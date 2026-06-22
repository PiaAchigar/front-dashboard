import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api-client";
import type { CompanyConfig } from "../lib/api-types";

export function useCompanyConfig() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;

  return useQuery({
    queryKey: ["company-config"],
    queryFn: () => apiFetch<CompanyConfig>("/api/agenda/company-config", token),
    enabled: !!token,
    staleTime: 10 * 60 * 1000,
  });
}
