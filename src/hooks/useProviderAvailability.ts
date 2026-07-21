import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api-client";
import type {
  AvailabilityException,
  ConflictingAppointment,
  SaturdayOverride,
  WeeklyAvailabilityRow,
} from "../lib/api-types";

function useToken() {
  const { session } = useAuth();
  return session?.access_token ?? null;
}

// ── Semanal ──────────────────────────────────────────────────────────────────

export type WeeklyRowInput = { dayOfWeek: number; workStartTime: string; workEndTime: string };

export function useWeeklyAvailability(providerId: string | null) {
  const token = useToken();
  return useQuery({
    queryKey: ["availability-weekly", providerId],
    queryFn: () =>
      apiFetch<WeeklyAvailabilityRow[]>(
        `/api/agenda/providers/${providerId}/availability/weekly`,
        token,
      ),
    enabled: !!token && !!providerId,
  });
}

export function useSaveWeeklyAvailability(providerId: string | null) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: WeeklyRowInput[]) =>
      apiFetch<WeeklyAvailabilityRow[]>(
        `/api/agenda/providers/${providerId}/availability/weekly`,
        token,
        { method: "PUT", body: JSON.stringify({ rows }) },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["availability-weekly", providerId] }),
  });
}

// ── Sábados ──────────────────────────────────────────────────────────────────

export type SaturdayInput = {
  saturdayDate: string;
  isWorking: boolean;
  workStartTime?: string | null;
  workEndTime?: string | null;
  notes?: string | null;
};

export function useSaturdaySchedules(providerId: string | null) {
  const token = useToken();
  return useQuery({
    queryKey: ["availability-saturdays", providerId],
    queryFn: () =>
      apiFetch<SaturdayOverride[]>(
        `/api/agenda/providers/${providerId}/availability/saturdays`,
        token,
      ),
    enabled: !!token && !!providerId,
  });
}

export function useAddSaturday(providerId: string | null) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SaturdayInput) =>
      apiFetch<SaturdayOverride>(
        `/api/agenda/providers/${providerId}/availability/saturdays`,
        token,
        { method: "POST", body: JSON.stringify(data) },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["availability-saturdays", providerId] }),
  });
}

export function useDeleteSaturday(providerId: string | null) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rowId: string) =>
      apiFetch(`/api/agenda/providers/${providerId}/availability/saturdays/${rowId}`, token, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["availability-saturdays", providerId] }),
  });
}

// ── Excepciones ──────────────────────────────────────────────────────────────

export type ExceptionInput = {
  exceptionType: string;
  dateException?: string | null;
  dateStart?: string | null;
  dateEnd?: string | null;
  timeOverrideStart?: string | null;
  timeOverrideEnd?: string | null;
  reason?: string | null;
  isWorking: boolean;
};

export type AddExceptionResult = AvailabilityException & {
  conflictingAppointments: ConflictingAppointment[];
};

export function useExceptions(providerId: string | null) {
  const token = useToken();
  return useQuery({
    queryKey: ["availability-exceptions", providerId],
    queryFn: () =>
      apiFetch<AvailabilityException[]>(
        `/api/agenda/providers/${providerId}/availability/exceptions`,
        token,
      ),
    enabled: !!token && !!providerId,
  });
}

export function useAddException(providerId: string | null) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ExceptionInput) =>
      apiFetch<AddExceptionResult>(
        `/api/agenda/providers/${providerId}/availability/exceptions`,
        token,
        { method: "POST", body: JSON.stringify(data) },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["availability-exceptions", providerId] }),
  });
}

export function useDeleteException(providerId: string | null) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rowId: string) =>
      apiFetch(`/api/agenda/providers/${providerId}/availability/exceptions/${rowId}`, token, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["availability-exceptions", providerId] }),
  });
}
