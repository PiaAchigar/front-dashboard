import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

describe("runner de tests", () => {
  it("corre y evalúa una aserción", () => {
    expect(1 + 1).toBe(2);
  });

  it("puede renderizar un componente de React y consultarlo", () => {
    render(<p>Combos</p>);
    expect(screen.getByText("Combos")).toBeInTheDocument();
  });
});
