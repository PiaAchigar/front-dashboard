import { describe, expect, it } from "vitest";
import { extremosOcultos } from "./desplazamiento";

const vista = (scrollLeft: number, clientWidth: number, scrollWidth: number) => ({
  scrollLeft,
  clientWidth,
  scrollWidth,
});

describe("extremosOcultos — qué queda fuera de la vista en una tira horizontal", () => {
  it("sin desborde no hay nada oculto: ninguna flecha", () => {
    expect(extremosOcultos(vista(0, 400, 400))).toEqual({ izquierda: false, derecha: false });
  });

  it("al principio de una tira larga sólo sobra por la derecha", () => {
    expect(extremosOcultos(vista(0, 400, 800))).toEqual({ izquierda: false, derecha: true });
  });

  it("en el medio sobra por los dos lados", () => {
    expect(extremosOcultos(vista(200, 400, 800))).toEqual({ izquierda: true, derecha: true });
  });

  it("al final sólo sobra por la izquierda — la flecha derecha desaparece", () => {
    expect(extremosOcultos(vista(400, 400, 800))).toEqual({ izquierda: true, derecha: false });
  });

  // El ancho de un layout flexible casi nunca es entero. Sin tolerancia, una
  // tira que entra justa muestra una flecha derecha permanente que no scrollea
  // nada — que es exactamente el defecto que estas flechas vienen a reemplazar.
  it("una diferencia de menos de un pixel no cuenta como desborde", () => {
    expect(extremosOcultos(vista(0, 400, 400.5))).toEqual({ izquierda: false, derecha: false });
    expect(extremosOcultos(vista(0.5, 400, 400.5))).toEqual({ izquierda: false, derecha: false });
  });

  it("un desborde de más de un pixel sí cuenta", () => {
    expect(extremosOcultos(vista(0, 400, 402)).derecha).toBe(true);
    expect(extremosOcultos(vista(2, 400, 402)).izquierda).toBe(true);
  });

  it("el rebote del scroll (scrollLeft negativo) no enciende la flecha izquierda", () => {
    expect(extremosOcultos(vista(-30, 400, 800)).izquierda).toBe(false);
  });

  it("una tira vacía no muestra flechas", () => {
    expect(extremosOcultos(vista(0, 0, 0))).toEqual({ izquierda: false, derecha: false });
  });
});
