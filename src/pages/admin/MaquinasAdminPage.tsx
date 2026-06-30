import { useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { can, type Role } from "../../lib/permissions";
import { ResourceManager, type Column } from "../../components/ResourceManager";
import { EntityDrawer } from "../../components/EntityDrawer";
import { Checkbox, Field, Select, TextArea, TextInput } from "../../components/form";
import { useToast } from "../../components/ui/Toast";
import { Wrench } from "../../components/icons";
import type { Machine } from "../../lib/api-types";
import {
  useArchiveMachine,
  useCreateMachine,
  useMachinesAdmin,
  useRestoreMachine,
  useUpdateMachine,
} from "../../hooks/useMachinesAdmin";
import { MachineLogsDrawer } from "./MachineLogsDrawer";

const STATUS_LABELS: Record<string, string> = {
  active: "Activa",
  inactive: "Inactiva",
  maintenance: "Mantenimiento",
};

type Form = {
  name: string;
  equipmentType: string;
  description: string;
  status: string;
  requiresOperator: boolean;
  quantity: string;
  hourlyCost: string;
  purchaseDate: string;
  weightKg: string;
  dimensions: string;
  supplierInfo: string;
  warrantyCost: string;
  warrantyExpiry: string;
  maintenanceNotes: string;
};

const EMPTY: Form = {
  name: "",
  equipmentType: "",
  description: "",
  status: "active",
  requiresOperator: false,
  quantity: "",
  hourlyCost: "",
  purchaseDate: "",
  weightKg: "",
  dimensions: "",
  supplierInfo: "",
  warrantyCost: "",
  warrantyExpiry: "",
  maintenanceNotes: "",
};

const num = (s: string) => (s.trim() === "" ? null : Number(s));

export function MaquinasAdminPage() {
  const { role } = useAuth();
  const r = role as Role | null;
  const canEdit = can(r, "catalogo", "edit");
  const canManage = can(r, "catalogo", "manage");
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Machine | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [logsMachine, setLogsMachine] = useState<Machine | null>(null);

  const { data: machines = [], isLoading, error } = useMachinesAdmin(showArchived);
  const create = useCreateMachine();
  const update = useUpdateMachine();
  const archive = useArchiveMachine();
  const restore = useRestoreMachine();

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return machines;
    return machines.filter(
      (m) =>
        (m.name ?? "").toLowerCase().includes(q) ||
        (m.equipmentType ?? "").toLowerCase().includes(q),
    );
  }, [machines, search]);

  const columns: Column<Machine>[] = [
    {
      key: "name",
      header: "Máquina",
      width: 220,
      render: (m) => <span className="font-medium text-ink">{m.name ?? "—"}</span>,
    },
    { key: "type", header: "Tipo", width: 160, render: (m) => m.equipmentType ?? "—" },
    {
      key: "status",
      header: "Estado",
      width: 130,
      render: (m) => (
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${
            m.status === "active"
              ? "bg-green-100 text-green-800"
              : m.status === "maintenance"
                ? "bg-amber-100 text-amber-800"
                : "bg-surface-high text-ink-soft"
          }`}
        >
          {STATUS_LABELS[m.status ?? ""] ?? m.status ?? "—"}
        </span>
      ),
    },
    { key: "qty", header: "Cantidad", width: 90, render: (m) => m.quantity ?? "—" },
    {
      key: "maint",
      header: "Mantenim.",
      width: 110,
      render: (m) => m.maintenanceCount ?? 0,
    },
  ];

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setFormError(null);
    setDrawerOpen(true);
  }

  function openEdit(m: Machine) {
    setEditing(m);
    setForm({
      name: m.name ?? "",
      equipmentType: m.equipmentType ?? "",
      description: m.description ?? "",
      status: m.status ?? "active",
      requiresOperator: !!m.requiresOperator,
      quantity: m.quantity?.toString() ?? "",
      hourlyCost: m.hourlyCost?.toString() ?? "",
      purchaseDate: m.purchaseDate ?? "",
      weightKg: m.weightKg?.toString() ?? "",
      dimensions: m.dimensions ?? "",
      supplierInfo: m.supplierInfo ?? "",
      warrantyCost: m.warrantyCost?.toString() ?? "",
      warrantyExpiry: m.warrantyExpiry ? m.warrantyExpiry.slice(0, 10) : "",
      maintenanceNotes: m.maintenanceNotes ?? "",
    });
    setFormError(null);
    setDrawerOpen(true);
  }

  function save() {
    const payload = {
      name: form.name.trim(),
      equipmentType: form.equipmentType.trim() || null,
      description: form.description.trim() || null,
      status: form.status as "active" | "inactive" | "maintenance",
      requiresOperator: form.requiresOperator,
      quantity: num(form.quantity),
      hourlyCost: num(form.hourlyCost),
      purchaseDate: form.purchaseDate || null,
      weightKg: num(form.weightKg),
      dimensions: form.dimensions.trim() || null,
      supplierInfo: form.supplierInfo.trim() || null,
      warrantyCost: num(form.warrantyCost),
      warrantyExpiry: form.warrantyExpiry || null,
      maintenanceNotes: form.maintenanceNotes.trim() || null,
    };
    const handlers = {
      onSuccess: () => {
        toast.success(editing ? "Máquina actualizada" : "Máquina creada");
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
      <ResourceManager<Machine>
        title="Máquinas"
        rows={rows}
        columns={columns}
        loading={isLoading}
        error={error ? (error as Error).message : null}
        rowKey={(m) => m.id}
        isArchived={(m) => m.status === "inactive"}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Buscar por nombre o tipo…"
        showArchived={showArchived}
        onToggleArchived={setShowArchived}
        canCreate={canManage}
        canArchive={canManage}
        onAdd={openCreate}
        onEdit={canEdit ? openEdit : undefined}
        archiving={archive.isPending}
        archiveName={(m) => m.name ?? "esta máquina"}
        rowActions={(m) => (
          <button
            onClick={() => setLogsMachine(m)}
            title="Mantenimientos"
            className="rounded p-1.5 text-ink-soft transition-colors hover:bg-surface-high hover:text-primary"
          >
            <Wrench size={16} />
          </button>
        )}
        onArchive={(m) =>
          archive.mutate(m.id, {
            onSuccess: () => toast.success("Máquina archivada"),
            onError: (e: Error) => toast.error(e.message),
          })
        }
        onRestore={(m) =>
          restore.mutate(m.id, {
            onSuccess: () => toast.success("Máquina restaurada"),
            onError: (e: Error) => toast.error(e.message),
          })
        }
      />

      <EntityDrawer
        open={drawerOpen}
        title={editing ? "Editar máquina" : "Nueva máquina"}
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
        <div className="flex gap-3">
          <Field label="Tipo de equipo">
            <TextInput
              value={form.equipmentType}
              onChange={(e) => setForm({ ...form, equipmentType: e.target.value })}
            />
          </Field>
          <Field label="Estado">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="active">Activa</option>
              <option value="maintenance">Mantenimiento</option>
              <option value="inactive">Inactiva</option>
            </Select>
          </Field>
        </div>
        <Field label="Descripción">
          <TextArea
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
        <div className="flex gap-3">
          <Field label="Cantidad">
            <TextInput
              type="number"
              min={0}
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          </Field>
          <Field label="Costo por hora">
            <TextInput
              type="number"
              min={0}
              value={form.hourlyCost}
              onChange={(e) => setForm({ ...form, hourlyCost: e.target.value })}
            />
          </Field>
        </div>
        <div className="rounded-xl border border-surface-high p-3">
          <Checkbox
            label="Requiere operadora"
            checked={form.requiresOperator}
            onChange={(v) => setForm({ ...form, requiresOperator: v })}
          />
        </div>
        <div className="flex gap-3">
          <Field label="Peso (kg)">
            <TextInput
              type="number"
              min={0}
              value={form.weightKg}
              onChange={(e) => setForm({ ...form, weightKg: e.target.value })}
            />
          </Field>
          <Field label="Dimensiones">
            <TextInput
              value={form.dimensions}
              onChange={(e) => setForm({ ...form, dimensions: e.target.value })}
              placeholder="ej: 120x80x60 cm"
            />
          </Field>
        </div>
        <Field label="Fecha de compra">
          <TextInput
            type="date"
            value={form.purchaseDate}
            onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
          />
        </Field>
        <div className="flex gap-3">
          <Field label="Costo de garantía">
            <TextInput
              type="number"
              min={0}
              value={form.warrantyCost}
              onChange={(e) => setForm({ ...form, warrantyCost: e.target.value })}
            />
          </Field>
          <Field label="Vencim. garantía">
            <TextInput
              type="date"
              value={form.warrantyExpiry}
              onChange={(e) => setForm({ ...form, warrantyExpiry: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Info del proveedor">
          <TextArea
            rows={2}
            value={form.supplierInfo}
            onChange={(e) => setForm({ ...form, supplierInfo: e.target.value })}
          />
        </Field>
        <Field label="Notas de mantenimiento">
          <TextArea
            rows={2}
            value={form.maintenanceNotes}
            onChange={(e) => setForm({ ...form, maintenanceNotes: e.target.value })}
          />
        </Field>
        {editing && (
          <p className="text-xs text-ink-soft">
            Mantenimientos: {editing.maintenanceCount ?? 0}
            {editing.lastMaintenanceAt
              ? ` · último: ${editing.lastMaintenanceAt.slice(0, 10)}`
              : ""}
          </p>
        )}
      </EntityDrawer>

      <MachineLogsDrawer machine={logsMachine} onClose={() => setLogsMachine(null)} />
    </>
  );
}
