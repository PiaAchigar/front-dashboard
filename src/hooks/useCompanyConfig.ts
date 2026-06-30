import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api-client";
import type { CompanyConfig } from "../lib/api-types";

const KEY = "company-config";

export type BrandingPatch = {
  heroTitle?: string | null;
  heroSubtitle?: string | null;
  companyDescription?: string | null;
  aboutUs?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  whatsapp?: string | null;
  website?: string | null;
};

export type DatosPatch = {
  companyName?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
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

export function useUpdateBranding() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: BrandingPatch) =>
      apiFetch("/api/agenda/company-config/branding", token, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateDatos() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: DatosPatch) =>
      apiFetch("/api/agenda/company-config/datos", token, {
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
