import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api-client";
import type { Training } from "../lib/api-types";

const KEY = "trainings-admin";

function useToken() {
  const { session } = useAuth();
  return session?.access_token ?? null;
}

/** Todas las capacitaciones activas (visibles o no) para administrar la web. */
export function useTrainingsAdmin() {
  const token = useToken();
  return useQuery({
    queryKey: [KEY],
    queryFn: () => apiFetch<Training[]>("/api/agenda/trainings/admin", token),
    enabled: !!token,
    staleTime: 60 * 1000,
  });
}

type TrainingWebPatch = {
  id: string;
  isVisible?: boolean;
  isFeatured?: boolean;
  webSortOrder?: number;
};

export function useUpdateTrainingWeb() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: TrainingWebPatch) =>
      apiFetch(`/api/agenda/trainings/${id}`, token, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
