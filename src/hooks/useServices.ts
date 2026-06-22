import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api-client";
import type { Service } from "../lib/api-types";

export function useServices(filters?: { categoryId?: string; q?: string }) {
  const { session } = useAuth();
  const token = session?.access_token ?? null;

  const params = new URLSearchParams();
  if (filters?.categoryId) params.set("categoryId", filters.categoryId);
  if (filters?.q) params.set("q", filters.q);
  const qs = params.size > 0 ? `?${params.toString()}` : "";

  return useQuery({
    queryKey: ["services", filters ?? "all"],
    queryFn: () => apiFetch<Service[]>(`/api/agenda/services${qs}`, token),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  });
}
