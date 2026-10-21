import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EncuentrosPage } from "./EncuentrosPage";
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
const PRESTADORA = { id: "p1", fullName: "ZZ Laura", isActive: true };

function encuentro(id: string, n: number, fecha: string, extra = {}) {
  return {
    id,
    trainingId: "c1",
    sessionNumber: n,
    sessionDate: fecha,
    startTime: "10:00:00",
    endTime: "12:00:00",
    serviceProviderId: null,
    providerName: null,
    location: null,
    capacity: null,
    isActive: true,
    anotadas: 0,
    ...extra,
  };
}

let encuentros: Record<string, unknown[]> = {};
let llamadas: { url: string; method: string; body?: any }[] = [];
let respuestaError: { status: number; error: string } | null = null;

function ok(data: unknown, status = 200) {
  return { ok: true, status, json: async () => data };
}

beforeEach(() => {
  llamadas = [];
  respuestaError = null;
  encuentros = {
    c1: [
      encuentro("e2", 2, "2026-11-12", { anotadas: 3, capacity: 5, providerName: "ZZ Laura", serviceProviderId: "p1", location: "Sala 2" }),
      encuentro("e1", 1, "2026-11-05", { anotadas: 7 }),
      encuentro("e3", 3, "2026-11-19", { isActive: false }),
    ],
    c2: [],
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      llamadas.push({ url, method, body: init?.body ? JSON.parse(init.body as string) : undefined });
      if (method !== "GET" && respuestaError) {
        return { ok: false, status: respuestaError.status, json: async () => ({ error: respuestaError!.error }) };
      }
      if (url.includes("/api/agenda/trainings/admin")) return ok([CAP_A, CAP_B]);
      if (url.includes("/api/agenda/providers/all")) return ok([PRESTADORA]);
      const m = url.match(/\/api\/agenda\/trainings\/(\w+)\/sessions(\?|$)/);
      if (m && method === "GET") return ok(encuentros[m[1]] ?? []);
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
        <MemoryRouter initialEntries={["/admin/capacitaciones/encuentros"]}>
          <Routes>
            <Route
              path="/admin/capacitaciones"
              element={<GrupalLayout titulo="Capacitaciones" bajada="b" solapas={solapasDeCapacitaciones()} />}
            >
              <Route path="encuentros" element={<EncuentrosPage />} />
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

/** Ni el botón ni sus ancestros están apagados con `opacity-60` entero. */
function apagado(el: HTMLElement) {
  for (let n: HTMLElement | null = el; n; n = n.parentElement) {
    if (n.classList.contains("opacity-60")) return true;
  }
  return false;
}

describe("EncuentrosPage", () => {
  it("muestra la tabla con Anotadas, fecha dd/mm/aaaa con día y cupo de la capacitación", async () => {
    montar();
    await esperarFilas(3);
    expect(screen.getByRole("columnheader", { name: "Anotadas" })).toBeInTheDocument();
    const filas = screen.getAllByRole("row").slice(1);
    // Ordenados por N.º
    expect(within(filas[0]).getAllByRole("cell")[0].textContent).toBe("1");
    expect(within(filas[0]).getByText(/05\/11\/2026/)).toBeInTheDocument();
    expect(within(filas[0]).getByText(/jueves/i)).toBeInTheDocument();
    expect(within(filas[0]).getByText("El de la capacitación (10)")).toBeInTheDocument();
    expect(within(filas[0]).getByText("7")).toBeInTheDocument();
    expect(within(filas[1]).getByText("ZZ Laura")).toBeInTheDocument();
    expect(within(filas[1]).getByText("Sala 2")).toBeInTheDocument();
    expect(within(filas[1]).getByText("3")).toBeInTheDocument();
    // Pidió también los de baja
    expect(llamadas.some((l) => l.url.includes("/api/agenda/trainings/c1/sessions?incluirInactivos=true"))).toBe(true);
  });

  it("con encuentros (aunque uno esté de baja) no ofrece Generar encuentros", async () => {
    montar();
    await esperarFilas(3);
    expect(screen.queryByRole("button", { name: "Generar encuentros" })).toBeNull();
  });

  it("si todos están de baja tampoco ofrece Generar y muestra Reactivar", async () => {
    encuentros.c1 = [encuentro("e3", 3, "2026-11-19", { isActive: false })];
    montar();
    await esperarFilas(1);
    expect(screen.queryByRole("button", { name: "Generar encuentros" })).toBeNull();
    expect(screen.getByRole("button", { name: "Reactivar" })).toBeInTheDocument();
  });

  it("Reactivar no queda apagado con la fila de baja y se ve como acción de la marca", async () => {
    encuentros.c1 = [encuentro("e3", 3, "2026-11-19", { isActive: false })];
    montar();
    await esperarFilas(1);
    const boton = screen.getByRole("button", { name: "Reactivar" });
    expect(apagado(boton)).toBe(false);
    expect(boton.className).toMatch(/\btext-primary-dark\b/);
    expect(boton.className).toMatch(/\bhover:bg-primary-dark\b/);
  });

  it("Dar de baja manda isActive false al PATCH", async () => {
    const user = userEvent.setup();
    montar();
    await esperarFilas(3);
    await user.click(screen.getAllByRole("button", { name: "Dar de baja" })[0]);
    await waitFor(() => expect(llamadas.some((l) => l.method === "PATCH")).toBe(true));
    const p = llamadas.find((l) => l.method === "PATCH")!;
    expect(p.url).toContain("/api/agenda/trainings/sessions/e1");
    expect(p.body).toEqual({ isActive: false });
  });

  it("sin encuentros ofrece Generar y manda el body con la cantidad precargada", async () => {
    const user = userEvent.setup();
    montar();
    await esperarFilas(3);
    await user.selectOptions(screen.getByLabelText("Capacitación"), "c2");
    await user.click(await screen.findByRole("button", { name: "Generar encuentros" }));
    expect(screen.getByLabelText("Cantidad")).toHaveValue(2);
    await user.type(screen.getByLabelText("Desde (fecha)"), "2026-11-03");
    await user.selectOptions(screen.getByLabelText("Día de la semana"), "2");
    await user.type(screen.getByLabelText("Desde"), "10:00");
    await user.type(screen.getByLabelText("Hasta"), "12:00");
    await user.selectOptions(screen.getByLabelText("Prestadora"), "p1");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(llamadas.some((l) => l.method === "POST")).toBe(true));
    const post = llamadas.find((l) => l.method === "POST")!;
    expect(post.url).toContain("/api/agenda/trainings/c2/sessions/generar");
    expect(post.body).toEqual({
      desde: "2026-11-03",
      diaDeLaSemana: 2,
      startTime: "10:00:00",
      endTime: "12:00:00",
      serviceProviderId: "p1",
      cantidad: 2,
    });
  });

  it("un 409 de la API se muestra tal cual", async () => {
    const user = userEvent.setup();
    montar();
    await esperarFilas(3);
    respuestaError = { status: 409, error: "Ya hay un encuentro N.º 5 en esta capacitación" };
    await user.click(await screen.findByRole("button", { name: "Agregar encuentro" }));
    await user.clear(screen.getByLabelText("N.º"));
    await user.type(screen.getByLabelText("N.º"), "5");
    await user.type(screen.getByLabelText("Fecha"), "2026-12-01");
    await user.type(screen.getByLabelText("Desde"), "10:00");
    await user.type(screen.getByLabelText("Hasta"), "12:00");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("Ya hay un encuentro N.º 5 en esta capacitación")).toBeInTheDocument();
  });

  it("el alta manda el cupo vacío como null", async () => {
    const user = userEvent.setup();
    montar();
    await esperarFilas(3);
    await user.click(await screen.findByRole("button", { name: "Agregar encuentro" }));
    await user.clear(screen.getByLabelText("N.º"));
    await user.type(screen.getByLabelText("N.º"), "4");
    await user.type(screen.getByLabelText("Fecha"), "2026-12-01");
    await user.type(screen.getByLabelText("Desde"), "10:00");
    await user.type(screen.getByLabelText("Hasta"), "12:00");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(llamadas.some((l) => l.method === "POST")).toBe(true));
    const post = llamadas.find((l) => l.method === "POST")!;
    expect(post.url).toMatch(/\/api\/agenda\/trainings\/c1\/sessions$/);
    expect(post.body).toMatchObject({
      sessionNumber: 4,
      sessionDate: "2026-12-01",
      startTime: "10:00:00",
      endTime: "12:00:00",
      capacity: null,
    });
  });
});
