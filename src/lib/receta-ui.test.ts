import { describe, expect, it } from "vitest";
import { costoDeLineas, ordenarParaElector } from "./receta-ui";
import type { Insumo } from "../hooks/useInsumos";

function insumo(id: string, name: string, unitCost: number | null = null): Insumo {
  return {
    id,
    name,
    description: null,
    code: null,
    unitType: null,
    quantityInStock: null,
    minimumStock: null,
    unitCost,
    unitPrice: null,
    supplierInfo: null,
    taxCategory: null,
    isActive: true,
    nivel: "ok",
  };
}

const catalogo = [
  insumo("alcohol", "Alcohol en gel"),
  insumo("ampollas", "Ampollas vitamina C"),
  insumo("gasas", "Gasas estériles"),
  insumo("guantes", "Guantes de nitrilo"),
];

describe("ordenarParaElector", () => {
  it("sin nada elegido, todos quedan abajo y ninguno arriba", () => {
    const { elegidos, resto } = ordenarParaElector(catalogo, {}, "");
    expect(elegidos).toEqual([]);
    expect(resto).toHaveLength(4);
  });

  it("los tildados suben arriba", () => {
    // Con 80 insumos, tener que scrollear buscando los tildes hace que no se
    // vea de un vistazo qué consume el servicio.
    const { elegidos, resto } = ordenarParaElector(catalogo, { gasas: "2" }, "");
    expect(elegidos.map((i) => i.id)).toEqual(["gasas"]);
    expect(resto.map((i) => i.id)).not.toContain("gasas");
  });

  it("un tildado sigue arriba aunque no coincida con la búsqueda", () => {
    // Si al buscar "guantes" desapareciera lo ya elegido, parecería que se
    // perdió, y al guardar se guardaría igual: la pantalla estaría mintiendo.
    const { elegidos, resto } = ordenarParaElector(catalogo, { gasas: "2" }, "guantes");
    expect(elegidos.map((i) => i.id)).toEqual(["gasas"]);
    expect(resto.map((i) => i.id)).toEqual(["guantes"]);
  });

  it("la búsqueda filtra el resto, sin importar mayúsculas ni acentos", () => {
    expect(ordenarParaElector(catalogo, {}, "AMPOLLAS").resto.map((i) => i.id)).toEqual([
      "ampollas",
    ]);
    expect(ordenarParaElector(catalogo, {}, "esteriles").resto.map((i) => i.id)).toEqual(["gasas"]);
  });

  it("una búsqueda sin resultados deja el resto vacío pero no toca los elegidos", () => {
    const { elegidos, resto } = ordenarParaElector(catalogo, { gasas: "2" }, "zzzz");
    expect(elegidos).toHaveLength(1);
    expect(resto).toEqual([]);
  });

  it("mantiene el orden alfabético dentro de cada bloque", () => {
    const { elegidos } = ordenarParaElector(catalogo, { guantes: "1", alcohol: "1" }, "");
    expect(elegidos.map((i) => i.id)).toEqual(["alcohol", "guantes"]);
  });

  it("un insumo tildado con la cantidad vacía sigue contando como elegido", () => {
    // Se tilda primero y se escribe la cantidad después: si al vaciar el input
    // el insumo saltara abajo, sería imposible tipear.
    expect(ordenarParaElector(catalogo, { gasas: "" }, "").elegidos.map((i) => i.id)).toEqual([
      "gasas",
    ]);
  });
});

describe("costoDeLineas", () => {
  it("suma cantidad por costo", () => {
    const conCosto = [insumo("gasas", "Gasas", 100), insumo("guantes", "Guantes", 50)];
    expect(costoDeLineas(conCosto, { gasas: "2", guantes: "1" })).toBe(250);
  });

  it("ignora los que no están tildados", () => {
    const conCosto = [insumo("gasas", "Gasas", 100), insumo("guantes", "Guantes", 50)];
    expect(costoDeLineas(conCosto, { gasas: "2" })).toBe(200);
  });

  it("una cantidad a medio escribir no rompe la cuenta", () => {
    expect(costoDeLineas([insumo("gasas", "Gasas", 100)], { gasas: "" })).toBe(0);
  });

  it("un insumo sin costo cargado suma 0", () => {
    // Es lo normal al principio: existe pero nadie le puso precio.
    expect(costoDeLineas([insumo("gasas", "Gasas", null)], { gasas: "3" })).toBe(0);
  });

  it("acepta fracciones", () => {
    expect(costoDeLineas([insumo("amp", "Ampolla", 4000)], { amp: "0.5" })).toBe(2000);
  });
});
