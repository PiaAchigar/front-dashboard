import { describe, expect, it } from "vitest";
import { contarDescendientes, filasVisibles, idsConHijas } from "./arbol-plano";

const f = (id: string, parentId: string | null = null) => ({ id, parentId });

// Una rama real del árbol de la 1.38.0, en orden de recorrido.
const ARBOL = [
  f("medicos"),
  f("derma", "medicos"),
  f("clinica", "derma"),
  f("consulta", "clinica"),
  f("inflamatorias", "consulta"),
  f("acne", "inflamatorias"),
  f("rosacea", "inflamatorias"),
  f("estetica", "derma"),
  f("facial", "estetica"),
  f("manicuria"),
  f("pedicuria", "manicuria"),
];

const ids = (fs: { id: string }[]) => fs.map((x) => x.id);

describe("filasVisibles", () => {
  it("sin nada plegado se ven todas", () => {
    expect(filasVisibles(ARBOL, new Set())).toHaveLength(ARBOL.length);
  });

  it("plegar una raíz esconde su rama y no toca las otras", () => {
    expect(ids(filasVisibles(ARBOL, new Set(["medicos"])))).toEqual([
      "medicos",
      "manicuria",
      "pedicuria",
    ]);
  });

  // El caso que se olvida: "acne" es tataranieto de "derma".
  it("plegar se lleva también a los descendientes lejanos, no sólo a las hijas", () => {
    const visibles = ids(filasVisibles(ARBOL, new Set(["derma"])));
    expect(visibles).not.toContain("acne");
    expect(visibles).not.toContain("rosacea");
    expect(visibles).toContain("derma");
  });

  it("la fila plegada sigue viéndose: es la que tiene la flechita para abrirla", () => {
    expect(ids(filasVisibles(ARBOL, new Set(["clinica"])))).toContain("clinica");
  });

  it("plegar una rama no esconde a sus hermanas", () => {
    const visibles = ids(filasVisibles(ARBOL, new Set(["clinica"])));
    expect(visibles).toContain("estetica");
    expect(visibles).toContain("facial");
  });

  it("plegar una hoja no cambia nada", () => {
    expect(filasVisibles(ARBOL, new Set(["acne"]))).toHaveLength(ARBOL.length);
  });

  it("una rama plegada dentro de otra plegada no reaparece", () => {
    const visibles = ids(filasVisibles(ARBOL, new Set(["medicos", "clinica"])));
    expect(visibles).toEqual(["medicos", "manicuria", "pedicuria"]);
  });

  it("preserva el orden original", () => {
    expect(ids(filasVisibles(ARBOL, new Set(["inflamatorias"])))).toEqual([
      "medicos",
      "derma",
      "clinica",
      "consulta",
      "inflamatorias",
      "estetica",
      "facial",
      "manicuria",
      "pedicuria",
    ]);
  });

  // `flatten()` hoy las devuelve en orden de recorrido, pero la función no
  // debe depender de eso: el día que la tabla se ordene por otra columna,
  // depender del orden escondería filas al azar.
  it("no depende de que la madre venga antes que la hija", () => {
    const alReves = [...ARBOL].reverse();
    const visibles = ids(filasVisibles(alReves, new Set(["derma"])));
    expect(visibles).not.toContain("acne");
    expect(visibles).toContain("manicuria");
  });

  it("lista vacía devuelve vacía", () => {
    expect(filasVisibles([], new Set(["x"]))).toEqual([]);
  });

  it("un ciclo en los datos no cuelga el navegador", () => {
    const ciclo = [f("a", "b"), f("b", "a")];
    expect(() => filasVisibles(ciclo, new Set(["z"]))).not.toThrow();
  });
});

describe("idsConHijas — quién lleva flechita", () => {
  it("marca sólo a las que tienen descendencia directa", () => {
    const con = idsConHijas(ARBOL);
    expect(con.has("medicos")).toBe(true);
    expect(con.has("inflamatorias")).toBe(true);
    expect(con.has("acne")).toBe(false);
    expect(con.has("facial")).toBe(false);
  });

  it("un árbol sin ramas no marca a nadie", () => {
    expect(idsConHijas([f("a"), f("b")]).size).toBe(0);
  });
});

describe("contarDescendientes — el número de la rama plegada", () => {
  const total = contarDescendientes(ARBOL);

  it("cuenta hijas, nietas y más abajo", () => {
    // derma, clinica, consulta, inflamatorias, acne, rosacea, estetica, facial
    expect(total.get("medicos")).toBe(8);
  });

  it("una rama del medio cuenta sólo lo suyo", () => {
    expect(total.get("inflamatorias")).toBe(2);
  });

  it("una hoja no aparece en el mapa", () => {
    expect(total.get("acne")).toBeUndefined();
  });

  it("una raíz con una sola hija cuenta 1", () => {
    expect(total.get("manicuria")).toBe(1);
  });

  it("un ciclo no cuelga", () => {
    expect(() => contarDescendientes([f("a", "b"), f("b", "a")])).not.toThrow();
  });
});
