import { describe, expect, it } from "vitest";
import { areasDe, contarSinArea, otrasAreas, sinArea, type ConCategorias } from "./areas";

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

describe("otrasAreas — lo que nombra el chip", () => {
  it("parada en Estética, nombra Medicina", () => {
    expect(otrasAreas(svc(ESTETICA, MEDICINA), ESTETICA, AREAS)).toEqual([MEDICINA]);
  });

  it("parada en Medicina, nombra Estética — el chip mira al OTRO lado", () => {
    expect(otrasAreas(svc(ESTETICA, MEDICINA), MEDICINA, AREAS)).toEqual([ESTETICA]);
  });

  it("nunca nombra el área propia", () => {
    for (const actual of AREAS) {
      expect(otrasAreas(svc(...AREAS), actual, AREAS)).not.toContain(actual);
    }
  });

  it("un servicio de una sola área no muestra chip", () => {
    expect(otrasAreas(svc(ESTETICA, "Venus Legacy"), ESTETICA, AREAS)).toEqual([]);
  });

  it("en 'Todos los servicios' no hay área propia, así que las nombra todas", () => {
    expect(otrasAreas(svc(ESTETICA, MEDICINA), undefined, AREAS)).toEqual([ESTETICA, MEDICINA]);
  });

  it("un servicio en tres áreas, parado en una, nombra las otras dos", () => {
    expect(otrasAreas(svc(...AREAS), ESTETICA, AREAS)).toEqual([MEDICINA, MASAJES]);
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
