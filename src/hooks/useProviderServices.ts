import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api-client";
import type { ProviderService } from "../lib/api-types";

export function useProviderServices(providerId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token ?? null;

  return useQuery({
    queryKey: ["provider-services", providerId],
    queryFn: () =>
      apiFetch<ProviderService[]>(`/api/agenda/providers/${providerId}/services`, token),
    enabled: !!providerId,
    staleTime: 5 * 60 * 1000,
  });
}
