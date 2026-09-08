/**
 * Un árbol aplanado en filas de tabla, con el plegado de ramas.
 *
 * La pantalla de Categorías muestra el árbol como una lista plana con sangría:
 * cada fila sabe quién es su madre y a qué profundidad está. Desde la 1.38.0
 * son 171 filas en siete niveles, y de corrido no se lee.
 *
 * Estas funciones no saben nada de React ni de la tabla: reciben filas y
 * devuelven filas.
 */

export type FilaPlana = { id: string; parentId: string | null };

/** Los ids que tienen al menos una hija — los únicos que llevan flechita. */
export function idsConHijas(filas: readonly FilaPlana[]): Set<string> {
  const conHijas = new Set<string>();
  for (const f of filas) if (f.parentId !== null) conHijas.add(f.parentId);
  return conHijas;
}

/**
 * Cuántas filas cuelgan de cada id, contando nietos y más abajo.
 *
 * Es lo que muestra el número de una rama plegada: sin él, contraer
 * "Tratamientos Médicos" esconde 54 filas sin decir cuántas ni que existen.
 */
export function contarDescendientes(filas: readonly FilaPlana[]): Map<string, number> {
  const padreDe = new Map(filas.map((f) => [f.id, f.parentId]));
  const total = new Map<string, number>();

  for (const f of filas) {
    // Se sube desde cada fila sumando uno a cada antepasado. Recorrer para
    // arriba en vez de para abajo evita tener que armar el árbol de nuevo.
    let padre = f.parentId;
    const vistos = new Set<string>();
    while (padre !== null && !vistos.has(padre)) {
      vistos.add(padre);
      total.set(padre, (total.get(padre) ?? 0) + 1);
      padre = padreDe.get(padre) ?? null;
    }
  }
  return total;
}

/**
 * Las filas que quedan a la vista con estas ramas plegadas.
 *
 * Una fila desaparece si CUALQUIER antepasado está plegado, no sólo su madre
 * directa: plegar "Dermatología" tiene que llevarse también a los bisnietos.
 *
 * Sube por la cadena de madres en vez de confiar en que las filas vengan en
 * orden de recorrido. `flatten()` hoy las devuelve así, pero atarse a ese orden
 * es una dependencia invisible que se rompe el día que alguien ordene la tabla
 * por otra columna.
 *
 * El `vistos` corta un ciclo si la base llegara a tener uno. No debería
 * —`parent_category_id` apunta a una sola madre— pero nada en el esquema lo
 * impide, y un ciclo acá colgaría el navegador en vez de mostrar un error.
 */
export function filasVisibles<T extends FilaPlana>(
  filas: readonly T[],
  plegados: ReadonlySet<string>,
): T[] {
  if (plegados.size === 0) return [...filas];
  const padreDe = new Map(filas.map((f) => [f.id, f.parentId]));

  return filas.filter((f) => {
    let padre = f.parentId;
    const vistos = new Set<string>();
    while (padre !== null && !vistos.has(padre)) {
      if (plegados.has(padre)) return false;
      vistos.add(padre);
      padre = padreDe.get(padre) ?? null;
    }
    return true;
  });
}
