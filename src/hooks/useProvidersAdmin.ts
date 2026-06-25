import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api-client";
import type { ProviderAdmin } from "../lib/api-types";

export type ProviderInput = {
  fullName: string;
  email?: string | null;
  phone?: string | null;
  dni?: string | null;
  cuit?: string | null;
  specialties?: string | null;
  notes?: string | null;
  address?: string | null;
  postalCode?: string | null;
};

const KEY = "providers-admin";

export function useProvidersAdmin(showArchived: boolean) {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const qs = showArchived ? "?includeInactive=true" : "";

  return useQuery({
    queryKey: [KEY, showArchived],
    queryFn: () => apiFetch<ProviderAdmin[]>(`/api/agenda/providers/all${qs}`, token),
    enabled: !!token,
    staleTime: 60 * 1000,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: [KEY] });
    qc.invalidateQueries({ queryKey: ["providers"] });
  };
}

export function useCreateProvider() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (data: ProviderInput) =>
      apiFetch("/api/agenda/providers", token, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: invalidate,
  });
}

export function useUpdateProvider() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...patch }: ProviderInput & { id: string }) =>
      apiFetch(`/api/agenda/providers/${id}`, token, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: invalidate,
  });
}

export function useArchiveProvider() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/agenda/providers/${id}`, token, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

export function useRestoreProvider() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/agenda/providers/${id}/restore`, token, { method: "POST" }),
    onSuccess: invalidate,
  });
}
