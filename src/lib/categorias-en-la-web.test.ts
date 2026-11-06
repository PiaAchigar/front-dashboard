import { describe, expect, it } from "vitest";
import { categoriasEnLaWeb } from "./categorias-en-la-web";
import type { CategoryNode } from "./api-types";

function cat(id: string, name: string, over: Partial<CategoryNode> = {}): CategoryNode {
  return {
    id,
    name,
    description: null,
    displayOrder: 0,
    isActive: true,
    kind: "tecnica",
    children: [],
    ...over,
  };
}

const visible = (...categoryIds: string[]) => ({
  isVisible: true,
  categories: categoryIds.map((id) => ({ id, name: null })),
});

describe("categoriasEnLaWeb", () => {
  it("devuelve cada categoría con su ruta, en el orden del árbol", () => {
    const arbol = [
      cat("b", "Belleza", { children: [cat("c", "Cejas", { webDescription: "Hola" })] }),
    ];
    expect(categoriasEnLaWeb(arbol, [visible("c")])).toEqual([
      { id: "b", ruta: "Belleza", webDescription: null },
      { id: "c", ruta: "Belleza › Cejas", webDescription: "Hola" },
    ]);
  });

  it("deja afuera la que la web no muestra porque no tiene servicios", () => {
    const arbol = [cat("b", "Belleza"), cat("m", "Masajes")];
    expect(categoriasEnLaWeb(arbol, [visible("m")]).map((c) => c.id)).toEqual(["m"]);
  });

  it("un servicio oculto no alcanza para que la categoría salga en la web", () => {
    const arbol = [cat("b", "Belleza")];
    const oculto = { isVisible: false, categories: [{ id: "b", name: null }] };
    expect(categoriasEnLaWeb(arbol, [oculto])).toEqual([]);
  });

  it("deja afuera las áreas: son las pestañas del panel, no salen en la web", () => {
    const arbol = [cat("a", "Estética", { kind: "area" })];
    expect(categoriasEnLaWeb(arbol, [visible("a")])).toEqual([]);
  });

  it("incluye Depilación, Actividades y Capacitaciones aunque no tengan servicios", () => {
    const arbol = [
      cat("d", "Depilación Definitiva"),
      cat("x", "Actividades"),
      cat("k", "Capacitaciones"),
      cat("da", "Depilación Definitiva", { kind: "area" }),
    ];
    expect(categoriasEnLaWeb(arbol, []).map((c) => c.id)).toEqual(["d", "x", "k"]);
  });
});
