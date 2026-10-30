import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ToastProvider } from "../../../components/ui/Toast";
import { ActualizarPreciosPage } from "./ActualizarPreciosPage";
import { ServiciosAdminPage } from "../ServiciosAdminPage";
import { ServiciosDeCategoria } from "../ServiciosDeCategoria";

let rol = "admin";
vi.mock("../../../auth/AuthContext", () => ({
  useAuth: () => ({
    role: rol,
    session: { access_token: "test-token" },
    user: null,
    loading: false,
    signOut: vi.fn(),
  }),
}));

beforeEach(() => {
  rol = "admin";
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => [] })),
  );
});
afterEach(() => vi.unstubAllGlobals());

function Envoltorio({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <MemoryRouter>{children}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

describe("ayuda de Actualizar precios", () => {
  it("el (?) abre la ayuda y Volver la cierra", () => {
    render(<ActualizarPreciosPage />, { wrapper: Envoltorio });
    expect(screen.queryByText("Para qué sirve")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cómo actualizar precios" }));
    expect(screen.getByText("Para qué sirve")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: /Volver/ })[0]);
    expect(screen.queryByText("Para qué sirve")).toBeNull();
  });

  it("menciona lista, efectivo y el ejemplo de redondeo", () => {
    render(<ActualizarPreciosPage />, { wrapper: Envoltorio });
    fireEvent.click(screen.getByRole("button", { name: "Cómo actualizar precios" }));
    expect(screen.getByText(/precio de lista y el de efectivo/)).toBeTruthy();
    expect(screen.getByText(/\$45\.150/)).toBeTruthy();
    expect(screen.getByText("$50.000")).toBeTruthy();
  });

  it("late la primera vez y no la segunda", () => {
    const { unmount } = render(<ActualizarPreciosPage />, { wrapper: Envoltorio });
    expect(screen.getByRole("button", { name: "Cómo actualizar precios" }).className).toContain("ayuda-latido");
    unmount();
    render(<ActualizarPreciosPage />, { wrapper: Envoltorio });
    expect(screen.getByRole("button", { name: "Cómo actualizar precios" }).className).not.toContain("ayuda-latido");
  });
});

describe("entradas a Actualizar precios", () => {
  it("Todos los servicios tiene el botón; un área no", async () => {
    const { unmount } = render(<ServiciosAdminPage />, { wrapper: Envoltorio });
    const link = await screen.findByRole("link", { name: "Actualizar precios" });
    expect(link.getAttribute("href")).toBe("/admin/servicios/actualizar-precios");
    unmount();
    render(<ServiciosAdminPage area="Estética" />, { wrapper: Envoltorio });
    await waitFor(() => expect(screen.getByText("Agregar")).toBeTruthy());
    expect(screen.queryByRole("link", { name: "Actualizar precios" })).toBeNull();
  });

  it("sin permiso de edición no aparece el botón", async () => {
    rol = "reception";
    render(<ServiciosAdminPage />, { wrapper: Envoltorio });
    await screen.findByPlaceholderText(/Buscar/);
    expect(screen.queryByRole("link", { name: "Actualizar precios" })).toBeNull();
  });

  const categoria = { id: "c-facial", name: "Facial", parentId: null } as never;
  const panel = (puedeEditar: boolean) => (
    <ServiciosDeCategoria
      categoria={categoria}
      categorias={[categoria]}
      servicios={[{ id: "s1", name: "Limpieza", categories: [{ id: "c-facial", name: "Facial" }] } as never]}
      areas={[]}
      puedeEditar={puedeEditar}
      onClose={() => {}}
    />
  );

  it("el panel de una categoría lleva ?categoria=<id>", () => {
    render(panel(true), { wrapper: Envoltorio });
    const link = screen.getByRole("link", { name: "Actualizar precios de esta categoría" });
    expect(link.getAttribute("href")).toBe("/admin/servicios/actualizar-precios?categoria=c-facial");
  });

  it("el panel sin permiso de edición no tiene el link", () => {
    render(panel(false), { wrapper: Envoltorio });
    expect(screen.queryByRole("link", { name: "Actualizar precios de esta categoría" })).toBeNull();
  });
});
