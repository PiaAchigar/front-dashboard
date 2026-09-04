import type { Service } from "./api-types";

/**
 * Filtra la lista por área y por búsqueda, en ese orden.
 *
 * El área se compara contra los NOMBRES de las categorías del servicio, y un
 * servicio puede estar en varias: `service_category` vincula, no copia, así que
 * uno que esté en Estética y en Medicina sale en las dos listas siendo la misma
 * fila. Editarlo desde cualquiera de las dos edita ese registro único.
 */
export function filtrarServicios(services: Service[], area: string | undefined, search: string) {
  const q = search.trim().toLowerCase();
  const delArea = area
    ? services.filter((s) => s.categories.some((c) => c.name === area))
    : services;
  if (!q) return delArea;
  return delArea.filter(
    (s) => (s.name ?? "").toLowerCase().includes(q) || (s.code ?? "").toLowerCase().includes(q),
  );
}
