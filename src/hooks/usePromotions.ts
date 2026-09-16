import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api-client";
import type { PromotionAdmin } from "../lib/api-types";

export function usePromotions() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;

  return useQuery({
    queryKey: ["promotions", "admin"],
    // El endpoint público filtra por `is_visible_web` desde 1.53.0, y ésta es
    // la pantalla donde se decide ese tilde: tiene que ver TODAS.
    queryFn: () => apiFetch<PromotionAdmin[]>("/api/agenda/promotions/admin", token),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  });
}
