import { useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { ResourceManager, type Column } from "../../components/ResourceManager";
import { EntityDrawer } from "../../components/EntityDrawer";
import { Checkbox, Field, Select, TextArea, TextInput } from "../../components/form";
import { useToast } from "../../components/ui/Toast";
import type { Service } from "../../lib/api-types";
import {
  useArchiveService,
  useCreateService,
  useRestoreService,
  useServicesAdmin,
  useUpdateServiceAdmin,
} from "../../hooks/useServicesAdmin";

const STAFF = ["admin", "manager", "operator"];
const TAX_OPTIONS = [
  { value: "", label: "—" },
  { value: "VAT21", label: "IVA 21%" },
  { value: "VAT10.5", label: "IVA 10.5%" },
  { value: "exempt", label: "Exento" },
];

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
  requiresOperator: boolean;
  requiresMachine: boolean;
  isVisible: boolean;
  isFeatured: boolean;
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
  requiresOperator: false,
  requiresMachine: false,
  isVisible: true,
  isFeatured: false,
};

const money = (n: number | null) => (n != null ? `$${n.toLocaleString("es-AR")}` : "—");
const num = (s: string) => (s.trim() === "" ? null : Number(s));

export function ServiciosAdminPage() {
  const { role } = useAuth();
  const isStaff = STAFF.includes(role ?? "");
  const isAdmin = role === "admin";
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
      requiresOperator: !!s.requiresOperator,
      requiresMachine: !!s.requiresMachine,
      isVisible: s.isVisible ?? true,
      isFeatured: !!s.isFeatured,
    });
    setFormError(null);
    setDrawerOpen(true);
  }

  function save() {
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
      isVisible: form.isVisible,
      isFeatured: form.isFeatured,
    };
    const handlers = {
      onSuccess: () => {
        toast.success(editing ? "Servicio actualizado" : "Servicio creado");
        setDrawerOpen(false);
      },
      onError: (e: Error) => setFormError(e.message),
    };
    if (editing) update.mutate({ id: editing.id, ...payload }, handlers);
    else create.mutate(payload, handlers);
  }

  const saving = create.isPending || update.isPending;

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
        canCreate={isAdmin}
        canArchive={isAdmin}
        onAdd={openCreate}
        onEdit={isStaff ? openEdit : undefined}
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
      />

      <EntityDrawer
        open={drawerOpen}
        title={editing ? "Editar servicio" : "Nuevo servicio"}
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
          <Field label="Unidad">
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
      </EntityDrawer>
    </>
  );
}
