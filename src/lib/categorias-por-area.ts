/**
 * Qué categoría cae en qué área, y qué servicios hay en cada categoría — la
 * vista que pidió Laura en Categorías (2026-10-27).
 *
 * Son dos cosas distintas que en pantalla parecen una:
 *  - Las categorías (técnicas: Aparatología, Tratamientos Faciales…) ordenan
 *    el menú del sitio web.
 *  - El área (`kind = "area"`, migración 1.37.0) se elige en cada servicio.
 *
 * Una categoría "está en" un área porque sus servicios lo están, y por eso
 * puede caer en dos. La excepción son las áreas con hijas (Actividades,
 * Depilación): lo que cuelga de ellas es de ellas aunque no tenga servicios.
 *
 * Colgar el árbol de Laura debajo de las áreas resolvería la vista pero
 * cambiaría el menú del sitio público, que arma su árbol con estas categorías.
 *
 * Funciones puras: reciben filas y devuelven filas, sin React.
 */

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

/** Categoría → (área → cuántos servicios distintos de su rama caen ahí). */
export type AreasPorCategoria = Map<string, Map<string, number>>;

/** Una fila de la lista plana: lo que sale en Sin área y al buscar. */
export type Resultado =
  | { tipo: "categoria"; id: string; name: string | null; camino: string }
  | {
      tipo: "servicio";
      id: string;
      name: string | null;
      camino: string;
      areaIds: string[];
    };

const esRaizDeArea = (c: CategoriaPlana) => c.kind === "area" && c.parentId === null;

/**
 * El orden de las pestañas de Administración (`PESTANAS` en admin-nav), para
 * que las pastillas se lean igual que las solapas de arriba (pedido de Pia,
 * 2026-10-27). Un área nueva que no esté acá va al final.
 */
const ORDEN_DE_AREAS = [
  "Depilación Definitiva",
  "Estética",
  "Medicina y Dermatología",
  "Masajes y Bienestar",
  "Actividades",
  "Capacitaciones",
];

function lugar(nombre: string): number {
  const i = ORDEN_DE_AREAS.indexOf(nombre);
  return i < 0 ? ORDEN_DE_AREAS.length : i;
}

/** Las áreas son las raíces de kind "area", en el orden de las pestañas. */
export function areasDelArbol(cats: readonly CategoriaPlana[]): Area[] {
  return cats
    .filter(esRaizDeArea)
    .map((c) => ({ id: c.id, name: c.name ?? "—" }))
    .sort((a, b) => lugar(a.name) - lugar(b.name));
}

function areaIdsDe(s: ServicioConCategorias, areas: readonly Area[]): string[] {
  return areas.filter((a) => s.categories.some((c) => c.id === a.id)).map((a) => a.id);
}

/** Los antepasados de una categoría, de la raíz para abajo. Corta ciclos. */
function antepasados(id: string, porId: ReadonlyMap<string, CategoriaPlana>): CategoriaPlana[] {
  const camino: CategoriaPlana[] = [];
  const vistos = new Set<string>([id]);
  let padre = porId.get(id)?.parentId ?? null;
  while (padre !== null && !vistos.has(padre)) {
    const c = porId.get(padre);
    if (!c) break;
    vistos.add(padre);
    camino.unshift(c);
    padre = c.parentId;
  }
  return camino;
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
  const porId = new Map(cats.map((c) => [c.id, c]));
  // Categoría → área → ids de servicio. Con Set, para no contar dos veces.
  const sets = new Map<string, Map<string, Set<string>>>(cats.map((c) => [c.id, new Map()]));

  // Lo que cuelga de un área es de esa área: arranca con la llave en cero.
  for (const c of cats) {
    if (esRaizDeArea(c)) continue;
    const raiz = antepasados(c.id, porId)[0];
    if (raiz && esRaizDeArea(raiz)) sets.get(c.id)!.set(raiz.id, new Set());
  }

  for (const s of servicios) {
    const suyas = areaIdsDe(s, areas);
    if (suyas.length === 0) continue;
    const rama = new Set<string>();
    for (const c of s.categories) {
      if (!porId.has(c.id)) continue;
      rama.add(c.id);
      for (const a of antepasados(c.id, porId)) rama.add(a.id);
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
 * El árbol de un área, para la vista sin búsqueda.
 *
 * Al filtrar por un área, las madres de una categoría que está en ella también
 * lo están (la cuenta es por rama), así que el árbol nunca queda cortado. Las
 * filas de las otras áreas salen; la del área elegida queda sólo si tiene
 * hijas, porque si no sería una fila con su propio nombre y nada abajo.
 */
export function arbolDelArea<C extends CategoriaPlana>(
  cats: readonly C[],
  mapa: AreasPorCategoria,
  filtro: string,
): C[] {
  if (filtro === TODAS || filtro === SIN_AREA) return [...cats];
  const conHijas = new Set(cats.map((c) => c.parentId));
  return cats.filter((c) =>
    esRaizDeArea(c) ? c.id === filtro && conHijas.has(c.id) : !!mapa.get(c.id)?.has(filtro),
  );
}

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function dentroDelFiltro(areaIds: readonly string[], filtro: string): boolean {
  if (filtro === TODAS) return true;
  if (filtro === SIN_AREA) return areaIds.length === 0;
  return areaIds.includes(filtro);
}

/**
 * La lista plana: Sin área, y cualquier búsqueda.
 *
 * Plana y con el camino escrito, en vez del árbol: con el árbol, una hoja sin
 * área arrastraba a sus madres —que sí tienen área— y la pantalla mostraba
 * pastillas de área justo en el filtro "Sin área". Acá cada fila dice sólo lo
 * suyo. Primero las categorías, después los servicios.
 */
export function resultadosPlanos(
  cats: readonly CategoriaPlana[],
  servicios: readonly ServicioConCategorias[],
  mapa: AreasPorCategoria,
  areas: readonly Area[],
  { filtro, texto }: { filtro: string; texto: string },
): Resultado[] {
  const q = normalizar(texto.trim());
  const coincide = (nombre: string | null) => normalizar(nombre ?? "").includes(q);
  const porId = new Map(cats.map((c) => [c.id, c]));
  const caminoDe = (id: string) =>
    antepasados(id, porId)
      .map((a) => a.name ?? "—")
      .join(" › ");

  const categorias: Resultado[] = cats
    .filter((c) => !esRaizDeArea(c) && coincide(c.name))
    .filter((c) => dentroDelFiltro([...(mapa.get(c.id)?.keys() ?? [])], filtro))
    .map((c) => ({ tipo: "categoria", id: c.id, name: c.name, camino: caminoDe(c.id) }));

  const delServicio: Resultado[] = servicios
    .filter((s) => coincide(s.name))
    .map((s) => {
      const suyas = s.categories.filter((c) => porId.has(c.id) && !esRaizDeArea(porId.get(c.id)!));
      return {
        tipo: "servicio" as const,
        id: s.id,
        name: s.name,
        // Un servicio puede estar en dos categorías: se ven los dos caminos.
        camino: suyas
          .map((c) => [caminoDe(c.id), c.name ?? "—"].filter(Boolean).join(" › "))
          .join(" · "),
        areaIds: areaIdsDe(s, areas),
        // Sin ninguna categoría no es un servicio de catálogo: es el ancla
        // interna de depilación, que no se vende.
        suelto: s.categories.length === 0,
      };
    })
    .filter((r) => !r.suelto && dentroDelFiltro(r.areaIds, filtro))
    .map(({ suelto: _suelto, ...r }) => r);

  // En Sin área, lo vacío va al final: una categoría sin ningún servicio es otro
  // problema (no hay nada mal ubicado), y arriba tapaba a las que sí importan.
  if (filtro === SIN_AREA) {
    const vacias = categoriasVacias(cats, servicios);
    const llenas = categorias.filter((c) => !vacias.has(c.id));
    return [...llenas, ...categorias.filter((c) => vacias.has(c.id)), ...delServicio];
  }
  return [...categorias, ...delServicio];
}

/** Las categorías sin ningún servicio en toda su rama. */
export function categoriasVacias(
  cats: readonly CategoriaPlana[],
  servicios: readonly ServicioConCategorias[],
): Set<string> {
  const porId = new Map(cats.map((c) => [c.id, c]));
  const conServicios = new Set<string>();
  for (const s of servicios)
    for (const c of s.categories) {
      if (!porId.has(c.id)) continue;
      conServicios.add(c.id);
      for (const a of antepasados(c.id, porId)) conServicios.add(a.id);
    }
  return new Set(cats.filter((c) => !conServicios.has(c.id)).map((c) => c.id));
}

/**
 * Las áreas que ofrece el panel para mover un servicio: las que hoy tienen
 * servicios. Ofrecer las seis en cada servicio era ruido: Actividades,
 * Capacitaciones y Depilación no se arman con servicios sueltos.
 */
export function areasConServicios(
  areas: readonly Area[],
  servicios: readonly ServicioConCategorias[],
): Area[] {
  return areas.filter((a) => servicios.some((s) => s.categories.some((c) => c.id === a.id)));
}

/**
 * Dónde cae lo que se buscó, para prender esas pastillas. Mira todo el
 * catálogo, no sólo el área elegida: si Laura está en Estética y busca un
 * masaje, la pastilla de Masajes le dice dónde está.
 */
export function areasPrendidas(
  cats: readonly CategoriaPlana[],
  servicios: readonly ServicioConCategorias[],
  mapa: AreasPorCategoria,
  areas: readonly Area[],
  texto: string,
): Set<string> {
  const prendidas = new Set<string>();
  if (!texto.trim()) return prendidas;
  for (const r of resultadosPlanos(cats, servicios, mapa, areas, { filtro: TODAS, texto })) {
    const suyas = r.tipo === "servicio" ? r.areaIds : [...(mapa.get(r.id)?.keys() ?? [])];
    if (suyas.length === 0) prendidas.add(SIN_AREA);
    for (const a of suyas) prendidas.add(a);
  }
  return prendidas;
}

/**
 * Lo que muestra el panel de una categoría: sus servicios y los de sus
 * subcategorías, agrupados por la categoría que los tiene, en el orden del
 * árbol. Sólo los grupos con algo adentro.
 */
export function serviciosDeLaRama<S extends ServicioConCategorias>(
  categoriaId: string,
  cats: readonly CategoriaPlana[],
  servicios: readonly S[],
): { categoria: CategoriaPlana; camino: string; servicios: S[] }[] {
  const porId = new Map(cats.map((c) => [c.id, c]));
  const inicio = porId.get(categoriaId);
  if (!inicio) return [];
  const rama = cats.filter(
    (c) => c.id === categoriaId || antepasados(c.id, porId).some((a) => a.id === categoriaId),
  );
  return rama
    .map((c) => ({
      categoria: c,
      // El camino desde la categoría abierta, sin repetirla: dentro del panel
      // de "Estética Corporal", "Reductores" alcanza.
      camino: antepasados(c.id, porId)
        .slice(antepasados(categoriaId, porId).length + 1)
        .concat(c.id === categoriaId ? [] : [c])
        .map((a) => a.name ?? "—")
        .join(" › "),
      servicios: servicios.filter((s) => s.categories.some((x) => x.id === c.id)),
    }))
    .filter((g) => g.servicios.length > 0);
}
