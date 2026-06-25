import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api-client";
import type { CompanyConfig } from "../lib/api-types";

const KEY = "company-config";

export type CompanyConfigPatch = {
  companyName?: string | null;
  companyDescription?: string | null;
  heroTitle?: string | null;
  heroSubtitle?: string | null;
  aboutUs?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  whatsapp?: string | null;
};

export function useCompanyConfig() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  return useQuery({
    queryKey: [KEY],
    queryFn: () => apiFetch<CompanyConfig>("/api/agenda/company-config", token),
    enabled: !!token,
    staleTime: 60 * 1000,
  });
}

export function useUpdateCompanyConfig() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: CompanyConfigPatch) =>
      apiFetch("/api/agenda/company-config", token, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export type OpenHourInput = {
  dayOfWeek: number;
  openingTime?: string | null;
  closingTime?: string | null;
  isOpen?: boolean | null;
};

export function useUpdateOpenHours() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (days: OpenHourInput[]) =>
      apiFetch("/api/agenda/company-config/open-hours", token, {
        method: "PATCH",
        body: JSON.stringify({ days }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
