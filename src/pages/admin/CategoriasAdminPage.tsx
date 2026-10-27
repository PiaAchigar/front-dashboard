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
  SIN_AREA,
  TODAS,
  areasDelArbol,
  areasPorCategoria,
  areasPrendidas,
  arbolDelArea,
  categoriasVacias,
  resultadosPlanos,
} from "../../lib/categorias-por-area";
import { AreasDeFila, FiltroDeAreas } from "../../components/PastillasDeArea";
import { useServicesAdmin } from "../../hooks/useServicesAdmin";
import { ServiciosDeCategoria } from "./ServiciosDeCategoria";
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

/**
 * Una fila de la tabla. Sin búsqueda es el árbol de categorías; buscando o en
 * "Sin área" es una lista plana de categorías y servicios, cada uno con su
 * camino escrito (`camino` deja de ser null).
 */
type Fila =
  | (FlatCat & { tipo: "categoria"; camino: string | null })
  | {
      tipo: "servicio";
      id: string;
      name: string | null;
      camino: string;
      areaIds: string[];
      /** La categoría cuyo panel se abre al tocar el servicio. */
      categoriaId: string | null;
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

type Form = { name: string; description: string; parentCategoryId: string; displayOrder: string };
const EMPTY: Form = { name: "", description: "", parentCategoryId: "", displayOrder: "" };

function subcategorias(n: number): string {
  return n === 1 ? "1 subcategoría" : `${n} subcategorías`;
}

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
  const [abierta, setAbierta] = useState<string | null>(null);
  // `useState` y no `useRef` para el hueco del botón Agregar: el portal
  // necesita volver a dibujarse cuando el nodo existe (igual que AreaLayout).
  const [slotAcciones, setSlotAcciones] = useState<HTMLElement | null>(null);

  const { data: tree = [], isLoading, error } = useCategoriesAdmin(showArchived);
  const { data: todosLosServicios = [] } = useServicesAdmin(false);
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const archive = useArchiveCategory();
  const restore = useRestoreCategory();
  const deleteImpact = useCategoryDeleteImpact();
  const hardDelete = useHardDeleteCategory();

  // En Archivados se buscan categorías archivadas: los servicios activos
  // ensuciarían la lista, y las pastillas no aplican.
  const servicios = showArchived ? [] : todosLosServicios;
  const flat = useMemo(() => flatten(tree), [tree]);
  const areas = useMemo(() => areasDelArbol(flat), [flat]);
  const idsDeArea = useMemo(() => new Set(areas.map((a) => a.id)), [areas]);
  const mapa = useMemo(() => areasPorCategoria(flat, servicios, areas), [flat, servicios, areas]);
  const vacias = useMemo(() => categoriasVacias(flat, servicios), [flat, servicios]);
  const conHijas = useMemo(() => idsConHijas(flat), [flat]);
  const descendientes = useMemo(() => contarDescendientes(flat), [flat]);

  const plegadosEfectivos = useMemo(
    () => plegados ?? new Set(flat.filter((c) => c.parentId === null).map((c) => c.id)),
    [plegados, flat],
  );

  const buscando = search.trim() !== "";
  // Plana cuando hay búsqueda o en Sin área: el árbol arrastraba a las madres
  // (que sí tienen área) y mostraba pastillas de área en "Sin área".
  const plana = buscando || area === SIN_AREA;

  const prendidas = useMemo(
    () => areasPrendidas(flat, servicios, mapa, areas, search),
    [flat, servicios, mapa, areas, search],
  );

  const rows = useMemo<Fila[]>(() => {
    if (plana) {
      const porId = new Map(flat.map((c) => [c.id, c]));
      return resultadosPlanos(flat, servicios, mapa, areas, { filtro: area, texto: search }).map(
        (f): Fila => {
          if (f.tipo === "categoria")
            return { ...porId.get(f.id)!, tipo: "categoria", camino: f.camino };
          const s = servicios.find((x) => x.id === f.id);
          const deLaWeb = s?.categories.find((c) => porId.has(c.id) && !idsDeArea.has(c.id));
          return { ...f, categoriaId: deLaWeb?.id ?? null };
        },
      );
    }
    return filasVisibles(arbolDelArea(flat, mapa, area), plegadosEfectivos).map((c) => ({
      ...c,
      tipo: "categoria" as const,
      camino: null,
    }));
  }, [plana, flat, servicios, mapa, areas, area, search, idsDeArea, plegadosEfectivos]);

  function alternarPlegado(id: string) {
    const siguiente = new Set(plegadosEfectivos);
    if (siguiente.has(id)) siguiente.delete(id);
    else siguiente.add(id);
    setPlegados(siguiente);
  }

  const columns: Column<Fila>[] = [
    {
      key: "name",
      header: "Nombre",
      width: 360,
      title: (f) => (f.camino ? `${f.camino} › ${f.name ?? ""}` : (f.name ?? "")),
      render: (f) => {
        if (f.camino !== null) {
          return (
            <div className="min-w-0">
              {f.camino && <p className="truncate text-xs text-ink-soft">{f.camino}</p>}
              <p className="flex items-center gap-2 truncate">
                <span className={f.tipo === "servicio" ? "text-ink" : "font-medium text-ink"}>
                  {f.name ?? "—"}
                </span>
                {f.tipo === "servicio" && (
                  <span className="rounded-full bg-surface-high px-1.5 text-[11px] text-ink-soft">
                    servicio
                  </span>
                )}
              </p>
            </div>
          );
        }
        if (f.tipo !== "categoria") return null;
        const tieneHijas = conHijas.has(f.id);
        const plegada = plegadosEfectivos.has(f.id);
        return (
          <div className="flex items-center" style={{ paddingLeft: f.depth * 16 }}>
            {tieneHijas ? (
              <button
                type="button"
                aria-expanded={!plegada}
                aria-label={`${plegada ? "Desplegar" : "Plegar"} ${f.name ?? "la categoría"}`}
                onClick={(e) => {
                  // Sin esto el click también abre el panel de servicios.
                  e.stopPropagation();
                  alternarPlegado(f.id);
                }}
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
            <span className="font-medium text-ink">{f.name ?? "—"}</span>
            {tieneHijas && plegada && (
              <span className="ml-2 text-xs text-ink-soft">
                {subcategorias(descendientes.get(f.id) ?? 0)}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "areas",
      header: "Área",
      width: 320,
      render: (f) => {
        if (f.tipo === "servicio") return <AreasDeFila areaIds={f.areaIds} areas={areas} />;
        if (idsDeArea.has(f.id)) return <AreasDeFila areaIds={[f.id]} areas={areas} />;
        const suyas = mapa.get(f.id) ?? new Map<string, number>();
        return (
          <AreasDeFila
            areaIds={[...suyas.keys()]}
            areas={areas}
            cantidades={suyas}
            vacia={!showArchived && vacias.has(f.id)}
          />
        );
      },
    },
    {
      key: "desc",
      header: "Descripción",
      width: 300,
      render: (f) =>
        f.tipo === "servicio" ? null : (
          <span className="text-ink-soft">{f.description ?? "—"}</span>
        ),
    },
    {
      key: "order",
      header: "Orden",
      width: 90,
      render: (f) => (f.tipo === "servicio" ? null : (f.displayOrder ?? "—")),
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

  const cantidadDeCategorias = rows.filter((f) => f.tipo === "categoria").length;
  const cantidadDeServicios = rows.length - cantidadDeCategorias;
  const panel = abierta ? (flat.find((c) => c.id === abierta) ?? null) : null;

  return (
    // Un solo scroll, igual que en las áreas (ver AreaLayout): el título y
    // Agregar quedan fijos y todo lo demás pasa por debajo.
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-4 pt-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl text-ink">Categorías</h1>
          <div ref={setSlotAcciones} className="shrink-0" />
        </div>
        <p className="mt-1 max-w-[75ch] text-sm text-ink-soft">
          Ordenan el menú de la web. El área se elige en cada servicio: una categoría está en un
          área cuando tiene servicios de ella. Tocá una categoría para ver sus servicios y
          cambiarles el área.
        </p>
      </div>
      <div className="modal-scroll min-h-0 flex-1 overflow-y-auto">
        <ResourceManager<Fila>
          title="Categorías"
          rows={rows}
          columns={columns}
          loading={isLoading}
          error={error ? (error as Error).message : null}
          slotAcciones={slotAcciones}
          alturaLibre
          bajoElBuscador={
            <div className="space-y-2">
              {!showArchived && (
                <FiltroDeAreas
                  areas={areas}
                  elegida={area}
                  prendidas={prendidas}
                  onElegir={setArea}
                />
              )}
              {plana ? (
                <p className="text-sm text-ink-soft">
                  {cantidadDeCategorias === 1
                    ? "1 categoría"
                    : `${cantidadDeCategorias} categorías`}
                  {" y "}
                  {cantidadDeServicios === 1 ? "1 servicio" : `${cantidadDeServicios} servicios`}
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft [&>button]:whitespace-nowrap">
                  <span>
                    {cantidadDeCategorias} de {flat.length} categorías a la vista
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
          rowKey={(f) => `${f.tipo}:${f.id}`}
          isArchived={(f) => f.tipo === "categoria" && f.isActive === false}
          sinAcciones={(f) => f.tipo === "servicio"}
          onRowClick={(f) => setAbierta(f.tipo === "categoria" ? f.id : f.categoriaId)}
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Buscar categoría o servicio…"
          showArchived={showArchived}
          onToggleArchived={setShowArchived}
          canCreate={canManage}
          canArchive={canManage}
          onAdd={openCreate}
          onEdit={canEdit ? (f) => f.tipo === "categoria" && openEdit(f) : undefined}
          archiving={archive.isPending}
          archiveName={(f) => f.name ?? "esta categoría"}
          onArchive={(f) =>
            archive.mutate(f.id, {
              onSuccess: () => toast.success("Categoría archivada"),
              onError: (e: Error) => toast.error(e.message),
            })
          }
          onRestore={(f) =>
            restore.mutate(f.id, {
              onSuccess: () => toast.success("Categoría restaurada"),
              onError: (e: Error) => toast.error(e.message),
            })
          }
          // Sólo sobre las archivadas, y sólo admin. Una categoría activa puede
          // estar en el menú del sitio público: borrarla lo cambiaría sin aviso.
          // El backend lo vuelve a chequear — esto es la conveniencia, no la
          // regla.
          canHardDelete={(f) => isAdmin && f.tipo === "categoria" && f.isActive === false}
          onHardDeletePreview={(f) => deleteImpact.mutateAsync(f.id)}
          hardDeleteName={(f) => f.name ?? "esta categoría"}
          onHardDelete={(f) =>
            hardDelete.mutate(f.id, {
              onSuccess: () => toast.success("Categoría eliminada definitivamente"),
              onError: (e: Error) => toast.error(e.message),
            })
          }
        />
      </div>

      <ServiciosDeCategoria
        categoria={panel}
        categorias={flat}
        servicios={todosLosServicios}
        areas={areas}
        puedeEditar={canEdit}
        onClose={() => setAbierta(null)}
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
    </div>
  );
}
