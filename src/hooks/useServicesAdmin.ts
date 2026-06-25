import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api-client";
import type { Service } from "../lib/api-types";

export type ServiceInput = {
  name: string;
  description?: string | null;
  code?: string | null;
  unitPriceList?: number | null;
  unitPriceCash?: number | null;
  unitType?: string | null;
  taxCategory?: string | null;
  requiresOperator?: boolean | null;
  requiresMachine?: boolean | null;
  estimatedDurationMinutes?: number | null;
  isVisible?: boolean | null;
  isFeatured?: boolean | null;
  webSortOrder?: number | null;
};

const KEY = "services-admin";

export function useServicesAdmin(showArchived: boolean) {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const qs = showArchived ? "?includeInactive=true" : "";

  return useQuery({
    queryKey: [KEY, showArchived],
    queryFn: () => apiFetch<Service[]>(`/api/agenda/services${qs}`, token),
    enabled: !!token,
    staleTime: 60 * 1000,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: [KEY] });
    qc.invalidateQueries({ queryKey: ["services"] });
  };
}

export function useCreateService() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (data: ServiceInput) =>
      apiFetch("/api/agenda/services", token, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: invalidate,
  });
}

export function useUpdateServiceAdmin() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<ServiceInput> & { id: string }) =>
      apiFetch(`/api/agenda/services/${id}`, token, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: invalidate,
  });
}

export function useArchiveService() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/agenda/services/${id}`, token, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

export function useRestoreService() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/agenda/services/${id}/restore`, token, { method: "POST" }),
    onSuccess: invalidate,
  });
}
