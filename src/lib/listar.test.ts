import { describe, expect, it } from "vitest";
import { listar } from "./listar";

describe("listar", () => {
  it("sin faltantes no dice nada", () => {
    expect(listar([])).toBeNull();
  });

  it("uno solo va tal cual", () => {
    expect(listar(["el nombre"])).toBe("el nombre");
  });

  it("dos van con 'y', no con coma", () => {
    expect(listar(["el nombre", "el precio"])).toBe("el nombre y el precio");
  });

  it("tres o más: comas y una 'y' al final", () => {
    expect(listar(["el nombre", "el precio", "la vigencia"])).toBe(
      "el nombre, el precio y la vigencia",
    );
  });
});
