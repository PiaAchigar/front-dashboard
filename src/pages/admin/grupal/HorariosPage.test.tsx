import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HorariosPage } from "./HorariosPage";
import { GrupalLayout } from "./GrupalLayout";
import { ToastProvider } from "../../../components/ui/Toast";
import { solapasDeActividades } from "../../../lib/admin-nav";

vi.mock("../../../auth/AuthContext", () => ({
  useAuth: () => ({
    role: "admin",
    session: { access_token: "test-token" },
    user: null,
    loading: false,
    signOut: vi.fn(),
  }),
}));

const PILATES = { id: "a1", name: "ZZ Pilates", activityType: "class", isActive: true };
const CAMILLA = { id: "a2", name: "ZZ Camilla", activityType: "machine", isActive: true };
const VIEJA = { id: "a3", name: "ZZ Vieja", activityType: "class", isActive: false };

function horario(id: string, dayOfWeek: number, start: string, end: string, extra = {}) {
  return {
    id,
    activityId: "a1",
    machineId: null,
    dayOfWeek,
    startTime: start,
    endTime: end,
    validFrom: null,
    validUntil: null,
    capacity: null,
    isActive: true,
    ...extra,
  };
}

let horarios: Record<string, unknown[]> = {};
let llamadas: { url: string; method: string; body?: unknown }[] = [];

function ok(data: unknown) {
  return { ok: true, status: 200, json: async () => data };
}

beforeEach(() => {
  llamadas = [];
  horarios = {
    a1: [
      horario("h3", 3, "18:00:00", "19:00:00", { capacity: 8 }),
      horario("h1", 1, "19:00:00", "20:00:00"),
      horario("h2", 1, "09:00:00", "10:00:00"),
    ],
    a2: [horario("h4", 2, "10:00:00", "11:00:00", { activityId: "a2", machineId: "m1" })],
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      llamadas.push({ url, method, body: init?.body ? JSON.parse(init.body as string) : undefined });
      if (/\/api\/activities$/.test(url)) return ok({ success: true, data: [PILATES, CAMILLA, VIEJA] });
      const m = url.match(/\/api\/activities\/(\w+)\/schedules/);
      if (m && method === "GET") return ok({ success: true, data: horarios[m[1]] ?? [] });
      if (url.includes("/machines")) return ok([{ id: "m1", name: "ZZ Máquina 1" }]);
      return ok({ success: true, data: {} });
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <MemoryRouter initialEntries={["/admin/actividades/horarios"]}>
          <Routes>
            <Route
              path="/admin/actividades"
              element={<GrupalLayout titulo="Actividades" bajada="b" solapas={solapasDeActividades()} />}
            >
              <Route path="horarios" element={<HorariosPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

/** Espera a que lleguen los horarios de ZZ Pilates (encabezado + 3 filas). */
async function esperarFilas() {
  await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(4));
}

describe("HorariosPage", () => {
  it("lista los horarios de la actividad elegida ordenados por día y hora", async () => {
    montar();
    await esperarFilas();
    const filas = screen.getAllByRole("row").slice(1);
    expect(filas.map((f) => within(f).getAllByRole("cell")[0].textContent)).toEqual([
      "Lunes",
      "Lunes",
      "Miércoles",
    ]);
    expect(within(filas[0]).getByText("09:00")).toBeInTheDocument();
    expect(within(filas[1]).getByText("19:00")).toBeInTheDocument();
    expect(within(filas[1]).getByText("Sin límite")).toBeInTheDocument();
    expect(within(filas[2]).getByText("8")).toBeInTheDocument();
    // Pidió también los pausados, para poder reactivarlos.
    expect(llamadas.some((l) => l.url.includes("/api/activities/a1/schedules?includeInactive=true"))).toBe(true);
  });

  it("el selector sólo ofrece actividades activas", async () => {
    montar();
    await screen.findByRole("option", { name: "ZZ Pilates" });
    expect(screen.queryByRole("option", { name: "ZZ Vieja" })).toBeNull();
  });

  it("el alta manda día, horas con segundos y cupo", async () => {
    const user = userEvent.setup();
    montar();
    await esperarFilas();
    await user.click(await screen.findByRole("button", { name: "Agregar horario" }));
    await user.selectOptions(screen.getByLabelText("Día"), "5");
    await user.type(screen.getByLabelText("Desde"), "10:00");
    await user.type(screen.getByLabelText("Hasta"), "11:30");
    await user.type(screen.getByLabelText("Cupo"), "6");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(llamadas.some((l) => l.method === "POST")).toBe(true));
    const post = llamadas.find((l) => l.method === "POST")!;
    expect(post.url).toContain("/api/activities/a1/schedules");
    expect(post.body).toMatchObject({ dayOfWeek: 5, startTime: "10:00:00", endTime: "11:30:00", capacity: 6 });
  });

  it("con hasta menor o igual a desde avisa y no manda", async () => {
    const user = userEvent.setup();
    montar();
    await esperarFilas();
    await user.click(await screen.findByRole("button", { name: "Agregar horario" }));
    await user.type(screen.getByLabelText("Desde"), "10:00");
    await user.type(screen.getByLabelText("Hasta"), "10:00");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("La hora de fin tiene que ser posterior a la de inicio")).toBeInTheDocument();
    expect(llamadas.some((l) => l.method === "POST")).toBe(false);
  });

  it("Pausar manda isActive false al PATCH real", async () => {
    const user = userEvent.setup();
    montar();
    await esperarFilas();
    await user.click(screen.getAllByRole("button", { name: "Pausar" })[0]);
    await waitFor(() => expect(llamadas.some((l) => l.method === "PATCH")).toBe(true));
    const p = llamadas.find((l) => l.method === "PATCH")!;
    expect(p.url).toContain("/api/activities/schedules/h2");
    expect(p.body).toEqual({ isActive: false });
  });

  it("la columna Máquina aparece sólo en actividades de máquina", async () => {
    const user = userEvent.setup();
    montar();
    await esperarFilas();
    expect(screen.queryByRole("columnheader", { name: "Máquina" })).toBeNull();
    await user.selectOptions(screen.getByLabelText("Actividad"), "a2");
    expect(await screen.findByRole("columnheader", { name: "Máquina" })).toBeInTheDocument();
    expect(await screen.findByText("ZZ Máquina 1")).toBeInTheDocument();
  });
});
