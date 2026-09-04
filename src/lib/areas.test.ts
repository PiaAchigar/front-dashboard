import { describe, expect, it } from "vitest";
import {
  areasDe,
  contarSinArea,
  preseleccionDeArea,
  sinArea,
  type ConCategorias,
} from "./areas";

const ESTETICA = "Estética";
const MEDICINA = "Medicina y Dermatología";
const MASAJES = "Masajes y Bienestar";
const AREAS = [ESTETICA, MEDICINA, MASAJES] as const;

const svc = (...cats: (string | null)[]): ConCategorias => ({
  categories: cats.map((name, i) => ({ id: String(i), name })),
});

describe("areasDe", () => {
  it("devuelve sólo las categorías que son áreas, no las técnicas", () => {
    // "Botox" es técnica, no área: agrupa dentro de una pestaña, no es una.
    expect(areasDe(svc(MEDICINA, "Botox", "Arrugas"), AREAS)).toEqual([MEDICINA]);
  });

  it("devuelve las dos cuando el servicio está en dos áreas", () => {
    expect(areasDe(svc(ESTETICA, MEDICINA, "Dermapen"), AREAS)).toEqual([ESTETICA, MEDICINA]);
  });

  it("sin áreas devuelve vacío", () => {
    expect(areasDe(svc("Cosmetología"), AREAS)).toEqual([]);
  });

  it("ignora categorías con nombre nulo sin romperse", () => {
    // `categories.name` es nullable en la base.
    expect(areasDe(svc(null, ESTETICA), AREAS)).toEqual([ESTETICA]);
  });

  it("compara el nombre completo: 'Estética' no matchea 'Estética Corporal'", () => {
    expect(areasDe(svc("Estética Corporal"), AREAS)).toEqual([]);
  });
});

describe("sinArea — la red que evita perder servicios", () => {
  it("un servicio con sólo técnicas está sin clasificar", () => {
    expect(sinArea(svc("Cosmetología", "Arrugas"), AREAS)).toBe(true);
  });

  it("un servicio sin ninguna categoría está sin clasificar", () => {
    expect(sinArea(svc(), AREAS)).toBe(true);
  });

  it("con un área alcanza para estar clasificado", () => {
    expect(sinArea(svc(MASAJES), AREAS)).toBe(false);
  });
});

describe("contarSinArea", () => {
  it("cuenta sólo los que no tienen ninguna área", () => {
    const catalogo = [svc(ESTETICA), svc("Botox"), svc(), svc(MEDICINA, ESTETICA)];
    expect(contarSinArea(catalogo, AREAS)).toBe(2);
  });

  it("catálogo vacío da 0, no error", () => {
    expect(contarSinArea([], AREAS)).toBe(0);
  });

  it("sin áreas definidas, TODO cuenta como sin clasificar", () => {
    // Si las áreas todavía no cargaron, el contador no puede decir "0 problemas".
    expect(contarSinArea([svc(ESTETICA), svc(MEDICINA)], [])).toBe(2);
  });
});

describe("preseleccionDeArea — el alta arranca en el área donde estás parada", () => {
  const AREAS_CAT = [
    { id: "a1", name: ESTETICA },
    { id: "a2", name: MEDICINA },
    { id: "a3", name: MASAJES },
  ];

  it("parada en Estética, preselecciona el id de Estética", () => {
    expect(preseleccionDeArea(AREAS_CAT, ESTETICA)).toEqual(["a1"]);
  });

  it("parada en Medicina, preselecciona el id de Medicina — no el de la primera", () => {
    expect(preseleccionDeArea(AREAS_CAT, MEDICINA)).toEqual(["a2"]);
  });

  // "Todos los servicios" y "Sin clasificar" no son un área: ahí no hay nada
  // que preseleccionar y el formulario exige elegir una a mano.
  it("sin área actual no preselecciona nada", () => {
    expect(preseleccionDeArea(AREAS_CAT, undefined)).toEqual([]);
  });

  it("un área que no existe en la base no preselecciona nada", () => {
    expect(preseleccionDeArea(AREAS_CAT, "Manicuría")).toEqual([]);
  });

  it("compara el nombre completo: 'Estética' no matchea 'Estética Corporal'", () => {
    expect(preseleccionDeArea([{ id: "x", name: "Estética Corporal" }], ESTETICA)).toEqual([]);
  });

  it("sin áreas cargadas todavía, devuelve vacío en vez de romperse", () => {
    expect(preseleccionDeArea([], ESTETICA)).toEqual([]);
  });
});
