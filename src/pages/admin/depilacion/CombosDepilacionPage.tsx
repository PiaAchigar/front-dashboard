import { useMemo, useState } from "react";
import { useAuth } from "../../../auth/AuthContext";
import { can, type Role } from "../../../lib/permissions";
import { ArmadorCombo, type ArmadorComboState } from "../../../components/depilacion/ArmadorCombo";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { EntityDrawer } from "../../../components/EntityDrawer";
import { Checkbox, Field, TextArea, TextInput } from "../../../components/form";
import { Archive, Pencil, Plus, RotateCcw } from "../../../components/icons";
import { useToast } from "../../../components/ui/Toast";
import { money } from "../../../lib/format";
import type { PackFijo, ZonaParaCotizar, Exclusion } from "../../../lib/depilation-pricing";
import type { ComboDepilacion } from "../../../lib/api-types";
import {
  useArchivarComboDepilacion,
  useCombosDepilacion,
  useDepilacionConfig,
  useGuardarComboDepilacion,
  useZonas,
} from "../../../hooks/useDepilacion";

type Form = {
  name: string;
  description: string;
  isPublishedWeb: boolean;
};

const EMPTY: Form = { name: "", description: "", isPublishedWeb: false };

export function CombosDepilacionPage() {
  const { role } = useAuth();
  const r = role as Role | null;
  const canEdit = can(r, "catalogo", "edit");
  const canManage = can(r, "catalogo", "manage");
  const toast = useToast();

  const [showArchived, setShowArchived] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<ComboDepilacion | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [armadorState, setArmadorState] = useState<ArmadorComboState | null>(null);
  const [toArchive, setToArchive] = useState<ComboDepilacion | null>(null);

  const { data: zonasData, isLoading: zonasLoading, error: zonasError } = useZonas();
  const { data: config, isLoading: configLoading, error: configError } = useDepilacionConfig();
  const { data: combos, isLoading: combosLoading, error: combosError } = useCombosDepilacion();
  const guardarCombo = useGuardarComboDepilacion();
  const archivarCombo = useArchivarComboDepilacion();

  // El armador solo ofrece zonas activas: una zona archivada no se puede
  // sumar a un combo nuevo, aunque siga viva en combos ya guardados.
  const zonasActivas: ZonaParaCotizar[] = useMemo(() => {
    if (!zonasData) return [];
    const todas = [...zonasData.grande, ...zonasData.mediana, ...zonasData.chica];
    return todas
      .filter((z) => z.isActive)
      .map((z) => ({ id: z.id, nombre: z.name, categoria: z.category }));
  }, [zonasData]);

  // El backend guarda `exclusions` colgado de cada zona (y ya escribe las dos
  // direcciones del par al guardar) — acá solo se aplana a la forma de pares
  // que pide `zonasBloqueadas`.
  const exclusiones: Exclusion[] = useMemo(() => {
    if (!zonasData) return [];
    const todas = [...zonasData.grande, ...zonasData.mediana, ...zonasData.chica];
    const pares: Exclusion[] = [];
    for (const z of todas) {
      for (const excluyeA of z.exclusions) pares.push({ zonaId: z.id, excluyeA });
    }
    return pares;
  }, [zonasData]);

  // Los packs fijos activos, en la forma que pide `buscarPackFijo`.
  const packs: PackFijo[] = useMemo(() => {
    if (!combos) return [];
    return combos
      .filter((c) => c.kind === "pack_fijo" && c.isActive)
      .map((c) => ({
        id: c.id,
        nombre: c.name,
        zonasBase: c.zonas.map((z) => z.id),
        zonasAEleccion: c.choiceZoneCount,
        precioFijo: c.fixedPrice ?? c.precioFinal,
        duracionFija: c.fixedDurationMinutes,
      }));
  }, [combos]);

  const combosVisibles = useMemo(
    () => (combos ?? []).filter((c) => c.isActive === !showArchived),
    [combos, showArchived],
  );

  // Zonas que el combo en edición ya incluye pero que ya no están activas.
  // `ArmadorCombo` las necesita para mostrarlas por nombre, seguir
  // cotizándolas mientras sigan tildadas y dejar que se destilden — si no se
  // le pasan, esas zonas desaparecen del cálculo en silencio y, si se guarda
  // sin sacarlas, el backend rechaza el PATCH con un 400 sobre un uuid que
  // nadie puede ubicar en la pantalla.
  const zonasArchivadasDelCombo: ZonaParaCotizar[] = useMemo(() => {
    if (!editing) return [];
    const activasIds = new Set(zonasActivas.map((z) => z.id));
    return editing.zonas
      .filter((z) => !activasIds.has(z.id))
      .map((z) => ({ id: z.id, nombre: z.name, categoria: z.category }));
  }, [editing, zonasActivas]);

  // Mientras quede una zona archivada tildada, no se deja guardar: es más
  // claro que el admin la saque acá a que el PATCH vuelva con un 400 sobre un
  // uuid sin nombre.
  const tieneZonaArchivadaSeleccionada = useMemo(() => {
    if (zonasArchivadasDelCombo.length === 0 || !armadorState) return false;
    const archivadasIds = new Set(zonasArchivadasDelCombo.map((z) => z.id));
    return armadorState.zonaIds.some((id) => archivadasIds.has(id));
  }, [zonasArchivadasDelCombo, armadorState]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setFormError(null);
    setArmadorState(null);
    setDrawerOpen(true);
  }

  function openEdit(c: ComboDepilacion) {
    setEditing(c);
    setForm({
      name: c.name,
      description: c.description ?? "",
      isPublishedWeb: c.isPublishedWeb,
    });
    setFormError(null);
    setArmadorState(null);
    setDrawerOpen(true);
  }

  async function save() {
    setFormError(null);
    const zonaIds = armadorState?.zonaIds ?? [];
    if (zonaIds.length === 0) {
      setFormError("El combo tiene que incluir al menos una zona.");
      return;
    }
    try {
      await guardarCombo.mutateAsync({
        id: editing?.id,
        name: form.name.trim(),
        description: form.description.trim() || null,
        isPublishedWeb: form.isPublishedWeb,
        displayOrder: editing?.displayOrder ?? 0,
        zonaIds,
      });
      toast.success(editing ? "Combo actualizado" : "Combo creado");
      setDrawerOpen(false);
    } catch (e) {
      setFormError((e as Error).message);
    }
  }

  const saving = guardarCombo.isPending;
  const puedeGuardar = form.name.trim().length >= 1 && !tieneZonaArchivadaSeleccionada;
  const loading = zonasLoading || configLoading || combosLoading;
  const error = zonasError ?? configError ?? combosError;

  return (
    <>
      <div className="flex h-full flex-col gap-4 overflow-auto p-2 pl-4 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl text-ink">Combos</h2>
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-surface-highest text-sm">
              {[
                { v: false, label: "Activos" },
                { v: true, label: "Archivados" },
              ].map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => setShowArchived(opt.v)}
                  className={`px-3 py-2 transition-colors ${
                    showArchived === opt.v
                      ? "bg-primary font-medium text-white"
                      : "bg-white text-ink-soft hover:bg-surface-high"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {canManage && (
              <button
                onClick={openCreate}
                disabled={loading || !!error}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
              >
                <Plus size={16} />
                Nuevo combo
              </button>
            )}
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {(error as Error).message}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-ink-soft">Cargando…</p>
        ) : (
          <div className="modal-scroll overflow-auto rounded-xl border border-surface-high">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-ink-soft">
                <tr>
                  <th className="border-b border-surface-highest bg-surface-high px-4 py-2.5 text-left font-medium">
                    Nombre
                  </th>
                  <th className="border-b border-surface-highest bg-surface-high px-4 py-2.5 text-left font-medium">
                    Zonas
                  </th>
                  <th className="border-b border-surface-highest bg-surface-high px-4 py-2.5 text-right font-medium">
                    Precio
                  </th>
                  <th className="border-b border-surface-highest bg-surface-high px-4 py-2.5 text-right font-medium">
                    Turno
                  </th>
                  <th className="border-b border-surface-highest bg-surface-high px-4 py-2.5 text-left font-medium">
                    Web
                  </th>
                  <th className="border-b border-surface-highest bg-surface-high px-4 py-2.5 text-right font-medium">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-high">
                {combosVisibles.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-ink-soft">
                      {showArchived ? "No hay combos archivados." : "No hay combos cargados."}
                    </td>
                  </tr>
                ) : (
                  combosVisibles.map((c) => {
                    const excedeFormula =
                      c.kind === "pack_fijo" && c.fixedPrice != null && c.fixedPrice > c.precioCalculado;
                    return (
                      <tr key={c.id} className={c.isActive ? "" : "opacity-60"}>
                        <td className="px-4 py-2.5 align-top text-ink">
                          <p>{c.name}</p>
                          <p className="text-xs text-ink-soft">
                            {c.kind === "pack_fijo" ? "Pack fijo" : "Guardado"}
                            {c.choiceZoneCount > 0 && ` · +${c.choiceZoneCount} a elección`}
                          </p>
                          {excedeFormula && (
                            <p className="mt-1 text-xs text-amber-800">
                              ⚠ Este precio fijo ({money(c.fixedPrice)}) es mayor a lo que da la
                              fórmula ({money(c.precioCalculado)}): dejó de ser un descuento.
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-2.5 align-top text-ink-soft">
                          {c.zonas.map((z) => z.name).join(", ")}
                        </td>
                        <td className="px-4 py-2.5 align-top text-right text-ink">
                          {money(c.precioFinal)}
                        </td>
                        <td className="px-4 py-2.5 align-top text-right text-ink-soft">
                          {c.duracionMinutos} min
                        </td>
                        <td className="px-4 py-2.5 align-top text-ink-soft">
                          {c.isPublishedWeb ? "Sí" : "No"}
                        </td>
                        <td className="px-4 py-2.5 align-top">
                          <div className="flex justify-end gap-1">
                            {canEdit && c.isActive && c.kind === "guardado" && (
                              <button
                                onClick={() => openEdit(c)}
                                title="Editar"
                                className="rounded p-1.5 text-ink-soft transition-colors hover:bg-surface-high hover:text-primary"
                              >
                                <Pencil size={16} />
                              </button>
                            )}
                            {canManage && c.isActive && (
                              <button
                                onClick={() => setToArchive(c)}
                                title="Archivar"
                                className="rounded p-1.5 text-ink-soft transition-colors hover:bg-surface-high hover:text-red-700"
                              >
                                <Archive size={16} />
                              </button>
                            )}
                            {canManage && !c.isActive && (
                              <button
                                onClick={() =>
                                  archivarCombo.mutate(
                                    { id: c.id, isActive: true },
                                    {
                                      onSuccess: () => toast.success("Combo restaurado"),
                                      onError: (e: Error) => toast.error(e.message),
                                    },
                                  )
                                }
                                title="Restaurar"
                                className="rounded p-1.5 text-ink-soft transition-colors hover:bg-surface-high hover:text-primary"
                              >
                                <RotateCcw size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <EntityDrawer
        open={drawerOpen}
        title={editing ? "Editar combo" : "Nuevo combo"}
        error={formError}
        busy={saving}
        canSubmit={puedeGuardar}
        widthClass="max-w-4xl"
        onSubmit={save}
        onClose={() => setDrawerOpen(false)}
      >
        <Field label="Nombre *">
          <TextInput
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            autoFocus
          />
        </Field>
        <Field label="Descripción">
          <TextArea
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
        <Checkbox
          label="Publicar en la web"
          checked={form.isPublishedWeb}
          onChange={(v) => setForm({ ...form, isPublishedWeb: v })}
        />

        {tieneZonaArchivadaSeleccionada && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Este combo tiene una zona archivada tildada (marcada abajo). Sacala para poder
            guardar.
          </p>
        )}

        {config && (
          <ArmadorCombo
            zonas={zonasActivas}
            zonasArchivadasIncluidas={zonasArchivadasDelCombo}
            exclusiones={exclusiones}
            config={config}
            packs={packs}
            zonaIdsIniciales={editing ? editing.zonas.map((z) => z.id) : undefined}
            onCambio={setArmadorState}
          />
        )}
      </EntityDrawer>

      <ConfirmDialog
        open={Boolean(toArchive)}
        title="Archivar"
        danger
        confirmLabel="Archivar"
        busy={archivarCombo.isPending}
        message={
          <>
            ¿Seguro que querés archivar {toArchive ? `"${toArchive.name}"` : "este combo"}? No se
            elimina: queda inactivo y podés restaurarlo después.
          </>
        }
        onCancel={() => setToArchive(null)}
        onConfirm={() => {
          if (toArchive) {
            archivarCombo.mutate(
              { id: toArchive.id, isActive: false },
              {
                onSuccess: () => toast.success("Combo archivado"),
                onError: (e: Error) => toast.error(e.message),
              },
            );
          }
          setToArchive(null);
        }}
      />
    </>
  );
}
