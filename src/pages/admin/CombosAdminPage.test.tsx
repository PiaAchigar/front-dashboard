import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ToastProvider } from "../../components/ui/Toast";
import { CombosAdminPage } from "./CombosAdminPage";

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({
    role: "admin",
    session: { access_token: "test-token" },
    user: null,
    loading: false,
    signOut: vi.fn(),
  }),
}));

const AREA_ESTETICA = "aaaaaaaa-1111-1111-1111-111111111111";
const LIMPIEZA = "11111111-1111-1111-1111-111111111111";
const PEELING = "22222222-2222-2222-2222-222222222222";

const AREAS = [
  { id: AREA_ESTETICA, name: "Estética" },
  { id: "aaaaaaaa-2222-2222-2222-222222222222", name: "Masajes y Bienestar" },
];

const SERVICIOS = [
  { id: LIMPIEZA, name: "Limpieza facial", unitPriceList: 20000, isActive: true, categories: [] },
  { id: PEELING, name: "Peeling", unitPriceList: 15000, isActive: true, categories: [] },
];

/** Un combo guardado, para probar la edición. */
const COMBO_GUARDADO = {
  id: "c1",
  name: "Facial Completo",
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
  areaCategoryId: AREA_ESTETICA,
  kind: "combo" as const,
  packOfComboId: null,
  packSessions: null,
  packDiscountPercentage: null,
  packRoundingBase: null,
  servicesTogether: true,
  lines: [
    { id: "l1", serviceId: LIMPIEZA, serviceName: "Limpieza facial", serviceIsActive: true, sessionsIncluded: 1, servicePrice: 20000 },
    { id: "l2", serviceId: PEELING, serviceName: "Peeling", serviceIsActive: true, sessionsIncluded: 1, servicePrice: 15000 },
  ],
};

type Opciones = {
  combos?: unknown[];
  duplicados?: { id: string; name: string }[];
  /** Se llena con los cuerpos de cada POST, para poder mirar qué se mandó. */
  enviados?: Record<string, unknown>[];
};

function makeFetchMock(op: Opciones = {}) {
  return vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/api/agenda/categories") && u.includes("kind=area")) {
      return { ok: true, json: async () => AREAS };
    }
    if (u.includes("/api/agenda/combos/admin/duplicados")) {
      op.enviados?.push(JSON.parse(String(init?.body ?? "{}")));
      return { ok: true, json: async () => ({ duplicados: op.duplicados ?? [] }) };
    }
    if (u.includes("/api/agenda/combos/admin")) {
      if (init?.method === "POST" || init?.method === "PATCH") {
        op.enviados?.push(JSON.parse(String(init?.body ?? "{}")));
        return { ok: true, json: async () => ({}) };
      }
      return { ok: true, json: async () => op.combos ?? [] };
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

/** Abre "Nuevo combo" y elige los dos servicios. */
async function armarComboDeDos(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: /agregar/i }));
  const dialog = await screen.findByRole("dialog");
  for (const _ of [0, 1]) {
    await user.click(within(dialog).getByRole("button", { name: /agregar servicio/i }));
  }
  const selects = within(dialog).getAllByRole("combobox");
  const deServicio = selects.filter((s) =>
    within(s).queryByRole("option", { name: /limpieza facial/i }),
  );
  await user.selectOptions(deServicio[0]!, LIMPIEZA);
  await user.selectOptions(deServicio[1]!, PEELING);
  return dialog;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CombosAdminPage", () => {
  it("avisa que los combos se arman con servicios ya cargados", async () => {
    render(<CombosAdminPage />, { wrapper });
    expect(await screen.findByText(/se arma con servicios y actividades que ya estén cargados/i))
      .toBeInTheDocument();
    expect(screen.getByRole("link", { name: /servicios/i })).toHaveAttribute("href", "/admin/servicios");
  });
});

// ── 1.50.0 ─────────────────────────────────────────────────────────────────

describe("CombosAdminPage — el área", () => {
  it("pide sólo los combos de su área, no los de todas", async () => {
    const fetchMock = makeFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    render(<CombosAdminPage area="Estética" />, { wrapper });

    await waitFor(() => {
      const pedidos = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(
        pedidos.some(
          (u) =>
            u.includes("/api/agenda/combos/admin") &&
            u.includes(`areaCategoryId=${AREA_ESTETICA}`) &&
            u.includes("kind=combo"),
        ),
      ).toBe(true);
    });
  });

  it("no pide combos hasta saber de qué área es: sin eso traería los de todas", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      // Las áreas nunca llegan, así que `idDeArea` no puede resolver.
      if (String(url).includes("/api/agenda/categories")) {
        return { ok: true, json: async () => [] };
      }
      return { ok: true, json: async () => [] };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<CombosAdminPage area="Estética" />, { wrapper });

    await screen.findByText(/se arma con servicios/i);
    const pedidos = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(pedidos.some((u) => u.includes("/api/agenda/combos/admin"))).toBe(false);
  });
});

describe("CombosAdminPage — se hacen juntos (§4.4)", () => {
  it("no ofrece el check con un solo servicio: no hay nada que juntar", async () => {
    const user = userEvent.setup();
    render(<CombosAdminPage area="Estética" />, { wrapper });

    await user.click(await screen.findByRole("button", { name: /agregar/i }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /agregar servicio/i }));

    expect(within(dialog).queryByLabelText(/se hacen juntos/i)).not.toBeInTheDocument();
  });

  it("con dos servicios lo ofrece, y viene DESMARCADO", async () => {
    const user = userEvent.setup();
    render(<CombosAdminPage area="Estética" />, { wrapper });
    const dialog = await armarComboDeDos(user);

    const check = within(dialog).getByRole("checkbox", { name: /se hacen juntos/i });
    expect(check).not.toBeChecked();
    // El default suelto es lo que pidió Pia: ante un descuido, la opción más
    // libre de agendar.
    expect(within(dialog).getByText(/cada servicio se agenda cuando la clienta quiera/i))
      .toBeInTheDocument();
  });

  it("al marcarlo explica que hay que agendarlos el mismo día", async () => {
    const user = userEvent.setup();
    render(<CombosAdminPage area="Estética" />, { wrapper });
    const dialog = await armarComboDeDos(user);

    await user.click(within(dialog).getByRole("checkbox", { name: /se hacen juntos/i }));
    expect(within(dialog).getByText(/el mismo día/i)).toBeInTheDocument();
    // Mismo día sí, pegados no: esa fue la decisión.
    expect(within(dialog).getByText(/no hace falta que sean seguidos/i)).toBeInTheDocument();
  });
});

describe("CombosAdminPage — el aviso de duplicados", () => {
  it("no guarda al primer intento y muestra cuál ya existe", async () => {
    const enviados: Record<string, unknown>[] = [];
    vi.stubGlobal(
      "fetch",
      makeFetchMock({ duplicados: [{ id: "c9", name: "Combo Facial" }], enviados }),
    );
    const user = userEvent.setup();
    render(<CombosAdminPage area="Estética" />, { wrapper });
    const dialog = await armarComboDeDos(user);

    await user.type(within(dialog).getByLabelText(/nombre/i), "Facial Completo");
    await user.type(within(dialog).getByLabelText(/porcentaje|precio del combo/i), "10");
    await user.click(within(dialog).getByRole("button", { name: /guardar/i }));

    expect(await screen.findByText(/ya existe un combo con estos mismos servicios/i))
      .toBeInTheDocument();
    expect(screen.getByText("Combo Facial")).toBeInTheDocument();
    // Se consultó, pero NO se creó.
    expect(enviados).toHaveLength(1);
  });

  it("al segundo intento lo crea igual: es un aviso, no un candado", async () => {
    const enviados: Record<string, unknown>[] = [];
    vi.stubGlobal(
      "fetch",
      makeFetchMock({ duplicados: [{ id: "c9", name: "Combo Facial" }], enviados }),
    );
    const user = userEvent.setup();
    render(<CombosAdminPage area="Estética" />, { wrapper });
    const dialog = await armarComboDeDos(user);

    await user.type(within(dialog).getByLabelText(/nombre/i), "Facial Completo");
    await user.type(within(dialog).getByLabelText(/porcentaje|precio del combo/i), "10");
    await user.click(within(dialog).getByRole("button", { name: /guardar/i }));
    await screen.findByText(/ya existe un combo/i);

    await user.click(within(dialog).getByRole("button", { name: /guardar/i }));
    await waitFor(() => expect(enviados).toHaveLength(2));
  });

  it("manda el área y una sesión por servicio, sin el campo viejo", async () => {
    const enviados: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", makeFetchMock({ enviados }));
    const user = userEvent.setup();
    render(<CombosAdminPage area="Estética" />, { wrapper });
    const dialog = await armarComboDeDos(user);

    await user.type(within(dialog).getByLabelText(/nombre/i), "Facial Completo");
    await user.type(within(dialog).getByLabelText(/porcentaje|precio del combo/i), "10");
    await user.click(within(dialog).getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(enviados.length).toBeGreaterThan(0));
    const cuerpo = enviados[0]!;
    expect(cuerpo.areaCategoryId).toBe(AREA_ESTETICA);
    expect(cuerpo.kind).toBe("combo");
    expect(cuerpo.lines).toEqual([{ serviceId: LIMPIEZA }, { serviceId: PEELING }]);
  });
});

describe("CombosAdminPage — la composición no se edita (§4.2)", () => {
  it("al editar, los servicios quedan bloqueados y lo explica", async () => {
    vi.stubGlobal("fetch", makeFetchMock({ combos: [COMBO_GUARDADO] }));
    const user = userEvent.setup();
    render(<CombosAdminPage area="Estética" />, { wrapper });

    await screen.findByText("Facial Completo");
    await user.click(screen.getByRole("button", { name: /editar/i }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByText(/los\s+servicios que lo forman no se cambian/i))
      .toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /agregar servicio/i }))
      .not.toBeInTheDocument();

    const selects = within(dialog).getAllByRole("combobox");
    const deServicio = selects.filter((s) =>
      within(s).queryByRole("option", { name: /limpieza facial/i }),
    );
    expect(deServicio.length).toBeGreaterThan(0);
    for (const sel of deServicio) expect(sel).toBeDisabled();
  });
});
