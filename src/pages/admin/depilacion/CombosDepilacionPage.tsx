import { useMemo, useState } from "react";
import { useAuth } from "../../../auth/AuthContext";
import { can, type Role } from "../../../lib/permissions";
import { ArmadorCombo, type ArmadorComboState } from "../../../components/depilacion/ArmadorCombo";
import { EntityDrawer } from "../../../components/EntityDrawer";
import { Checkbox, Field, TextArea, TextInput } from "../../../components/form";
import { ResourceManager, type Column } from "../../../components/ResourceManager";
import { useToast } from "../../../components/ui/Toast";
import { money } from "../../../lib/format";
import type { PackFijo, ZonaParaCotizar, Exclusion } from "../../../lib/depilation-pricing";
import type { ComboDepilacion } from "../../../lib/api-types";
import {
  useArchivarComboDepilacion,
  useComboDepilacionDeleteImpact,
  useCombosDepilacion,
  useDepilacionConfig,
  useGuardarComboDepilacion,
  useHardDeleteComboDepilacion,
  useZonas,
} from "../../../hooks/useDepilacion";

type Form = {
  name: string;
  description: string;
  isPublishedWeb: boolean;
  /** Solo se usa editando un pack fijo. Un combo guardado no tiene precio
   *  propio: el suyo sale siempre de la fórmula. */
  fixedPrice: string;
};

const EMPTY: Form = { name: "", description: "", isPublishedWeb: false, fixedPrice: "" };

/** "" es inválido (un pack fijo necesita precio). Acepta enteros >= 0 con
 *  puntos o espacios de miles ("65.000"); cualquier otra cosa devuelve null
 *  para que el llamador muestre el error sin llegar a la API. */
function parsePrecio(raw: string): number | null {
  const limpio = raw.trim().replace(/[.\s]/g, "");
  if (limpio === "" || !/^\d+$/.test(limpio)) return null;
  return Number(limpio);
}

export function CombosDepilacionPage() {
  const { role } = useAuth();
  const r = role as Role | null;
  const canEdit = can(r, "catalogo", "edit");
  const canManage = can(r, "catalogo", "manage");
  const toast = useToast();

  const isAdmin = r === "admin";

  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<ComboDepilacion | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [armadorState, setArmadorState] = useState<ArmadorComboState | null>(null);

  const { data: zonasData, isLoading: zonasLoading, error: zonasError } = useZonas();
  const { data: config, isLoading: configLoading, error: configError } = useDepilacionConfig();
  const { data: combos, isLoading: combosLoading, error: combosError } = useCombosDepilacion();
  const guardarCombo = useGuardarComboDepilacion();
  const archivarCombo = useArchivarComboDepilacion();
  const deleteImpact = useComboDepilacionDeleteImpact();
  const hardDelete = useHardDeleteComboDepilacion();

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

  // El filtro activos/archivados lo hace ResourceManager; acá solo el
  // buscador, que mira el nombre del combo y también el de sus zonas: buscar
  // "Axila" tiene que traer los combos que la incluyen.
  const combosVisibles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q === "") return combos ?? [];
    return (combos ?? []).filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.zonas.some((z) => z.name.toLowerCase().includes(q)),
    );
  }, [combos, search]);

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
      fixedPrice: c.fixedPrice != null ? String(c.fixedPrice) : "",
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
    // Un pack fijo sembrado se puede editar, pero sigue siendo pack fijo: el
    // backend rechaza cambiarle el kind o dejarlo sin precio. Crear, en
    // cambio, siempre crea un guardado.
    const esPackFijo = editing?.kind === "pack_fijo";
    let fixedPrice: number | null = null;
    if (esPackFijo) {
      const parsed = parsePrecio(form.fixedPrice);
      if (parsed === null) {
        setFormError("El precio del pack tiene que ser un número entero mayor o igual a 0.");
        return;
      }
      fixedPrice = parsed;
    }

    try {
      await guardarCombo.mutateAsync({
        id: editing?.id,
        name: form.name.trim(),
        description: form.description.trim() || null,
        isPublishedWeb: form.isPublishedWeb,
        displayOrder: editing?.displayOrder ?? 0,
        zonaIds,
        kind: esPackFijo ? "pack_fijo" : "guardado",
        fixedPrice: esPackFijo ? fixedPrice : undefined,
        choiceZoneCount: esPackFijo ? editing.choiceZoneCount : 0,
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

  const COLUMNAS: Column<ComboDepilacion>[] = useMemo(
    () => [
      {
        key: "nombre",
        header: "Nombre",
        width: 260,
        render: (c) => {
          // Un pack fijo cuyo precio quedó por encima de su propia fórmula
          // dejó de ser un descuento: quien lo edite tiene que verlo acá, no
          // descubrirlo cobrando.
          const excedeFormula =
            c.kind === "pack_fijo" && c.fixedPrice != null && c.fixedPrice > c.precioCalculado;
          return (
            <div>
              <p className="truncate">{c.name}</p>
              <p className="text-xs text-ink-soft">
                {c.kind === "pack_fijo" ? "Pack fijo" : "Guardado"}
                {c.choiceZoneCount > 0 && ` · +${c.choiceZoneCount} a elección`}
              </p>
              {excedeFormula && (
                <p className="mt-1 whitespace-normal text-xs text-amber-800">
                  ⚠ Este precio fijo ({money(c.fixedPrice)}) es mayor a lo que da la fórmula (
                  {money(c.precioCalculado)}): dejó de ser un descuento.
                </p>
              )}
            </div>
          );
        },
      },
      {
        key: "zonas",
        header: "Zonas",
        width: 340,
        render: (c) => c.zonas.map((z) => z.name).join(", "),
      },
      {
        key: "precio",
        header: "Precio",
        width: 120,
        className: "text-right",
        render: (c) => money(c.precioFinal),
      },
      {
        key: "turno",
        header: "Turno",
        width: 100,
        className: "text-right",
        render: (c) => `${c.duracionMinutos} min`,
      },
      {
        key: "web",
        header: "Web",
        width: 80,
        render: (c) => (c.isPublishedWeb ? "Sí" : "No"),
      },
    ],
    [],
  );

  return (
    <>
      <ResourceManager
        title="Combos"
        rows={combosVisibles}
        columns={COLUMNAS}
        loading={loading}
        error={error ? (error as Error).message : null}
        rowKey={(c) => c.id}
        isArchived={(c) => !c.isActive}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Buscar por nombre del combo o de una zona…"
        showArchived={showArchived}
        onToggleArchived={setShowArchived}
        canCreate={canManage && !loading && !error}
        canArchive={canManage}
        onAdd={openCreate}
        onEdit={canEdit ? openEdit : undefined}
        archiving={archivarCombo.isPending}
        archiveName={(c) => c.name}
        onArchive={(c) =>
          archivarCombo.mutate(
            { id: c.id, isActive: false },
            {
              onSuccess: () => toast.success("Combo archivado"),
              onError: (e: Error) => toast.error(e.message),
            },
          )
        }
        onRestore={(c) =>
          archivarCombo.mutate(
            { id: c.id, isActive: true },
            {
              onSuccess: () => toast.success("Combo restaurado"),
              onError: (e: Error) => toast.error(e.message),
            },
          )
        }
        canHardDelete={isAdmin}
        onHardDeletePreview={(c) => deleteImpact.mutateAsync(c.id)}
        hardDeleteName={(c) => c.name}
        onHardDelete={(c) =>
          hardDelete.mutate(c.id, {
            onSuccess: () => toast.success("Combo eliminado definitivamente"),
            onError: (e: Error) => toast.error(e.message),
          })
        }
      />

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
        {editing?.kind === "pack_fijo" && (
          // El texto de ayuda va FUERA del Field: `Field` envuelve a sus
          // hijos en un <label>, así que todo lo que entre ahí se pega al
          // nombre accesible del campo.
          <div>
            <Field label="Precio del pack *">
              <TextInput
                inputMode="numeric"
                value={form.fixedPrice}
                onChange={(e) => setForm({ ...form, fixedPrice: e.target.value })}
                placeholder="65000"
              />
            </Field>
            <p className="mt-1 text-xs text-ink-soft">
              Este pack se cobra a este precio, no al que da la fórmula. Tiene que quedar por
              debajo de la fórmula para seguir siendo un descuento.
            </p>
          </div>
        )}

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

    </>
  );
}
