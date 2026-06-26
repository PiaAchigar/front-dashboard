import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api-client";
import type { ServiceAgreement } from "../lib/api-types";

/** Acuerdos vigentes (proveedora + tipo de pago + tarifa) de un servicio, para
 *  prefill del modal de edición. */
export function useServiceAgreements(serviceId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token ?? null;

  return useQuery({
    queryKey: ["service-agreements", serviceId],
    queryFn: () =>
      apiFetch<ServiceAgreement[]>(`/api/agenda/services/${serviceId}/agreements`, token),
    enabled: !!serviceId && !!token,
    staleTime: 60 * 1000,
  });
}
