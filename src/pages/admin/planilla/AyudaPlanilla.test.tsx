import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ToastProvider } from "../../../components/ui/Toast";
import { AyudaPlanilla, BotonAyudaPlanilla } from "./AyudaPlanilla";
import { PlanillaServiciosPage } from "./PlanillaServiciosPage";

vi.mock("../../../auth/AuthContext", () => ({
  useAuth: () => ({ role: "admin", session: { access_token: "t" }, user: null, loading: false, signOut: vi.fn() }),
}));

beforeEach(() => localStorage.clear());

function Envoltorio({ children }: { children: ReactNode }) {
  const qc = new QueryClient();
  return (
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <MemoryRouter>{children}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

describe("AyudaPlanilla", () => {
  it("explica todo lo que Laura necesita saber", () => {
    render(<AyudaPlanilla onVolver={() => {}} />);
    const texto = document.body.textContent ?? "";
    for (const frag of [
      "no borra",
      "Categorías",
      "Microsoft Excel (.xlsx)",
      "no toques la columna id",
      "Depilación",
      "IVA",
      "admin",
      "conflicto",
      "Por hora",
      "Porcentaje (%)",
      "Fijo por servicio",
      "Sí o No",
      "decimales",
      "un solo archivo",
      "no se guarda nada",
      "historial",
      "combos y packs",
      "al menos una categoría",
      "Actualizar precios",
      "varias máquinas a un mismo servicio",
      "Máquina nueva",
    ]) {
      expect(texto, frag).toContain(frag);
    }
  });

  it("el (?) abre la ayuda y Volver la cierra", () => {
    render(<PlanillaServiciosPage area={{ path: "estetica", categoria: "Estética", bajada: "" }} />, { wrapper: Envoltorio });
    expect(screen.queryByText("Para qué sirve")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cómo usar la planilla" }));
    expect(screen.getByText("Para qué sirve")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: /Volver/ })[0]);
    expect(screen.queryByText("Para qué sirve")).toBeNull();
  });

  it("el botón late la primera vez y no la segunda (clave ayuda-planilla-vista)", () => {
    const { unmount } = render(<BotonAyudaPlanilla abierta={false} onClick={() => {}} />);
    expect(screen.getByRole("button", { name: "Cómo usar la planilla" }).className).toContain("ayuda-latido");
    expect(localStorage.getItem("ayuda-planilla-vista")).toBe("1");
    unmount();
    render(<BotonAyudaPlanilla abierta={false} onClick={() => {}} />);
    expect(screen.getByRole("button", { name: "Cómo usar la planilla" }).className).not.toContain("ayuda-latido");
  });
});
