import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api-client";
import type { ComboAdmin } from "../lib/api-types";

export type ComboLineInput = {
  serviceId: string;
  sessionsIncluded: number;
};

export type ComboInput = {
  name: string;
  description?: string | null;
  priceType: "fixed" | "percentage";
  fixedPrice?: number | null;
  discountPercentage?: number | null;
  validityMonths: number;
  isVisibleWeb?: boolean | null;
  displayOrder?: number | null;
  lines: ComboLineInput[];
};

const KEY = "combos-admin";

export function useCombosAdmin(showArchived: boolean) {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const qs = showArchived ? "?includeInactive=true" : "";

  return useQuery({
    queryKey: [KEY, showArchived],
    queryFn: () => apiFetch<ComboAdmin[]>(`/api/agenda/combos/admin${qs}`, token),
    enabled: !!token,
    staleTime: 60 * 1000,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: [KEY] });
    qc.invalidateQueries({ queryKey: ["combos"] }); // la web pública también los lee
  };
}

export function useCreateCombo() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (data: ComboInput) =>
      apiFetch("/api/agenda/combos/admin", token, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: invalidate,
  });
}

export function useUpdateComboAdmin() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...data }: ComboInput & { id: string }) =>
      apiFetch(`/api/agenda/combos/admin/${id}`, token, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: invalidate,
  });
}

export function useArchiveCombo() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/agenda/combos/admin/${id}`, token, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

export function useRestoreCombo() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/agenda/combos/admin/${id}/restore`, token, { method: "POST" }),
    onSuccess: invalidate,
  });
}

export function useDeleteCombo() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/agenda/combos/admin/${id}/delete`, token, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}
