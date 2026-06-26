import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api-client";
import type { PromotionAdmin } from "../lib/api-types";

export type PromoLineInput = {
  serviceId: string;
  serviceProviderId?: string | null;
  providerPayment?: number | null;
};

export type PromotionInput = {
  name: string;
  description?: string | null;
  promotionType?: string | null; // 'percentage' | 'fixed_amount'
  discountPercentage?: number | null;
  discountAmount?: number | null;
  validFrom?: string | null;
  validUntil?: string | null;
  isFeatured?: boolean | null;
  usageLimit?: number | null;
  notes?: string | null;
  lines: PromoLineInput[];
};

const KEY = "promotions-admin";

export function usePromotionsAdmin(showArchived: boolean) {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const qs = showArchived ? "?includeInactive=true" : "";

  return useQuery({
    queryKey: [KEY, showArchived],
    queryFn: () => apiFetch<PromotionAdmin[]>(`/api/agenda/promotions/admin${qs}`, token),
    enabled: !!token,
    staleTime: 60 * 1000,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: [KEY] });
    qc.invalidateQueries({ queryKey: ["promotions"] }); // la web pública también lee promos
  };
}

export function useCreatePromotion() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (data: PromotionInput) =>
      apiFetch("/api/agenda/promotions/admin", token, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: invalidate,
  });
}

export function useUpdatePromotionAdmin() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...data }: PromotionInput & { id: string }) =>
      apiFetch(`/api/agenda/promotions/admin/${id}`, token, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: invalidate,
  });
}

export function useArchivePromotion() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/agenda/promotions/admin/${id}`, token, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

export function useRestorePromotion() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/agenda/promotions/admin/${id}/restore`, token, { method: "POST" }),
    onSuccess: invalidate,
  });
}
