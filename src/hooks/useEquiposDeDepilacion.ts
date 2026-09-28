import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api-client";
import { MAQUINAS_DE_PROVEEDORA_KEY } from "./useMaquinasDeProveedora";

/** Una máquina que la depilación usa: `service_machine` del servicio ancla.
 *  `machineStatus` viaja porque la disponibilidad sólo mira las `active` — un
 *  equipo en mantenimiento deja a la proveedora sin horarios y nada más lo
 *  explicaría. */
export type EquipoDeDepilacion = {
  machineId: string;
  machineName: string | null;
  machineStatus: string | null;
};

export const EQUIPOS_KEY = ["depilacion", "equipos"];

/** GET /api/agenda/depilacion/equipos */
export function useEquiposDeDepilacion() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;

  return useQuery({
    queryKey: EQUIPOS_KEY,
    queryFn: () =>
      apiFetch<EquipoDeDepilacion[]>("/api/agenda/depilacion/equipos", token),
    enabled: !!token,
    staleTime: 60 * 1000,
  });
}

/** Las dos mutaciones invalidan TAMBIÉN las máquinas de cada proveedora: sacar
 *  un equipo de la depilación arrastra, en el backend (`sacarEquipo`), la
 *  certificación de ese equipo en las proveedoras que hacen depilación. Sin
 *  esta invalidación la pantalla seguiría mostrando tildado algo que el
 *  servidor ya borró. */
function useInvalidarEquipos() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: EQUIPOS_KEY });
    qc.invalidateQueries({ queryKey: [MAQUINAS_DE_PROVEEDORA_KEY] });
  };
}

/** PUT /equipos/:machineId — idempotente del lado del backend. */
export function useAgregarEquipo() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const invalidar = useInvalidarEquipos();

  return useMutation({
    mutationFn: (machineId: string) =>
      apiFetch(`/api/agenda/depilacion/equipos/${machineId}`, token, { method: "PUT" }),
    onSuccess: invalidar,
  });
}

/** DELETE /equipos/:machineId */
export function useSacarEquipo() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const invalidar = useInvalidarEquipos();

  return useMutation({
    mutationFn: (machineId: string) =>
      apiFetch(`/api/agenda/depilacion/equipos/${machineId}`, token, { method: "DELETE" }),
    onSuccess: invalidar,
  });
}
