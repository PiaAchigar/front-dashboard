/**
 * Qué categoría cae en qué área, y qué servicio en qué categoría — la vista
 * que pidió Laura en Categorías (2026-10-27).
 *
 * Una categoría NO cuelga de un área: las áreas (`kind = "area"`, migración
 * 1.37.0) son raíces sueltas, y el árbol de técnicas de Laura va aparte. Lo
 * que los une son los servicios: "Reductores" está en Estética porque tiene
 * servicios que también están en Estética. Por eso una categoría puede caer
 * en dos áreas a la vez, y eso es correcto.
 *
 * Funciones puras: reciben filas y devuelven filas, sin React.
 */

import { conAncestros } from "./arbol-plano";

export const TODAS = "todas";
export const SIN_AREA = "sin-area";

export type CategoriaPlana = {
  id: string;
  name: string | null;
  parentId: string | null;
  kind: string;
  depth: number;
};

export type ServicioConCategorias = {
  id: string;
  name: string | null;
  categories: { id: string; name: string | null }[];
};

export type Area = { id: string; name: string };

export type FilaServicio = {
  tipo: "servicio";
  /** `categoría/servicio`: el mismo servicio aparece en cada categoría que lo tiene. */
  id: string;
  servicioId: string;
  name: string | null;
  parentId: string;
  depth: number;
  areaIds: string[];
};

export type FilaCategoria<C extends CategoriaPlana> = C & { tipo: "categoria" };
export type Fila<C extends CategoriaPlana> = FilaCategoria<C> | FilaServicio;

/** Categoría → (área → cuántos servicios distintos de su rama caen ahí). */
export type AreasPorCategoria = Map<string, Map<string, number>>;

/** Las áreas son las raíces de kind "area", en el orden del árbol. */
export function areasDelArbol(cats: readonly CategoriaPlana[]): Area[] {
  return cats
    .filter((c) => c.kind === "area" && c.parentId === null)
    .map((c) => ({ id: c.id, name: c.name ?? "—" }));
}

function esArea(c: CategoriaPlana, areas: readonly Area[]): boolean {
  return areas.some((a) => a.id === c.id);
}

function areaIdsDe(s: ServicioConCategorias, areas: readonly Area[]): string[] {
  return areas.filter((a) => s.categories.some((c) => c.id === a.id)).map((a) => a.id);
}

/**
 * Cuenta por rama, no por fila: "Estética Corporal" tiene sus servicios en las
 * hijas, y sin sumar la rama aparecería "sin área" aunque todo lo de adentro
 * esté en Estética. Un servicio en dos hijas cuenta una sola vez en la madre.
 */
export function areasPorCategoria(
  cats: readonly CategoriaPlana[],
  servicios: readonly ServicioConCategorias[],
  areas: readonly Area[],
): AreasPorCategoria {
  const padreDe = new Map(cats.map((c) => [c.id, c.parentId]));
  // Categoría → área → ids de servicio. Con Set, para no contar dos veces.
  const sets = new Map<string, Map<string, Set<string>>>(cats.map((c) => [c.id, new Map()]));

  for (const s of servicios) {
    const suyas = areaIdsDe(s, areas);
    if (suyas.length === 0) continue;
    const rama = new Set<string>();
    for (const c of s.categories) {
      // Sube hasta la raíz; `rama` corta ciclos y repeticiones de antepasados.
      let id: string | null = c.id;
      while (id !== null && !rama.has(id) && padreDe.has(id)) {
        rama.add(id);
        id = padreDe.get(id) ?? null;
      }
    }
    for (const id of rama) {
      const porArea = sets.get(id)!;
      for (const a of suyas) {
        if (!porArea.has(a)) porArea.set(a, new Set());
        porArea.get(a)!.add(s.id);
      }
    }
  }

  return new Map(
    [...sets].map(([id, porArea]) => [id, new Map([...porArea].map(([a, ss]) => [a, ss.size]))]),
  );
}

/**
 * Mete cada servicio como hija de cada categoría que lo tiene, justo después
 * de ella y antes de sus subcategorías: lo propio primero, después lo de
 * abajo. Las áreas no listan sus servicios — ya son las pastillas, y repetir
 * los 59 de Estética debajo de su fila sería la misma lista otra vez.
 */
export function intercalarServicios<C extends CategoriaPlana>(
  cats: readonly C[],
  servicios: readonly ServicioConCategorias[],
  areas: readonly Area[],
): Fila<C>[] {
  const porCategoria = new Map<string, ServicioConCategorias[]>();
  for (const s of servicios)
    for (const c of s.categories) {
      if (!porCategoria.has(c.id)) porCategoria.set(c.id, []);
      porCategoria.get(c.id)!.push(s);
    }

  const filas: Fila<C>[] = [];
  for (const c of cats) {
    filas.push({ ...c, tipo: "categoria" });
    if (esArea(c, areas)) continue;
    for (const s of porCategoria.get(c.id) ?? [])
      filas.push({
        tipo: "servicio",
        id: `${c.id}/${s.id}`,
        servicioId: s.id,
        name: s.name,
        parentId: c.id,
        depth: c.depth + 1,
        areaIds: areaIdsDe(s, areas),
      });
  }
  return filas;
}

/**
 * Las filas de un área: sus categorías y sólo los servicios que están en ella.
 * Sin área: lo que no cae en ninguna, con las categorías que lo contienen para
 * que se vea dónde está. Las filas de las áreas mismas salen siempre: filtrando
 * por área, el área es la pastilla.
 */
export function filtrarPorArea<C extends CategoriaPlana>(
  filas: readonly Fila<C>[],
  mapa: AreasPorCategoria,
  filtro: string,
): Fila<C>[] {
  if (filtro === TODAS) return [...filas];

  const queda = (f: Fila<C>): boolean => {
    if (f.tipo === "servicio")
      return filtro === SIN_AREA ? f.areaIds.length === 0 : f.areaIds.includes(filtro);
    if (f.kind === "area" && f.parentId === null) return false;
    const suyas = mapa.get(f.id);
    return filtro === SIN_AREA ? !suyas || suyas.size === 0 : !!suyas?.has(filtro);
  };

  const elegidas = new Set(filas.filter(queda).map((f) => f.id));
  return conAncestros(filas, elegidas);
}

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * El buscador híbrido: busca por nombre de categoría y de servicio a la vez.
 *
 * - Un servicio encontrado se muestra con el camino de categorías hasta él.
 * - Una categoría encontrada se muestra con el camino y sus servicios.
 * - `areasPrendidas`: dónde cae lo encontrado, para prender esas pastillas.
 *   Se calcula sobre las filas que se le pasen; la página lo pide sobre todas,
 *   no sólo las del área elegida, para avisar si el servicio está en otra.
 */
export function buscarEnArbol<C extends CategoriaPlana>(
  filas: readonly Fila<C>[],
  mapa: AreasPorCategoria,
  texto: string,
): { filas: Fila<C>[]; coincidencias: Set<string>; areasPrendidas: Set<string> } {
  const q = normalizar(texto.trim());
  const coincidencias = new Set(
    filas.filter((f) => normalizar(f.name ?? "").includes(q)).map((f) => f.id),
  );

  const elegidas = new Set(coincidencias);
  for (const f of filas)
    if (f.tipo === "servicio" && coincidencias.has(f.parentId)) elegidas.add(f.id);

  const areasPrendidas = new Set<string>();
  for (const f of filas) {
    if (!coincidencias.has(f.id)) continue;
    let suyas: string[];
    if (f.tipo === "servicio") suyas = f.areaIds;
    else if (f.kind === "area" && f.parentId === null) suyas = [f.id];
    else suyas = [...(mapa.get(f.id)?.keys() ?? [])];
    if (suyas.length === 0) areasPrendidas.add(SIN_AREA);
    for (const a of suyas) areasPrendidas.add(a);
  }

  return { filas: conAncestros(filas, elegidas), coincidencias, areasPrendidas };
}
