import { describe, expect, it } from "vitest";
import { margenDesdePrecio, precioDesdeMargen } from "./margen";

describe("precioDesdeMargen", () => {
  it("un 100% duplica el costo", () => {
    expect(precioDesdeMargen(1000, 100)).toBe(2000);
  });

  it("un 50% agrega la mitad", () => {
    expect(precioDesdeMargen(1000, 50)).toBe(1500);
  });

  it("0% deja el precio igual al costo", () => {
    expect(precioDesdeMargen(1000, 0)).toBe(1000);
  });

  it("redondea a dos decimales", () => {
    // 3500.50 * 1.33 = 4655.665 → la base guarda numeric(10,2). Sin redondear,
    // el input mostraría 4655.664999999999.
    expect(precioDesdeMargen(3500.5, 33)).toBe(4655.67);
  });

  it("sin costo no se puede calcular", () => {
    expect(precioDesdeMargen(null, 50)).toBeNull();
    expect(precioDesdeMargen(1000, null)).toBeNull();
  });

  it("con costo 0 el precio es 0, no un error", () => {
    // Un insumo que salió gratis (muestra, regalo del proveedor) es válido.
    expect(precioDesdeMargen(0, 80)).toBe(0);
  });
});

describe("margenDesdePrecio", () => {
  it("el doble del costo es 100%", () => {
    expect(margenDesdePrecio(1000, 2000)).toBe(100);
  });

  it("mismo precio que costo es 0%", () => {
    expect(margenDesdePrecio(1000, 1000)).toBe(0);
  });

  it("vender más barato que el costo da margen negativo", () => {
    // No se corrige a 0: si Laura puso un precio por debajo del costo, el
    // número tiene que decírselo.
    expect(margenDesdePrecio(1000, 800)).toBe(-20);
  });

  it("redondea a un decimal", () => {
    expect(margenDesdePrecio(3500.5, 4655.67)).toBe(33);
  });

  it("con costo 0 no hay margen que calcular", () => {
    // Dividir por cero daría Infinity y el input mostraría "Infinity%".
    expect(margenDesdePrecio(0, 500)).toBeNull();
  });

  it("sin costo o sin precio devuelve null", () => {
    expect(margenDesdePrecio(null, 500)).toBeNull();
    expect(margenDesdePrecio(1000, null)).toBeNull();
  });
});
