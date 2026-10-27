import { describe, expect, it } from "vitest";
import {
  SIN_AREA,
  TODAS,
  areasDelArbol,
  areasPorCategoria,
  buscarEnArbol,
  filtrarPorArea,
  intercalarServicios,
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

// Un recorte del árbol real: las áreas son raíces de kind "area" sin hijas,
// y el árbol de Laura (técnicas) va aparte. Lo que los une son los servicios.
const CATS: CategoriaPlana[] = [
  cat("Estética", null, "area"),
  cat("Medicina", null, "area"),
  cat("Masajes y Bienestar", null, "area"),
  cat("Estética Corporal"),
  cat("Modeladores", "Estética Corporal", "tecnica", 1),
  cat("Reductores", "Estética Corporal", "tecnica", 1),
  cat("Masajes"),
  cat("Promos del Mes"),
];

const SERVICIOS = [
  svc("Drenaje", "Estética", "Modeladores"),
  svc("Mesoterapia", "Medicina", "Reductores"),
  svc("Criolipólisis", "Estética", "Reductores"),
  svc("Masaje descontracturante", "Masajes y Bienestar", "Masajes"),
];

const AREAS = areasDelArbol(CATS);
const ids = (fs: { id: string }[]) => fs.map((f) => f.id);

describe("areasDelArbol", () => {
  it("son las raíces de kind area, en el orden del árbol", () => {
    expect(AREAS.map((a) => a.name)).toEqual(["Estética", "Medicina", "Masajes y Bienestar"]);
  });

  it("una categoría de kind area que no es raíz no es un área", () => {
    expect(
      areasDelArbol([cat("Depilación", null, "area"), cat("Zonas", "Depilación", "area", 1)]),
    ).toHaveLength(1);
  });
});

describe("areasPorCategoria", () => {
  const mapa = areasPorCategoria(CATS, SERVICIOS, AREAS);

  it("una hoja cuenta los servicios que tiene en cada área", () => {
    expect(Object.fromEntries(mapa.get("Reductores")!)).toEqual({ Estética: 1, Medicina: 1 });
  });

  it("una madre suma su rama sin contar dos veces el mismo servicio", () => {
    const doble = [...SERVICIOS, svc("Combinado", "Estética", "Modeladores", "Reductores")];
    const m = areasPorCategoria(CATS, doble, AREAS);
    expect(Object.fromEntries(m.get("Estética Corporal")!)).toEqual({ Estética: 3, Medicina: 1 });
  });

  it("una categoría sin servicios en ningún área queda vacía", () => {
    expect(mapa.get("Promos del Mes")!.size).toBe(0);
  });
});

describe("intercalarServicios", () => {
  it("cada servicio cuelga de su categoría, antes que las subcategorías", () => {
    const filas = intercalarServicios(CATS, SERVICIOS, AREAS);
    const corporal = filas.slice(3, 9).map((f) => f.id);
    expect(corporal).toEqual([
      "Estética Corporal",
      "Modeladores",
      "Modeladores/Drenaje",
      "Reductores",
      "Reductores/Mesoterapia",
      "Reductores/Criolipólisis",
    ]);
  });

  it("la fila del servicio sabe su madre, su profundidad y sus áreas", () => {
    const filas = intercalarServicios(CATS, SERVICIOS, AREAS);
    const drenaje = filas.find((f) => f.id === "Modeladores/Drenaje")!;
    expect(drenaje).toMatchObject({
      tipo: "servicio",
      parentId: "Modeladores",
      depth: 2,
      areaIds: ["Estética"],
    });
  });

  it("un servicio en dos categorías aparece en las dos", () => {
    const filas = intercalarServicios(CATS, [svc("Drenaje", "Modeladores", "Masajes")], AREAS);
    expect(ids(filas).filter((id) => id.endsWith("/Drenaje"))).toEqual([
      "Modeladores/Drenaje",
      "Masajes/Drenaje",
    ]);
  });

  it("las áreas no listan sus servicios: ya son las pastillas", () => {
    const filas = intercalarServicios(CATS, SERVICIOS, AREAS);
    expect(filas.some((f) => f.parentId === "Estética")).toBe(false);
  });
});

describe("filtrarPorArea", () => {
  const mapa = areasPorCategoria(CATS, SERVICIOS, AREAS);
  const filas = intercalarServicios(CATS, SERVICIOS, AREAS);

  it("Todas deja todo", () => {
    expect(filtrarPorArea(filas, mapa, TODAS)).toEqual(filas);
  });

  it("un área deja sus categorías y sólo los servicios de esa área, sin las filas de área", () => {
    expect(ids(filtrarPorArea(filas, mapa, "Medicina"))).toEqual([
      "Estética Corporal",
      "Reductores",
      "Reductores/Mesoterapia",
    ]);
  });

  it("Sin área deja lo que no cae en ninguna", () => {
    expect(ids(filtrarPorArea(filas, mapa, SIN_AREA))).toEqual(["Promos del Mes"]);
  });

  it("Sin área muestra el servicio suelto con la categoría que lo contiene", () => {
    const suelto = [...SERVICIOS, svc("Gift card", "Masajes")];
    const m = areasPorCategoria(CATS, suelto, AREAS);
    const f = intercalarServicios(CATS, suelto, AREAS);
    expect(ids(filtrarPorArea(f, m, SIN_AREA))).toEqual([
      "Masajes",
      "Masajes/Gift card",
      "Promos del Mes",
    ]);
  });
});

describe("buscarEnArbol", () => {
  const filas = intercalarServicios(CATS, SERVICIOS, AREAS);
  const mapa = areasPorCategoria(CATS, SERVICIOS, AREAS);

  it("encuentra un servicio y muestra el camino hasta él", () => {
    const r = buscarEnArbol(filas, mapa, "meso");
    expect(ids(r.filas)).toEqual(["Estética Corporal", "Reductores", "Reductores/Mesoterapia"]);
    expect([...r.coincidencias]).toEqual(["Reductores/Mesoterapia"]);
  });

  it("encuentra una categoría y muestra sus servicios", () => {
    const r = buscarEnArbol(filas, mapa, "reduct");
    expect(ids(r.filas)).toEqual([
      "Estética Corporal",
      "Reductores",
      "Reductores/Mesoterapia",
      "Reductores/Criolipólisis",
    ]);
  });

  it("no distingue tildes ni mayúsculas", () => {
    expect(ids(buscarEnArbol(filas, mapa, "CRIOLIPOLISIS").filas)).toContain(
      "Reductores/Criolipólisis",
    );
  });

  it("prende las áreas del servicio encontrado", () => {
    expect([...buscarEnArbol(filas, mapa, "meso").areasPrendidas]).toEqual(["Medicina"]);
  });

  it("prende todas las áreas de una categoría encontrada", () => {
    expect([...buscarEnArbol(filas, mapa, "reduct").areasPrendidas].sort()).toEqual([
      "Estética",
      "Medicina",
    ]);
  });

  it("prende Sin área si lo encontrado no cae en ninguna", () => {
    expect([...buscarEnArbol(filas, mapa, "promos").areasPrendidas]).toEqual([SIN_AREA]);
  });
});
