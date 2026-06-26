import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api-client";
import type { Provider } from "../lib/api-types";

/** Proveedoras activas que brindan un servicio dado. Para elegir a quién se le paga en una promo. */
export function useProvidersByService(serviceId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token ?? null;

  return useQuery({
    queryKey: ["providers-by-service", serviceId],
    queryFn: () =>
      apiFetch<Provider[]>(`/api/agenda/providers?serviceId=${serviceId}`, token),
    enabled: !!serviceId && !!token,
    staleTime: 5 * 60 * 1000,
  });
}
