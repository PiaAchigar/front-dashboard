import { useState } from "react";
import type { SubscriptionWithAttendance } from "../pages/admin/SubscriptionsAdminPage";
import { useToast } from "./ui/Toast";
import { Field, Select, TextArea } from "./form";
import { apiFetch } from "../lib/api-client";
import { useToken } from "../hooks/useToken";
import { mesSiguiente, nombreDelMes } from "../lib/format";

/**
 * Modal/drawer de detalle de suscripción (Task 8 de planning/subscriptions_admin.md).
 * Muestra período/monto/cliente/actividad como read-only (no se pueden romper datos
 * históricos) y permite editar inline estado y notas via
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

/** Lo que responde POST /api/training-subscriptions/:id/renovar (sin envoltorio). */
interface ResultadoRenovar {
  anotadas: number;
  /** startsAt ISO de las clases que no tenían lugar */
  sinLugar: string[];
  superaPlan: boolean;
}

/** ISO UTC -> dd/mm en hora de Argentina (la fecha del turno, no la del servidor). */
function diaMes(iso: string): string {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(iso));
  const [, mm, dd] = partes.split("-");
  return `${dd}/${mm}`;
}

export function SubscriptionDetailsModal({
  subscription,
  onClose,
  onUpdate,
}: SubscriptionDetailsModalProps) {
  const toast = useToast();
  const [status, setStatus] = useState<SubscriptionWithAttendance["status"]>(subscription.status);
  const [notes, setNotes] = useState<string>(subscription.notes || "");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const token = useToken();

  const [renovando, setRenovando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoRenovar | null>(null);
  const [errorRenovar, setErrorRenovar] = useState<string | null>(null);
  const mesARenovar = mesSiguiente();

  const handleRenovar = async () => {
    setRenovando(true);
    setErrorRenovar(null);
    setResultado(null);
    try {
      const r = await apiFetch<ResultadoRenovar>(
        `/api/training-subscriptions/${subscription.id}/renovar`,
        token,
        { method: "POST", body: JSON.stringify({ mes: mesARenovar }) },
      );
      setResultado(r);
      // Recarga la lista de atrás (columna Horarios); el drawer queda abierto con el resultado.
      onUpdate();
    } catch (err) {
      // Los 400/409 de la API ya traen el mensaje pensado para la usuaria: va tal cual.
      setErrorRenovar(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setRenovando(false);
    }
  };

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

    setSubmitting(true);
    try {
      const payload = {
        status,
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
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-y-auto bg-white shadow-lg">
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

          {/* El mes queda pagado solo al cobrar la cuota (botón Cobrar de la tabla). */}
          {subscription.paidDate && (
            <p className="text-xs text-ink-soft">
              ✅ Pagado el {formatDate(subscription.paidDate)}
            </p>
          )}

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

          {/* Repite los horarios del mes anterior en el mes que viene (también en máquinas: Thermo Bike tiene horarios). */}
          <div className="space-y-2 rounded-lg border border-surface-high p-4 text-sm">
            <button
              onClick={handleRenovar}
              disabled={renovando}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              {renovando ? "Renovando..." : `Renovar ${nombreDelMes(mesARenovar)}`}
            </button>
            {errorRenovar && <p className="text-red-700">{errorRenovar}</p>}
            {resultado && (
              <div className="space-y-1 text-ink">
                <p>{`Quedó anotada en ${resultado.anotadas} clases`}</p>
                {resultado.sinLugar.length > 0 && (
                  <p className="text-red-700">{`Sin lugar: ${resultado.sinLugar.map(diaMes).join(", ")}`}</p>
                )}
                {resultado.superaPlan && <p>{`Supera las ${classesPerMonth} clases del plan`}</p>}
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
