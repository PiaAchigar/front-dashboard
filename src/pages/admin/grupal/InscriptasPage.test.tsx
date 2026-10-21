import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InscriptasPage } from "./InscriptasPage";
import { GrupalLayout } from "./GrupalLayout";
import { ToastProvider } from "../../../components/ui/Toast";
import { solapasDeCapacitaciones } from "../../../lib/admin-nav";

vi.mock("../../../auth/AuthContext", () => ({
  useAuth: () => ({
    role: "admin",
    session: { access_token: "test-token" },
    user: null,
    loading: false,
    signOut: vi.fn(),
  }),
}));

const CAP_A = { id: "c1", name: "ZZ Instructorado", totalSessions: 4, maxParticipants: 10, isActive: true };
const CAP_B = { id: "c2", name: "ZZ Workshop", totalSessions: 2, maxParticipants: 6, isActive: true };

function inscripta(customerPurchaseId: string, nombre: string, extra = {}) {
  return {
    customerPurchaseId,
    customerId: `cli-${customerPurchaseId}`,
    nombre,
    compradaEl: "2026-10-03T14:00:00.000Z",
    debe: 0,
    encuentrosAnotada: 0,
    encuentrosTotales: 4,
    ...extra,
  };
}

let inscriptas: Record<string, unknown[]> = {};
let llamadas: { url: string; method: string; body?: unknown }[] = [];
let respuestaAnotar: unknown = null;

function ok(data: unknown, status = 200) {
  return { ok: true, status, json: async () => data };
}

beforeEach(() => {
  llamadas = [];
  respuestaAnotar = null;
  inscriptas = {
    c1: [
      inscripta("cp1", "ZZ Ana Pérez", { debe: 2000, encuentrosAnotada: 2 }),
      inscripta("cp2", "ZZ Bea Gómez", { debe: 0, encuentrosAnotada: 4 }),
    ],
    c2: [],
  };
  // Todo fetch va mockeado: si se escapa una llamada real, el test falla acá.
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      llamadas.push({ url, method, body: init?.body ? JSON.parse(init.body as string) : undefined });
      if (url.includes("/api/agenda/trainings/admin")) return ok([CAP_A, CAP_B]);
      const m = url.match(/\/api\/agenda\/trainings\/(\w+)\/inscriptas$/);
      if (m && method === "GET") return ok(inscriptas[m[1]] ?? []);
      if (url.endsWith("/api/agenda/classes/anotar-a-capacitacion")) {
        if (respuestaAnotar) return ok(respuestaAnotar, 201);
        return { ok: false, status: 400, json: async () => ({ error: "La clienta no compró esta capacitación" }) };
      }
      return ok({});
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <MemoryRouter initialEntries={["/admin/capacitaciones/inscriptas"]}>
          <Routes>
            <Route
              path="/admin/capacitaciones"
              element={<GrupalLayout titulo="Capacitaciones" bajada="b" solapas={solapasDeCapacitaciones()} />}
            >
              <Route path="inscriptas" element={<InscriptasPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

async function esperarFilas(n: number) {
  await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(n + 1));
}

describe("InscriptasPage", () => {
  it("los títulos de la tabla quedan fijos: la tabla tiene su propio scroll", async () => {
    montar();
    const tabla = await screen.findByRole("table");
    expect(tabla.querySelector("thead")!.className).toContain("sticky");
    expect(tabla.parentElement!.className).toContain("overflow-auto");
    expect(tabla.parentElement!.className).toContain("flex-1");
  });

  it("muestra Nombre, Comprada el, Debe en rojo o Pagada, y Encuentros como 'X de Y'", async () => {
    montar();
    await esperarFilas(2);
    expect(screen.getByRole("columnheader", { name: "Nombre" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Comprada el" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Debe" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Encuentros" })).toBeInTheDocument();

    const filas = screen.getAllByRole("row").slice(1);
    const ana = within(filas[0]);
    expect(ana.getByText("ZZ Ana Pérez")).toBeInTheDocument();
    expect(ana.getByText("Debe $2.000")).toHaveClass("text-red-700");
    expect(ana.getByText("2 de 4")).toBeInTheDocument();

    const bea = within(filas[1]);
    expect(bea.getByText("ZZ Bea Gómez")).toBeInTheDocument();
    expect(bea.getByText("Pagada")).toBeInTheDocument();
    expect(bea.queryByText(/Debe/)).toBeNull();
    expect(bea.getByText("4 de 4")).toBeInTheDocument();
  });

  it("muestra la fecha de compra en dd/mm/aaaa", async () => {
    montar();
    await esperarFilas(2);
    const filas = screen.getAllByRole("row").slice(1);
    expect(within(filas[0]).getByText("03/10/2026")).toBeInTheDocument();
  });

  it("pide las inscriptas de la capacitación seleccionada (la primera por defecto)", async () => {
    montar();
    await esperarFilas(2);
    expect(llamadas.some((l) => l.method === "GET" && l.url.endsWith("/api/agenda/trainings/c1/inscriptas"))).toBe(true);
  });

  it("sin compras muestra el texto de vacío", async () => {
    const user = userEvent.setup();
    montar();
    await esperarFilas(2);
    // La segunda capacitación no tiene compras
    await user.selectOptions(screen.getByRole("combobox"), "c2");
    await waitFor(() => expect(screen.getByText("Todavía nadie compró esta capacitación.")).toBeInTheDocument());
  });

  it("'Anotar en los encuentros' sólo aparece cuando faltan encuentros", async () => {
    montar();
    await esperarFilas(2);
    const filas = screen.getAllByRole("row").slice(1);
    expect(within(filas[0]).getByRole("button", { name: "Anotar en los encuentros" })).toBeInTheDocument();
    expect(within(filas[1]).queryByRole("button", { name: "Anotar en los encuentros" })).toBeNull();
  });

  it("anota con { trainingId, customerId }, avisa y recarga la lista", async () => {
    const user = userEvent.setup();
    respuestaAnotar = { success: true, data: { anotada: 2, yaEstaba: 2, sinLugar: [] } };
    montar();
    await esperarFilas(2);
    const antes = llamadas.filter((l) => l.method === "GET" && l.url.endsWith("/c1/inscriptas")).length;
    await user.click(screen.getByRole("button", { name: "Anotar en los encuentros" }));
    expect(await screen.findByText("Quedó anotada en 2 encuentros")).toBeInTheDocument();
    const post = llamadas.find((l) => l.method === "POST")!;
    expect(post.url).toMatch(/\/api\/agenda\/classes\/anotar-a-capacitacion$/);
    expect(post.body).toEqual({ trainingId: "c1", customerId: "cli-cp1" });
    await waitFor(() =>
      expect(llamadas.filter((l) => l.method === "GET" && l.url.endsWith("/c1/inscriptas")).length).toBeGreaterThan(antes),
    );
  });

  it("avisa los encuentros sin lugar", async () => {
    const user = userEvent.setup();
    respuestaAnotar = { success: true, data: { anotada: 1, yaEstaba: 2, sinLugar: [3, 4] } };
    montar();
    await esperarFilas(2);
    await user.click(screen.getByRole("button", { name: "Anotar en los encuentros" }));
    expect(await screen.findByText("Quedó anotada en 1 encuentro")).toBeInTheDocument();
    expect(screen.getByText("Sin lugar en el encuentro N.º 3, 4")).toBeInTheDocument();
  });

  it("muestra el error de la API tal cual", async () => {
    const user = userEvent.setup();
    respuestaAnotar = null;
    montar();
    await esperarFilas(2);
    await user.click(screen.getByRole("button", { name: "Anotar en los encuentros" }));
    expect(await screen.findByText("La clienta no compró esta capacitación")).toBeInTheDocument();
  });
});
