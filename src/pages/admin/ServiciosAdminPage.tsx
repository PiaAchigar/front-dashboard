import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { ResourceManager, type Column } from "../../components/ResourceManager";
import { EntityDrawer } from "../../components/EntityDrawer";
import { Checkbox, Field, Select, TextArea, TextInput } from "../../components/form";
import { Plus, Trash } from "../../components/icons";
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

/** Aplana el árbol de categorías para un multi-select, con sangría por nivel. */
function flattenCategories(nodes: CategoryNode[], depth = 0): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = [];
  for (const n of nodes) {
    out.push({ id: n.id, label: `${"— ".repeat(depth)}${n.name ?? "—"}` });
    if (n.children?.length) out.push(...flattenCategories(n.children, depth + 1));
  }
  return out;
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
};

const money = (n: number | null) => (n != null ? `$${n.toLocaleString("es-AR")}` : "—");
const num = (s: string) => (s.trim() === "" ? null : Number(s));

export function ServiciosAdminPage() {
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

  const { data: services = [], isLoading, error } = useServicesAdmin(showArchived);
  const create = useCreateService();
  const update = useUpdateServiceAdmin();
  const archive = useArchiveService();
  const restore = useRestoreService();
  const deleteImpact = useServiceDeleteImpact();
  const hardDelete = useHardDeleteService();
  const setCategories = useSetServiceCategories();
  const setAgreements = useSetServiceAgreements();
  const { data: machines = [] } = useMachinesList();
  const { data: categoryTree = [] } = useCategoriesAdmin(false);
  const { data: providersAll = [] } = useProvidersAdmin(false);
  const categoryOptions = useMemo(() => flattenCategories(categoryTree), [categoryTree]);

  // El editor de acuerdos mantiene su propio estado; lo leemos al guardar.
  const agreementsRef = useRef<AgreementsHandle>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return services;
    return services.filter(
      (s) =>
        (s.name ?? "").toLowerCase().includes(q) || (s.code ?? "").toLowerCase().includes(q),
    );
  }, [services, search]);

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
      width: 240,
      render: (s) =>
        s.categories.length > 0 ? (
          <span className="text-ink-soft">{s.categories.map((c) => c.name).join(", ")}</span>
        ) : (
          "—"
        ),
    },
  ];

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
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
    });
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
    };
    // Solo acuerdos con proveedora elegida; tarifa/tipo opcionales.
    const agreements = (agreementsRef.current?.getAgreements() ?? [])
      .filter((a) => a.serviceProviderId)
      .map((a) => ({
        serviceProviderId: a.serviceProviderId,
        paymentType: a.paymentType || null,
        rate: a.rate.trim() === "" ? null : Number(a.rate),
      }));

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
      toast.success(editing ? "Servicio actualizado" : "Servicio creado");
      setDrawerOpen(false);
    } catch (e) {
      setFormError((e as Error).message);
    }
  }

  const saving =
    create.isPending || update.isPending || setCategories.isPending || setAgreements.isPending;

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
        title="Servicios"
        rows={rows}
        columns={columns}
        loading={isLoading}
        error={error ? (error as Error).message : null}
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
          <TextArea
            rows={2}
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

        {/* Categorías (M:N) */}
        <div className="space-y-2 rounded-xl border border-surface-high p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Categorías</p>
          {categoryOptions.length === 0 ? (
            <p className="text-sm text-ink-soft">No hay categorías cargadas.</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {categoryOptions.map((c) => (
                <Checkbox
                  key={c.id}
                  label={c.label}
                  checked={form.categoryIds.includes(c.id)}
                  onChange={() => toggleCategory(c.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Proveedoras que ofrecen el servicio + su acuerdo (tipo de pago + tarifa) */}
        <AgreementsSection
          serviceId={editing?.id ?? null}
          providers={providersAll}
          editorRef={agreementsRef}
        />
      </EntityDrawer>
    </>
  );
}
