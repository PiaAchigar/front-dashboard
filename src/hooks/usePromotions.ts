import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api-client";
import type { Promotion } from "../lib/api-types";

export function usePromotions() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;

  return useQuery({
    queryKey: ["promotions"],
    queryFn: () => apiFetch<Promotion[]>("/api/agenda/promotions", token),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  });
}
