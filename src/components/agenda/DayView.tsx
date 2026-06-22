import { useMemo } from "react";
import type { Appointment, Provider } from "../../lib/api-types";
import type { ProviderColor } from "../../lib/agenda-colors";
import { generateTimeSlots } from "../../lib/agenda-utils";
import { DayColumn } from "./DayColumn";

const PX_PER_MIN = 2;
const SLOT_MIN = 30;
const SLOT_HEIGHT = SLOT_MIN * PX_PER_MIN;

const FALLBACK_COLOR: ProviderColor = {
  bg: "#e5e7eb",
  bgLight: "#f9fafb",
  border: "#d1d5db",
  text: "#374151",
};

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

type Props = {
  appointments: Appointment[];
  providers: Provider[];
  colorMap: Map<string, ProviderColor>;
  filterProviderId: string | null;
  filterServiceId: string | null;
  openTime: string;
  closeTime: string;
  onAppointmentClick: (appointment: Appointment) => void;
  onSlotClick: (providerId: string, time: string) => void;
};

export function DayView({
  appointments,
  providers,
  colorMap,
  filterProviderId,
  filterServiceId,
  openTime,
  closeTime,
  onAppointmentClick,
  onSlotClick,
}: Props) {
  const slots = generateTimeSlots(openTime, closeTime);
  const openMinutes = timeToMinutes(openTime);
  const totalHeight = slots.length * SLOT_HEIGHT;

  const visibleProviders = filterProviderId
    ? providers.filter((p) => p.id === filterProviderId)
    : providers;

  const byProvider = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const appt of appointments) {
      if (!appt.providerId) continue;
      const list = map.get(appt.providerId) ?? [];
      list.push(appt);
      map.set(appt.providerId, list);
    }
    return map;
  }, [appointments]);

  return (
    <div className="flex flex-1 overflow-y-auto">
      {/* Eje de horas */}
      <div
        className="w-14 flex-shrink-0 relative bg-surface-low border-r border-surface-high"
        style={{ height: totalHeight + 36 /* header offset */ }}
      >
        {/* Espacio del header de columna */}
        <div className="h-9" />
        {slots.map((slot, i) => (
          <div
            key={slot}
            className="absolute left-0 right-0 flex justify-end pr-2"
            style={{ top: 36 + i * SLOT_HEIGHT }}
          >
            <span className="text-xs text-ink-soft font-sans -mt-2">{slot}</span>
          </div>
        ))}
      </div>

      {/* Columnas por prestadora */}
      {visibleProviders.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-ink-soft text-sm font-sans">
          No hay prestadoras disponibles
        </div>
      ) : (
        <div className="flex flex-1 gap-px bg-surface-high overflow-x-auto">
          {visibleProviders.map((provider) => (
            <DayColumn
              key={provider.id}
              provider={provider}
              color={colorMap.get(provider.id) ?? FALLBACK_COLOR}
              appointments={byProvider.get(provider.id) ?? []}
              filterServiceId={filterServiceId}
              slots={slots}
              openMinutes={openMinutes}
              totalHeight={totalHeight}
              onAppointmentClick={onAppointmentClick}
              onSlotClick={onSlotClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
