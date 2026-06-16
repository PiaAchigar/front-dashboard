import type { Appointment } from "../../lib/api-types";
import type { Provider } from "../../lib/api-types";
import type { ProviderColor } from "../../lib/agenda-colors";
import { TimeSlotBlock } from "./TimeSlotBlock";

const PX_PER_MIN = 2;
const SLOT_MIN = 30;
const SLOT_HEIGHT = SLOT_MIN * PX_PER_MIN;

type Props = {
  provider: Provider;
  color: ProviderColor;
  appointments: Appointment[];
  filterServiceId: string | null;
  slots: string[];
  openMinutes: number;
  totalHeight: number;
  onAppointmentClick: (appointment: Appointment) => void;
  onSlotClick: (providerId: string, time: string) => void;
};

export function DayColumn({
  provider,
  color,
  appointments,
  filterServiceId,
  slots,
  openMinutes,
  totalHeight,
  onAppointmentClick,
  onSlotClick,
}: Props) {
  return (
    <div className="flex flex-col flex-1 min-w-36 bg-white">
      {/* Header de la columna */}
      <div
        className="px-3 py-2 text-xs font-sans font-semibold text-center border-b border-surface-high truncate"
        style={{ color: color.text, borderTop: `3px solid ${color.border}` }}
        title={provider.fullName ?? ""}
      >
        {provider.fullName}
      </div>

      {/* Cuerpo del timeline */}
      <div className="relative flex-1" style={{ height: totalHeight }}>
        {/* Líneas guía por slot */}
        {slots.map((slot, i) => (
          <div
            key={slot}
            className="absolute left-0 right-0 border-t border-surface-high"
            style={{ top: i * SLOT_HEIGHT, height: SLOT_HEIGHT }}
          />
        ))}

        {/* Slots clickeables (vacíos) */}
        {slots.map((slot, i) => (
          <button
            key={slot}
            onClick={() => onSlotClick(provider.id, slot)}
            className="absolute left-0 right-0 group flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
            style={{ top: i * SLOT_HEIGHT, height: SLOT_HEIGHT, zIndex: 1 }}
            aria-label={`Nuevo turno a las ${slot}`}
          >
            <span className="text-xs text-ink-soft/50 font-sans group-hover:text-primary transition-colors">
              +
            </span>
          </button>
        ))}

        {/* Bloques de turnos */}
        {appointments.map((appt) => (
          <TimeSlotBlock
            key={appt.id}
            appointment={appt}
            color={color}
            openMinutes={openMinutes}
            isOtherService={
              filterServiceId !== null && appt.serviceId !== filterServiceId
            }
            onClick={() => onAppointmentClick(appt)}
          />
        ))}
      </div>
    </div>
  );
}
