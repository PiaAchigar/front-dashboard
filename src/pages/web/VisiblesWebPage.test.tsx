import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { VisiblesWebPage } from "./VisiblesWebPage";
import { ToastProvider } from "../../components/ui/Toast";

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({
    role: "admin",
    session: { access_token: "test-token" },
    user: null,
    loading: false,
    signOut: vi.fn(),
  }),
}));

// #43 (2026-10-30): las actividades tienen su check "Publicar en la web"
// (activities.is_visible_web, 1.64.0) y Laura lo maneja desde acá, igual que
// el de servicios y capacitaciones.
const ACTIVIDADES = [
  { id: "a1", name: "Pilates Reformer - Clase suelta/prueba", activityType: "class", isActive: true, isVisibleWeb: true },
  { id: "a2", name: "Thermobike - Clase suelta/prueba", activityType: "machine", isActive: true, isVisibleWeb: false },
];

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async (url: RequestInfo | URL) => {
    const u = String(url);
    if (u.includes("/api/activities")) return { ok: true, json: async () => ({ success: true, data: ACTIVIDADES }) };
    if (u.includes("/api/agenda/services")) return { ok: true, json: async () => [] };
    if (u.includes("/api/agenda/trainings/admin")) return { ok: true, json: async () => [] };
    return { ok: true, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ToastProvider>{children}</ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const fila = async (nombre: string) => (await screen.findByText(nombre)).closest("tr") as HTMLElement;

describe("VisiblesWebPage — actividades", () => {
  it("lista las actividades con su check, publicadas o no", async () => {
    render(<VisiblesWebPage />, { wrapper });
    expect(screen.getByRole("heading", { name: "Actividades" })).toBeInTheDocument();
    expect(within(await fila("Pilates Reformer - Clase suelta/prueba")).getByRole("button", { name: "Ocultar" })).toBeInTheDocument();
    expect(within(await fila("Thermobike - Clase suelta/prueba")).getByRole("button", { name: "Mostrar" })).toBeInTheDocument();
  });

  it("destildar una actividad manda isVisibleWeb: false a su PATCH", async () => {
    render(<VisiblesWebPage />, { wrapper });
    fireEvent.click(within(await fila("Pilates Reformer - Clase suelta/prueba")).getByRole("button", { name: "Ocultar" }));
    await vi.waitFor(() => {
      const patch = fetchMock.mock.calls.find(
        ([u, init]) => String(u).endsWith("/api/activities/a1") && (init as RequestInit)?.method === "PATCH",
      );
      expect(patch).toBeDefined();
      expect(JSON.parse(String((patch![1] as RequestInit).body))).toEqual({ isVisibleWeb: false });
    });
  });
});
