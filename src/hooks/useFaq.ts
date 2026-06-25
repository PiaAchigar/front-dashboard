import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api-client";
import type { Faq } from "../lib/api-types";

const KEY = "faq-admin";

export type FaqInput = {
  question?: string | null;
  answer?: string | null;
  category?: string | null;
  displayOrder?: number | null;
  keywords?: string[] | null;
};

function useToken() {
  const { session } = useAuth();
  return session?.access_token ?? null;
}

export function useFaqs(showArchived: boolean) {
  const token = useToken();
  const qs = showArchived ? "?includeInactive=true" : "";
  return useQuery({
    queryKey: [KEY, showArchived],
    queryFn: () => apiFetch<Faq[]>(`/api/agenda/faq${qs}`, token),
    enabled: !!token,
    staleTime: 60 * 1000,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [KEY] });
}

export function useCreateFaq() {
  const token = useToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (data: FaqInput) =>
      apiFetch("/api/agenda/faq", token, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: invalidate,
  });
}

export function useUpdateFaq() {
  const token = useToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...patch }: FaqInput & { id: string }) =>
      apiFetch(`/api/agenda/faq/${id}`, token, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: invalidate,
  });
}

export function useArchiveFaq() {
  const token = useToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/agenda/faq/${id}`, token, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

export function useRestoreFaq() {
  const token = useToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/agenda/faq/${id}/restore`, token, { method: "POST" }),
    onSuccess: invalidate,
  });
}
