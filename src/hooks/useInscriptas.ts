import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api-client";
import { useToken } from "./useToken";

/**
 * Una clienta que compró la capacitación. `debe` es lo que le falta pagar (0 = pagada);
 * `encuentrosAnotada` cuenta los encuentros activos en que tiene un turno no cancelado.
 */
export type Inscripta = {
  customerPurchaseId: string;
  customerId: string;
  nombre: string;
  /** ISO de la compra */
  compradaEl: string;
  debe: number;
  encuentrosAnotada: number;
  encuentrosTotales: number;
};

const KEY = "inscriptas";

/** La API responde el array directo, sin envoltorio `{ data }`. */
export function useInscriptas(trainingId: string | null) {
  const token = useToken();
  return useQuery({
    queryKey: [KEY, trainingId],
    queryFn: () => apiFetch<Inscripta[]>(`/api/agenda/trainings/${trainingId}/inscriptas`, token),
    enabled: !!token && !!trainingId,
    staleTime: 60 * 1000,
  });
}
