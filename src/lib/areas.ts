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

/**
 * El área que ya viene tildada al abrir "Nuevo servicio".
 *
 * Si estás parada en la pestaña Estética, lo normal es que el servicio que vas
 * a crear sea de Estética; tener que tildarlo a mano es un paso que se olvida y
 * deja el servicio sin pestaña. Es una preselección, no un candado: se puede
 * destildar y se pueden tildar otras.
 *
 * Devuelve un array —no un id suelto— porque es lo que consume el formulario,
 * que guarda las categorías como lista.
 */
export function preseleccionDeArea(
  areas: readonly { id: string; name: string | null }[],
  area: string | undefined,
): string[] {
  if (!area) return [];
  const encontrada = areas.find((a) => a.name === area);
  return encontrada ? [encontrada.id] : [];
}

/**
 * El id de la categoría de área que se llama así.
 *
 * Las pestañas y las rutas trabajan con el NOMBRE del área ("Estética"), pero
 * los combos la guardan por id. Esta es la traducción, en un solo lugar.
 *
 * Devuelve `null` si todavía no cargaron las categorías o si el nombre no
 * existe: quien la use tiene que esperar antes de pedir combos, porque sin
 * área el listado traería los de todas.
 */
export function idDeArea(
  areas: readonly { id: string; name: string | null }[],
  nombre: string | undefined,
): string | null {
  if (!nombre) return null;
  return areas.find((a) => a.name === nombre)?.id ?? null;
}
