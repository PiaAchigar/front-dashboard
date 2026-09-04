import type { Service } from "./api-types";
import { sinArea } from "./areas";

export type FiltroServicios = {
  /** Acota a un área del catálogo. Sin esto, todos los servicios. */
  area?: string;
  /** Sólo los que no tienen NINGÚN área — la pestaña de rescate. */
  soloSinArea?: boolean;
  /** Los nombres de las áreas, necesarios para `soloSinArea`. */
  nombresDeArea?: readonly string[];
  search?: string;
};

/**
 * Filtra la lista por área y por búsqueda, en ese orden.
 *
 * El área se compara contra los NOMBRES de las categorías del servicio, y un
 * servicio puede estar en varias: `service_category` vincula, no copia, así que
 * uno que esté en Estética y en Medicina sale en las dos listas siendo la misma
 * fila. Editarlo desde cualquiera de las dos edita ese registro único.
 */
export function filtrarServicios(services: Service[], filtro: FiltroServicios = {}): Service[] {
  const { area, soloSinArea, nombresDeArea = [], search = "" } = filtro;

  let filas = services;
  if (soloSinArea) filas = filas.filter((s) => sinArea(s, nombresDeArea));
  else if (area) filas = filas.filter((s) => s.categories.some((c) => c.name === area));

  const q = search.trim().toLowerCase();
  if (!q) return filas;
  return filas.filter(
    (s) => (s.name ?? "").toLowerCase().includes(q) || (s.code ?? "").toLowerCase().includes(q),
  );
}
