import { describe, expect, it } from "vitest";
import { traduccionDeTarifa } from "./traduccion-de-tarifa";

describe("traduccionDeTarifa", () => {
  it("por hora: prorratea contra una sesión larga y una corta", () => {
    const texto = traduccionDeTarifa("per_hour", 28000);
    expect(texto).toContain("$28.000");
    expect(texto).toContain("$8.400");
  });

  it("monto fijo: el mismo importe dure lo que dure", () => {
    const texto = traduccionDeTarifa("fixed_per_service", 20000);
    expect(texto).toContain("$20.000");
    expect(texto).toMatch(/dure lo que dure/i);
  });

  it("sin monto no dice nada, en vez de decir $0", () => {
    expect(traduccionDeTarifa("per_hour", 0)).toBeNull();
    expect(traduccionDeTarifa("fixed_per_service", Number.NaN)).toBeNull();
  });

  it("redondea a peso entero: nadie cobra centavos", () => {
    // 10.000/h × 18 min = 3000 exacto; 10.001/h daría 3000,3
    expect(traduccionDeTarifa("per_hour", 10001)).not.toContain(",");
  });
});
