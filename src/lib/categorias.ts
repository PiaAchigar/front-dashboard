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
 * Categorías que existen en la base pero NO se tildan a mano en el formulario
 * de servicio.
 *
 * "Promos del Mes" y "Combos" no describen qué ES un servicio: describen cómo
 * se vende. Van a tener pestaña propia, y hasta entonces sólo ensucian la
 * lista — hoy tienen cero servicios, así que la web tampoco las muestra.
 *
 * Es una lista por nombre y eso es frágil: la comparación es por igualdad
 * exacta, así que un acento de menos la deja sin efecto. El test fija los dos
 * nombres verificados contra producción el 2026-09-04 — no puede comprobar la
 * base desde un test, pero obliga a mirar si alguien los cambia. Cuando
 * existan las pestañas, estas dos se archivan en la base y esta constante se
 * borra.
 */
export const NO_SE_TILDAN = ["Promos del Mes", "Combos"];

/**
 * El árbol que ve el formulario de servicio: sin las áreas del panel y sin lo
 * comercial.
 *
 * Las áreas son un eje aparte (`categories.kind='area'`, migración 1.37.0) y
 * tienen su propio bloque. Tres de las seis —Estética, Medicina y
 * Dermatología, Masajes y Bienestar— están archivadas, así que el árbol de
 * categorías activas no las traía y nadie las veía dos veces. Las otras tres
 * —Depilación Definitiva, Actividades, Capacitaciones— están activas, y se
 * colaban como si "Depilación Definitiva" fuera una categoría del sitio más,
 * arrastrando sus hijas.
 *
 * Sacar el nodo se lleva la rama entera, que es lo que se quiere: las hijas de
 * un área tampoco son categorías de la web. Depilación se administra en su
 * propia pestaña, con `body_zone` en vez de `service`, y Actividades tiene su
 * propia pantalla.
 */
export function categoriasDelFormulario<
  T extends { name: string | null; kind: string; children: T[] },
>(arbol: readonly T[]): T[] {
  return arbol
    .filter((n) => n.kind !== "area" && !NO_SE_TILDAN.includes(n.name ?? ""))
    .map((n) => ({ ...n, children: categoriasDelFormulario(n.children ?? []) }) as T);
}

/**
 * Parte el árbol en las ramas (raíces con hijas) y las **generales** (raíces
 * sueltas, sin hijas).
 *
 * Sin esto, una raíz sin hijas se dibuja como un checkbox flotando al principio
 * de una columna, sin encabezado, entre grupos que sí lo tienen: parece una
 * opción huérfana en vez de una categoría de primer nivel. Agrupadas bajo un
 * título se leen como lo que son.
 *
 * "Generales" es un encabezado de la pantalla, no una categoría de la base: no
 * se puede tildar y nada queda asignado a ella. La pertenencia se calcula sola,
 * así que una categoría que mañana gane hijas —Masajes, en cuanto tenga sus
 * cuatro— se mueve de grupo sin tocar código.
 */
export function agruparParaElFormulario<T extends { children: T[] }>(
  arbol: readonly T[],
): { ramas: T[]; generales: T[] } {
  return {
    ramas: arbol.filter((n) => (n.children ?? []).length > 0),
    generales: arbol.filter((n) => (n.children ?? []).length === 0),
  };
}

/**
 * Cuántas categorías de una rama están tildadas, contando la raíz y bajando
 * hasta el fondo.
 *
 * Es lo que muestra el número al costado de un grupo plegado. Sin él, un grupo
 * cerrado no da ninguna pista de que adentro hay algo elegido — y con siete
 * niveles de profundidad, "adentro" puede ser un nieto de sexto grado.
 */
export function contarSeleccionadas<T extends { id: string; children: T[] }>(
  nodo: T,
  seleccionadas: readonly string[],
): number {
  // `Set` y no `includes` en bucle: se llama una vez por grupo en cada render
  // del formulario, y la lista de tildadas crece con cada categoría marcada.
  return contar(nodo, new Set(seleccionadas));
}

function contar<T extends { id: string; children: T[] }>(nodo: T, elegidas: Set<string>): number {
  return (
    (elegidas.has(nodo.id) ? 1 : 0) +
    (nodo.children ?? []).reduce((acc, h) => acc + contar(h, elegidas), 0)
  );
}
