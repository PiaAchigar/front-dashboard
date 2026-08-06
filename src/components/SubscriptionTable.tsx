import type { SubscriptionWithAttendance } from "../pages/admin/SubscriptionsAdminPage";

/**
 * Tabla admin de suscripciones a actividades/capacitaciones (Task 6 de
 * planning/subscriptions_admin.md). Reemplaza al placeholder que vivía en
 * SubscriptionsAdminPage. Solo lectura + selección por ahora: editar inline
 * y archivar/soft-delete quedan para tasks posteriores.
 */
interface SubscriptionTableProps {
  subscriptions: SubscriptionWithAttendance[];
  onSelectSubscription: (sub: SubscriptionWithAttendance) => void;
  onRefresh: () => void;
}

const STATUS_LABELS: Record<SubscriptionWithAttendance["status"], string> = {
  active: "Activa",
  paused: "Pausada",
  cancelled: "Cancelada",
};

const STATUS_BADGE_CLASSES: Record<SubscriptionWithAttendance["status"], string> = {
  active: "bg-green-100 text-green-700",
  paused: "bg-orange-100 text-orange-700",
  cancelled: "bg-red-100 text-red-700",
};

const PAID_STATUS_ICON: Record<SubscriptionWithAttendance["paidStatus"], string> = {
  paid: "✅",
  pending: "⏳",
  overdue: "🔴",
};

const PAID_STATUS_LABEL: Record<SubscriptionWithAttendance["paidStatus"], string> = {
  paid: "Pagado",
  pending: "Pendiente",
  overdue: "Vencido",
};

export function SubscriptionTable({ subscriptions, onSelectSubscription }: SubscriptionTableProps) {
  if (subscriptions.length === 0) {
    return (
      <div className="p-6 text-center text-ink-soft">No hay suscripciones registradas.</div>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="sticky top-0 border-b border-surface-high bg-surface-low">
          <th className="px-6 py-3 text-left font-medium text-ink">Cliente</th>
          <th className="px-6 py-3 text-left font-medium text-ink">Actividad</th>
          <th className="px-6 py-3 text-left font-medium text-ink">Período</th>
          <th className="px-6 py-3 text-left font-medium text-ink">Monto</th>
          <th
            className="px-6 py-3 text-left font-medium text-ink"
            title="Clases a las que el cliente realmente fue, tildadas desde la Agenda"
          >
            Asistió
          </th>
          <th
            className="px-6 py-3 text-left font-medium text-ink"
            title="Clases agendadas vigentes este mes (consumen cupo aunque todavía no hayan ocurrido)"
          >
            Agendadas
          </th>
          <th
            className="px-6 py-3 text-left font-medium text-ink"
            title="Cupo del plan que queda por agendar este mes"
          >
            Restantes
          </th>
          <th className="px-6 py-3 text-left font-medium text-ink">Pagado</th>
          <th className="px-6 py-3 text-left font-medium text-ink">Estado</th>
          <th className="px-6 py-3 text-left font-medium text-ink">Acciones</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-surface-high">
        {subscriptions.map((sub) => {
          const isMachine = sub.activityType === "machine";

          return (
            <tr
              key={sub.id}
              onClick={() => onSelectSubscription(sub)}
              className="cursor-pointer hover:bg-surface-low"
            >
              <td className="px-6 py-3 font-medium text-ink">{sub.customerName}</td>
              <td className="px-6 py-3 text-ink">{sub.activityName}</td>
              <td className="whitespace-nowrap px-6 py-3 text-ink-soft">
                {sub.subscriptionStartDate} - {sub.subscriptionEndDate || "∞"}
              </td>
              <td className="whitespace-nowrap px-6 py-3 text-ink-soft">
                ${sub.monthlyAmount.toLocaleString("es-AR")}
              </td>
              <td className="px-6 py-3 text-ink-soft">
                {isMachine ? "—" : `${sub.attendedThisMonth}/${sub.classesPerMonth || "—"}`}
              </td>
              <td className="px-6 py-3 text-ink-soft">
                {isMachine ? "—" : `${sub.scheduledThisMonth}/${sub.classesPerMonth || "—"}`}
              </td>
              <td className="px-6 py-3 text-ink-soft">
                {isMachine ? "—" : sub.classesRemainingThisMonth}
              </td>
              <td className="px-6 py-3 text-center">
                <span title={PAID_STATUS_LABEL[sub.paidStatus]} aria-label={PAID_STATUS_LABEL[sub.paidStatus]}>
                  {PAID_STATUS_ICON[sub.paidStatus]}
                </span>
              </td>
              <td className="px-6 py-3">
                <span
                  className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${STATUS_BADGE_CLASSES[sub.status]}`}
                >
                  {STATUS_LABELS[sub.status]}
                </span>
              </td>
              <td className="px-6 py-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectSubscription(sub);
                  }}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Ver
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
