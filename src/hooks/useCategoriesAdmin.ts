import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api-client";
import type { CategoryNode } from "../lib/api-types";

export type CategoryInput = {
  name: string;
  description?: string | null;
  parentCategoryId?: string | null;
  displayOrder?: number | null;
};

const KEY = "categories-admin";

export function useCategoriesAdmin(showArchived: boolean) {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const qs = showArchived ? "?includeInactive=true" : "";

  return useQuery({
    queryKey: [KEY, showArchived],
    queryFn: () => apiFetch<CategoryNode[]>(`/api/agenda/categories${qs}`, token),
    enabled: !!token,
    staleTime: 60 * 1000,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: [KEY] });
    qc.invalidateQueries({ queryKey: ["categories"] });
  };
}

export function useCreateCategory() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (data: CategoryInput) =>
      apiFetch("/api/agenda/categories", token, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: invalidate,
  });
}

export function useUpdateCategory() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...patch }: CategoryInput & { id: string }) =>
      apiFetch(`/api/agenda/categories/${id}`, token, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: invalidate,
  });
}

export function useArchiveCategory() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/agenda/categories/${id}`, token, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

export function useRestoreCategory() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/agenda/categories/${id}/restore`, token, { method: "POST" }),
    onSuccess: invalidate,
  });
}
