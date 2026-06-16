import { useQueries } from "@tanstack/react-query";
import type { Appointment, Provider } from "../../lib/api-types";
import type { ProviderColor } from "../../lib/agenda-colors";
import { getWeekDays, toLocalDateString } from "../../lib/agenda-utils";
import { apiFetch } from "../../lib/api-client";
import { useAuth } from "../../auth/AuthContext";
import { WeekDayCell } from "./WeekDayCell";

type Props = {
  date: Date;
  providers: Provider[];
  colorMap: Map<string, ProviderColor>;
  filterProviderId: string | null;
  filterServiceId: string | null;
  onDayClick: (date: Date) => void;
  onAppointmentClick: (appointment: Appointment) => void;
};

export function WeekView({
  date,
  providers: _providers,
  colorMap,
  filterProviderId,
  filterServiceId,
  onDayClick,
  onAppointmentClick,
}: Props) {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const today = new Date();
  const weekDays = getWeekDays(date);

  const weekQueries = useQueries({
    queries: weekDays.map((day) => {
      const dateStr = toLocalDateString(day);
      return {
        queryKey: ["appointments", dateStr],
        queryFn: () =>
          apiFetch<Appointment[]>(`/api/agenda/appointments?date=${dateStr}`, token),
        staleTime: 30 * 1000,
      };
    }),
  });

  const appointmentsByDay = weekQueries.map((q) => q.data ?? []);
  const isLoading = weekQueries.some((q) => q.isLoading);

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      {isLoading && (
        <div className="flex items-center justify-center py-4 text-xs text-ink-soft font-sans">
          Cargando semana...
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {weekDays.map((day, i) => (
          <WeekDayCell
            key={toLocalDateString(day)}
            day={day}
            today={today}
            appointments={appointmentsByDay[i] ?? []}
            colorMap={colorMap}
            filterProviderId={filterProviderId}
            filterServiceId={filterServiceId}
            onDayClick={(d) => onDayClick(d)}
            onAppointmentClick={onAppointmentClick}
          />
        ))}
      </div>
    </div>
  );
}
