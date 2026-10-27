import { describe, expect, it } from "vitest";
import {
  SIN_AREA,
  TODAS,
  areasConServicios,
  areasDelArbol,
  categoriasVacias,
  areasPorCategoria,
  areasPrendidas,
  arbolDelArea,
  resultadosPlanos,
  serviciosDeLaRama,
  type CategoriaPlana,
  type ServicioConCategorias,
} from "./categorias-por-area";

const cat = (
  id: string,
  parentId: string | null = null,
  kind = "tecnica",
  depth = 0,
): CategoriaPlana => ({ id, name: id, parentId, kind, depth });

const svc = (id: string, ...categorias: string[]): ServicioConCategorias => ({
  id,
  name: id,
  categories: categorias.map((c) => ({ id: c, name: c })),
});

// Un recorte del árbol real. Estética y Medicina son áreas sin hijas; el
// árbol de Laura va aparte y lo une a ellas el servicio. Actividades es un
// área CON hijas: lo que cuelga de ella es de ella aunque no tenga servicios.
const CATS: CategoriaPlana[] = [
  cat("Actividades", null, "area"),
  cat("Pilates", "Actividades", "tecnica", 1),
  cat("Estética", null, "area"),
  cat("Medicina", null, "area"),
  cat("Estética Corporal"),
  cat("Modeladores", "Estética Corporal", "tecnica", 1),
  cat("Reductores", "Estética Corporal", "tecnica", 1),
  cat("Promos del Mes"),
];

const SERVICIOS = [
  svc("Drenaje", "Estética", "Modeladores"),
  svc("Mesoterapia", "Medicina", "Reductores"),
  svc("Criolipólisis", "Estética", "Reductores"),
  svc("Gift card", "Promos del Mes"),
];

const AREAS = areasDelArbol(CATS);
const MAPA = areasPorCategoria(CATS, SERVICIOS, AREAS);
const ids = (fs: { id: string }[]) => fs.map((f) => f.id);
const comoObjeto = (m: ReadonlyMap<string, number> | undefined) => Object.fromEntries(m ?? []);

describe("areasDelArbol", () => {
  it("son las raíces de kind area, en el orden del árbol", () => {
    expect(AREAS.map((a) => a.name)).toEqual(["Actividades", "Estética", "Medicina"]);
  });
});

describe("areasPorCategoria", () => {
  it("una hoja cuenta los servicios que tiene en cada área", () => {
    expect(comoObjeto(MAPA.get("Reductores"))).toEqual({ Estética: 1, Medicina: 1 });
  });

  it("una madre suma su rama sin contar dos veces el mismo servicio", () => {
    const doble = [...SERVICIOS, svc("Combinado", "Estética", "Modeladores", "Reductores")];
    const m = areasPorCategoria(CATS, doble, AREAS);
    expect(comoObjeto(m.get("Estética Corporal"))).toEqual({ Estética: 3, Medicina: 1 });
  });

  it("lo que cuelga de un área es de esa área, aunque no tenga servicios", () => {
    expect(comoObjeto(MAPA.get("Pilates"))).toEqual({ Actividades: 0 });
  });

  it("una categoría sin servicios en ningún área queda vacía", () => {
    expect(MAPA.get("Promos del Mes")!.size).toBe(0);
  });
});

describe("arbolDelArea", () => {
  it("Todas deja el árbol entero", () => {
    expect(arbolDelArea(CATS, MAPA, TODAS)).toEqual(CATS);
  });

  it("un área deja sus categorías, sin las filas de las otras áreas ni la suya si está sola", () => {
    expect(ids(arbolDelArea(CATS, MAPA, "Medicina"))).toEqual(["Estética Corporal", "Reductores"]);
  });

  it("un área con hijas se muestra con ellas, para que el árbol no quede cortado", () => {
    expect(ids(arbolDelArea(CATS, MAPA, "Actividades"))).toEqual(["Actividades", "Pilates"]);
  });
});

describe("resultadosPlanos — Sin área", () => {
  it("trae sólo lo que no cae en ninguna, sin las madres que sí caen", () => {
    const r = resultadosPlanos(CATS, SERVICIOS, MAPA, AREAS, { filtro: SIN_AREA, texto: "" });
    expect(r.map((f) => [f.tipo, f.id])).toEqual([
      ["categoria", "Promos del Mes"],
      ["servicio", "Gift card"],
    ]);
  });

  it("cada fila dice dónde está", () => {
    const r = resultadosPlanos(CATS, SERVICIOS, MAPA, AREAS, { filtro: SIN_AREA, texto: "gift" });
    expect(r).toEqual([
      expect.objectContaining({ tipo: "servicio", id: "Gift card", camino: "Promos del Mes" }),
    ]);
  });

  it("una hoja sin área muestra el camino de sus madres", () => {
    const cats = [...CATS, cat("Ofertas", "Estética Corporal", "tecnica", 1)];
    const m = areasPorCategoria(cats, SERVICIOS, AREAS);
    const r = resultadosPlanos(cats, SERVICIOS, m, AREAS, { filtro: SIN_AREA, texto: "ofer" });
    expect(r).toEqual([expect.objectContaining({ id: "Ofertas", camino: "Estética Corporal" })]);
  });
});

describe("resultadosPlanos — buscador híbrido", () => {
  it("encuentra categorías y servicios a la vez", () => {
    const cats = [...CATS, cat("Drenajes", "Estética Corporal", "tecnica", 1)];
    const m = areasPorCategoria(cats, SERVICIOS, AREAS);
    const r = resultadosPlanos(cats, SERVICIOS, m, AREAS, { filtro: TODAS, texto: "drenaj" });
    expect(r.map((f) => [f.tipo, f.id])).toEqual([
      ["categoria", "Drenajes"],
      ["servicio", "Drenaje"],
    ]);
  });

  it("el camino de un servicio es el de su categoría, sin el área", () => {
    const [r] = resultadosPlanos(CATS, SERVICIOS, MAPA, AREAS, { filtro: TODAS, texto: "meso" });
    expect(r).toMatchObject({ camino: "Estética Corporal › Reductores", areaIds: ["Medicina"] });
  });

  it("no distingue tildes ni mayúsculas", () => {
    const r = resultadosPlanos(CATS, SERVICIOS, MAPA, AREAS, {
      filtro: TODAS,
      texto: "CRIOLIPOLISIS",
    });
    expect(ids(r)).toEqual(["Criolipólisis"]);
  });

  it("con un área elegida busca sólo adentro de esa área", () => {
    const r = resultadosPlanos(CATS, SERVICIOS, MAPA, AREAS, { filtro: "Estética", texto: "o" });
    // "Mesoterapia" tiene "o" pero está en Medicina; "Pilates" está en Actividades.
    expect(ids(r)).toEqual(["Estética Corporal", "Modeladores", "Reductores", "Criolipólisis"]);
  });

  it("las filas de las áreas no salen: ya son las pastillas", () => {
    const r = resultadosPlanos(CATS, SERVICIOS, MAPA, AREAS, { filtro: TODAS, texto: "estética" });
    expect(ids(r)).toEqual(["Estética Corporal"]);
  });
});

describe("areasPrendidas", () => {
  it("las áreas del servicio encontrado", () => {
    expect([...areasPrendidas(CATS, SERVICIOS, MAPA, AREAS, "meso")]).toEqual(["Medicina"]);
  });

  it("todas las áreas de una categoría encontrada", () => {
    expect([...areasPrendidas(CATS, SERVICIOS, MAPA, AREAS, "reduct")].sort()).toEqual([
      "Estética",
      "Medicina",
    ]);
  });

  it("Sin área si lo encontrado no cae en ninguna", () => {
    expect([...areasPrendidas(CATS, SERVICIOS, MAPA, AREAS, "promos")]).toEqual([SIN_AREA]);
  });

  it("sin texto no prende nada", () => {
    expect(areasPrendidas(CATS, SERVICIOS, MAPA, AREAS, "  ").size).toBe(0);
  });
});

describe("serviciosDeLaRama", () => {
  it("los servicios de la categoría y de sus subcategorías, agrupados", () => {
    const grupos = serviciosDeLaRama("Estética Corporal", CATS, SERVICIOS);
    expect(grupos.map((g) => [g.categoria.id, g.servicios.map((s) => s.id)])).toEqual([
      ["Modeladores", ["Drenaje"]],
      ["Reductores", ["Mesoterapia", "Criolipólisis"]],
    ]);
  });

  it("una hoja trae sólo los suyos", () => {
    expect(serviciosDeLaRama("Modeladores", CATS, SERVICIOS)).toHaveLength(1);
  });

  it("una categoría sin servicios en toda su rama no trae grupos", () => {
    expect(serviciosDeLaRama("Pilates", CATS, SERVICIOS)).toEqual([]);
  });
});

describe("categoriasVacias", () => {
  it("las que no tienen ningún servicio en toda su rama", () => {
    expect([...categoriasVacias(CATS, SERVICIOS)].sort()).toEqual(["Actividades", "Pilates"]);
  });

  it("una madre con servicios en una hija no está vacía", () => {
    expect(categoriasVacias(CATS, SERVICIOS).has("Estética Corporal")).toBe(false);
  });
});

describe("resultadosPlanos — Sin área deja las vacías al final", () => {
  it("primero lo que tiene servicios sin área, después lo vacío", () => {
    const cats = [cat("Manchas"), ...CATS];
    const m = areasPorCategoria(cats, SERVICIOS, AREAS);
    const r = resultadosPlanos(cats, SERVICIOS, m, AREAS, { filtro: SIN_AREA, texto: "" });
    expect(r.map((f) => f.id)).toEqual(["Promos del Mes", "Manchas", "Gift card"]);
  });
});

describe("areasConServicios", () => {
  it("las áreas donde hoy hay al menos un servicio, en el orden del árbol", () => {
    expect(areasConServicios(AREAS, SERVICIOS).map((a) => a.id)).toEqual(["Estética", "Medicina"]);
  });
});
