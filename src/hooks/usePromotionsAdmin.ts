import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import type { DeleteImpact } from "../components/ResourceManager";
import { apiFetch } from "../lib/api-client";
import type { PromotionAdmin, PromotionInput } from "../lib/api-types";

export type { PromotionInput } from "../lib/api-types";

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

export function useDeletePromotion() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/agenda/promotions/admin/${id}/delete`, token, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

/**
 * Qué se lleva puesto borrar una promo. No es una query cacheada: se llama
 * on-demand justo antes de la confirmación, igual que Servicios y Zonas.
 *
 * Nunca bloquea —las ventas conservan su `promotion_name`—, pero tiene que
 * decir las dos cosas que cambian en silencio: las ventas que quedan sin promo
 * y los pagos acordados que se borran.
 */
export function usePromotionDeleteImpact() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<DeleteImpact>(`/api/agenda/promotions/admin/${id}/delete-impact`, token),
  });
}
