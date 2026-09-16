import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { UltimaSolapa, useRecordarSolapa } from "./UltimaSolapa";

/** Un dashboard de juguete con la misma forma que el de verdad. */
function App() {
  useRecordarSolapa();
  return (
    <>
      <Link to="/agenda">ir a la agenda</Link>
      <Link to="/admin">ir a administración</Link>
      <Link to="/admin/estetica/combos">ir a combos de estética</Link>
      <Routes>
        <Route path="/agenda" element={<p>pantalla agenda</p>} />
        <Route path="/admin">
          <Route index element={<UltimaSolapa seccion="/admin" porDefecto="/admin/promos" />} />
          <Route path="promos" element={<p>pantalla promos</p>} />
          <Route path="servicios" element={<p>pantalla todos los servicios</p>} />
          <Route path="estetica">
            <Route
              index
              element={
                <UltimaSolapa seccion="/admin/estetica" porDefecto="/admin/estetica/servicios" />
              }
            />
            <Route path="servicios" element={<p>pantalla servicios de estética</p>} />
            <Route path="combos" element={<p>pantalla combos de estética</p>} />
          </Route>
        </Route>
      </Routes>
    </>
  );
}

const abrir = (desde: string) =>
  render(
    <MemoryRouter initialEntries={[desde]}>
      <App />
    </MemoryRouter>,
  );

afterEach(() => sessionStorage.clear());

describe("la última solapa", () => {
  it("la primera vez, Administración abre en Promos", async () => {
    // Antes abría en "Todos los servicios", que no es lo que Laura mira
    // (Pia, 2026-09-16).
    abrir("/admin");
    expect(await screen.findByText("pantalla promos")).toBeInTheDocument();
  });

  it("volver a Administración devuelve a la solapa donde quedó", async () => {
    const user = userEvent.setup();
    abrir("/admin/estetica/combos");
    await screen.findByText("pantalla combos de estética");

    await user.click(screen.getByText("ir a la agenda"));
    await screen.findByText("pantalla agenda");

    await user.click(screen.getByText("ir a administración"));
    expect(await screen.findByText("pantalla combos de estética")).toBeInTheDocument();
  });

  it("y el área recuerda su propia solapa", async () => {
    const user = userEvent.setup();
    abrir("/admin/estetica/combos");
    await screen.findByText("pantalla combos de estética");
    await user.click(screen.getByText("ir a la agenda"));
    await screen.findByText("pantalla agenda");

    // Entrar al área directo, sin pasar por el índice de /admin. Se desmonta
    // lo anterior para que no queden dos dashboards en la misma pantalla.
    cleanup();
    abrir("/admin/estetica");
    expect(await screen.findByText("pantalla combos de estética")).toBeInTheDocument();
  });

  it("una pestaña nueva arranca en el destino por defecto", async () => {
    // `sessionStorage` es por pestaña: es lo que se quiere, dos pestañas en
    // pantallas distintas no se pisan.
    abrir("/admin");
    expect(await screen.findByText("pantalla promos")).toBeInTheDocument();
  });
});
