import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api-client";
import type { MpAccount } from "../lib/api-types";

export type MpAccountInput = {
  alias?: string | null;
  cvu?: string | null;
  accountOwnerName?: string | null;
  accountEmail?: string | null;
};

function useToken() {
  const { session } = useAuth();
  return session?.access_token ?? null;
}

export function useProviderMpAccounts(providerId: string | null) {
  const token = useToken();
  return useQuery({
    queryKey: ["mp-accounts", providerId],
    queryFn: () => apiFetch<MpAccount[]>(`/api/agenda/providers/${providerId}/mp-accounts`, token),
    enabled: !!token && !!providerId,
  });
}

function useInvalidate(providerId: string | null) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["mp-accounts", providerId] });
}

export function useCreateMpAccount(providerId: string | null) {
  const token = useToken();
  const invalidate = useInvalidate(providerId);
  return useMutation({
    mutationFn: (data: MpAccountInput) =>
      apiFetch(`/api/agenda/providers/${providerId}/mp-accounts`, token, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: invalidate,
  });
}

/** Variante para encadenar tras crear la proveedora: el providerId llega al mutar. */
export function useCreateMpAccountForProvider() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ providerId, ...data }: MpAccountInput & { providerId: string }) =>
      apiFetch(`/api/agenda/providers/${providerId}/mp-accounts`, token, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ["mp-accounts", vars.providerId] }),
  });
}

export function useUpdateMpAccount(providerId: string | null) {
  const token = useToken();
  const invalidate = useInvalidate(providerId);
  return useMutation({
    mutationFn: ({ accountId, ...patch }: MpAccountInput & { accountId: string }) =>
      apiFetch(`/api/agenda/providers/mp-accounts/${accountId}`, token, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: invalidate,
  });
}

export function useDeleteMpAccount(providerId: string | null) {
  const token = useToken();
  const invalidate = useInvalidate(providerId);
  return useMutation({
    mutationFn: (accountId: string) =>
      apiFetch(`/api/agenda/providers/mp-accounts/${accountId}`, token, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}
