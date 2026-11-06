import { render, screen } from "@testing-library/react";
import { MemoryRouter, Navigate, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { TextosWebLayout } from "./TextosWebLayout";

function montar(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/sitio-web/textos" element={<TextosWebLayout />}>
          <Route index element={<Navigate to="inicio" replace />} />
          <Route path="inicio" element={<p>pantalla inicio</p>} />
          <Route path="categorias" element={<p>pantalla categorias</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("TextosWebLayout", () => {
  it("tiene el sub-menú con Inicio y Categorías", () => {
    montar("/sitio-web/textos/categorias");
    expect(screen.getByRole("link", { name: "Inicio" })).toHaveAttribute("href", "/sitio-web/textos/inicio");
    expect(screen.getByRole("link", { name: "Categorías" })).toHaveAttribute("href", "/sitio-web/textos/categorias");
    expect(screen.getByText("pantalla categorias")).toBeInTheDocument();
  });

  it("la ruta vieja lleva a Inicio: puede estar guardada como última solapa", () => {
    montar("/sitio-web/textos");
    expect(screen.getByText("pantalla inicio")).toBeInTheDocument();
  });
});
