import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { apiFetch } from "../../lib/api-client";
import type { Appointment, AppointmentStatus, Customer } from "../../lib/api-types";
import { useProviderServices } from "../../hooks/useProviderServices";
import { useProviders } from "../../hooks/useProviders";
import { toLocalDateString, toAppointmentISO, formatTime } from "../../lib/agenda-utils";
import { CustomerSearch } from "./CustomerSearch";
import { QuickCreateCustomer } from "./QuickCreateCustomer";

type CreateIntent = {
  mode: "create";
  providerId: string;
  date: Date;
  time: string;
};

type EditIntent = {
  mode: "edit";
  appointment: Appointment;
};

export type ModalIntent = CreateIntent | EditIntent;

type Props = {
  intent: ModalIntent;
  onClose: () => void;
  onSaved: (date: string) => void;
};

const STATUS_ACTIONS: { status: AppointmentStatus; label: string; color: string }[] = [
  { status: "completed", label: "Completar", color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
  { status: "cancelled", label: "Cancelar", color: "bg-gray-400 hover:bg-gray-500 text-white" },
  { status: "no_show", label: "No se presentó", color: "bg-red-500 hover:bg-red-600 text-white" },
  { status: "scheduled", label: "Restaurar", color: "bg-surface-high hover:bg-surface-highest text-ink" },
];

export function AppointmentModal({ intent, onClose, onSaved }: Props) {
  const { session } = useAuth();
  const token = session?.access_token ?? null;

  // ── Estado compartido ─────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // ── Estado modo crear ─────────────────────────────────────────────────────
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [providerId, setProviderId] = useState(
    intent.mode === "create" ? intent.providerId : (intent.appointment.providerId ?? ""),
  );
  const [serviceId, setServiceId] = useState(
    intent.mode === "edit" ? (intent.appointment.serviceId ?? "") : "",
  );
  const [date, setDate] = useState(
    intent.mode === "create"
      ? toLocalDateString(intent.date)
      : toLocalDateString(new Date(intent.appointment.appointmentStart)),
  );
  const [time, setTime] = useState(
    intent.mode === "create"
      ? intent.time
      : new Date(intent.appointment.appointmentStart)
          .toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
  );
  const [priceMode, setPriceMode] = useState<"list" | "cash">("cash");
  const [notes, setNotes] = useState(
    intent.mode === "edit" ? (intent.appointment.notes ?? "") : "",
  );

  // ── Datos auxiliares ──────────────────────────────────────────────────────
  const { data: providers = [] } = useProviders();
  const { data: providerServices = [] } = useProviderServices(providerId || null);

  // Resetea el servicio cuando cambia la prestadora
  useEffect(() => {
    if (intent.mode === "create") setServiceId("");
  }, [providerId, intent.mode]);

  // ── Cerrar con Escape ─────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // ── Acciones ──────────────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!customer) { setError("Seleccioná un cliente"); return; }
    if (!serviceId) { setError("Seleccioná un servicio"); return; }
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/api/agenda/appointments", token, {
        method: "POST",
        body: JSON.stringify({
          customerId: customer.id,
          serviceId,
          providerId,
          start: toAppointmentISO(date, time),
          priceMode,
          notes: notes || undefined,
        }),
      });
      onSaved(date);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(status: AppointmentStatus) {
    if (intent.mode !== "edit") return;
    setLoading(true);
    setError(null);
    try {
      await apiFetch(`/api/agenda/appointments/${intent.appointment.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      onSaved(date);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveNotes() {
    if (intent.mode !== "edit") return;
    setLoading(true);
    setError(null);
    try {
      await apiFetch(`/api/agenda/appointments/${intent.appointment.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ notes }),
      });
      onSaved(date);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar notas");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    // El API no tiene DELETE — cancelamos el turno como equivalente
    await handleStatusChange("cancelled");
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const title = intent.mode === "create" ? "Nuevo turno" : "Turno";

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-high">
          <h2 className="font-display text-xl text-ink">{title}</h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink text-lg cursor-pointer">
            ✕
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* ── MODO CREAR ── */}
          {intent.mode === "create" && (
            <form onSubmit={handleCreate} className="space-y-4">
              {/* Cliente */}
              <div>
                <label className="block text-xs font-sans font-medium text-ink-soft mb-1 uppercase tracking-wide">
                  Cliente
                </label>
                <CustomerSearch
                  value={customer}
                  onChange={setCustomer}
                  onCreateNew={() => setShowCreateCustomer(true)}
                />
                {showCreateCustomer && (
                  <QuickCreateCustomer
                    onCreated={(c) => { setCustomer(c); setShowCreateCustomer(false); }}
                    onCancel={() => setShowCreateCustomer(false)}
                  />
                )}
              </div>

              {/* Prestadora */}
              <div>
                <label className="block text-xs font-sans font-medium text-ink-soft mb-1 uppercase tracking-wide">
                  Prestadora
                </label>
                <select
                  value={providerId}
                  onChange={(e) => setProviderId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm font-sans border border-surface-high rounded bg-white text-ink focus:outline-none focus:border-primary"
                >
                  <option value="">Seleccioná una prestadora</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>{p.fullName}</option>
                  ))}
                </select>
              </div>

              {/* Servicio */}
              <div>
                <label className="block text-xs font-sans font-medium text-ink-soft mb-1 uppercase tracking-wide">
                  Servicio
                </label>
                <select
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  required
                  disabled={!providerId}
                  className="w-full px-3 py-2 text-sm font-sans border border-surface-high rounded bg-white text-ink focus:outline-none focus:border-primary disabled:opacity-50"
                >
                  <option value="">
                    {providerId ? "Seleccioná un servicio" : "Primero elegí una prestadora"}
                  </option>
                  {providerServices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.estimatedDurationMinutes ? `(${s.estimatedDurationMinutes} min)` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Fecha y hora */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-sans font-medium text-ink-soft mb-1 uppercase tracking-wide">
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm font-sans border border-surface-high rounded bg-white text-ink focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-sans font-medium text-ink-soft mb-1 uppercase tracking-wide">
                    Hora
                  </label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm font-sans border border-surface-high rounded bg-white text-ink focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Precio */}
              <div>
                <label className="block text-xs font-sans font-medium text-ink-soft mb-1 uppercase tracking-wide">
                  Precio
                </label>
                <div className="flex gap-2">
                  {(["cash", "list"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPriceMode(mode)}
                      className={
                        "flex-1 py-1.5 text-xs font-sans rounded border transition-colors cursor-pointer " +
                        (priceMode === mode
                          ? "bg-primary text-white border-primary"
                          : "bg-white text-ink border-surface-high hover:bg-surface")
                      }
                    >
                      {mode === "cash" ? "Efectivo" : "Lista"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-xs font-sans font-medium text-ink-soft mb-1 uppercase tracking-wide">
                  Notas
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-sm font-sans border border-surface-high rounded bg-white text-ink focus:outline-none focus:border-primary resize-none"
                />
              </div>

              {error && <p className="text-xs text-red-600 font-sans">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-primary text-white text-sm font-sans font-medium rounded hover:bg-primary-dark transition-colors disabled:opacity-60 cursor-pointer"
              >
                {loading ? "Guardando..." : "Guardar turno"}
              </button>
            </form>
          )}

          {/* ── MODO EDITAR ── */}
          {intent.mode === "edit" && (
            <div className="space-y-4">
              {/* Info del turno */}
              <div className="space-y-1 text-sm font-sans">
                <p className="text-ink font-medium">{intent.appointment.customerName ?? "—"}</p>
                <p className="text-ink-soft">{intent.appointment.serviceName}</p>
                <p className="text-ink-soft">
                  {formatTime(intent.appointment.appointmentStart)}
                  {" – "}
                  {formatTime(intent.appointment.appointmentEnd)}
                  {" · "}
                  {intent.appointment.providerName}
                </p>
                {intent.appointment.servicePrice != null && (
                  <p className="text-ink-soft">
                    ${intent.appointment.servicePrice.toLocaleString("es-AR")}
                  </p>
                )}
              </div>

              {/* Cambio de estado */}
              <div>
                <p className="text-xs font-sans font-medium text-ink-soft uppercase tracking-wide mb-2">
                  Cambiar estado
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_ACTIONS.filter(
                    (a) => a.status !== intent.appointment.status,
                  ).map((action) => (
                    <button
                      key={action.status}
                      type="button"
                      onClick={() => handleStatusChange(action.status)}
                      disabled={loading}
                      className={`py-2 text-xs font-sans rounded transition-colors cursor-pointer disabled:opacity-60 ${action.color}`}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-xs font-sans font-medium text-ink-soft mb-1 uppercase tracking-wide">
                  Notas
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-sm font-sans border border-surface-high rounded bg-white text-ink focus:outline-none focus:border-primary resize-none"
                />
                <button
                  type="button"
                  onClick={handleSaveNotes}
                  disabled={loading || notes === (intent.appointment.notes ?? "")}
                  className="mt-1.5 text-xs font-sans text-primary hover:underline disabled:opacity-40 disabled:no-underline cursor-pointer"
                >
                  Guardar notas
                </button>
              </div>

              {error && <p className="text-xs text-red-600 font-sans">{error}</p>}

              {/* Eliminar */}
              <div className="pt-2 border-t border-surface-high">
                {!confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="text-xs font-sans text-red-500 hover:text-red-700 cursor-pointer"
                  >
                    Cancelar turno
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <p className="text-xs font-sans text-ink-soft">¿Confirmar cancelación?</p>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={loading}
                      className="text-xs font-sans text-red-600 font-medium hover:underline cursor-pointer"
                    >
                      Sí, cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="text-xs font-sans text-ink-soft hover:text-ink cursor-pointer"
                    >
                      No
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
