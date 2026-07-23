import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api-client";
import type { Service } from "../lib/api-types";
import type { DeleteImpact } from "../components/ResourceManager";

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

export type AgreementInput = {
  serviceProviderId: string;
  paymentType?: string | null;
  rate?: number | null;
};

/** Reemplaza las categorías de un servicio (M:N). */
export function useSetServiceCategories() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, categoryIds }: { id: string; categoryIds: string[] }) =>
      apiFetch(`/api/agenda/services/${id}/categories`, token, {
        method: "PUT",
        body: JSON.stringify({ categoryIds }),
      }),
    onSuccess: invalidate,
  });
}

/** Reconcilia los acuerdos proveedora↔servicio (cierra viejo + crea nuevo, §4). */
export function useSetServiceAgreements() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, agreements }: { id: string; agreements: AgreementInput[] }) =>
      apiFetch(`/api/agenda/services/${id}/agreements`, token, {
        method: "PUT",
        body: JSON.stringify({ agreements }),
      }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ["service-agreements", id] });
      qc.invalidateQueries({ queryKey: ["providers-by-service"] });
    },
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

/** Preview de impacto antes del hard-delete: no es una query cacheada, se llama
 *  on-demand vía mutateAsync justo antes de mostrar la confirmación. */
export function useServiceDeleteImpact() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  return useMutation({
    mutationFn: (id: string) => apiFetch<DeleteImpact>(`/api/agenda/services/${id}/delete-impact`, token),
  });
}

export function useHardDeleteService() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/agenda/services/${id}/permanent`, token, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}
