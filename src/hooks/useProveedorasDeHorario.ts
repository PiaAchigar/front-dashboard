import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api-client";
import type { WeeklyWindow } from "../lib/horario-proveedora";
import { useToken } from "./useToken";

export interface ProveedoraOpcion {
  id: string;
  /** La API devuelve `fullName`, no `name` */
  fullName: string | null;
  specialties: string | null;
}

/** Proveedoras activas, para elegir en el horario de una actividad. */
export function useProveedorasActivas() {
  const token = useToken();
  return useQuery({
    queryKey: ["agenda-providers-opciones"],
    // OJO: este endpoint devuelve un ARRAY pelado, no { data: [...] }.
    queryFn: async () => (await apiFetch<ProveedoraOpcion[]>("/api/agenda/providers", token)) ?? [],
    enabled: !!token,
    staleTime: 60 * 1000,
  });
}

/** Horario semanal de todas las proveedoras, por id, para mostrarlo al elegir. */
export function useHorarioSemanalProveedoras() {
  const token = useToken();
  return useQuery({
    queryKey: ["agenda-providers-weekly"],
    queryFn: async () =>
      (await apiFetch<Record<string, WeeklyWindow[]>>("/api/agenda/providers/availability/weekly", token)) ?? {},
    enabled: !!token,
    staleTime: 60 * 1000,
  });
}
