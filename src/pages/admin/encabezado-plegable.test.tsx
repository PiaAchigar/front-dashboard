import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Plegable, ProveedorDePliegue } from "./encabezado-plegable";
import { GrupalLayout } from "./grupal/GrupalLayout";
import { solapasDeActividades } from "../../lib/admin-nav";

/** Un scroll vertical de mentira: jsdom no calcula alturas, se las damos. */
function Tabla() {
  return (
    <div data-testid="scroll" style={{ overflow: "auto" }}>
      <div style={{ height: 2000 }}>filas</div>
    </div>
  );
}

function montar(entrada = "/admin/actividades/lista") {
  render(
    <MemoryRouter initialEntries={[entrada]}>
      <ProveedorDePliegue>
        <Plegable>
          <h1>Administración</h1>
        </Plegable>
        <Routes>
          <Route
            path="/admin/actividades"
            element={<GrupalLayout titulo="Actividades" bajada="Una bajada." solapas={solapasDeActividades()} />}
          >
            <Route path="lista" element={<Tabla />} />
            <Route path="horarios" element={<Tabla />} />
          </Route>
        </Routes>
      </ProveedorDePliegue>
    </MemoryRouter>,
  );
}

function scrollear(el: HTMLElement, top: number, { alto = 2000, visible = 300 } = {}) {
  Object.defineProperty(el, "scrollHeight", { configurable: true, value: alto });
  Object.defineProperty(el, "clientHeight", { configurable: true, value: visible });
  el.scrollTop = top;
  fireEvent.scroll(el);
}

const plegados = () => document.querySelectorAll('[data-plegado="si"]');
const solapas = () => screen.getByTestId("solapas-de-la-seccion");

describe("encabezado plegable de Actividades y Capacitaciones", () => {
  it("arranca desplegado y sin borde en las solapas", () => {
    montar();
    expect(plegados()).toHaveLength(0);
    expect(solapas().dataset.hayAbajo).toBeUndefined();
  });

  it("al bajar en la tabla se esconde todo lo de arriba y las solapas se marcan con el borde", () => {
    montar();
    scrollear(screen.getByTestId("scroll"), 40);
    // El de Administración (fila de áreas) y el del título de la sección.
    expect(plegados()).toHaveLength(2);
    expect(screen.getByText("Una bajada.").closest('[data-plegado="si"]')).not.toBeNull();
    expect(screen.getByText("Administración").closest('[data-plegado="si"]')).not.toBeNull();
    expect(solapas().dataset.hayAbajo).toBe("si");
    // Las solapas no se esconden: son lo que queda arriba.
    expect(solapas().closest('[data-plegado="si"]')).toBeNull();
  });

  it("al volver arriba del todo se despliega de nuevo", () => {
    montar();
    const tabla = screen.getByTestId("scroll");
    scrollear(tabla, 40);
    scrollear(tabla, 0);
    expect(plegados()).toHaveLength(0);
    expect(solapas().dataset.hayAbajo).toBeUndefined();
  });

  it("un scroll de costado (sin desborde vertical) no pliega nada", () => {
    montar();
    scrollear(screen.getByTestId("scroll"), 0, { alto: 300, visible: 300 });
    const el = screen.getByTestId("scroll");
    el.scrollLeft = 200;
    fireEvent.scroll(el);
    expect(plegados()).toHaveLength(0);
  });

  it("si la tabla apenas desborda, no se pliega (si no, al plegar entraría entera y quedaría trabado)", () => {
    montar();
    scrollear(screen.getByTestId("scroll"), 40, { alto: 400, visible: 300 });
    expect(plegados()).toHaveLength(0);
  });

  it("si al plegar la tabla entra entera (el scroll vuelve a 0), se despliega", () => {
    montar();
    const tabla = screen.getByTestId("scroll");
    scrollear(tabla, 40);
    scrollear(tabla, 0, { alto: 300, visible: 300 });
    expect(plegados()).toHaveLength(0);
  });

  it("lo plegado no se puede enfocar con el teclado (inert)", () => {
    montar();
    scrollear(screen.getByTestId("scroll"), 40);
    for (const el of plegados()) expect(el.hasAttribute("inert")).toBe(true);
  });

  it("cambiar de solapa vuelve a desplegar", () => {
    montar();
    scrollear(screen.getByTestId("scroll"), 40);
    fireEvent.click(screen.getByRole("link", { name: "Horarios" }));
    expect(plegados()).toHaveLength(0);
  });
});
