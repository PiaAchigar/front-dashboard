import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { DestacadosWebPage } from "./DestacadosWebPage";

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({
    role: "admin",
    session: { access_token: "test-token" },
    user: null,
    loading: false,
    signOut: vi.fn(),
  }),
}));

// La Task 9 hizo que el endpoint público /api/agenda/promotions filtre por
// `is_visible_web`. Esta pantalla es donde Laura decide ese tilde: tiene que
// pegarle al endpoint de admin, que devuelve TODO (publicado o no).
const PROMOS_ADMIN = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Promo sin publicar",
    description: null,
    promotionType: "percentage",
    discountPercentage: 10,
    discountAmount: null,
    validFrom: null,
    validUntil: null,
    status: "active",
    isFeatured: false,
    isVisibleWeb: false,
    usageLimit: null,
    notes: null,
    destinos: [
      { filaId: "d1", tipo: "servicio", id: "s1", nombre: "Servicio uno" },
      { filaId: "d2", tipo: "servicio", id: "s2", nombre: "Servicio dos" },
    ],
    pagos: [],
  },
  // Defensa contra el `undefined.length`/`undefined.map` que ya dejó una
  // pantalla en blanco antes: una promo sin destinos no debería romper nada.
  {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Promo vacía",
    description: null,
    promotionType: "percentage",
    discountPercentage: 10,
    discountAmount: null,
    validFrom: null,
    validUntil: null,
    status: "active",
    isFeatured: false,
    isVisibleWeb: true,
    usageLimit: null,
    notes: null,
    destinos: undefined,
    pagos: [],
  },
  // Vencida hace años. El endpoint de admin la devuelve (el ABM necesita
  // poder editarla); esta pantalla no tiene que ofrecerla para destacar.
  {
    id: "33333333-3333-3333-3333-333333333333",
    name: "Promo vencida",
    description: null,
    promotionType: "percentage",
    discountPercentage: 10,
    discountAmount: null,
    validFrom: "2020-01-01",
    validUntil: "2020-03-12",
    status: "active",
    isFeatured: false,
    isVisibleWeb: true,
    usageLimit: null,
    notes: null,
    destinos: [],
    pagos: [],
  },
];

function makeFetchMock() {
  return vi.fn(async (url: RequestInfo | URL) => {
    const u = String(url);
    if (u.includes("/api/agenda/promotions/admin")) {
      return { ok: true, json: async () => PROMOS_ADMIN };
    }
    if (u.includes("/api/agenda/services")) {
      return { ok: true, json: async () => [] };
    }
    if (u.includes("/api/agenda/trainings/admin")) {
      return { ok: true, json: async () => [] };
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
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", makeFetchMock());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DestacadosWebPage — promos", () => {
  it("muestra también las promos sin publicar", async () => {
    // Es la pantalla donde Laura decide qué publicar: si sólo lista lo ya
    // publicado, no puede publicar nada nuevo.
    render(<DestacadosWebPage />, { wrapper });
    expect(await screen.findByText(/promo sin publicar/i)).toBeInTheDocument();
  });

  it("dice cuántas cosas tiene en oferta cada promo", async () => {
    render(<DestacadosWebPage />, { wrapper });
    expect(await screen.findByText(/2 cosas en oferta/i)).toBeInTheDocument();
  });

  it("no ofrece para destacar una promo vencida", async () => {
    // Al pasar del endpoint público al de admin se perdió el filtro de
    // vigencia: "Promo del Mes" listaba promos vencidas —"hasta 12 de marzo"—
    // con su toggle listo para tildar algo que no va a aparecer en la home.
    render(<DestacadosWebPage />, { wrapper });
    await screen.findByText(/promo sin publicar/i);
    expect(screen.queryByText(/promo vencida/i)).not.toBeInTheDocument();
  });

  it("no rompe si una promo viene sin destinos", async () => {
    // Defensa contra el `undefined.map`/`undefined.length` que ya nos dejó
    // una pantalla en blanco.
    render(<DestacadosWebPage />, { wrapper });
    expect(await screen.findByText(/promo vacía/i)).toBeInTheDocument();
  });
});
