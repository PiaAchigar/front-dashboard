import { useMemo, useState } from "react";
import { useAuth } from "../../../auth/AuthContext";
import { can, type Role } from "../../../lib/permissions";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { EntityDrawer } from "../../../components/EntityDrawer";
import { Checkbox, Field, Select, TextInput } from "../../../components/form";
import { Archive, Pencil, Plus, RotateCcw } from "../../../components/icons";
import { useToast } from "../../../components/ui/Toast";
import {
  useArchivarZona,
  useGuardarExclusiones,
  useGuardarZona,
  useZonas,
} from "../../../hooks/useDepilacion";
import type { ZonaCategoria, ZonaDepilacion } from "../../../lib/api-types";

const CATEGORIAS: { key: ZonaCategoria; label: string }[] = [
  { key: "grande", label: "Grande" },
  { key: "mediana", label: "Mediana" },
  { key: "chica", label: "Chica" },
];

type Form = {
  name: string;
  category: ZonaCategoria;
  displayOrder: string;
  excludes: string[];
};

const EMPTY: Form = { name: "", category: "grande", displayOrder: "0", excludes: [] };

export function ZonasPage() {
  const { role } = useAuth();
  const r = role as Role | null;
  const canEdit = can(r, "catalogo", "edit");
  const canManage = can(r, "catalogo", "manage");
  const toast = useToast();

  const [showArchived, setShowArchived] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<ZonaDepilacion | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [toArchive, setToArchive] = useState<ZonaDepilacion | null>(null);

  const { data, isLoading, error } = useZonas();
  const guardarZona = useGuardarZona();
  const archivarZona = useArchivarZona();
  const guardarExclusiones = useGuardarExclusiones();

  // Todas las zonas juntas (las tres categorías), para el mapa de nombres y
  // para el selector de exclusiones del formulario.
  const todas = useMemo(
    () => (data ? [...data.grande, ...data.mediana, ...data.chica] : []),
    [data],
  );
  const nombrePorId = useMemo(() => {
    const m = new Map<string, string>();
    for (const z of todas) m.set(z.id, z.name);
    return m;
  }, [todas]);

  // Zonas activas que se pueden elegir como exclusión: todas menos la que se
  // está editando (una zona no puede excluirse a sí misma).
  const zonasParaExcluir = useMemo(
    () => todas.filter((z) => z.isActive && z.id !== editing?.id),
    [todas, editing],
  );

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setFormError(null);
    setDrawerOpen(true);
  }

  function openEdit(z: ZonaDepilacion) {
    setEditing(z);
    setForm({
      name: z.name,
      category: z.category,
      displayOrder: z.displayOrder != null ? String(z.displayOrder) : "0",
      excludes: [...z.exclusions],
    });
    setFormError(null);
    setDrawerOpen(true);
  }

  function toggleExclude(id: string) {
    setForm((f) => ({
      ...f,
      excludes: f.excludes.includes(id)
        ? f.excludes.filter((x) => x !== id)
        : [...f.excludes, id],
    }));
  }

  async function save() {
    setFormError(null);
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        displayOrder: form.displayOrder.trim() === "" ? 0 : Number(form.displayOrder),
      };
      const saved = await guardarZona.mutateAsync(
        editing ? { id: editing.id, ...payload } : payload,
      );
      const id = editing ? editing.id : (saved as ZonaDepilacion).id;
      await guardarExclusiones.mutateAsync({ id, excludes: form.excludes });
      toast.success(editing ? "Zona actualizada" : "Zona creada");
      setDrawerOpen(false);
    } catch (e) {
      setFormError((e as Error).message);
    }
  }

  const saving = guardarZona.isPending || guardarExclusiones.isPending;
  const puedeGuardar = form.name.trim().length >= 1;

  return (
    <>
      <div className="flex h-full flex-col gap-4 overflow-auto p-2 pl-4 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl text-ink">Zonas</h2>
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-surface-highest text-sm">
              {[
                { v: false, label: "Activos" },
                { v: true, label: "Archivadas" },
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
            {canEdit && (
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
              >
                <Plus size={16} />
                Agregar
              </button>
            )}
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {(error as Error).message}
          </p>
        )}

        {isLoading ? (
          <p className="text-sm text-ink-soft">Cargando…</p>
        ) : (
          CATEGORIAS.map((cat) => {
            const zonas = (data?.[cat.key] ?? []).filter((z) => z.isActive === !showArchived);
            return (
              <div key={cat.key} className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <h3 className="font-display text-base text-ink">{cat.label}</h3>
                  <span className="text-xs text-ink-soft">
                    {zonas.length} {zonas.length === 1 ? "zona" : "zonas"}
                  </span>
                </div>
                <div className="modal-scroll overflow-auto rounded-xl border border-surface-high">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase tracking-wider text-ink-soft">
                      <tr>
                        <th className="border-b border-surface-highest bg-surface-high px-4 py-2.5 text-left font-medium">
                          Nombre
                        </th>
                        <th className="border-b border-surface-highest bg-surface-high px-4 py-2.5 text-left font-medium">
                          Exclusiones
                        </th>
                        <th className="border-b border-surface-highest bg-surface-high px-4 py-2.5 text-right font-medium">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-high">
                      {zonas.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-6 text-center text-ink-soft">
                            {showArchived
                              ? "No hay zonas archivadas en esta categoría."
                              : "No hay zonas en esta categoría."}
                          </td>
                        </tr>
                      ) : (
                        zonas.map((z) => (
                          <tr key={z.id} className={z.isActive ? "" : "opacity-60"}>
                            <td className="px-4 py-2.5 text-ink">{z.name}</td>
                            <td className="px-4 py-2.5 text-ink-soft">
                              {z.exclusions.length === 0
                                ? "—"
                                : `No se combina con ${z.exclusions
                                    .map((id) => nombrePorId.get(id) ?? id)
                                    .join(", ")}`}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex justify-end gap-1">
                                {canEdit && z.isActive && (
                                  <button
                                    onClick={() => openEdit(z)}
                                    title="Editar"
                                    className="rounded p-1.5 text-ink-soft transition-colors hover:bg-surface-high hover:text-primary"
                                  >
                                    <Pencil size={16} />
                                  </button>
                                )}
                                {canManage && z.isActive && (
                                  <button
                                    onClick={() => setToArchive(z)}
                                    title="Archivar"
                                    className="rounded p-1.5 text-ink-soft transition-colors hover:bg-surface-high hover:text-red-700"
                                  >
                                    <Archive size={16} />
                                  </button>
                                )}
                                {canManage && !z.isActive && (
                                  <button
                                    onClick={() =>
                                      archivarZona.mutate(
                                        { id: z.id, isActive: true },
                                        {
                                          onSuccess: () => toast.success("Zona restaurada"),
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
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </div>

      <EntityDrawer
        open={drawerOpen}
        title={editing ? "Editar zona" : "Nueva zona"}
        error={formError}
        busy={saving}
        canSubmit={puedeGuardar}
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

        <div className="flex gap-3">
          <Field label="Categoría *">
            <Select
              value={form.category}
              onChange={(e) =>
                setForm({ ...form, category: e.target.value as ZonaCategoria })
              }
            >
              {CATEGORIAS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Orden">
            <TextInput
              inputMode="numeric"
              value={form.displayOrder}
              onChange={(e) => setForm({ ...form, displayOrder: e.target.value })}
              placeholder="0"
            />
          </Field>
        </div>

        <div className="space-y-2 rounded-xl border border-surface-high p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            No se combina con
          </p>
          {zonasParaExcluir.length === 0 ? (
            <p className="text-sm text-ink-soft">No hay otras zonas activas.</p>
          ) : (
            <div className="max-h-56 space-y-2 overflow-y-auto">
              {CATEGORIAS.map((cat) => {
                const zonas = zonasParaExcluir.filter((z) => z.category === cat.key);
                if (zonas.length === 0) return null;
                return (
                  <div key={cat.key}>
                    <p className="text-xs font-medium text-ink-soft">{cat.label}</p>
                    <div className="mt-0.5 space-y-0.5 pl-1">
                      {zonas.map((z) => (
                        <Checkbox
                          key={z.id}
                          label={z.name}
                          checked={form.excludes.includes(z.id)}
                          onChange={() => toggleExclude(z.id)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </EntityDrawer>

      <ConfirmDialog
        open={Boolean(toArchive)}
        title="Archivar"
        danger
        confirmLabel="Archivar"
        busy={archivarZona.isPending}
        message={
          <>
            ¿Seguro que querés archivar {toArchive ? `"${toArchive.name}"` : "esta zona"}? No se
            elimina: queda inactiva y podés restaurarla después.
          </>
        }
        onCancel={() => setToArchive(null)}
        onConfirm={() => {
          if (toArchive) {
            archivarZona.mutate(
              { id: toArchive.id, isActive: false },
              {
                onSuccess: () => toast.success("Zona archivada"),
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
