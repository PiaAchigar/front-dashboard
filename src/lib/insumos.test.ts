import { describe, expect, it } from "vitest";
import { etiquetaDeStock, paraReponer, textoDelAviso } from "./insumos";
import type { Insumo } from "../hooks/useInsumos";

function insumo(p: Partial<Insumo>): Insumo {
  return {
    id: "x",
    name: "Insumo",
    description: null,
    code: null,
    unitType: null,
    quantityInStock: null,
    minimumStock: null,
    unitCost: null,
    unitPrice: null,
    supplierInfo: null,
    taxCategory: null,
    isActive: true,
    nivel: "desconocido",
    ...p,
  };
}

describe("paraReponer", () => {
  const lista = [
    insumo({ id: "1", name: "Guantes", nivel: "ok" }),
    insumo({ id: "2", name: "Gasas", nivel: "bajo" }),
    insumo({ id: "3", name: "Ampollas", nivel: "sin_stock" }),
    insumo({ id: "4", name: "Algodón", nivel: "desconocido" }),
  ];

  it("deja sólo los bajos y los que no tienen nada", () => {
    expect(paraReponer(lista).map((i) => i.name)).toEqual(["Ampollas", "Gasas"]);
  });

  it("pone primero los que no tienen nada", () => {
    // El orden es la prioridad: sin stock frena un tratamiento hoy, bajo no.
    expect(paraReponer(lista)[0]!.name).toBe("Ampollas");
  });

  it("los que no tienen stock cargado no son una alerta", () => {
    // 'desconocido' es un insumo a medio cargar. Avisar por esos entrena a
    // ignorar el aviso.
    expect(paraReponer(lista).some((i) => i.name === "Algodón")).toBe(false);
  });

  it("sin nada que reponer devuelve lista vacía", () => {
    expect(paraReponer([insumo({ nivel: "ok" })])).toEqual([]);
  });
});

describe("textoDelAviso", () => {
  it("con uno solo lo nombra, sin contar", () => {
    // "1 insumo" obliga a abrir para saber cuál. El nombre ya lo dice.
    expect(textoDelAviso([insumo({ name: "Gasas", nivel: "bajo" })])).toBe("Falta reponer Gasas");
  });

  it("con dos los nombra a los dos, el más urgente primero", () => {
    // Ampollas está en cero y Gasas sólo bajo: el aviso arranca por lo que
    // frena un tratamiento hoy.
    const dos = [insumo({ name: "Gasas", nivel: "bajo" }), insumo({ name: "Ampollas", nivel: "sin_stock" })];
    expect(textoDelAviso(dos)).toBe("Falta reponer Ampollas y Gasas");
  });

  it("con más de dos nombra los dos primeros y cuenta el resto", () => {
    const muchos = [
      insumo({ name: "Gasas", nivel: "bajo" }),
      insumo({ name: "Ampollas", nivel: "bajo" }),
      insumo({ name: "Guantes", nivel: "bajo" }),
      insumo({ name: "Alcohol", nivel: "bajo" }),
    ];
    expect(textoDelAviso(muchos)).toBe("Falta reponer Gasas, Ampollas y 2 más");
  });

  it("un insumo sin nombre no rompe la frase", () => {
    expect(textoDelAviso([insumo({ name: null, nivel: "bajo" })])).toBe("Falta reponer 1 insumo");
  });

  it("sin nada que reponer no hay texto", () => {
    expect(textoDelAviso([])).toBeNull();
  });
});

describe("etiquetaDeStock", () => {
  it("traduce cada nivel", () => {
    expect(etiquetaDeStock("sin_stock").texto).toBe("Sin stock");
    expect(etiquetaDeStock("bajo").texto).toBe("Bajo");
    expect(etiquetaDeStock("ok").texto).toBe("En stock");
  });

  it("sin stock cargado dice que falta cargarlo, no que está en cero", () => {
    // Decir "sin stock" de algo que nadie contó es una alerta falsa.
    expect(etiquetaDeStock("desconocido").texto).toBe("Sin cargar");
  });

  it("las clases van escritas enteras, no armadas en runtime", () => {
    // Tailwind escanea el código como texto plano: una clase construida con
    // template string no se compila y el chip queda transparente. Ya pasó con
    // `bg-promo`. Este test falla si alguien vuelve a derivarlas.
    for (const nivel of ["sin_stock", "bajo", "ok", "desconocido"] as const) {
      expect(etiquetaDeStock(nivel).clase).toMatch(/^bg-\S+ text-\S+$/);
    }
  });
});
