import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ToastProvider } from "../../components/ui/Toast";
import { PromosAdminPage } from "./PromosAdminPage";

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({
    role: "admin",
    session: { access_token: "test-token" },
    user: null,
    loading: false,
    signOut: vi.fn(),
  }),
}));

const BABY_BOTOX = "33333333-3333-3333-3333-333333333333";
const SIN_PROVEEDORA = "44444444-4444-4444-4444-444444444444";
const COMBO_FACIAL = "cccccccc-cccc-cccc-cccc-cccccccccccc";

// El servicio del combo (Baby Botox) no aparece en /services: sólo se conoce
// por la línea del combo, que es justo lo que la pantalla tiene que usar.
const SERVICIOS = [
  {
    id: SIN_PROVEEDORA,
    name: "Servicio sin proveedora",
    unitPriceList: 10000,
    estimatedDurationMinutes: 30,
    isActive: true,
    categories: [],
  },
];

const COMBO = {
  id: COMBO_FACIAL,
  name: "Combo Facial",
  description: null,
  priceType: "percentage",
  fixedPrice: null,
  discountPercentage: 10,
  validityMonths: 6,
  isActive: true,
  isVisibleWeb: true,
  displayOrder: 0,
  servicesSubtotal: 35000,
  finalAmount: 31500,
  hasInactiveService: false,
  areaCategoryId: "aaaaaaaa-1111-1111-1111-111111111111",
  kind: "combo" as const,
  packOfComboId: null,
  packSessions: null,
  packDiscountPercentage: null,
  packRoundingBase: null,
  servicesTogether: true,
  lines: [
    {
      id: "l1",
      serviceId: BABY_BOTOX,
      serviceName: "Baby Botox",
      serviceIsActive: true,
      sessionsIncluded: 1,
      servicePrice: 90000,
    },
  ],
};

type Opciones = { enviados?: Record<string, unknown>[] };

function makeFetchMock(op: Opciones = {}) {
  return vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/api/agenda/promotions/admin")) {
      if (init?.method === "POST" || init?.method === "PATCH") {
        op.enviados?.push(JSON.parse(String(init?.body ?? "{}")));
        return { ok: true, json: async () => ({}) };
      }
      return { ok: true, json: async () => [] };
    }
    if (u.includes("/api/agenda/combos/admin")) {
      if (u.includes("kind=pack")) return { ok: true, json: async () => [] };
      if (u.includes("kind=combo")) return { ok: true, json: async () => [COMBO] };
      return { ok: true, json: async () => [] };
    }
    if (u.includes("/api/agenda/depilacion/combos")) {
      return { ok: true, json: async () => [] };
    }
    if (u.includes("/api/agenda/providers?serviceId=")) {
      // Único servicio SIN proveedora: el resto (p. ej. Baby Botox) sí tiene.
      const sinProveedora = u.includes(SIN_PROVEEDORA);
      return {
        ok: true,
        json: async () => (sinProveedora ? [] : [{ id: "prov1", fullName: "Ana", specialties: null }]),
      };
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

describe("PromosAdminPage — qué está en oferta", () => {
  it("muestra los tres bloques", async () => {
    render(<PromosAdminPage />, { wrapper });
    await userEvent.click(await screen.findByRole("button", { name: /agregar/i }));
    expect(screen.getByText(/servicios en oferta/i)).toBeInTheDocument();
    expect(screen.getByText(/combos en oferta/i)).toBeInTheDocument();
    expect(screen.getByText(/packs en oferta/i)).toBeInTheDocument();
  });

  it("al poner un combo en oferta, abre sus servicios para el pago", async () => {
    // Pedido de Pia: Laura tiene que ver qué servicios trae el combo, porque
    // son los que después va a tener que agendar.
    render(<PromosAdminPage />, { wrapper });
    await userEvent.click(await screen.findByRole("button", { name: /agregar/i }));
    await userEvent.click(await screen.findByLabelText(/combo facial/i));
    expect(await screen.findByText(/baby botox/i)).toBeInTheDocument();
  });

  it("avisa cuando un servicio en oferta no tiene proveedora", async () => {
    // Laura estaría poniendo en oferta algo que después nadie puede atender:
    // la clienta pagaría por un turno que no existe.
    render(<PromosAdminPage />, { wrapper });
    await userEvent.click(await screen.findByRole("button", { name: /agregar/i }));
    await userEvent.click(await screen.findByLabelText(/servicio sin proveedora/i));
    expect(await screen.findByText(/no tiene proveedora/i)).toBeInTheDocument();
  });

  it("no deja guardar una promo sin nada en oferta", async () => {
    render(<PromosAdminPage />, { wrapper });
    await userEvent.click(await screen.findByRole("button", { name: /agregar/i }));
    await userEvent.type(screen.getByLabelText(/nombre/i), "Promo vacía");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));
    expect(await screen.findByText(/al menos un servicio, combo o pack/i)).toBeInTheDocument();
  });

  it("manda destinos y pagos al guardar", async () => {
    const enviados: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", makeFetchMock({ enviados }));
    render(<PromosAdminPage />, { wrapper });

    await userEvent.click(await screen.findByRole("button", { name: /agregar/i }));
    await userEvent.type(screen.getByLabelText(/nombre/i), "Promo Facial");
    await userEvent.click(await screen.findByLabelText(/servicio sin proveedora/i));
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(enviados.length).toBeGreaterThan(0));
    const cuerpo = enviados.at(-1)!;
    expect(cuerpo.destinos).toEqual([{ tipo: "servicio", id: SIN_PROVEEDORA }]);
    expect(cuerpo.pagos).toEqual([]);
    expect(cuerpo.isVisibleWeb).toBe(false);
  });
});
