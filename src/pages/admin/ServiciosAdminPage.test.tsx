import { describe, expect, it, vi } from "vitest";

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({ role: "admin", session: null, user: null, loading: false, signOut: vi.fn() }),
}));

import { filtrarServicios } from "../../lib/filtrar-servicios";
import type { Service } from "../../lib/api-types";

const cat = (name: string) => ({ id: name, name });

function svc(name: string, categorias: string[], code = ""): Service {
  return { id: name, name, code, categories: categorias.map(cat) } as unknown as Service;
}

const ESTETICA = "Estética";
const MEDICINA = "Medicina y Dermatología";

const CATALOGO = [
  svc("Limpieza de Cutis Profunda", [ESTETICA, "Limpieza de Cutis y Cosmetología"]),
  svc("Botox Tercio Superior", [MEDICINA, "Botox"]),
  svc("Venus Legacy - 1 zona", [ESTETICA, "Venus Legacy"], "VL1"),
  // El caso del Borde 3: un mismo servicio en dos áreas.
  svc("Limpieza de Cutis con Dermapen", [ESTETICA, MEDICINA, "Dermapen"]),
  svc("Sin clasificar", []),
];

describe("filtrarServicios — por área", () => {
  it("sin área devuelve todo, que es la pantalla de siempre", () => {
    expect(filtrarServicios(CATALOGO)).toHaveLength(5);
  });

  it("con área devuelve sólo los de esa área", () => {
    const nombres = filtrarServicios(CATALOGO, { area: MEDICINA }).map((s) => s.name);
    expect(nombres).toEqual(["Botox Tercio Superior", "Limpieza de Cutis con Dermapen"]);
  });

  it("un servicio en dos áreas aparece en LAS DOS, y es el mismo objeto", () => {
    const enEstetica = filtrarServicios(CATALOGO, { area: ESTETICA });
    const enMedicina = filtrarServicios(CATALOGO, { area: MEDICINA });

    const deEstetica = enEstetica.find((s) => s.name === "Limpieza de Cutis con Dermapen");
    const deMedicina = enMedicina.find((s) => s.name === "Limpieza de Cutis con Dermapen");

    expect(deEstetica).toBeDefined();
    expect(deMedicina).toBeDefined();
    // No es una copia: es la misma fila. Editarla desde una pestaña la edita
    // desde la otra, que es todo el punto de que `service_category` vincule en
    // vez de duplicar.
    expect(deEstetica).toBe(deMedicina);
  });

  it("un servicio sin área no aparece en ninguna", () => {
    for (const a of [ESTETICA, MEDICINA]) {
      expect(filtrarServicios(CATALOGO, { area: a }).map((s) => s.name)).not.toContain("Sin clasificar");
    }
  });

  it("un área sin servicios devuelve lista vacía, no error", () => {
    expect(filtrarServicios(CATALOGO, { area: "Masajes y Bienestar" })).toEqual([]);
  });

  it("compara el nombre completo, no un pedazo", () => {
    // "Estética" es prefijo de "Estética Corporal": si comparara por `includes`
    // se mezclarían las dos.
    const filas = [svc("X", ["Estética Corporal"])];
    expect(filtrarServicios(filas, { area: ESTETICA })).toEqual([]);
  });
});

describe("filtrarServicios — área y búsqueda juntas", () => {
  it("la búsqueda se aplica DENTRO del área, no sobre todo el catálogo", () => {
    // "Limpieza" matchea dos servicios, pero sólo uno está en Medicina.
    const r = filtrarServicios(CATALOGO, { area: MEDICINA, search: "limpieza" });
    expect(r.map((s) => s.name)).toEqual(["Limpieza de Cutis con Dermapen"]);
  });

  it("busca también por código", () => {
    expect(filtrarServicios(CATALOGO, { area: ESTETICA, search: "vl1" }).map((s) => s.name)).toEqual([
      "Venus Legacy - 1 zona",
    ]);
  });

  it("la búsqueda ignora mayúsculas y espacios al borde", () => {
    expect(filtrarServicios(CATALOGO, { area: ESTETICA, search: "  BOTOX " })).toEqual([]);
    expect(filtrarServicios(CATALOGO, { area: MEDICINA, search: "  BOTOX " })).toHaveLength(1);
  });
});

describe("filtrarServicios — la pestaña de rescate", () => {
  const AREAS = [ESTETICA, MEDICINA, "Masajes y Bienestar"];

  it("soloSinArea devuelve los que no están en ninguna pestaña", () => {
    const r = filtrarServicios(CATALOGO, { soloSinArea: true, nombresDeArea: AREAS });
    expect(r.map((s) => s.name)).toEqual(["Sin clasificar"]);
  });

  it("soloSinArea gana sobre area: son modos, no filtros que se suman", () => {
    const r = filtrarServicios(CATALOGO, {
      soloSinArea: true,
      area: ESTETICA,
      nombresDeArea: AREAS,
    });
    expect(r.map((s) => s.name)).toEqual(["Sin clasificar"]);
  });

  it("la búsqueda también se aplica dentro de los sin clasificar", () => {
    const r = filtrarServicios(CATALOGO, {
      soloSinArea: true,
      nombresDeArea: AREAS,
      search: "botox",
    });
    expect(r).toEqual([]);
  });

  it("sin nombresDeArea, TODO cuenta como sin clasificar — no dice 'cero problemas' por no saber", () => {
    const r = filtrarServicios(CATALOGO, { soloSinArea: true });
    expect(r).toHaveLength(CATALOGO.length);
  });
});
