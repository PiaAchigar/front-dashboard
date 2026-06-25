import { useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { Field, Select, TextArea, TextInput } from "../../components/form";
import { useToast } from "../../components/ui/Toast";
import { Pencil, Trash } from "../../components/icons";
import type { Machine, MaintenanceLog } from "../../lib/api-types";
import {
  useCreateLog,
  useDeleteLog,
  useMaintenanceLogs,
  useUpdateLog,
} from "../../hooks/useMachinesAdmin";

const TYPE_LABELS: Record<string, string> = {
  preventive: "Preventivo",
  corrective: "Correctivo",
  repair: "Reparación",
};

type LogForm = {
  id: string | null;
  maintenanceDate: string;
  maintenanceType: string;
  description: string;
  cost: string;
  performedBy: string;
  notes: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = (): LogForm => ({
  id: null,
  maintenanceDate: today(),
  maintenanceType: "preventive",
  description: "",
  cost: "",
  performedBy: "",
  notes: "",
});

export function MachineLogsDrawer({
  machine,
  onClose,
}: {
  machine: Machine | null;
  onClose: () => void;
}) {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const toast = useToast();
  const machineId = machine?.id ?? null;

  const [form, setForm] = useState<LogForm>(emptyForm());

  const { data: logs = [], isLoading } = useMaintenanceLogs(machineId);
  const create = useCreateLog(machineId);
  const update = useUpdateLog(machineId);
  const del = useDeleteLog(machineId);

  if (!machine) return null;

  function resetForm() {
    setForm(emptyForm());
  }

  function editLog(l: MaintenanceLog) {
    setForm({
      id: l.id,
      maintenanceDate: l.maintenanceDate ?? today(),
      maintenanceType: l.maintenanceType ?? "preventive",
      description: l.description ?? "",
      cost: l.cost?.toString() ?? "",
      performedBy: l.performedBy ?? "",
      notes: l.notes ?? "",
    });
  }

  function save() {
    const payload = {
      maintenanceDate: form.maintenanceDate,
      maintenanceType: form.maintenanceType,
      description: form.description.trim() || null,
      cost: form.cost.trim() === "" ? null : Number(form.cost),
      performedBy: form.performedBy.trim() || null,
      notes: form.notes.trim() || null,
    };
    const handlers = {
      onSuccess: () => {
        toast.success(form.id ? "Mantenimiento actualizado" : "Mantenimiento registrado");
        resetForm();
      },
      onError: (e: Error) => toast.error(e.message),
    };
    if (form.id) update.mutate({ logId: form.id, ...payload }, handlers);
    else create.mutate(payload, handlers);
  }

  const saving = create.isPending || update.isPending;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-lg flex-col bg-surface-low shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-surface-high px-6 py-4">
          <h3 className="font-display text-xl text-ink">Mantenimientos</h3>
          <p className="text-xs text-ink-soft">{machine.name}</p>
        </div>

        <div className="modal-scroll flex-1 overflow-y-auto px-6 py-4">
          {/* Form alta/edición */}
          <div className="space-y-3 rounded-xl border border-surface-high p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
              {form.id ? "Editar mantenimiento" : "Registrar mantenimiento"}
            </p>
            <div className="flex gap-3">
              <Field label="Fecha *">
                <TextInput
                  type="date"
                  value={form.maintenanceDate}
                  onChange={(e) => setForm({ ...form, maintenanceDate: e.target.value })}
                />
              </Field>
              <Field label="Tipo">
                <Select
                  value={form.maintenanceType}
                  onChange={(e) => setForm({ ...form, maintenanceType: e.target.value })}
                >
                  <option value="preventive">Preventivo</option>
                  <option value="corrective">Correctivo</option>
                  <option value="repair">Reparación</option>
                </Select>
              </Field>
            </div>
            <Field label="Descripción">
              <TextInput
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Ej: Cambio de lámpara"
              />
            </Field>
            <div className="flex gap-3">
              <Field label="Costo">
                <TextInput
                  type="number"
                  min={0}
                  value={form.cost}
                  onChange={(e) => setForm({ ...form, cost: e.target.value })}
                />
              </Field>
              <Field label="Realizado por">
                <TextInput
                  value={form.performedBy}
                  onChange={(e) => setForm({ ...form, performedBy: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Notas">
              <TextArea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
            <div className="flex justify-end gap-2">
              {form.id && (
                <button
                  onClick={resetForm}
                  className="rounded-full px-4 py-2 text-sm text-ink-soft hover:bg-surface-high"
                >
                  Cancelar
                </button>
              )}
              <button
                onClick={save}
                disabled={saving || !form.maintenanceDate}
                className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {saving ? "Guardando…" : form.id ? "Guardar cambios" : "Registrar"}
              </button>
            </div>
          </div>

          {/* Historial */}
          <h4 className="mb-2 mt-5 text-sm font-medium text-ink">Historial</h4>
          {isLoading ? (
            <p className="text-sm text-ink-soft">Cargando…</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-ink-soft">Sin mantenimientos registrados.</p>
          ) : (
            <ul className="space-y-2">
              {logs.map((l) => (
                <li
                  key={l.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-surface-high bg-white p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {l.maintenanceDate ?? "—"}
                      <span className="ml-2 rounded-full bg-surface-high px-2 py-0.5 text-xs text-ink-soft">
                        {TYPE_LABELS[l.maintenanceType ?? ""] ?? l.maintenanceType ?? "—"}
                      </span>
                    </p>
                    {l.description && <p className="text-sm text-ink-soft">{l.description}</p>}
                    <p className="text-xs text-ink-soft">
                      {l.cost != null ? `$${l.cost.toLocaleString("es-AR")}` : "Sin costo"}
                      {l.performedBy ? ` · ${l.performedBy}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => editLog(l)}
                      title="Editar"
                      className="rounded p-1.5 text-ink-soft hover:bg-surface-high hover:text-primary"
                    >
                      <Pencil size={15} />
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() =>
                          del.mutate(l.id, {
                            onSuccess: () => toast.success("Mantenimiento eliminado"),
                            onError: (e: Error) => toast.error(e.message),
                          })
                        }
                        title="Eliminar"
                        className="rounded p-1.5 text-ink-soft hover:bg-surface-high hover:text-red-700"
                      >
                        <Trash size={15} />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="shrink-0 border-t border-surface-high px-6 py-3 text-right">
          <button
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm text-ink-soft hover:bg-surface-high"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
