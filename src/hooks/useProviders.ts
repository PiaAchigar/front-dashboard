import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api-client";
import type { Provider } from "../lib/api-types";

export function useProviders(serviceId?: string) {
  const { session } = useAuth();
  const token = session?.access_token ?? null;

  const params = serviceId ? `?serviceId=${serviceId}` : "";

  return useQuery({
    queryKey: ["providers", serviceId ?? "all"],
    queryFn: () => apiFetch<Provider[]>(`/api/agenda/providers${params}`, token),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  });
}
