import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api-client";
import type { Appointment } from "../lib/api-types";

export function appointmentsKey(date: string) {
  return ["appointments", date];
}

export function useAgendaAppointments(date: string) {
  const { session } = useAuth();
  const token = session?.access_token ?? null;

  return useQuery({
    queryKey: appointmentsKey(date),
    queryFn: () =>
      apiFetch<Appointment[]>(`/api/agenda/appointments?date=${date}`, token),
    enabled: !!date && !!token,
    staleTime: 30 * 1000,
  });
}

export function useInvalidateAppointments() {
  const qc = useQueryClient();
  return (date: string) => qc.invalidateQueries({ queryKey: appointmentsKey(date) });
}
