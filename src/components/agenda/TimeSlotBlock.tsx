import type { Appointment } from "../../lib/api-types";
import type { ProviderColor } from "../../lib/agenda-colors";
import { formatTime } from "../../lib/agenda-utils";

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Agendado",
  completed: "Completado",
  cancelled: "Cancelado",
  no_show: "No se presentó",
};

const PX_PER_MIN = 2;

type Props = {
  appointment: Appointment;
  color: ProviderColor;
  openMinutes: number;
  isOtherService: boolean;
  onClick: () => void;
};

function timeToLocalMinutes(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

export function TimeSlotBlock({ appointment, color, openMinutes, isOtherService, onClick }: Props) {
  const startMin = timeToLocalMinutes(appointment.appointmentStart);
  const duration = appointment.durationMinutes ?? 30;

  const top = (startMin - openMinutes) * PX_PER_MIN;
  const height = Math.max(duration * PX_PER_MIN, 24);

  const isCancelled = appointment.status === "cancelled";
  const isNoShow = appointment.status === "no_show";
  const isCompleted = appointment.status === "completed";

  if (isOtherService) {
    return (
      <div
        onClick={onClick}
        className="absolute left-1 right-1 rounded px-2 py-1 cursor-pointer overflow-hidden"
        style={{
          top,
          height,
          backgroundColor: "#f3f4f6",
          border: "1px dashed #d1d5db",
        }}
        title={`Ocupada — ${appointment.serviceName ?? "otro servicio"}`}
      >
        <p className="text-xs text-gray-400 font-sans truncate leading-tight">
          Ocupada
        </p>
        {height >= 40 && (
          <p className="text-xs text-gray-400 font-sans truncate leading-tight">
            {appointment.serviceName}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className="absolute left-1 right-1 rounded px-2 py-1 cursor-pointer overflow-hidden transition-opacity hover:opacity-90"
      style={{
        top,
        height,
        backgroundColor: isCompleted || isCancelled ? "#e5e7eb" : color.bg,
        borderLeft: `3px solid ${isNoShow ? "#ef4444" : isCancelled ? "#9ca3af" : color.border}`,
        opacity: isCancelled ? 0.5 : 1,
      }}
      title={`${appointment.customerName} — ${appointment.serviceName}`}
    >
      <p
        className="text-xs font-sans font-medium leading-tight truncate"
        style={{
          color: isCompleted || isCancelled ? "#6b7280" : color.text,
          textDecoration: isCancelled ? "line-through" : "none",
        }}
      >
        {appointment.customerName ?? "Sin cliente"}
      </p>
      {height >= 40 && (
        <p
          className="text-xs font-sans leading-tight truncate"
          style={{ color: isCompleted || isCancelled ? "#9ca3af" : color.text, opacity: 0.8 }}
        >
          {appointment.serviceName}
        </p>
      )}
      {height >= 56 && (
        <p
          className="text-xs font-sans leading-tight"
          style={{ color: isCompleted || isCancelled ? "#9ca3af" : color.text, opacity: 0.7 }}
        >
          {formatTime(appointment.appointmentStart)} · {STATUS_LABELS[appointment.status]}
        </p>
      )}
    </div>
  );
}
