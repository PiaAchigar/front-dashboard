/**
 * El texto de la columna "Categorías" de la grilla de servicios.
 *
 * Antes esto eran chips de colores ("también en Medicina", "sin área"). No se
 * entendían: un chip obliga a aprender qué significa cada color y cada frase
 * antes de poder leer la fila. La lista separada por comas se lee sola.
 */

export type ConCategorias = { categories: { id: string; name: string | null }[] };

/**
 * Todas las categorías del servicio, separadas por comas, con las áreas
 * adelante.
 *
 * El área primero es deliberado: leyendo de izquierda a derecha se ve antes en
 * qué pestaña vive el servicio y después de qué técnica es. Un servicio en dos
 * áreas las muestra a las dos — `service_category` vincula, no copia, así que
 * es una sola fila que aparece en las dos pestañas.
 */
export function etiquetaDeCategorias(
  servicio: ConCategorias,
  nombresDeArea: readonly string[],
): string {
  const nombres = servicio.categories
    .map((c) => c.name)
    .filter((n): n is string => n !== null && n.trim() !== "");

  const areas = nombres.filter((n) => nombresDeArea.includes(n));
  const resto = nombres.filter((n) => !nombresDeArea.includes(n));
  const ordenadas = [...new Set([...areas, ...resto])];

  return ordenadas.length > 0 ? ordenadas.join(", ") : "—";
}

/**
 * El árbol de categorías del sitio público, sin las áreas del panel.
 *
 * Las áreas son un eje aparte (`categories.kind='area'`, migración 1.37.0) y
 * tienen su propio bloque en el formulario. Tres de las seis —Estética,
 * Medicina y Dermatología, Masajes y Bienestar— están archivadas, así que el
 * árbol de categorías activas no las traía y nadie las veía dos veces. Las
 * otras tres —Depilación Definitiva, Actividades, Capacitaciones— están
 * activas, y se colaban entre las categorías de la web como si "Depilación
 * Definitiva" fuera una categoría del sitio más, arrastrando sus hijas.
 *
 * Sacar el nodo se lleva la rama entera, que es lo que se quiere: las hijas de
 * un área tampoco son categorías de la web. Depilación se administra en su
 * propia pestaña, con `body_zone` en vez de `service`, y Actividades tiene su
 * propia pantalla.
 */
export function categoriasDeLaWeb<T extends { kind: string; children: T[] }>(
  arbol: readonly T[],
): T[] {
  return arbol
    .filter((n) => n.kind !== "area")
    .map((n) => ({ ...n, children: categoriasDeLaWeb(n.children ?? []) }) as T);
}
