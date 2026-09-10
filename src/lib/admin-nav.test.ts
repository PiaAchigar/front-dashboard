import { describe, expect, it } from "vitest";
import { AREAS, PESTANAS, solapasDeArea } from "./admin-nav";

describe("solapasDeArea", () => {
  const estetica = AREAS.find((a) => a.path === "estetica")!;
  const medicina = AREAS.find((a) => a.path === "medicina")!;

  it("las tres solapas van de lo simple a lo compuesto", () => {
    // No se puede armar un combo sin servicios, ni un pack sin algo que
    // repetir: el orden de la barra es el orden en que se cargan las cosas.
    expect(solapasDeArea(estetica).map((s) => s.label)).toEqual([
      "Servicios",
      "Combos",
      "Packs",
    ]);
  });

  it("apuntan adentro del área, no a las pantallas generales", () => {
    expect(solapasDeArea(estetica).map((s) => s.to)).toEqual([
      "/admin/estetica/servicios",
      "/admin/estetica/combos",
      "/admin/estetica/packs",
    ]);
  });

  it("sólo Medicina aclara 'Tratamientos', y va aparte del nombre", () => {
    const combos = solapasDeArea(medicina).find((s) => s.label === "Combos")!;
    // En `sub` y no pegado al label: se pinta más chiquito, y la palabra que
    // manda sigue siendo "Combos".
    expect(combos.sub).toBe("Tratamientos");
    expect(combos.label).toBe("Combos");
  });

  it("las otras áreas no llevan aclaración", () => {
    for (const area of AREAS.filter((a) => a.path !== "medicina")) {
      const combos = solapasDeArea(area).find((s) => s.label === "Combos")!;
      expect(combos.sub).toBeUndefined();
    }
  });

  it("cada área tiene su bajada, para que el layout no quede mudo", () => {
    for (const area of AREAS) expect(area.bajada.length).toBeGreaterThan(0);
  });
});

describe("PESTANAS", () => {
  it("Depilación va antes que Estética (pedido de Pia, 2026-09-10)", () => {
    const orden = PESTANAS.map((p) => p.label);
    expect(orden.indexOf("Depilación")).toBeLessThan(orden.indexOf("Estética"));
  });

  it("Promos sigue abriendo la barra: es lo que se vende", () => {
    expect(PESTANAS[0]?.label).toBe("Promos");
  });

  it("ya no hay una pestaña de Combos suelta: un combo vive en un área", () => {
    expect(PESTANAS.some((p) => p.to === "/admin/combos")).toBe(false);
  });
});

describe("AREAS", () => {
  it("son las tres del catálogo: depilación tiene su propio motor", () => {
    expect(AREAS.map((a) => a.categoria)).toEqual([
      "Estética",
      "Medicina y Dermatología",
      "Masajes y Bienestar",
    ]);
  });

  it("cada área tiene su pestaña en la barra de Administración", () => {
    for (const area of AREAS) {
      expect(PESTANAS.some((p) => p.to === `/admin/${area.path}`)).toBe(true);
    }
  });
});
