import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ServiciosDeCategoria } from "./ServiciosDeCategoria";
import { ToastProvider } from "../../components/ui/Toast";
import type { Service } from "../../lib/api-types";
import type { CategoriaPlana } from "../../lib/categorias-por-area";

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({ role: "admin", session: { access_token: "t" }, user: null, loading: false, signOut: vi.fn() }),
}));

const AREA: CategoriaPlana = { id: "a-est", name: "Estética", parentId: null, kind: "area", depth: 0 };
const TECNICA: CategoriaPlana = { id: "c-fac", name: "Facial", parentId: "a-est", kind: "tecnica", depth: 1 };
const SERVICIO = { id: "s1", name: "Limpieza", categories: [{ id: "a-est", name: "Estética" }, { id: "c-fac", name: "Facial" }] } as unknown as Service;

function montar(categoria: CategoriaPlana) {
  const qc = new QueryClient();
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ToastProvider>
          <ServiciosDeCategoria
            categoria={categoria}
            categorias={[AREA, TECNICA]}
            servicios={[SERVICIO]}
            areas={[{ id: "a-est", name: "Estética" } as never]}
            puedeEditar
            onClose={() => {}}
          />
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ServiciosDeCategoria - link a Actualizar precios", () => {
  it("aparece en una categoría común", () => {
    montar(TECNICA);
    expect(screen.getByRole("link", { name: "Actualizar precios de esta categoría" })).toBeInTheDocument();
  });

  it("no aparece cuando la categoría es un área", () => {
    montar(AREA);
    expect(screen.getAllByText("Limpieza").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Actualizar precios de esta categoría" })).not.toBeInTheDocument();
  });
});
