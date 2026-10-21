import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api-client";
import { useToken } from "./useToken";

/** Una actividad del catálogo, lo mínimo que necesita el selector de horarios. */
export type ActividadResumen = {
  id: string;
  name: string;
  activityType: "class" | "machine";
  isActive: boolean;
};

/** Un horario semanal de una actividad. Las horas vienen "HH:MM:SS" en hora local del negocio. */
export type ActivitySchedule = {
  id: string;
  activityId: string | null;
  machineId: string | null;
  /** 0 = domingo … 6 = sábado */
  dayOfWeek: number | null;
  startTime: string | null;
  endTime: string | null;
  validFrom: string | null;
  validUntil: string | null;
  /** null = sin límite */
  capacity: number | null;
  isActive: boolean | null;
  /** Quién dicta ese horario. null = sin proveedora (máquinas). */
  serviceProviderId?: string | null;
  providerName?: string | null;
};

export type HorarioInput = {
  machineId?: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  validFrom?: string | null;
  validUntil?: string | null;
  capacity: number | null;
  serviceProviderId?: string | null;
};

const KEY = "activity-schedules";

export function useActividadesResumen() {
  const token = useToken();
  return useQuery({
    queryKey: ["activities-resumen"],
    queryFn: async () => (await apiFetch<{ data: ActividadResumen[] }>("/api/activities", token)).data ?? [],
    enabled: !!token,
    staleTime: 60 * 1000,
  });
}

/** Trae también los pausados: sin ellos no habría cómo reactivarlos. */
export function useActivitySchedules(activityId: string | null) {
  const token = useToken();
  return useQuery({
    queryKey: [KEY, activityId],
    queryFn: async () =>
      (
        await apiFetch<{ data: ActivitySchedule[] }>(
          `/api/activities/${activityId}/schedules?includeInactive=true`,
          token,
        )
      ).data ?? [],
    enabled: !!token && !!activityId,
    staleTime: 60 * 1000,
  });
}

export function useCrearHorario(activityId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: HorarioInput) =>
      apiFetch(`/api/activities/${activityId}/schedules`, token, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, activityId] }),
  });
}

/** Sirve para editar y para Pausar/Reactivar (`{ isActive }`). */
export function useEditarHorario(activityId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<HorarioInput> & { id: string; isActive?: boolean }) =>
      apiFetch(`/api/activities/schedules/${id}`, token, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, activityId] }),
  });
}
