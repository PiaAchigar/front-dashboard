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
