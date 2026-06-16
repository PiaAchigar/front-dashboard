import type { Appointment } from "../../lib/api-types";
import type { ProviderColor } from "../../lib/agenda-colors";
import { formatTime, isSameDay, toLocalDateString } from "../../lib/agenda-utils";

const MAX_VISIBLE = 4;

type Props = {
  day: Date;
  today: Date;
  appointments: Appointment[];
  colorMap: Map<string, ProviderColor>;
  filterProviderId: string | null;
  filterServiceId: string | null;
  onDayClick: (date: Date) => void;
  onAppointmentClick: (appointment: Appointment) => void;
};

export function WeekDayCell({
  day,
  today,
  appointments,
  colorMap,
  filterProviderId,
  filterServiceId,
  onDayClick,
  onAppointmentClick,
}: Props) {
  const isToday = isSameDay(day, today);

  const filtered = appointments.filter((a) => {
    if (filterProviderId && a.providerId !== filterProviderId) return false;
    if (filterServiceId && a.serviceId !== filterServiceId) return false;
    return true;
  });

  const visible = filtered.slice(0, MAX_VISIBLE);
  const overflow = filtered.length - MAX_VISIBLE;

  const dayLabel = day.toLocaleDateString("es-AR", { weekday: "short" });
  const dayNumber = day.getDate();

  return (
    <div className="flex flex-col flex-1 min-w-0 bg-white border-r border-surface-high last:border-r-0">
      {/* Header del día */}
      <button
        onClick={() => onDayClick(day)}
        className="flex flex-col items-center py-2 border-b border-surface-high hover:bg-surface transition-colors cursor-pointer w-full"
      >
        <span className="text-xs font-sans text-ink-soft capitalize">{dayLabel}</span>
        <span
          className={
            "text-sm font-sans font-semibold w-7 h-7 flex items-center justify-center rounded-full mt-0.5 " +
            (isToday ? "bg-primary text-white" : "text-ink")
          }
        >
          {dayNumber}
        </span>
      </button>

      {/* Turnos del día */}
      <div className="flex-1 p-1.5 space-y-1 overflow-y-auto">
        {visible.map((appt) => {
          const color = colorMap.get(appt.providerId ?? "") ?? {
            bg: "#e5e7eb",
            border: "#d1d5db",
            text: "#374151",
            bgLight: "#f9fafb",
          };
          const isCancelled = appt.status === "cancelled";
          const isNoShow = appt.status === "no_show";

          return (
            <button
              key={appt.id}
              onClick={() => onAppointmentClick(appt)}
              className="w-full text-left rounded px-1.5 py-1 cursor-pointer hover:opacity-80 transition-opacity overflow-hidden"
              style={{
                backgroundColor: isCancelled ? "#f3f4f6" : color.bg,
                borderLeft: `3px solid ${isNoShow ? "#ef4444" : isCancelled ? "#9ca3af" : color.border}`,
                opacity: isCancelled ? 0.6 : 1,
              }}
            >
              <p
                className="text-xs font-sans font-medium leading-tight truncate"
                style={{
                  color: isCancelled ? "#9ca3af" : color.text,
                  textDecoration: isCancelled ? "line-through" : "none",
                }}
              >
                {formatTime(appt.appointmentStart)} {appt.customerName ?? "—"}
              </p>
              <p
                className="text-xs font-sans leading-tight truncate"
                style={{ color: isCancelled ? "#9ca3af" : color.text, opacity: 0.75 }}
              >
                {appt.serviceName} · {appt.providerName}
              </p>
            </button>
          );
        })}

        {overflow > 0 && (
          <button
            onClick={() => onDayClick(day)}
            className="w-full text-xs text-ink-soft font-sans text-center py-0.5 hover:text-primary transition-colors cursor-pointer"
          >
            +{overflow} más
          </button>
        )}

        {filtered.length === 0 && (
          <button
            onClick={() => onDayClick(day)}
            className="w-full h-full min-h-12 flex items-center justify-center cursor-pointer group"
            aria-label={`Ver día ${toLocalDateString(day)}`}
          >
            <span className="text-xs text-ink-soft/30 group-hover:text-primary/40 transition-colors">
              +
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
