import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ToastProvider } from "../../components/ui/Toast";
import { PacksAdminPage } from "./PacksAdminPage";

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({
    role: "admin",
    session: { access_token: "test-token" },
    user: null,
    loading: false,
    signOut: vi.fn(),
  }),
}));

const AREA = "aaaaaaaa-1111-1111-1111-111111111111";
const LIMPIEZA = "11111111-1111-1111-1111-111111111111";
const COMBO_FACIAL = "cccccccc-cccc-cccc-cccc-cccccccccccc";

const AREAS = [{ id: AREA, name: "Estética" }];
const SERVICIOS = [
  { id: LIMPIEZA, name: "Limpieza facial", unitPriceList: 20000, isActive: true, categories: [] },
];
const TARIFARIOS = [
  {
    areaCategoryId: AREA,
    areaName: "Estética",
    packSessions: 3,
    packDiscountPercentage: 15,
    packRoundingBase: 1000,
  },
];

const base = {
  description: null,
  priceType: "percentage",
  fixedPrice: null,
  discountPercentage: 0,
  validityMonths: 6,
  isActive: true,
  isVisibleWeb: true,
  displayOrder: 0,
  hasInactiveService: false,
  areaCategoryId: AREA,
  servicesTogether: false,
  packRoundingBase: null,
};

const COMBO = {
  ...base,
  id: COMBO_FACIAL,
  name: "Facial Completo",
  kind: "combo" as const,
  packOfComboId: null,
  packSessions: null,
  packDiscountPercentage: null,
  servicesSubtotal: 35000,
  finalAmount: 30000,
  lines: [],
};

/** Un pack que repite ese combo 4 veces, con el descuento del área. */
const PACK = {
  ...base,
  id: "p1",
  name: "Facial × 4",
  kind: "pack" as const,
  packOfComboId: COMBO_FACIAL,
  packSessions: 4,
  packDiscountPercentage: null,
  servicesSubtotal: 0,
  finalAmount: 102000,
  packUnitAmount: 30000,
  packDiscountSource: "area" as const,
  packEffectiveDiscount: 15,
  lines: [],
};

type Opciones = { packs?: unknown[]; enviados?: Record<string, unknown>[] };

function makeFetchMock(op: Opciones = {}) {
  return vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/api/agenda/categories") && u.includes("kind=area")) {
      return { ok: true, json: async () => AREAS };
    }
    if (u.includes("/api/agenda/combos/admin/tarifarios")) {
      if (init?.method === "PUT") {
        op.enviados?.push({ url: u, ...JSON.parse(String(init?.body ?? "{}")) });
        return { ok: true, json: async () => ({}) };
      }
      return { ok: true, json: async () => TARIFARIOS };
    }
    if (u.includes("/api/agenda/combos/admin/duplicados")) {
      return { ok: true, json: async () => ({ duplicados: [] }) };
    }
    if (u.includes("/api/agenda/combos/admin")) {
      if (init?.method === "POST" || init?.method === "PATCH") {
        op.enviados?.push(JSON.parse(String(init?.body ?? "{}")));
        return { ok: true, json: async () => ({}) };
      }
      if (u.includes("kind=pack")) return { ok: true, json: async () => op.packs ?? [] };
      if (u.includes("kind=combo")) return { ok: true, json: async () => [COMBO] };
      return { ok: true, json: async () => [] };
    }
    if (u.includes("/api/agenda/services")) {
      return { ok: true, json: async () => SERVICIOS };
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
      <MemoryRouter>
        <ToastProvider>{children}</ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", makeFetchMock());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PacksAdminPage — el tarifario del área", () => {
  it("dice cuál es la política por defecto en criollo", async () => {
    render(<PacksAdminPage area="Estética" />, { wrapper });
    expect(await screen.findByText(/por defecto, un pack de esta área es de/i)).toBeInTheDocument();
    expect(screen.getByText("3 veces")).toBeInTheDocument();
    expect(screen.getByText("15%")).toBeInTheDocument();
  });

  it("avisa que cambiarlo no toca lo ya vendido", async () => {
    const user = userEvent.setup();
    render(<PacksAdminPage area="Estética" />, { wrapper });

    await user.click(await screen.findByRole("button", { name: /cambiar/i }));
    expect(
      screen.getByText(/descuento propio y todo lo ya vendido quedan como están/i),
    ).toBeInTheDocument();
  });

  it("guarda contra el área que corresponde", async () => {
    const enviados: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", makeFetchMock({ enviados }));
    const user = userEvent.setup();
    render(<PacksAdminPage area="Estética" />, { wrapper });

    await user.click(await screen.findByRole("button", { name: /cambiar/i }));
    await user.click(screen.getByRole("button", { name: /guardar tarifario/i }));

    await waitFor(() => expect(enviados.length).toBeGreaterThan(0));
    expect(String(enviados[0]!.url)).toContain(`/tarifarios/${AREA}`);
    expect(enviados[0]!.packDiscountPercentage).toBe(15);
  });
});

describe("PacksAdminPage — el listado", () => {
  it("muestra qué repite, cuántas veces y de dónde salió el descuento", async () => {
    vi.stubGlobal("fetch", makeFetchMock({ packs: [PACK] }));
    render(<PacksAdminPage area="Estética" />, { wrapper });

    expect(await screen.findByText("Facial × 4")).toBeInTheDocument();
    // El nombre del combo que repite, resuelto contra la lista de combos.
    expect(screen.getByText("Facial Completo")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("(del área)")).toBeInTheDocument();
  });
});

describe("PacksAdminPage — armar un pack", () => {
  it("arranca con las veces del tarifario, que es lo más común", async () => {
    const user = userEvent.setup();
    render(<PacksAdminPage area="Estética" />, { wrapper });

    await user.click(await screen.findByRole("button", { name: /^agregar$/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(/cuántas veces/i)).toHaveValue("3");
  });

  it("manda un pack de combo sin renglones propios", async () => {
    const enviados: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", makeFetchMock({ enviados }));
    const user = userEvent.setup();
    render(<PacksAdminPage area="Estética" />, { wrapper });

    await user.click(await screen.findByRole("button", { name: /^agregar$/i }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/nombre/i), "Facial × 4");
    await user.selectOptions(within(dialog).getByLabelText(/^combo/i), COMBO_FACIAL);
    await user.clear(within(dialog).getByLabelText(/cuántas veces/i));
    await user.type(within(dialog).getByLabelText(/cuántas veces/i), "4");
    await user.click(within(dialog).getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(enviados.length).toBeGreaterThan(0));
    const cuerpo = enviados.at(-1)!;
    expect(cuerpo.kind).toBe("pack");
    expect(cuerpo.packOfComboId).toBe(COMBO_FACIAL);
    expect(cuerpo.packSessions).toBe(4);
    // Un pack que repite un combo no lleva servicios propios.
    expect(cuerpo.lines).toEqual([]);
    // Sin descuento propio cargado, viaja NULL y manda el del área.
    expect(cuerpo.packDiscountPercentage).toBeNull();
  });

  it("un pack de un servicio suelto lleva ese servicio y ningún combo", async () => {
    const enviados: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", makeFetchMock({ enviados }));
    const user = userEvent.setup();
    render(<PacksAdminPage area="Estética" />, { wrapper });

    await user.click(await screen.findByRole("button", { name: /^agregar$/i }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/nombre/i), "Limpieza × 5");
    await user.selectOptions(within(dialog).getByLabelText(/^repite/i), "servicio");
    await user.selectOptions(within(dialog).getByLabelText(/^servicio/i), LIMPIEZA);
    await user.clear(within(dialog).getByLabelText(/cuántas veces/i));
    await user.type(within(dialog).getByLabelText(/cuántas veces/i), "5");
    await user.click(within(dialog).getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(enviados.length).toBeGreaterThan(0));
    const cuerpo = enviados.at(-1)!;
    expect(cuerpo.packOfComboId).toBeNull();
    expect(cuerpo.lines).toEqual([{ serviceId: LIMPIEZA }]);
  });

  it("al editar, qué repite y cuántas veces quedan bloqueados", async () => {
    vi.stubGlobal("fetch", makeFetchMock({ packs: [PACK] }));
    const user = userEvent.setup();
    render(<PacksAdminPage area="Estética" />, { wrapper });

    await screen.findByText("Facial × 4");
    await user.click(screen.getByRole("button", { name: /editar/i }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByLabelText(/^repite/i)).toBeDisabled();
    expect(within(dialog).getByLabelText(/^combo/i)).toBeDisabled();
    expect(within(dialog).getByLabelText(/cuántas veces/i)).toBeDisabled();
    // El descuento sí se edita: es lo único que cambia sin volverlo otro pack.
    expect(within(dialog).getByLabelText(/% propio/i)).not.toBeDisabled();
  });
});
