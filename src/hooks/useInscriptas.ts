import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

/** Lo que responde POST /api/agenda/classes/anotar-a-capacitacion (dentro de `data`). */
export type ResultadoAnotarEncuentros = {
  anotada: number;
  yaEstaba: number;
  /** N.º de los encuentros que estaban llenos */
  sinLugar: number[];
};

/** Anota a la clienta en los encuentros que le faltan y recarga las inscriptas. */
export function useAnotarEnEncuentros() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { trainingId: string; customerId: string }) => {
      const r = await apiFetch<{ success: boolean; data: ResultadoAnotarEncuentros }>(
        "/api/agenda/classes/anotar-a-capacitacion",
        token,
        { method: "POST", body: JSON.stringify(v) },
      );
      return r.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
