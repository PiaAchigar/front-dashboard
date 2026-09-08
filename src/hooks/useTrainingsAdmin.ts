import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api-client";

/**
 * Las capacitaciones profesionales (`training`): instructorados y workshops que
 * Piu Bella dicta. No son servicios ni actividades — tienen su propia tabla
 * desde la 1.0.0, con inscripciones y suscripciones colgando.
 */
export type Training = {
  id: string;
  name: string | null;
  description: string | null;
  modality: string | null;
  location: string | null;
  totalSessions: number | null;
  durationPerSessionMinutes: number | null;
  prerequisitesText: string | null;
  maxParticipants: number | null;
  includesCertification: boolean | null;
  certificationTitle: string | null;
  listPrice: number | null;
  cashPrice: number | null;
  taxCategory: string | null;
  isVisible: boolean | null;
  isFeatured: boolean | null;
  webSortOrder: number | null;
  isActive: boolean | null;
};

export type TrainingInput = Omit<Training, "id" | "isActive"> & { name: string };

const KEY = "trainings-admin";

function useToken() {
  const { session } = useAuth();
  return session?.access_token ?? null;
}

/**
 * Invalida las dos pantallas de una sola vez.
 *
 * `useTrainingsWeb` (Sitio Web → Capacitaciones) usa este MISMO prefijo con la
 * clave `["trainings-admin"]`, y esta pantalla usa
 * `["trainings-admin", showArchived]`. Como React Query invalida por prefijo,
 * un solo `invalidateQueries` refresca las dos: archivar una capacitación acá
 * la saca de allá sin recargar la página.
 */
function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [KEY] });
}

export function useTrainingsAdmin(showArchived: boolean) {
  const token = useToken();
  const qs = showArchived ? "?includeInactive=true" : "";
  return useQuery({
    queryKey: [KEY, showArchived],
    queryFn: () => apiFetch<Training[]>(`/api/agenda/trainings/admin${qs}`, token),
    enabled: !!token,
    staleTime: 60 * 1000,
  });
}

export function useCreateTraining() {
  const token = useToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: TrainingInput) =>
      apiFetch<Training>("/api/agenda/trainings", token, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: invalidate,
  });
}

export function useUpdateTraining() {
  const token = useToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<TrainingInput> & { id: string }) =>
      apiFetch<Training>(`/api/agenda/trainings/${id}`, token, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: invalidate,
  });
}

export function useArchiveTraining() {
  const token = useToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/agenda/trainings/${id}`, token, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

export function useRestoreTraining() {
  const token = useToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/agenda/trainings/${id}/restore`, token, { method: "POST" }),
    onSuccess: invalidate,
  });
}
