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
const PACK_FACIAL = "pppppppp-cccc-cccc-cccc-cccccccccccc";

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

// Un pack que REPITE el Combo Facial: `lines` vacío, sus servicios salen del
// combo original. Es la forma más común de pack, y la que el formulario no
// sabía abrir.
const PACK = {
  ...COMBO,
  id: PACK_FACIAL,
  name: "Pack Facial x4",
  kind: "pack" as const,
  packOfComboId: COMBO_FACIAL,
  packSessions: 4,
  lines: [],
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
      if (u.includes("kind=pack")) return { ok: true, json: async () => [PACK] };
      if (u.includes("kind=combo")) return { ok: true, json: async () => [COMBO] };
      return { ok: true, json: async () => [] };
    }
    if (u.includes("/api/agenda/depilacion/combos")) {
      return {
        ok: true,
        json: async () => [{ id: "dddddddd-1111-1111-1111-111111111111", name: "Piernas completas" }],
      };
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

  it("un pack que repite un combo abre los servicios del combo original", async () => {
    // Un pack con packOfComboId no tiene renglones propios. Antes el
    // formulario miraba `pack.lines`, no encontraba nada, y mostraba "Elegí
    // algo en oferta y acá van a aparecer sus servicios" con el pack ya
    // tildado — sin forma de cargarle un pago acordado.
    render(<PromosAdminPage />, { wrapper });
    await userEvent.click(await screen.findByRole("button", { name: /agregar/i }));
    await userEvent.click(await screen.findByLabelText(/pack facial x4/i));
    expect(await screen.findByText(/baby botox/i)).toBeInTheDocument();
    expect(screen.getByText(/de Pack Facial x4/i)).toBeInTheDocument();
  });

  it("un combo de depilación dice por qué no abre servicios", async () => {
    // Son zonas, no servicios con proveedora: no hay desglose posible. Sin
    // decirlo, Laura tilda el combo y espera filas que no van a aparecer.
    render(<PromosAdminPage />, { wrapper });
    await userEvent.click(await screen.findByRole("button", { name: /agregar/i }));
    await userEvent.click(await screen.findByLabelText(/piernas completas/i));
    expect(await screen.findByText(/no abren servicios acá/i)).toBeInTheDocument();
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

  it("destildar un combo no manda el pago que había quedado cargado para su servicio", async () => {
    // Fix round 1: Laura tilda el Combo Facial, carga proveedora y monto
    // para Baby Botox, y se arrepiente — destilda el combo. La fila
    // desaparece de la pantalla; el pago tiene que desaparecer también del
    // guardado, no quedar huérfano viajando igual.
    const enviados: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", makeFetchMock({ enviados }));
    const user = userEvent.setup();
    render(<PromosAdminPage />, { wrapper });

    await user.click(await screen.findByRole("button", { name: /agregar/i }));
    await user.type(screen.getByLabelText(/nombre/i), "Promo Facial");
    await user.click(await screen.findByLabelText(/combo facial/i));

    await screen.findByText(/baby botox/i);
    await user.selectOptions(screen.getByLabelText(/^proveedora$/i), "prov1");
    await user.type(screen.getByLabelText(/se le paga/i), "5000");

    // Se arrepiente: destilda el combo y tilda otra cosa para poder guardar.
    await user.click(screen.getByLabelText(/combo facial/i));
    await user.click(await screen.findByLabelText(/servicio sin proveedora/i));
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(enviados.length).toBeGreaterThan(0));
    const cuerpo = enviados.at(-1)!;
    expect(cuerpo.destinos).toEqual([{ tipo: "servicio", id: SIN_PROVEEDORA }]);
    // Ni rastro del pago de Baby Botox: su destino ya no está en oferta.
    expect(cuerpo.pagos).toEqual([]);
  });
});
