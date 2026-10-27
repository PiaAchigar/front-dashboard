import { useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { can, type Role } from "../../lib/permissions";
import { ResourceManager, type Column } from "../../components/ResourceManager";
import { EntityDrawer } from "../../components/EntityDrawer";
import { Field, Select, TextArea, TextInput } from "../../components/form";
import { useToast } from "../../components/ui/Toast";
import { ChevronRight } from "../../components/icons";
import { contarDescendientes, filasVisibles, idsConHijas } from "../../lib/arbol-plano";
import type { CategoryNode } from "../../lib/api-types";
import {
  TODAS,
  areasDelArbol,
  areasPorCategoria,
  buscarEnArbol,
  filtrarPorArea,
  intercalarServicios,
  type Fila,
} from "../../lib/categorias-por-area";
import { AreasDeFila, FiltroDeAreas } from "../../components/PastillasDeArea";
import { useServicesAdmin } from "../../hooks/useServicesAdmin";
import {
  useArchiveCategory,
  useCategoriesAdmin,
  useCategoryDeleteImpact,
  useCreateCategory,
  useHardDeleteCategory,
  useRestoreCategory,
  useUpdateCategory,
} from "../../hooks/useCategoriesAdmin";

type FlatCat = {
  id: string;
  name: string | null;
  description: string | null;
  displayOrder: number | null;
  isActive: boolean | null;
  kind: string;
  depth: number;
  parentId: string | null;
};

function flatten(
  nodes: CategoryNode[],
  depth = 0,
  parentId: string | null = null,
  acc: FlatCat[] = [],
): FlatCat[] {
  for (const n of nodes) {
    acc.push({
      id: n.id,
      name: n.name,
      description: n.description,
      displayOrder: n.displayOrder,
      isActive: n.isActive,
      kind: n.kind,
      depth,
      parentId,
    });
    if (n.children?.length) flatten(n.children, depth + 1, n.id, acc);
  }
  return acc;
}

type Form = {
  name: string;
  description: string;
  parentCategoryId: string;
  displayOrder: string;
};
const EMPTY: Form = {
  name: "",
  description: "",
  parentCategoryId: "",
  displayOrder: "",
};

export function CategoriasAdminPage() {
  const { role } = useAuth();
  const r = role as Role | null;
  const canEdit = can(r, "catalogo", "edit");
  const canManage = can(r, "catalogo", "manage");
  const isAdmin = r === "admin";
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [area, setArea] = useState(TODAS);
  const [showArchived, setShowArchived] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<FlatCat | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [plegados, setPlegados] = useState<Set<string> | null>(null);
  // Las ramas plegadas. `null` significa "la usuaria todavía no tocó ninguna
  // flechita", y entonces vale el valor por defecto: el árbol plegado a sus
  // raíces. Guardar `null` en vez de sembrar el estado con las raíces evita
  // depender de CUÁNDO llegan los datos — el árbol viene de una consulta, así
  // que en el primer render `flat` está vacío y no hay raíces que plegar.

  const { data: tree = [], isLoading, error } = useCategoriesAdmin(showArchived);
  const { data: servicios = [] } = useServicesAdmin(false);
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const archive = useArchiveCategory();
  const restore = useRestoreCategory();
  const deleteImpact = useCategoryDeleteImpact();
  const hardDelete = useHardDeleteCategory();

  const flat = useMemo(() => flatten(tree), [tree]);
  const areas = useMemo(() => areasDelArbol(flat), [flat]);
  const mapa = useMemo(() => areasPorCategoria(flat, servicios, areas), [flat, servicios, areas]);
  // Los servicios cuelgan de sus categorías como filas más. En Archivados no:
  // ahí se buscan categorías archivadas, y los servicios activos ensuciarían.
  const todas = useMemo<Fila<FlatCat>[]>(
    () => intercalarServicios(flat, showArchived ? [] : servicios, areas),
    [flat, servicios, areas, showArchived],
  );
  const conHijas = useMemo(() => idsConHijas(todas), [todas]);
  // El número de una rama plegada cuenta subcategorías, no servicios: los
  // servicios ya se cuentan en las pastillas de la columna Áreas.
  const descendientes = useMemo(() => contarDescendientes(flat), [flat]);

  const plegadosEfectivos = useMemo(
    () => plegados ?? new Set(flat.filter((c) => c.parentId === null).map((c) => c.id)),
    [plegados, flat],
  );

  const buscando = search.trim() !== "";
  const delArea = useMemo(() => filtrarPorArea(todas, mapa, area), [todas, mapa, area]);

  // Las pastillas se prenden mirando TODO, no sólo el área elegida: si Laura
  // está en Estética y busca un masaje, la pastilla de Masajes le dice dónde.
  const busqueda = useMemo(
    () => (buscando ? buscarEnArbol(todas, mapa, search) : null),
    [buscando, todas, mapa, search],
  );

  const rows = useMemo(() => {
    // Buscando, el plegado se ignora: una coincidencia escondida adentro de una
    // rama cerrada haría que la búsqueda mienta y diga que no hay resultados.
    if (buscando) return buscarEnArbol(delArea, mapa, search).filas;
    return filasVisibles(delArea, plegadosEfectivos);
  }, [buscando, delArea, mapa, search, plegadosEfectivos]);

  function alternarPlegado(id: string) {
    const siguiente = new Set(plegadosEfectivos);
    if (siguiente.has(id)) siguiente.delete(id);
    else siguiente.add(id);
    setPlegados(siguiente);
  }

  const columns: Column<Fila<FlatCat>>[] = [
    {
      key: "name",
      header: "Nombre",
      width: 320,
      render: (c) => {
        if (c.tipo === "servicio") {
          const encontrado = busqueda?.coincidencias.has(c.id);
          return (
            <div className="flex items-center" style={{ paddingLeft: c.depth * 16 }}>
              <span className="mr-1 inline-block w-[22px] text-center text-ink-soft">·</span>
              <span
                className={`text-ink-soft ${encontrado ? "rounded bg-amber-100 px-1 font-medium text-ink" : ""}`}
              >
                {c.name ?? "—"}
              </span>
            </div>
          );
        }
        const tieneHijas = conHijas.has(c.id);
        const plegada = plegadosEfectivos.has(c.id);
        return (
          <div className="flex items-center" style={{ paddingLeft: c.depth * 16 }}>
            {tieneHijas && !buscando ? (
              <button
                type="button"
                aria-expanded={!plegada}
                aria-label={`${plegada ? "Desplegar" : "Plegar"} ${c.name ?? "la categoría"}`}
                onClick={() => alternarPlegado(c.id)}
                className="-ml-1 mr-1 rounded p-0.5 text-ink-soft transition-colors hover:bg-surface-high hover:text-ink"
              >
                {/* `rotate-90` escrita entera: Tailwind no compila una clase
                    armada en runtime y la flecha quedaría siempre igual. */}
                <ChevronRight
                  size={14}
                  className={`transition-transform ${plegada ? "" : "rotate-90"}`}
                />
              </button>
            ) : (
              // Reserva el ancho de la flechita para que los nombres de las
              // hojas queden alineados con los de sus hermanas con hijas.
              <span className="mr-1 inline-block w-[22px]" />
            )}
            <span className="font-medium text-ink">{c.name ?? "—"}</span>
            {tieneHijas && plegada && !buscando && (
              <span className="ml-2 rounded-full bg-surface-high px-2 py-0.5 text-xs text-ink-soft">
                {descendientes.get(c.id)}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "areas",
      header: "Áreas",
      width: 300,
      render: (c) => {
        if (c.tipo === "servicio") return <AreasDeFila areaIds={c.areaIds} areas={areas} />;
        if (c.kind === "area" && c.parentId === null)
          return <AreasDeFila areaIds={[c.id]} areas={areas} />;
        const suyas = mapa.get(c.id) ?? new Map<string, number>();
        return <AreasDeFila areaIds={[...suyas.keys()]} areas={areas} cantidades={suyas} />;
      },
    },
    {
      key: "desc",
      header: "Descripción",
      width: 300,
      render: (c) =>
        c.tipo === "servicio" ? null : (
          <span className="text-ink-soft">{c.description ?? "—"}</span>
        ),
    },
    {
      key: "order",
      header: "Orden",
      width: 90,
      render: (c) => (c.tipo === "servicio" ? null : (c.displayOrder ?? "—")),
    },
  ];

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setFormError(null);
    setDrawerOpen(true);
  }

  function openEdit(c: FlatCat) {
    setEditing(c);
    setForm({
      name: c.name ?? "",
      description: c.description ?? "",
      parentCategoryId: c.parentId ?? "",
      displayOrder: c.displayOrder?.toString() ?? "",
    });
    setFormError(null);
    setDrawerOpen(true);
  }

  function save() {
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      parentCategoryId: form.parentCategoryId || null,
      displayOrder: form.displayOrder.trim() === "" ? null : Number(form.displayOrder),
    };
    const handlers = {
      onSuccess: () => {
        toast.success(editing ? "Categoría actualizada" : "Categoría creada");
        setDrawerOpen(false);
      },
      onError: (e: Error) => setFormError(e.message),
    };
    if (editing) update.mutate({ id: editing.id, ...payload }, handlers);
    else create.mutate(payload, handlers);
  }

  const parentOptions = flat.filter((c) => c.id !== editing?.id);
  const saving = create.isPending || update.isPending;

  return (
    <>
      <ResourceManager<Fila<FlatCat>>
        title="Categorías"
        rows={rows}
        columns={columns}
        loading={isLoading}
        error={error ? (error as Error).message : null}
        avisoSuperior={
          <div className="space-y-2">
            <FiltroDeAreas
              areas={areas}
              elegida={area}
              prendidas={busqueda?.areasPrendidas ?? new Set()}
              onElegir={setArea}
            />
            {buscando ? null : (
              <div className="flex items-center gap-3 text-sm text-ink-soft">
                <span>
                  {rows.filter((f) => f.tipo === "categoria").length} de {flat.length} categorías a
                  la vista
                </span>
                <button
                  type="button"
                  onClick={() => setPlegados(new Set())}
                  className="font-medium text-primary hover:underline"
                >
                  Desplegar todo
                </button>
                <button
                  type="button"
                  onClick={() => setPlegados(new Set(conHijas))}
                  className="font-medium text-primary hover:underline"
                >
                  Plegar todo
                </button>
              </div>
            )}
          </div>
        }
        rowKey={(c) => c.id}
        isArchived={(c) => c.tipo === "categoria" && c.isActive === false}
        sinAcciones={(c) => c.tipo === "servicio"}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Buscar categoría o servicio…"
        showArchived={showArchived}
        onToggleArchived={setShowArchived}
        canCreate={canManage}
        canArchive={canManage}
        onAdd={openCreate}
        onEdit={canEdit ? (c) => c.tipo === "categoria" && openEdit(c) : undefined}
        archiving={archive.isPending}
        archiveName={(c) => c.name ?? "esta categoría"}
        onArchive={(c) =>
          archive.mutate(c.id, {
            onSuccess: () => toast.success("Categoría archivada"),
            onError: (e: Error) => toast.error(e.message),
          })
        }
        onRestore={(c) =>
          restore.mutate(c.id, {
            onSuccess: () => toast.success("Categoría restaurada"),
            onError: (e: Error) => toast.error(e.message),
          })
        }
        // Sólo sobre las archivadas, y sólo admin. Una categoría activa puede
        // estar en el menú del sitio público: borrarla lo cambiaría sin aviso.
        // El backend lo vuelve a chequear — esto es la conveniencia, no la
        // regla.
        canHardDelete={(c) => isAdmin && c.tipo === "categoria" && c.isActive === false}
        onHardDeletePreview={(c) => deleteImpact.mutateAsync(c.id)}
        hardDeleteName={(c) => c.name ?? "esta categoría"}
        onHardDelete={(c) =>
          hardDelete.mutate(c.id, {
            onSuccess: () => toast.success("Categoría eliminada definitivamente"),
            onError: (e: Error) => toast.error(e.message),
          })
        }
      />

      <EntityDrawer
        open={drawerOpen}
        title={editing ? "Editar categoría" : "Nueva categoría"}
        error={formError}
        busy={saving}
        canSubmit={form.name.trim().length >= 1}
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
        <Field label="Categoría padre">
          <Select
            value={form.parentCategoryId}
            onChange={(e) => setForm({ ...form, parentCategoryId: e.target.value })}
          >
            <option value="">— (categoría raíz)</option>
            {parentOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {" ".repeat(c.depth * 2)}
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Orden de aparición">
          <TextInput
            type="number"
            min={0}
            value={form.displayOrder}
            onChange={(e) => setForm({ ...form, displayOrder: e.target.value })}
            placeholder="—"
          />
        </Field>
      </EntityDrawer>
    </>
  );
}
