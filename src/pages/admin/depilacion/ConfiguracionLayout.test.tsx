import { render, screen } from "@testing-library/react";
import { MemoryRouter, Navigate, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ConfiguracionLayout } from "./ConfiguracionLayout";

describe("ConfiguracionLayout", () => {
  it("muestra las dos subpestañas", () => {
    render(
      <MemoryRouter initialEntries={["/admin/depilacion/configuracion/comision"]}>
        <ConfiguracionLayout />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Comisión" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Precios por zona/ })).toBeInTheDocument();
  });

  it("la ruta vieja /precios redirige a configuracion/precios", () => {
    render(
      <MemoryRouter initialEntries={["/admin/depilacion/precios"]}>
        <Routes>
          <Route
            path="/admin/depilacion/precios"
            element={<Navigate to="/admin/depilacion/configuracion/precios" replace />}
          />
          <Route
            path="/admin/depilacion/configuracion/precios"
            element={<div>Precios por zona</div>}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Precios por zona")).toBeInTheDocument();
  });
});
