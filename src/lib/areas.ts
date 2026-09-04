/**
 * Las áreas de un servicio — el eje "qué es" de `categories.kind` (migración
 * 1.37.0).
 *
 * Un servicio puede estar en varias a la vez y eso es correcto: una limpieza
 * facial con aparatología es cosmetología Y medicina. `service_category`
 * vincula, no copia, así que sigue siendo UNA fila: aparece en las dos
 * pestañas y editarla desde cualquiera edita el mismo registro.
 */

export type ConCategorias = { categories: { id: string; name: string | null }[] };

/** Las áreas a las que pertenece el servicio, en el orden en que están cargadas. */
export function areasDe(servicio: ConCategorias, nombresDeArea: readonly string[]): string[] {
  return servicio.categories
    .map((c) => c.name)
    // El `n !== null` es para TypeScript, no para la lógica: `includes(null)`
    // ya da false, así que en runtime no cambia nada. Sacarlo rompe el build
    // porque `categories.name` es nullable y `includes` espera string.
    .filter((n): n is string => n !== null && nombresDeArea.includes(n));
}

/**
 * Las áreas del servicio **distintas** de la que se está mirando.
 *
 * Es lo que nombra el chip: parada en Estética, ver "también en Medicina y
 * Dermatología" te dice a dónde ir. Un resaltado genérico sólo diría "pasa algo
 * acá" y obligaría a abrir el registro para saber qué.
 *
 * Sin área actual (la vista "Todos los servicios") devuelve todas: ahí no hay
 * un "propio" del cual distinguirse.
 */
export function otrasAreas(
  servicio: ConCategorias,
  actual: string | undefined,
  nombresDeArea: readonly string[],
): string[] {
  return areasDe(servicio, nombresDeArea).filter((a) => a !== actual);
}

/**
 * Un servicio sin ninguna área.
 *
 * No es un caso teórico: 19 servicios quedaron fuera del árbol de categorías
 * de la 1.26.0 y nadie los vio hasta que se contaron a mano. Con N:N no hay
 * `NOT NULL` que lo impida, así que hace falta buscarlos a propósito.
 */
export function sinArea(servicio: ConCategorias, nombresDeArea: readonly string[]): boolean {
  return areasDe(servicio, nombresDeArea).length === 0;
}

/** Cuántos servicios quedaron sin clasificar. Alimenta la pestaña de rescate. */
export function contarSinArea(
  servicios: readonly ConCategorias[],
  nombresDeArea: readonly string[],
): number {
  return servicios.filter((s) => sinArea(s, nombresDeArea)).length;
}
