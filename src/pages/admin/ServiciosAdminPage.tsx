import { filtrarServicios } from "../../lib/filtrar-servicios";
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { ResourceManager, type Column } from "../../components/ResourceManager";
import { EntityDrawer } from "../../components/EntityDrawer";
import { SuppliesSection, type SuppliesHandle } from "./SuppliesSection";
import { useSetServiceSupplies } from "../../hooks/useRecetas";
import { BenefitsInput } from "../../components/Services/BenefitsInput";
import { EmbeddingsPendientesAviso } from "../../components/EmbeddingsPendientesAviso";
import { Checkbox, Field, Select, TextArea, TextInput } from "../../components/form";
import { ChevronRight, Plus, Trash } from "../../components/icons";
import { useToast } from "../../components/ui/Toast";
import type { CategoryNode, ProviderAdmin, Service } from "../../lib/api-types";
import { can, type Role } from "../../lib/permissions";
import {
  useArchiveService,
  useCreateService,
  useHardDeleteService,
  useRestoreService,
  useServiceDeleteImpact,
  useServicesAdmin,
  useSetServiceAgreements,
  useSetServiceCategories,
  useUpdateServiceAdmin,
} from "../../hooks/useServicesAdmin";
import { useMachinesList } from "../../hooks/useMachinesAdmin";
import { useCategoriesAdmin } from "../../hooks/useCategoriesAdmin";
import { nombresDeArea, useAreas } from "../../hooks/useAreas";
import { preseleccionDeArea } from "../../lib/areas";
import {
  agruparParaElFormulario,
  categoriasDelFormulario,
  contarSeleccionadas,
  etiquetaDeCategorias,
} from "../../lib/categorias";
import { useProvidersAdmin } from "../../hooks/useProvidersAdmin";
import { useServiceAgreements } from "../../hooks/useServiceAgreements";

const TAX_OPTIONS = [
  { value: "", label: "—" },
  { value: "VAT21", label: "IVA 21%" },
  { value: "VAT10.5", label: "IVA 10.5%" },
  { value: "exempt", label: "Exento" },
];
const PAYMENT_TYPES = [
  { value: "", label: "—" },
  { value: "per_hour", label: "Por hora" },
  { value: "percentage", label: "Porcentaje (%)" },
  { value: "fixed_per_service", label: "Fijo por servicio" },
];

type AgreementForm = { serviceProviderId: string; paymentType: string; rate: string };

/** Cuenta las categorías del árbol, para distinguir "no hay ninguna" de "hay". */
function contarCategorias(nodes: CategoryNode[]): number {
  return nodes.reduce((acc, n) => acc + 1 + contarCategorias(n.children ?? []), 0);
}

/**
 * Rama del árbol de categorías dentro del modal de servicio.
 *
 * Regla única, derivada de la forma del árbol y sin listas fijas: una categoría
 * **con hijas es un encabezado** (Cosmetología, y adentro Facial y Corporal), y
 * una **sin hijas es un checkbox** (Limpieza de Cutis). Con eso salen solos los
 * tres niveles de Dermatología sin ningún caso especial.
 *
 * El encabezado además lleva **su propio checkbox al final de su grupo**, no
 * arriba: así hay que leer todas las opciones específicas antes de encontrar la
 * general. Sin ese checkbox, los servicios que hoy cuelgan de una categoría
 * madre —11 al momento de escribir esto, 7 de Cosmetología y 4 de Estética
 * Corporal— quedarían asignados sin forma de verlo ni de sacarlo.
 *
 * `sinTitulo` sirve para las raíces: ahí el nombre ya lo muestra la cabecera
 * del grupo plegable, y repetirlo adentro lo diría dos veces seguidas.
 */
function RamaCategorias({
  nodo,
  nivel,
  seleccionadas,
  onToggle,
  sinTitulo = false,
}: {
  nodo: CategoryNode;
  nivel: number;
  seleccionadas: string[];
  onToggle: (id: string) => void;
  sinTitulo?: boolean;
}) {
  const hijas = nodo.children ?? [];
  const nombre = nodo.name ?? "—";

  if (hijas.length === 0) {
    return (
      <Checkbox
        label={nombre}
        checked={seleccionadas.includes(nodo.id)}
        onChange={() => onToggle(nodo.id)}
      />
    );
  }

  // Los encabezados de primer nivel son los más marcados; los de adentro bajan
  // de peso para que se lea la jerarquía sin depender solo de la sangría.
  const claseTitulo =
    nivel === 0
      ? "text-xs font-semibold uppercase tracking-wide text-ink"
      : "text-xs font-medium text-ink-soft";

  const contenido = (
    <div
      className={
        sinTitulo ? "space-y-0.5" : `mt-0.5 space-y-0.5 ${nivel === 0 ? "pl-2" : "pl-3"}`
      }
    >
      {hijas.map((h) => (
        <RamaCategorias
          key={h.id}
          nodo={h}
          nivel={sinTitulo ? nivel : nivel + 1}
          seleccionadas={seleccionadas}
          onToggle={onToggle}
        />
      ))}
      <Checkbox
        label={`${nombre} (general)`}
        checked={seleccionadas.includes(nodo.id)}
        onChange={() => onToggle(nodo.id)}
      />
    </div>
  );

  if (sinTitulo) return contenido;

  return (
    <div className={nivel === 0 ? "" : "mt-1"}>
      <p className={`${claseTitulo} ${nivel === 0 ? "" : "pl-1"}`}>{nombre}</p>
      {contenido}
    </div>
  );
}

/**
 * Un grupo de primer nivel del árbol de categorías, plegable.
 *
 * Arrancan cerrados. Con el árbol de la 1.38.0 son ~150 casilleros en siete
 * niveles: abiertos de entrada, el formulario obliga a scrollear una pantalla
 * y media para llegar al botón de guardar, y la rama de Tratamientos Médicos
 * sola es más alta que el resto junto.
 *
 * Cerrado, el grupo tiene que seguir diciendo algo, y por eso lleva el contador
 * de tildadas: una categoría elegida puede estar seis niveles adentro, y sin el
 * número no habría forma de saber que está ahí sin abrir los nueve grupos.
 */
function GrupoPlegable({
  titulo,
  elegidas,
  abierto,
  onToggle,
  children,
}: {
  titulo: string;
  elegidas: number;
  abierto: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-surface-high">
      <button
        type="button"
        aria-expanded={abierto}
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left transition-colors hover:bg-surface-container"
      >
        {/* `rotate-90` va escrito entero y no armado en runtime: Tailwind
            escanea el código como texto plano y una clase compuesta no llega
            al CSS compilado. */}
        <ChevronRight
          size={14}
          className={`shrink-0 text-ink-soft transition-transform ${abierto ? "rotate-90" : ""}`}
        />
        <span className="flex-1 text-xs font-semibold uppercase tracking-wide text-ink">
          {titulo}
        </span>
        {elegidas > 0 && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {elegidas}
          </span>
        )}
      </button>
      {abierto && <div className="border-t border-surface-high px-2.5 py-2">{children}</div>}
    </div>
  );
}

export type AgreementsHandle = { getAgreements: () => AgreementForm[] };

/** Editor de acuerdos proveedora↔servicio. Mantiene su propio estado (sembrado por
 *  el inicializador de useState) y el padre lee el valor actual vía ref en save().
 *  No usa effects: se re-monta por `key` cuando cambia el servicio. */
const AgreementsEditor = forwardRef<
  AgreementsHandle,
  { initial: AgreementForm[]; providers: ProviderAdmin[] }
>(function AgreementsEditor({ initial, providers }, ref) {
  const [rows, setRows] = useState<AgreementForm[]>(initial);
  useImperativeHandle(ref, () => ({ getAgreements: () => rows }), [rows]);

  const patch = (i: number, p: Partial<AgreementForm>) =>
    setRows((rs) => rs.map((x, idx) => (idx === i ? { ...x, ...p } : x)));

  return (
    <div className="space-y-2 rounded-xl border border-surface-high p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
        Proveedoras y tarifa
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-soft">Sin proveedoras asignadas.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((a, i) => (
            <li
              key={i}
              className="flex items-end gap-2 rounded-lg border border-surface-high bg-white p-2.5"
            >
              <Field label="Proveedora">
                <Select
                  value={a.serviceProviderId}
                  onChange={(e) => patch(i, { serviceProviderId: e.target.value })}
                >
                  <option value="">Elegí proveedora…</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName ?? "—"}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Tipo de pago">
                <Select value={a.paymentType} onChange={(e) => patch(i, { paymentType: e.target.value })}>
                  {PAYMENT_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={a.paymentType === "percentage" ? "Tarifa (%)" : "Tarifa ($)"}>
                <TextInput
                  inputMode="numeric"
                  value={a.rate}
                  onChange={(e) => patch(i, { rate: e.target.value })}
                  placeholder="0"
                />
              </Field>
              <button
                type="button"
                title="Quitar proveedora"
                onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}
                className="mb-1.5 shrink-0 rounded p-1.5 text-ink-soft transition-colors hover:bg-surface-high hover:text-red-700"
              >
                <Trash size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() =>
            setRows((rs) => [...rs, { serviceProviderId: "", paymentType: "", rate: "" }])
          }
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
        >
          <Plus size={15} />
          Agregar proveedora
        </button>
      </div>
    </div>
  );
});

/** Carga los acuerdos vigentes y re-monta el editor (key) cuando cambia el servicio. */
function AgreementsSection({
  serviceId,
  providers,
  editorRef,
}: {
  serviceId: string | null;
  providers: ProviderAdmin[];
  editorRef: React.Ref<AgreementsHandle>;
}) {
  const { data, isLoading } = useServiceAgreements(serviceId);
  if (serviceId && isLoading) {
    return <p className="text-sm text-ink-soft">Cargando proveedoras…</p>;
  }
  const initial: AgreementForm[] = (data ?? []).map((a) => ({
    serviceProviderId: a.serviceProviderId,
    paymentType: a.paymentType ?? "",
    rate: a.rate != null ? String(a.rate) : "",
  }));
  return (
    <AgreementsEditor
      key={serviceId ?? "new"}
      ref={editorRef}
      initial={initial}
      providers={providers}
    />
  );
}

type Form = {
  name: string;
  code: string;
  description: string;
  unitPriceList: string;
  unitPriceCash: string;
  estimatedDurationMinutes: string;
  taxCategory: string;
  unitType: string;
  webSortOrder: string;
  machineId: string;
  requiresOperator: boolean;
  requiresMachine: boolean;
  isVisible: boolean;
  isFeatured: boolean;
  categoryIds: string[];
  benefits: string;
  contraindications: string;
  specialAttentionNotes: string;
};

const EMPTY: Form = {
  name: "",
  code: "",
  description: "",
  unitPriceList: "",
  unitPriceCash: "",
  estimatedDurationMinutes: "",
  taxCategory: "",
  unitType: "",
  webSortOrder: "",
  machineId: "",
  requiresOperator: false,
  requiresMachine: false,
  isVisible: true,
  isFeatured: false,
  categoryIds: [],
  benefits: "",
  contraindications: "",
  specialAttentionNotes: "",
};

const money = (n: number | null) => (n != null ? `$${n.toLocaleString("es-AR")}` : "—");
const num = (s: string) => (s.trim() === "" ? null : Number(s));

/**
 * `area` acota la lista a un área del catálogo (Estética, Medicina y
 * Dermatología, Masajes y Bienestar). Es un filtro de VISTA, no de datos: el
 * alta, la edición y el borrado siguen operando sobre el mismo servicio, así
 * que editar desde una pestaña se ve desde la otra. Un servicio que esté en
 * dos áreas aparece en las dos, sin duplicarse.
 *
 * Sin `area`, la página es la de siempre: todos los servicios.
 */
export function ServiciosAdminPage(
  { area, soloSinArea }: { area?: string; soloSinArea?: boolean } = {},
) {
  const { role } = useAuth();
  const r = role as Role | null;
  const canEdit = can(r, "catalogo", "edit");
  const canManage = can(r, "catalogo", "manage");
  const isAdmin = r === "admin";
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  // Sólo los grupos que la usuaria abrió o cerró a mano. Lo que no está acá se
  // decide por si tiene algo tildado, así que un grupo se abre solo al editar
  // un servicio que ya está en esa rama — y sigue funcionando aunque el árbol
  // llegue después que el servicio, que es lo normal con dos consultas.
  const [gruposTocados, setGruposTocados] = useState<Record<string, boolean>>({});

  const { data: services = [], isLoading, error } = useServicesAdmin(showArchived);
  const create = useCreateService();
  const update = useUpdateServiceAdmin();
  const archive = useArchiveService();
  const restore = useRestoreService();
  const deleteImpact = useServiceDeleteImpact();
  const hardDelete = useHardDeleteService();
  const setCategories = useSetServiceCategories();
  const setAgreements = useSetServiceAgreements();
  const setSupplies = useSetServiceSupplies();
  const { data: machines = [] } = useMachinesList();
  const { data: categoryTree = [] } = useCategoriesAdmin(false);
  const { data: areas = [] } = useAreas();
  const AREAS_NOMBRES = useMemo(() => nombresDeArea(areas), [areas]);
  const idsDeArea = useMemo(() => new Set(areas.map((a) => a.id)), [areas]);

  const { data: providersAll = [] } = useProvidersAdmin(false);
  // Depilación Definitiva, Actividades y Capacitaciones son áreas y están
  // activas, así que venían en el árbol de categorías como si fueran del sitio.
  // Promos y Combos se van con ellas: describen cómo se vende, no qué es.
  const arbolWeb = useMemo(() => categoriasDelFormulario(categoryTree), [categoryTree]);
  const { ramas, generales } = useMemo(() => agruparParaElFormulario(arbolWeb), [arbolWeb]);
  const totalCategorias = useMemo(() => contarCategorias(arbolWeb), [arbolWeb]);

  // El editor de acuerdos mantiene su propio estado; lo leemos al guardar.
  const agreementsRef = useRef<AgreementsHandle>(null);
  const suppliesRef = useRef<SuppliesHandle>(null);

  const rows = useMemo(
    () => filtrarServicios(services, { area, soloSinArea, nombresDeArea: AREAS_NOMBRES, search }),
    [services, search, area, soloSinArea, AREAS_NOMBRES],
  );

  const columns: Column<Service>[] = [
    {
      key: "name",
      header: "Servicio",
      width: 240,
      render: (s) => (
        <div>
          <span className="font-medium text-ink">{s.name ?? "—"}</span>
          {s.code && <span className="ml-2 text-xs text-ink-soft">{s.code}</span>}
        </div>
      ),
    },
    { key: "list", header: "Lista", width: 110, render: (s) => money(s.unitPriceList) },
    { key: "cash", header: "Efectivo", width: 110, render: (s) => money(s.unitPriceCash) },
    {
      key: "dur",
      header: "Duración",
      width: 110,
      render: (s) => (s.estimatedDurationMinutes != null ? `${s.estimatedDurationMinutes} min` : "—"),
    },
    { key: "tax", header: "IVA", width: 90, render: (s) => s.taxCategory ?? "—" },
    {
      key: "machine",
      header: "Máquina",
      width: 160,
      render: (s) =>
        s.primaryMachine ? (
          <span className="text-ink-soft">{s.primaryMachine.name}</span>
        ) : (
          <span className="text-ink-soft">{s.requiresMachine ? "Sin asignar" : "—"}</span>
        ),
    },
    {
      key: "cats",
      header: "Categorías",
      width: 280,
      // Todas las categorías del servicio, separadas por comas y con el área
      // adelante. Antes eran chips de colores ("también en Medicina", "sin
      // área") y no se entendían: obligaban a aprender qué quería decir cada
      // uno antes de poder leer la fila.
      render: (s) => (
        <span className="text-ink-soft">{etiquetaDeCategorias(s, AREAS_NOMBRES)}</span>
      ),
    },
  ];

  function openCreate() {
    setEditing(null);
    // El área de la pestaña viene tildada: estando en Estética, lo normal es
    // que el servicio nuevo sea de Estética. Se puede destildar y se pueden
    // marcar otras.
    setForm({ ...EMPTY, categoryIds: preseleccionDeArea(areas, area) });
    setGruposTocados({});
    setFormError(null);
    setDrawerOpen(true);
  }

  function openEdit(s: Service) {
    setEditing(s);
    setForm({
      name: s.name ?? "",
      code: s.code ?? "",
      description: s.description ?? "",
      unitPriceList: s.unitPriceList?.toString() ?? "",
      unitPriceCash: s.unitPriceCash?.toString() ?? "",
      estimatedDurationMinutes: s.estimatedDurationMinutes?.toString() ?? "",
      taxCategory: s.taxCategory ?? "",
      unitType: s.unitType ?? "",
      webSortOrder: s.webSortOrder?.toString() ?? "",
      machineId: s.primaryMachine?.id ?? "",
      requiresOperator: !!s.requiresOperator,
      requiresMachine: !!s.requiresMachine,
      isVisible: s.isVisible ?? true,
      isFeatured: !!s.isFeatured,
      categoryIds: s.categories.map((c) => c.id),
      benefits: s.benefits ?? "",
      contraindications: s.contraindications ?? "",
      specialAttentionNotes: s.specialAttentionNotes ?? "",
    });
    setGruposTocados({});
    setFormError(null);
    setDrawerOpen(true);
  }

  async function save() {
    const payload = {
      name: form.name.trim(),
      code: form.code.trim() || null,
      description: form.description.trim() || null,
      unitPriceList: num(form.unitPriceList),
      unitPriceCash: num(form.unitPriceCash),
      estimatedDurationMinutes: num(form.estimatedDurationMinutes),
      taxCategory: form.taxCategory || null,
      unitType: form.unitType.trim() || null,
      webSortOrder: num(form.webSortOrder),
      requiresOperator: form.requiresOperator,
      requiresMachine: form.requiresMachine,
      // Si no requiere máquina, se desvincula (null); si requiere, manda la elegida.
      machineId: form.requiresMachine ? form.machineId || null : null,
      isVisible: form.isVisible,
      isFeatured: form.isFeatured,
      benefits: form.benefits.trim() || null,
      contraindications: form.contraindications.trim() || null,
      specialAttentionNotes: form.specialAttentionNotes.trim() || null,
    };
    // Solo acuerdos con proveedora elegida; tarifa/tipo opcionales.
    const agreements = (agreementsRef.current?.getAgreements() ?? [])
      .filter((a) => a.serviceProviderId)
      .map((a) => ({
        serviceProviderId: a.serviceProviderId,
        paymentType: a.paymentType || null,
        rate: a.rate.trim() === "" ? null : Number(a.rate),
      }));

    // Sin área, el servicio no aparece en ninguna pestaña y se vuelve
    // invisible. No es teórico: 19 servicios quedaron fuera del árbol de la
    // 1.26.0 y nadie los vio hasta contarlos a mano. Con N:N no hay NOT NULL
    // que lo impida, así que se valida acá.
    const areasElegidas = form.categoryIds.filter((id) => idsDeArea.has(id));
    if (AREAS_NOMBRES.length > 0 && areasElegidas.length === 0) {
      setFormError(
        "Elegí al menos un área (Estética, Depilación, Medicina y Dermatología, " +
          "Masajes y Bienestar…). Sin área, el servicio no aparece en ninguna pestaña.",
      );
      return;
    }

    setFormError(null);
    try {
      // 1) Servicio (alta u edición) → obtener el id. 2) Categorías. 3) Acuerdos.
      let serviceId = editing?.id;
      if (editing) {
        await update.mutateAsync({ id: editing.id, ...payload });
      } else {
        const created = (await create.mutateAsync(payload)) as { id: string };
        serviceId = created.id;
      }
      if (!serviceId) throw new Error("No se pudo guardar el servicio.");
      await setCategories.mutateAsync({ id: serviceId, categoryIds: form.categoryIds });
      await setAgreements.mutateAsync({ id: serviceId, agreements });
      await setSupplies.mutateAsync({
        id: serviceId,
        supplies: suppliesRef.current?.getSupplies() ?? [],
      });
      toast.success(editing ? "Servicio actualizado" : "Servicio creado");
      setDrawerOpen(false);
    } catch (e) {
      setFormError((e as Error).message);
    }
  }

  const saving =
    create.isPending ||
    update.isPending ||
    setCategories.isPending ||
    setAgreements.isPending ||
    setSupplies.isPending;

  /** Un grupo está abierto si la usuaria lo abrió, y si no, si tiene algo tildado. */
  function grupoAbierto(id: string, elegidas: number) {
    return gruposTocados[id] ?? elegidas > 0;
  }

  function alternarGrupo(id: string, elegidas: number) {
    setGruposTocados((g) => ({ ...g, [id]: !grupoAbierto(id, elegidas) }));
  }

  function toggleCategory(id: string) {
    setForm((f) => ({
      ...f,
      categoryIds: f.categoryIds.includes(id)
        ? f.categoryIds.filter((x) => x !== id)
        : [...f.categoryIds, id],
    }));
  }

  return (
    <>
      <ResourceManager<Service>
        title={soloSinArea ? "Sin clasificar" : (area ?? "Servicios")}
        rows={rows}
        columns={columns}
        loading={isLoading}
        error={error ? (error as Error).message : null}
        avisoSuperior={<EmbeddingsPendientesAviso />}
        rowKey={(s) => s.id}
        isArchived={(s) => s.isActive === false}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Buscar por nombre o código…"
        showArchived={showArchived}
        onToggleArchived={setShowArchived}
        canCreate={canManage}
        canArchive={canManage}
        onAdd={openCreate}
        onEdit={canEdit ? openEdit : undefined}
        archiving={archive.isPending}
        archiveName={(s) => s.name ?? "este servicio"}
        onArchive={(s) =>
          archive.mutate(s.id, {
            onSuccess: () => toast.success("Servicio archivado"),
            onError: (e: Error) => toast.error(e.message),
          })
        }
        onRestore={(s) =>
          restore.mutate(s.id, {
            onSuccess: () => toast.success("Servicio restaurado"),
            onError: (e: Error) => toast.error(e.message),
          })
        }
        canHardDelete={isAdmin}
        onHardDeletePreview={(s) => deleteImpact.mutateAsync(s.id)}
        hardDeleteName={(s) => s.name ?? "este servicio"}
        onHardDelete={(s) =>
          hardDelete.mutate(s.id, {
            onSuccess: () => toast.success("Servicio eliminado definitivamente"),
            onError: (e: Error) => toast.error(e.message),
          })
        }
      />

      <EntityDrawer
        open={drawerOpen}
        title={editing ? "Editar servicio" : "Nuevo servicio"}
        error={formError}
        busy={saving}
        canSubmit={form.name.trim().length >= 1}
        widthClass="max-w-2xl"
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
        <Field label="Código">
          <TextInput value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        </Field>
        <Field label="Descripción">
          {/* 6 filas y redimensionable a mano: las descripciones reales rondan
              los 150-300 caracteres y con 2 filas había que escribir mirando
              por una rendija. `resize-y` pisa el `resize-none` del componente. */}
          <TextArea
            rows={6}
            className="resize-y"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
        <div className="flex gap-3">
          <Field label="Precio lista">
            <TextInput
              type="number"
              min={0}
              value={form.unitPriceList}
              onChange={(e) => setForm({ ...form, unitPriceList: e.target.value })}
            />
          </Field>
          <Field label="Precio efectivo">
            <TextInput
              type="number"
              min={0}
              value={form.unitPriceCash}
              onChange={(e) => setForm({ ...form, unitPriceCash: e.target.value })}
            />
          </Field>
        </div>
        <div className="flex gap-3">
          <Field label="Duración (min)">
            <TextInput
              type="number"
              min={0}
              value={form.estimatedDurationMinutes}
              onChange={(e) => setForm({ ...form, estimatedDurationMinutes: e.target.value })}
            />
          </Field>
          <Field label="IVA">
            <Select
              value={form.taxCategory}
              onChange={(e) => setForm({ ...form, taxCategory: e.target.value })}
            >
              {TAX_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="flex gap-3">
          <Field
            label="Unidad"
            help="Unidad de medida/cobro del servicio: cómo se cuenta lo que se vende. Ej: sesión, hora, zona. Es informativo y aparece en presupuestos."
          >
            <TextInput
              value={form.unitType}
              onChange={(e) => setForm({ ...form, unitType: e.target.value })}
              placeholder="ej: sesión"
            />
          </Field>
          <Field label="Orden web (destacados)">
            <TextInput
              type="number"
              min={0}
              value={form.webSortOrder}
              onChange={(e) => setForm({ ...form, webSortOrder: e.target.value })}
            />
          </Field>
        </div>
        <div className="space-y-2 rounded-xl border border-surface-high p-3">
          <Checkbox
            label="Requiere operadora"
            checked={form.requiresOperator}
            onChange={(v) => setForm({ ...form, requiresOperator: v })}
          />
          <Checkbox
            label="Requiere máquina"
            checked={form.requiresMachine}
            onChange={(v) => setForm({ ...form, requiresMachine: v })}
          />
          {form.requiresMachine && (
            <Field label="Máquina">
              <Select
                value={form.machineId}
                onChange={(e) => setForm({ ...form, machineId: e.target.value })}
              >
                <option value="">— Sin asignar</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Checkbox
            label="Visible en la web"
            checked={form.isVisible}
            onChange={(v) => setForm({ ...form, isVisible: v })}
          />
          <Checkbox
            label="Destacado en el home"
            checked={form.isFeatured}
            onChange={(v) => setForm({ ...form, isFeatured: v })}
          />
        </div>

        {/* El área decide en qué pestaña del panel vive el servicio; las
            categorías de abajo son las del sitio público. Son dos cosas
            distintas y estaban mezcladas en una sola lista, donde "Estética"
            parecía una categoría de la web más. */}
        <div className="space-y-2 rounded-xl border border-surface-high p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            Área del panel
          </p>
          <p className="text-xs leading-relaxed text-ink-soft">
            Decide en qué pestaña de Administración aparece el servicio.{" "}
            <span className="font-medium text-ink">No se muestra en la web.</span> Podés marcar
            más de una: el servicio aparece en las dos pestañas siendo la misma ficha, y editarlo
            desde cualquiera, lo edita en las dos.
          </p>
          {areas.length === 0 ? (
            <p className="text-sm text-ink-soft">No hay áreas cargadas.</p>
          ) : (
            <div className="columns-2 gap-x-6">
              {areas.map((a) => (
                <div key={a.id} className="break-inside-avoid">
                  <Checkbox
                    label={a.name ?? "—"}
                    checked={form.categoryIds.includes(a.id)}
                    onChange={() => toggleCategory(a.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Categorías de la web (M:N) — agrupadas por categoría madre, ver RamaCategorias */}
        <div className="space-y-2 rounded-xl border border-surface-high p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            Categorías de la web
          </p>
          <p className="text-xs leading-relaxed text-ink-soft">
            Son las que ve la clienta en el sitio público: el menú de servicios y el buscador de
            tratamientos.
          </p>
          {totalCategorias === 0 ? (
            <p className="text-sm text-ink-soft">No hay categorías cargadas.</p>
          ) : (
            // `columns-2` en vez de `grid-cols-2`: con grid, un grupo largo se
            // parte al medio entre las dos columnas. Con columnas CSS y
            // `break-inside-avoid` cada categoría madre queda entera.
            // Una sola columna, no dos. Con `columns-2` el bloque de
            // Tratamientos Médicos es más alto que una columna entera y, como
            // un grupo no se puede partir al medio, todo lo que viene después
            // se apila en la misma columna dejando la izquierda vacía. Además
            // el ancho completo le da aire a los nombres de nivel 5 y 6, que
            // llegan a 49 caracteres.
            <div className="space-y-1.5">
              {ramas.map((n) => {
                const elegidas = contarSeleccionadas(n, form.categoryIds);
                return (
                  <GrupoPlegable
                    key={n.id}
                    titulo={n.name ?? "—"}
                    elegidas={elegidas}
                    abierto={grupoAbierto(n.id, elegidas)}
                    onToggle={() => alternarGrupo(n.id, elegidas)}
                  >
                    <RamaCategorias
                      nodo={n}
                      nivel={0}
                      sinTitulo
                      seleccionadas={form.categoryIds}
                      onToggle={toggleCategory}
                    />
                  </GrupoPlegable>
                );
              })}
              {/* Las raíces sin hijas, juntas bajo un encabezado. Suelto, un
                  checkbox de primer nivel entre grupos que sí tienen título
                  parece una opción huérfana. "Generales" es un título de esta
                  pantalla, no una categoría: no se tilda ni se guarda. */}
              {generales.length > 0 &&
                (() => {
                  const elegidas = generales.filter((n) =>
                    form.categoryIds.includes(n.id),
                  ).length;
                  return (
                    <GrupoPlegable
                      titulo="Generales"
                      elegidas={elegidas}
                      abierto={grupoAbierto("__generales", elegidas)}
                      onToggle={() => alternarGrupo("__generales", elegidas)}
                    >
                      <div className="space-y-0.5">
                        {generales.map((n) => (
                          <Checkbox
                            key={n.id}
                            label={n.name ?? "—"}
                            checked={form.categoryIds.includes(n.id)}
                            onChange={() => toggleCategory(n.id)}
                          />
                        ))}
                      </div>
                    </GrupoPlegable>
                  );
                })()}
            </div>
          )}
        </div>

        {/* Proveedoras que ofrecen el servicio + su acuerdo (tipo de pago + tarifa) */}
        <AgreementsSection
          serviceId={editing?.id ?? null}
          providers={providersAll}
          editorRef={agreementsRef}
        />

        {/* Insumos que consume el servicio (migración 1.43.0) */}
        <SuppliesSection serviceId={editing?.id ?? null} editorRef={suppliesRef} />

        {/* Contenido RAG: alimenta la búsqueda de tratamientos y el chatbot (migración 1.4.0) */}
        <div className="space-y-1 rounded-xl border border-surface-high p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-soft">
            Contenido para búsqueda de tratamientos
          </p>
          <BenefitsInput
            label="Beneficios"
            description="Ej: Reduce vello en 80%, efecto duradero por 4-6 semanas"
            value={form.benefits}
            onChange={(value) => setForm({ ...form, benefits: value })}
            placeholder="Beneficios principales del tratamiento"
            hasExistingDescription={!!form.description}
          />
          <BenefitsInput
            label="Contraindicaciones"
            description="Ej: No apto si hay dermatitis activa, heridas abiertas"
            value={form.contraindications}
            onChange={(value) => setForm({ ...form, contraindications: value })}
            placeholder="Restricciones y contraindicaciones"
            hasExistingDescription={!!form.description}
          />
          <BenefitsInput
            label="Instrucciones Especiales"
            description="Ej: Llevar protector solar, evitar sol 48h, usar ropa clara"
            value={form.specialAttentionNotes}
            onChange={(value) => setForm({ ...form, specialAttentionNotes: value })}
            placeholder="Recomendaciones antes/después del tratamiento"
            hasExistingDescription={!!form.description}
          />
        </div>
      </EntityDrawer>
    </>
  );
}
