import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ConfiguracionDepilacionLayout } from "./ConfiguracionDepilacionLayout";

describe("ConfiguracionDepilacionLayout", () => {
  it("muestra las dos subpestañas", () => {
    render(
      <MemoryRouter initialEntries={["/admin/depilacion/configuracion/comision"]}>
        <ConfiguracionDepilacionLayout />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Comisión" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Precios por zona/ })).toBeInTheDocument();
  });
});
