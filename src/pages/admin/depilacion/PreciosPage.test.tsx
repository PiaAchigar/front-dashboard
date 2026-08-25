import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ToastProvider } from "../../../components/ui/Toast";
import { PreciosPage } from "./PreciosPage";
import type { DepilationConfig } from "../../../lib/depilation-pricing";

// Mutable para poder probar con distintos roles sin re-declarar el mock por test.
let mockRole = "admin";

vi.mock("../../../auth/AuthContext", () => ({
  useAuth: () => ({
    role: mockRole,
    session: { access_token: "test-token" },
    user: null,
    loading: false,
    signOut: vi.fn(),
  }),
}));

// Mismos valores que src/lib/depilation-pricing.test.ts, así los totales
// esperados de los combos de ejemplo son los que ya están probados ahí.
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

function mockFetchOk() {
  return vi.fn(async () => ({ ok: true, json: async () => CONFIG }));
}

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetchOk());
});

afterEach(() => {
  mockRole = "admin";
});

describe("PreciosPage", () => {
  it("renderiza los cuatro combos de ejemplo con los totales actuales", async () => {
    render(<PreciosPage />, { wrapper });
    // Cavado + Axila = 12.000 + 5*1.200 = 18.000
    expect(await screen.findByTestId("preview-cavado-axila")).toHaveTextContent("$18.000");
    // Pierna + Cavado + Rostro = 19.000 + 10*1.200 + 5*1.000 = 36.000
    expect(screen.getByTestId("preview-pierna-cavado-rostro")).toHaveTextContent("$36.000");
    // Pierna + Axila + Cavado + Tira + Bozo = 19.000 + 5*1.200 + 3×5*1.000 = 40.000
    expect(screen.getByTestId("preview-pierna-axila-cavado-tira-bozo")).toHaveTextContent(
      "$40.000",
    );
    // Cuerpo Full: pack fijo, precio propio, no sale de la fórmula.
    expect(screen.getByTestId("preview-cuerpo-full")).toHaveTextContent("$65.000");
  });

  it("recalcula los ejemplos al cambiar la tarifa del escalón 1, sin guardar", async () => {
    const user = userEvent.setup();
    render(<PreciosPage />, { wrapper });
    expect(await screen.findByTestId("preview-cavado-axila")).toHaveTextContent("$18.000");

    const fetchMock = vi.mocked(fetch);
    const callsAntes = fetchMock.mock.calls.length;

    await user.clear(screen.getByLabelText(/escalón 1/i));
    await user.type(screen.getByLabelText(/escalón 1/i), "1300");

    // la segunda zona (chica, 5 min) pasa de $6.000 a $6.500
    expect(screen.getByTestId("preview-cavado-axila")).toHaveTextContent("$18.500");
    // Cuerpo Full es precio fijo: no se mueve con el escalón 1.
    expect(screen.getByTestId("preview-cuerpo-full")).toHaveTextContent("$65.000");
    // Nada se mandó a la red todavía: la vista previa es puramente local.
    expect(fetchMock.mock.calls.length).toBe(callsAntes);
  });

  it("Guardar manda los 19 campos en forma plana al PUT /config", async () => {
    const user = userEvent.setup();
    render(<PreciosPage />, { wrapper });
    await screen.findByTestId("preview-cavado-axila");

    await user.clear(screen.getByLabelText(/escalón 1/i));
    await user.type(screen.getByLabelText(/escalón 1/i), "1300");
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    const fetchMock = vi.mocked(fetch);
    const putCall = fetchMock.mock.calls.find(([, opts]) => (opts as RequestInit)?.method === "PUT");
    expect(putCall).toBeDefined();
    const body = JSON.parse((putCall![1] as RequestInit).body as string);
    expect(body).toMatchObject({
      priceGrande: 19000,
      priceMediana: 17000,
      priceChica: 12000,
      pricingMinutesGrande: 10,
      pricingMinutesMediana: 7,
      pricingMinutesChica: 5,
      tier1RatePerMinute: 1300,
      tier2RatePerMinute: 1000,
      slotMinutesFemaleGrande: 9,
      slotMinutesFemaleMediana: 6,
      slotMinutesFemaleChica: 3,
      slotMinutesMaleGrande: 10,
      slotMinutesMaleMediana: 8,
      slotMinutesMaleChica: 5,
      slotRoundingStep: 5,
      slotMinimumMinutes: 10,
      packSessions: 3,
      packDiscountPercentage: 15,
      packRoundingBase: 1000,
    });
  });

  it("muestra el mensaje de error del backend tal cual, sin reemplazarlo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, options?: RequestInit) => {
        if (options?.method === "PUT") {
          return {
            ok: false,
            status: 400,
            json: async () => ({ error: "La tarifa del primer escalón tiene que ser mayor a cero" }),
          };
        }
        return { ok: true, json: async () => CONFIG };
      }),
    );
    const user = userEvent.setup();
    render(<PreciosPage />, { wrapper });
    await screen.findByTestId("preview-cavado-axila");

    await user.click(screen.getByRole("button", { name: /guardar/i }));

    expect(
      await screen.findByText("La tarifa del primer escalón tiene que ser mayor a cero"),
    ).toBeInTheDocument();
  });

  it("un rol sin permiso de manage no ve el botón Guardar", async () => {
    mockRole = "operator";
    render(<PreciosPage />, { wrapper });
    await screen.findByTestId("preview-cavado-axila");
    expect(screen.queryByRole("button", { name: /guardar/i })).not.toBeInTheDocument();
  });

  it("muestra el cartel de advertencia sobre el impacto en todos los combos", async () => {
    render(<PreciosPage />, { wrapper });
    await screen.findByTestId("preview-cavado-axila");
    expect(screen.getByText(/afectan a todos los combos/i)).toBeInTheDocument();
  });
});
