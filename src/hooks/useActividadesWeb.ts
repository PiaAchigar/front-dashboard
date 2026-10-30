import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api-client";
import { useToken } from "./useToken";

/** Una actividad con su check "Publicar en la web" (activities.is_visible_web, 1.64.0). */
export type ActividadWeb = {
  id: string;
  name: string | null;
  isVisibleWeb: boolean;
};

const KEY = "actividades-web";

/** Las actividades activas, publicadas o no: acá es donde Laura decide. */
export function useActividadesWeb() {
  const token = useToken();
  return useQuery({
    queryKey: [KEY],
    queryFn: async () => (await apiFetch<{ data: ActividadWeb[] }>("/api/activities", token)).data ?? [],
    enabled: !!token,
    staleTime: 60 * 1000,
  });
}

export function useUpdateActividadWeb() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isVisibleWeb }: { id: string; isVisibleWeb: boolean }) =>
      apiFetch(`/api/activities/${id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ isVisibleWeb }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
