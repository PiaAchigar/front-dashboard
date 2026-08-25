import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ToastProvider } from "../../../components/ui/Toast";
import { CombosDepilacionPage } from "./CombosDepilacionPage";
import type { ComboDepilacion } from "../../../lib/api-types";
import type { DepilationConfig } from "../../../lib/depilation-pricing";
import type { ZonasPorCategoria } from "../../../lib/api-types";

vi.mock("../../../auth/AuthContext", () => ({
  useAuth: () => ({
    role: "admin",
    session: { access_token: "test-token" },
    user: null,
    loading: false,
    signOut: vi.fn(),
  }),
}));

const CONFIG: DepilationConfig = {
  precioLista: { grande: 19000, mediana: 17000, chica: 12000 },
  minutosPrecio: { grande: 10, mediana: 7, chica: 5 },
  tarifaEscalon1: 1200,
  tarifaEscalon2: 1000,
  minutosTurno: {
    mujer: { grande: 9, mediana: 6, chica: 3 },
    hombre: { grande: 10, mediana: 8, chica: 5 },
  },
  redondeoTurno: 5,
  turnoMinimo: 10,
  packSesiones: 3,
  packDescuentoPct: 15,
  packRedondeo: 1000,
};

// Pierna entera (z1) sigue activa; Rostro completo (z3) fue archivada pero
// sigue siendo parte del combo guardado más abajo — es el caso que rompía el
// editor.
const ZONAS: ZonasPorCategoria = {
  grande: [
    { id: "z1", name: "Pierna entera", category: "grande", displayOrder: 1, isActive: true, exclusions: [] },
    { id: "z3", name: "Rostro completo", category: "grande", displayOrder: 2, isActive: false, exclusions: [] },
  ],
  mediana: [],
  chica: [
    { id: "z2", name: "Cavado", category: "chica", displayOrder: 1, isActive: true, exclusions: [] },
  ],
};

const COMBO_ARCHIVADA: ComboDepilacion = {
  id: "combo-1",
  name: "Combo con zona archivada",
  description: "desc",
  kind: "guardado",
  fixedPrice: null,
  fixedDurationMinutes: null,
  choiceZoneCount: 0,
  isPublishedWeb: false,
  displayOrder: 0,
  isActive: true,
  zonas: [
    { id: "z1", name: "Pierna entera", category: "grande" },
    { id: "z3", name: "Rostro completo", category: "grande" },
  ],
  precioCalculado: 31000, // 19.000 (lista) + 12.000 (escalón 1: 10 × 1.200)
  precioFinal: 31000,
  duracionMinutos: 20,
};

// Dos packs fijos sobre la misma zona (Cavado, $12.000 de fórmula): uno
// vendido por encima de la fórmula (debe advertir) y otro por debajo (no
// debe advertir) — así el test no puede pasar con una advertencia que
// siempre se muestra o que nunca se muestra.
const PACK_EXCEDE: ComboDepilacion = {
  id: "pack-1",
  name: "Pack con precio alto",
  description: null,
  kind: "pack_fijo",
  fixedPrice: 15000,
  fixedDurationMinutes: null,
  choiceZoneCount: 0,
  isPublishedWeb: true,
  displayOrder: 1,
  isActive: true,
  zonas: [{ id: "z2", name: "Cavado", category: "chica" }],
  precioCalculado: 12000,
  precioFinal: 15000,
  duracionMinutos: 10,
};

const PACK_OK: ComboDepilacion = {
  id: "pack-2",
  name: "Pack con precio normal",
  description: null,
  kind: "pack_fijo",
  fixedPrice: 10000,
  fixedDurationMinutes: null,
  choiceZoneCount: 0,
  isPublishedWeb: true,
  displayOrder: 2,
  isActive: true,
  zonas: [{ id: "z2", name: "Cavado", category: "chica" }],
  precioCalculado: 12000,
  precioFinal: 10000,
  duracionMinutos: 10,
};

const COMBOS: ComboDepilacion[] = [COMBO_ARCHIVADA, PACK_EXCEDE, PACK_OK];

let patchCalls: { url: string; body: Record<string, unknown> }[] = [];

function makeFetchMock() {
  return vi.fn(async (url: RequestInfo | URL, options?: RequestInit) => {
    const u = String(url);
    const method = (options?.method ?? "GET").toUpperCase();

    if (u.includes("/depilacion/zonas")) {
      return { ok: true, json: async () => ZONAS };
    }
    if (u.includes("/depilacion/config")) {
      return { ok: true, json: async () => CONFIG };
    }
    if (method === "PATCH" && u.includes("/depilacion/combos/") && !u.endsWith("/estado")) {
      patchCalls.push({ url: u, body: JSON.parse(String(options?.body)) });
      return {
        ok: true,
        json: async () => ({
          ...COMBO_ARCHIVADA,
          zonas: [{ id: "z1", name: "Pierna entera", category: "grande" }],
        }),
      };
    }
    if (method === "PATCH" && u.endsWith("/estado")) {
      return { ok: true, json: async () => COMBO_ARCHIVADA };
    }
    if (u.includes("/depilacion/combos")) {
      return { ok: true, json: async () => COMBOS };
    }
    return { ok: true, json: async () => ({}) };
  });
}

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={qc}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  patchCalls = [];
  vi.stubGlobal("fetch", makeFetchMock());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CombosDepilacionPage", () => {
  it("lista los combos con su precio ya calculado", async () => {
    render(<CombosDepilacionPage />, { wrapper });
    expect(await screen.findByText("Combo con zona archivada")).toBeInTheDocument();
    expect(screen.getByText("Pack con precio alto")).toBeInTheDocument();
  });

  it("advierte cuando un pack fijo cuesta más que su fórmula, y no cuando no", async () => {
    render(<CombosDepilacionPage />, { wrapper });

    const filaConAdvertencia = (await screen.findByText("Pack con precio alto")).closest("tr");
    expect(filaConAdvertencia).not.toBeNull();
    expect(
      within(filaConAdvertencia as HTMLElement).getByText(/dejó de ser un descuento/i),
    ).toBeInTheDocument();

    const filaSinAdvertencia = screen.getByText("Pack con precio normal").closest("tr");
    expect(filaSinAdvertencia).not.toBeNull();
    expect(
      within(filaSinAdvertencia as HTMLElement).queryByText(/dejó de ser un descuento/i),
    ).not.toBeInTheDocument();
  });

  it("al editar un combo con una zona archivada: la identifica por nombre, deja sacarla y guarda bien", async () => {
    const user = userEvent.setup();
    render(<CombosDepilacionPage />, { wrapper });

    await screen.findByText("Combo con zona archivada");
    await user.click(screen.getByTitle("Editar"));

    // La zona archivada aparece identificada por su nombre, no por uuid, y
    // con el motivo de por qué hay que sacarla.
    expect(await screen.findByLabelText("Rostro completo (archivada)")).toBeInTheDocument();
    expect(screen.getByText(/ya no está activa en el catálogo/i)).toBeInTheDocument();

    // Mientras siga tildada no se deja guardar (mejor bloquear acá que dejar
    // que el backend rechace el PATCH con un uuid que nadie puede ubicar).
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();

    // La saca: el checkbox desaparece (no hay forma de volver a tildarla).
    await user.click(screen.getByLabelText("Rostro completo (archivada)"));
    expect(screen.queryByLabelText("Rostro completo (archivada)")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar" })).not.toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(patchCalls).toHaveLength(1));
    expect(patchCalls[0]!.url).toContain("/depilacion/combos/combo-1");
    // La zona archivada no viaja en el PATCH — solo la que quedó tildada.
    expect(patchCalls[0]!.body.zonaIds).toEqual(["z1"]);
  });
});
