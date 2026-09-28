import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api-client";
import type { EquipoDeDepilacion } from "./useEquiposDeDepilacion";

/** Las máquinas que una proveedora sabe usar (`service_provider_machine`).
 *  Misma forma que un equipo de depilación — es la misma tabla de máquinas
 *  vista desde el otro lado. */
export type MaquinaDeProveedora = EquipoDeDepilacion;

export const MAQUINAS_DE_PROVEEDORA_KEY = "proveedora-maquinas";

/**
 * Las máquinas de VARIAS proveedoras a la vez: la pantalla de Comisión muestra
 * una fila por proveedora y cada fila necesita las suyas.
 *
 * Va por `useQueries` y no por un hook adentro de cada fila porque el estado de
 * los tildes y el diff contra lo guardado viven en la pantalla (el Guardar es
 * uno solo), así que la pantalla necesita las N respuestas, no cada fila la
 * suya.
 */
export function useMaquinasDeProveedoras(providerIds: string[]) {
  const { session } = useAuth();
  const token = session?.access_token ?? null;

  const resultados = useQueries({
    queries: providerIds.map((id) => ({
      queryKey: [MAQUINAS_DE_PROVEEDORA_KEY, id],
      queryFn: () =>
        apiFetch<MaquinaDeProveedora[]>(`/api/agenda/providers/${id}/machines`, token),
      enabled: !!token,
      staleTime: 60 * 1000,
    })),
  });

  const porProveedora: Record<string, MaquinaDeProveedora[]> = {};
  providerIds.forEach((id, i) => {
    const data = resultados[i]?.data;
    if (data) porProveedora[id] = data;
  });

  return { porProveedora, isLoading: resultados.some((r) => r.isLoading) };
}

function useInvalidarUna() {
  const qc = useQueryClient();
  return (providerId: string) =>
    qc.invalidateQueries({ queryKey: [MAQUINAS_DE_PROVEEDORA_KEY, providerId] });
}

/**
 * PUT / DELETE `/api/agenda/providers/:id/machines/:machineId`, de a UNA.
 *
 * No hay un PUT que reconcilie el conjunto, y no es un olvido: la
 * certificación es global por proveedora (`service_provider_machine` no tiene
 * columna de servicio), así que una pantalla de área que mandara la lista
 * entera le borraría a la proveedora las máquinas que usa en las otras.
 */
export function useHabilitarMaquina() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const invalidar = useInvalidarUna();

  return useMutation({
    mutationFn: ({ providerId, machineId }: { providerId: string; machineId: string }) =>
      apiFetch(`/api/agenda/providers/${providerId}/machines/${machineId}`, token, {
        method: "PUT",
      }),
    onSuccess: (_data, { providerId }) => invalidar(providerId),
  });
}

export function useDeshabilitarMaquina() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const invalidar = useInvalidarUna();

  return useMutation({
    mutationFn: ({ providerId, machineId }: { providerId: string; machineId: string }) =>
      apiFetch(`/api/agenda/providers/${providerId}/machines/${machineId}`, token, {
        method: "DELETE",
      }),
    onSuccess: (_data, { providerId }) => invalidar(providerId),
  });
}
