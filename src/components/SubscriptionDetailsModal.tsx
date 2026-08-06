import { useState } from "react";
import type { SubscriptionWithAttendance } from "../pages/admin/SubscriptionsAdminPage";
import { useToast } from "./ui/Toast";
import { Field, Select, TextArea, TextInput, Checkbox } from "./form";
import { apiFetch } from "../lib/api-client";
import { useToken } from "../hooks/useToken";

/**
 * Modal/drawer de detalle de suscripción (Task 8 de planning/subscriptions_admin.md).
 * Muestra período/monto/cliente/actividad como read-only (no se pueden romper datos
 * históricos) y permite editar inline estado, pago y notas via
 * PATCH /api/training-subscriptions/:id/admin.
 */
interface SubscriptionDetailsModalProps {
  subscription: SubscriptionWithAttendance;
  onClose: () => void;
  onUpdate: () => void;
}

const STATUS_LABELS: Record<SubscriptionWithAttendance["status"], string> = {
  active: "Activa",
  paused: "Pausada",
  cancelled: "Cancelada",
};

const MONTH_NAMES = [
  "ENERO",
  "FEBRERO",
  "MARZO",
  "ABRIL",
  "MAYO",
  "JUNIO",
  "JULIO",
  "AGOSTO",
  "SEPTIEMBRE",
  "OCTUBRE",
  "NOVIEMBRE",
  "DICIEMBRE",
];

/** YYYY-MM-DD -> D/M/YYYY, sin pasar por Date (evita corrimientos de timezone). */
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "∞";
  const [year, month, day] = dateStr.split("-");
  if (!year || !month || !day) return dateStr;
  return `${parseInt(day, 10)}/${parseInt(month, 10)}/${year}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function SubscriptionDetailsModal({
  subscription,
  onClose,
  onUpdate,
}: SubscriptionDetailsModalProps) {
  const toast = useToast();
  const [status, setStatus] = useState<SubscriptionWithAttendance["status"]>(subscription.status);
  const [paid, setPaid] = useState<boolean>(Boolean(subscription.paidDate));
  const [paidDate, setPaidDate] = useState<string>(subscription.paidDate || "");
  const [notes, setNotes] = useState<string>(subscription.notes || "");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const token = useToken();

  const isMachine = subscription.activityType === "machine";
  const currentMonthLabel = MONTH_NAMES[new Date().getMonth()];
  const classesPerMonth = subscription.classesPerMonth || 0;
  // La barra mide asistencia REAL sobre el plan; las agendadas se muestran
  // aparte como referencia de cuánto cupo ya comprometió.
  const progressPct =
    !isMachine && classesPerMonth > 0
      ? Math.min(100, Math.round((subscription.attendedThisMonth / classesPerMonth) * 100))
      : 0;

  const handleSave = async () => {
    setFormError(null);

    if (!(status in STATUS_LABELS)) {
      setFormError("Estado inválido");
      return;
    }

    if (paid && !DATE_RE.test(paidDate)) {
      setFormError("La fecha de pago debe tener formato YYYY-MM-DD");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        status,
        paidDate: paid ? paidDate : null,
        notes: notes.trim() || null,
      };

      await apiFetch<SubscriptionWithAttendance>(
        `/api/training-subscriptions/${subscription.id}/admin`,
        token,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
      );

      toast.success("Suscripción actualizada");
      onUpdate();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setFormError(message);
      toast.error(`Error al guardar: ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-surface-high px-6 py-4">
          <h2 className="text-lg font-semibold text-ink">Detalle de suscripción</h2>
          <button onClick={onClose} className="text-ink-soft transition-colors hover:text-ink">
            ✕
          </button>
        </div>

        <div className="space-y-6 p-6">
          {formError && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-900">{formError}</div>
          )}

          {/* Encabezado read-only */}
          <div>
            <p className="text-base font-semibold text-ink">
              Suscripción de {subscription.customerName} a {subscription.activityName}
            </p>
          </div>

          {/* Datos históricos: no editables */}
          <div className="space-y-2 rounded-lg border border-surface-high bg-surface-low p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-soft">Período</span>
              <span className="font-medium text-ink">
                {formatDate(subscription.subscriptionStartDate)} -{" "}
                {formatDate(subscription.subscriptionEndDate)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-soft">Monto mensual</span>
              <span className="font-medium text-ink">
                ${subscription.monthlyAmount.toLocaleString("es-AR")}
              </span>
            </div>
          </div>

          {/* Campos editables */}
          <Field label="Estado">
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as SubscriptionWithAttendance["status"])}
            >
              <option value="active">Activa</option>
              <option value="paused">Pausada</option>
              <option value="cancelled">Cancelada</option>
            </Select>
          </Field>

          <div className="space-y-2">
            <Checkbox
              label="Pagado"
              checked={paid}
              onChange={(checked) => {
                setPaid(checked);
                if (checked && !paidDate) {
                  setPaidDate(new Date().toISOString().slice(0, 10));
                }
              }}
            />
            {paid && (
              <>
                <TextInput
                  type="date"
                  value={paidDate}
                  onChange={(e) => setPaidDate(e.target.value)}
                />
                {subscription.paidDate && (
                  <p className="text-xs text-ink-soft">
                    ✅ Pagado el {formatDate(subscription.paidDate)}
                  </p>
                )}
              </>
            )}
          </div>

          <Field label="Notas">
            <TextArea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas internas sobre esta suscripción..."
              rows={3}
            />
          </Field>

          {/* Asistencias del mes: read-only */}
          <div className="rounded-lg border border-surface-high p-4">
            <p className="mb-2 text-sm font-medium text-ink">
              Asistencias en {currentMonthLabel}
            </p>
            {isMachine ? (
              <p className="text-sm text-ink-soft">No aplica para actividades de tipo máquina.</p>
            ) : (
              <div className="space-y-2 text-sm text-ink-soft">
                <p>
                  <strong className="text-ink">
                    {subscription.attendedThisMonth}/{classesPerMonth || "—"}
                  </strong>{" "}
                  asistió
                </p>
                <p>
                  {subscription.scheduledThisMonth}/{classesPerMonth || "—"} agendadas
                </p>
                <p>{subscription.classesRemainingThisMonth} clases por agendar</p>
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-surface-high"
                  role="progressbar"
                  aria-valuenow={progressPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 border-t border-surface-high pt-6">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-surface-high px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-low"
            >
              Cerrar
            </button>
            <button
              onClick={handleSave}
              disabled={submitting}
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              {submitting ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
