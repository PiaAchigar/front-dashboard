import { useMemo, useState } from "react";
import { useAuth } from "../../../auth/AuthContext";
import { can, type Role } from "../../../lib/permissions";
import { EntityDrawer } from "../../../components/EntityDrawer";
import { Checkbox, Field, Select, TextInput } from "../../../components/form";
import { ResourceManager, type Column, type Group } from "../../../components/ResourceManager";
import { useToast } from "../../../components/ui/Toast";
import {
  useArchivarZona,
  useGuardarExclusiones,
  useGuardarZona,
  useHardDeleteZona,
  useZonaDeleteImpact,
  useZonas,
} from "../../../hooks/useDepilacion";
import type { ZonaCategoria, ZonaDepilacion } from "../../../lib/api-types";

const CATEGORIAS: { key: ZonaCategoria; label: string }[] = [
  { key: "grande", label: "Grande" },
  { key: "mediana", label: "Mediana" },
  { key: "chica", label: "Chica" },
];

// Las tres secciones colapsables de la tabla, en el orden en que se muestran:
// de zona más grande a más chica, igual que la lista de precios.
const GRUPOS: Group[] = CATEGORIAS.map((c) => ({ key: c.key, label: c.label }));

type Form = {
  name: string;
  category: ZonaCategoria;
  displayOrder: string;
  excludes: string[];
};

const EMPTY: Form = { name: "", category: "grande", displayOrder: "0", excludes: [] };

/** "" cuenta como 0. Cualquier otra cosa debe ser un entero >= 0 (sin signo,
 *  sin decimales); si no, devuelve null para que el llamador muestre el error. */
function parseDisplayOrder(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return 0;
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

export function ZonasPage() {
  const { role } = useAuth();
  const r = role as Role | null;
  const canEdit = can(r, "catalogo", "edit");
  const canManage = can(r, "catalogo", "manage");
  const toast = useToast();

  const isAdmin = r === "admin";

  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<ZonaDepilacion | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, error } = useZonas();
  const guardarZona = useGuardarZona();
  const archivarZona = useArchivarZona();
  const guardarExclusiones = useGuardarExclusiones();
  const deleteImpact = useZonaDeleteImpact();
  const hardDelete = useHardDeleteZona();

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
    const displayOrder = parseDisplayOrder(form.displayOrder);
    if (displayOrder === null) {
      setFormError("El orden debe ser un número entero mayor o igual a 0.");
      return;
    }
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        displayOrder,
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

  // El buscador filtra por nombre de la zona y también por el de sus
  // exclusiones: buscar "Pierna entera" tiene que traer "Media pierna", que es
  // justo la zona con la que no se combina.
  const filtradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q === "") return todas;
    return todas.filter(
      (z) =>
        z.name.toLowerCase().includes(q) ||
        z.exclusions.some((id) => (nombrePorId.get(id) ?? "").toLowerCase().includes(q)),
    );
  }, [todas, search, nombrePorId]);

  const COLUMNAS: Column<ZonaDepilacion>[] = useMemo(
    () => [
      { key: "nombre", header: "Nombre", render: (z) => z.name, width: 260 },
      {
        key: "exclusiones",
        header: "No se combina con",
        render: (z) =>
          z.exclusions.length === 0
            ? "—"
            : z.exclusions.map((id) => nombrePorId.get(id) ?? id).join(", "),
        width: 420,
      },
    ],
    [nombrePorId],
  );

  const saving = guardarZona.isPending || guardarExclusiones.isPending;
  const puedeGuardar = form.name.trim().length >= 1;

  return (
    <>
      <ResourceManager
        title="Zonas"
        rows={filtradas}
        columns={COLUMNAS}
        loading={isLoading}
        error={error ? (error as Error).message : null}
        rowKey={(z) => z.id}
        isArchived={(z) => !z.isActive}
        groups={GRUPOS}
        groupOf={(z) => z.category}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Buscar zona por nombre…"
        showArchived={showArchived}
        onToggleArchived={setShowArchived}
        canCreate={canManage}
        canArchive={canManage}
        onAdd={openCreate}
        onEdit={canEdit ? openEdit : undefined}
        archiving={archivarZona.isPending}
        archiveName={(z) => z.name}
        onArchive={(z) =>
          archivarZona.mutate(
            { id: z.id, isActive: false },
            {
              onSuccess: () => toast.success("Zona archivada"),
              onError: (e: Error) => toast.error(e.message),
            },
          )
        }
        onRestore={(z) =>
          archivarZona.mutate(
            { id: z.id, isActive: true },
            {
              onSuccess: () => toast.success("Zona restaurada"),
              onError: (e: Error) => toast.error(e.message),
            },
          )
        }
        canHardDelete={isAdmin}
        onHardDeletePreview={(z) => deleteImpact.mutateAsync(z.id)}
        hardDeleteName={(z) => z.name}
        onHardDelete={(z) =>
          hardDelete.mutate(z.id, {
            onSuccess: () => toast.success("Zona eliminada definitivamente"),
            onError: (e: Error) => toast.error(e.message),
          })
        }
      />

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
          <Field label="Orden" help="Posición en la lista: el número más chico va primero. Ordena solo dentro de su categoría (una zona chica nunca sube al grupo de las grandes). Si dos tienen el mismo número, se ordenan alfabéticamente — por eso con todo en 0 la lista queda alfabética. Conviene numerar de 10 en 10 (10, 20, 30) para poder meter una zona en el medio sin renumerar el resto.">
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

    </>
  );
}
