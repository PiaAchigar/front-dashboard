import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api-client";
import { useToken } from "./useToken";

/** Un encuentro de una capacitación. Las horas vienen "HH:MM:SS" en hora local del negocio. */
export type Encuentro = {
  id: string;
  trainingId: string;
  sessionNumber: number;
  sessionDate: string;
  startTime: string;
  endTime: string;
  serviceProviderId: string | null;
  providerName: string | null;
  location: string | null;
  /** null = el cupo de la capacitación */
  capacity: number | null;
  isActive: boolean;
  /** Turnos con este encuentro que no están cancelados. */
  anotadas: number;
};

export type EncuentroInput = {
  sessionNumber: number;
  sessionDate: string;
  startTime: string;
  endTime: string;
  serviceProviderId?: string | null;
  location?: string | null;
  capacity?: number | null;
};

export type GenerarInput = {
  desde: string;
  /** 0 = domingo … 6 = sábado */
  diaDeLaSemana: number;
  startTime: string;
  endTime: string;
  serviceProviderId?: string | null;
  cantidad?: number;
};

const KEY = "encuentros";

/** Trae también los de baja: sin ellos no habría cómo reactivarlos, y la API
 *  rechaza generar si hay cualquiera (activo o no). */
export function useEncuentros(trainingId: string | null) {
  const token = useToken();
  return useQuery({
    queryKey: [KEY, trainingId],
    queryFn: () =>
      apiFetch<Encuentro[]>(`/api/agenda/trainings/${trainingId}/sessions?incluirInactivos=true`, token),
    enabled: !!token && !!trainingId,
    staleTime: 60 * 1000,
  });
}

export function useCrearEncuentro(trainingId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: EncuentroInput) =>
      apiFetch(`/api/agenda/trainings/${trainingId}/sessions`, token, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, trainingId] }),
  });
}

/** Sirve para editar y para Dar de baja / Reactivar (`{ isActive }`). */
export function useEditarEncuentro(trainingId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<EncuentroInput> & { id: string; isActive?: boolean }) =>
      apiFetch(`/api/agenda/trainings/sessions/${id}`, token, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, trainingId] }),
  });
}

export function useGenerarEncuentros(trainingId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: GenerarInput) =>
      apiFetch(`/api/agenda/trainings/${trainingId}/sessions/generar`, token, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, trainingId] }),
  });
}
