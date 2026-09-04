import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api-client";
import type { CategoryNode } from "../lib/api-types";

/**
 * Las categorías del eje "área" (migración 1.37.0): Estética, Depilación
 * Definitiva, Medicina y Dermatología, Masajes y Bienestar, Actividades,
 * Capacitaciones.
 *
 * ⚠️ Pide `includeInactive=true` a propósito. Las tres áreas que tienen
 * servicios están ARCHIVADAS: el sitio público arma su árbol con las
 * categorías activas que tengan servicios, así que activarlas haría que
 * /servicios duplicara todo el catálogo. Están archivadas para el público,
 * pero el dashboard las necesita igual — sin esto, el formulario de servicio
 * no las ofrece y no hay forma de asignarle un área a nada.
 *
 * Sólo staff recibe las archivadas; el endpoint ignora el parámetro para el
 * resto, así que esto no filtra nada a quien no debe verlo.
 */
export function useAreas() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;

  return useQuery({
    queryKey: ["categories-areas"],
    queryFn: () =>
      apiFetch<CategoryNode[]>("/api/agenda/categories?kind=area&includeInactive=true", token),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  });
}

/** Los nombres, que es con lo que se compara la categoría de un servicio. */
export function nombresDeArea(areas: CategoryNode[]): string[] {
  return areas.map((a) => a.name).filter((n): n is string => n !== null);
}
