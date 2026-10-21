import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { createPortal } from "react-dom";
import { GrupalLayout } from "./GrupalLayout";
import { useContextoDeArea } from "../contexto-de-area";
import { solapasDeActividades } from "../../../lib/admin-nav";
import { ToastProvider } from "../../../components/ui/Toast";
import { rutasGrupales } from "./rutas-grupales";

// Sin sesión los hooks de datos no pegan a la red; sólo importa dónde se aterriza.
vi.mock("../../../auth/AuthContext", () => ({
  useAuth: () => ({ role: "admin", session: null, user: null, loading: false, signOut: vi.fn() }),
}));

function Ubicacion() {
  return <div data-testid="ubicacion">{useLocation().pathname}</div>;
}

/** Las cajas con scroll vertical propio. */
function scrollsVerticales(container: HTMLElement) {
  return Array.from(container.querySelectorAll("*")).filter((el) =>
    /\boverflow-(y-)?auto\b/.test(el.getAttribute("class") ?? ""),
  );
}

/** Una pantalla que dibuja en el hueco de acciones, como las de área. */
function PantallaConAccion() {
  const ctx = useContextoDeArea();
  return ctx?.slotAcciones ? createPortal(<button>Agregar</button>, ctx.slotAcciones) : null;
}

describe("GrupalLayout", () => {
  it("muestra el título, la bajada y las tres solapas", () => {
    render(
      <MemoryRouter initialEntries={["/admin/actividades/lista"]}>
        <Routes>
          <Route
            path="/admin/actividades"
            element={
              <GrupalLayout titulo="Actividades" bajada="Una bajada." solapas={solapasDeActividades()} />
            }
          >
            <Route path="lista" element={<div>contenido</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Actividades" })).toBeInTheDocument();
    expect(screen.getByText("Una bajada.")).toBeInTheDocument();
    for (const n of ["Actividades", "Horarios", "Suscripciones"]) {
      expect(screen.getByRole("link", { name: n })).toBeInTheDocument();
    }
    expect(screen.getByText("contenido")).toBeInTheDocument();
  });

  it("presta el hueco de acciones junto al título", () => {
    render(
      <MemoryRouter initialEntries={["/admin/actividades/lista"]}>
        <Routes>
          <Route
            path="/admin/actividades"
            element={<GrupalLayout titulo="Actividades" bajada="b" solapas={solapasDeActividades()} />}
          >
            <Route path="lista" element={<PantallaConAccion />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    const titulo = screen.getByRole("heading", { name: "Actividades" });
    expect(titulo.parentElement).toContainElement(screen.getByRole("button", { name: "Agregar" }));
  });
});

describe("rutas de Actividades y Capacitaciones (montadas como en App.tsx)", () => {
  function montar(entrada: string) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <MemoryRouter initialEntries={[entrada]}>
            <Ubicacion />
            <Routes>
              <Route path="/admin">{rutasGrupales()}</Route>
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>,
    );
  }

  it("/admin/suscripciones termina en /admin/actividades/suscripciones", async () => {
    montar("/admin/suscripciones");
    expect(screen.getByTestId("ubicacion")).toHaveTextContent("/admin/actividades/suscripciones");
  });

  it("/admin/actividades redirige a la lista y muestra la pantalla de actividades", async () => {
    montar("/admin/actividades");
    expect(screen.getByTestId("ubicacion")).toHaveTextContent("/admin/actividades/lista");
    expect(await screen.findByText(/Cargando actividades|No hay actividades/)).toBeInTheDocument();
  });

  // Como las áreas del catálogo (Estética): del buscador para abajo todo
  // desfila en el único scroll del layout y se esconde bajo las solapas.
  it("Suscripciones no tiene un scroll propio: el único es el del layout", async () => {
    const { container } = montar("/admin/actividades/suscripciones");
    await screen.findByText(/Cargando suscripciones/);
    expect(scrollsVerticales(container)).toHaveLength(1);
  });

  it("/admin/capacitaciones redirige a la lista", async () => {
    montar("/admin/capacitaciones");
    expect(screen.getByTestId("ubicacion")).toHaveTextContent("/admin/capacitaciones/lista");
  });
});

