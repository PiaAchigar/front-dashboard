import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ToastProvider } from "../../../components/ui/Toast";
import { PacksPage } from "./PacksPage";
import type { DepilationConfig } from "../../../lib/depilation-pricing";
import type { ComboDepilacion } from "../../../lib/api-types";

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

// Los 25 campos de la config, con los tres del pack en 3 / 15 / 1000 — los
// mismos valores que el brief de la Tarea 9 espera ver precargados en los
// inputs. Los otros 22 no se editan en esta pantalla, pero el PUT tiene que
// seguir mandándolos: por eso el fixture está completo, no truncado.
const CONFIG: DepilationConfig = {
  precioLista: {
    mujer: { grande: 19000, mediana: 17000, chica: 12000 },
    hombre: { grande: 23000, mediana: 21000, chica: 16000 },
  },
  minutosPrecio: {
    mujer: { grande: 10, mediana: 7, chica: 5 },
    hombre: { grande: 11, mediana: 9, chica: 6 },
  },
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

/** Un combo completo con defaults razonables, así cada test sólo declara lo
 *  que le importa. `packSessions`/`packDiscountPercentage` en `null` (el
 *  default) arma también `pack.propio: false` y `pack.sesiones`/`descuentoPct`
 *  iguales a los de `CONFIG` — igual que lo resolvería el backend de verdad. */
function crearCombo(overrides: Partial<ComboDepilacion> & { id: string; name: string }): ComboDepilacion {
  const packSessions = overrides.packSessions ?? null;
  const packDiscountPercentage = overrides.packDiscountPercentage ?? null;
  const packRoundingBase = overrides.packRoundingBase ?? null;
  const propio = packSessions != null;
  return {
    id: overrides.id,
    name: overrides.name,
    description: null,
    kind: "guardado",
    fixedPrice: null,
    fixedDurationMinutes: null,
    choiceZoneCount: 0,
    packSessions,
    packDiscountPercentage,
    packRoundingBase,
    isPublishedWeb: true,
    displayOrder: 1,
    isActive: true,
    zonas: [],
    precioCalculado: 0,
    precioFinal: 0,
    duracionMinutos: 0,
    pack: {
      sesiones: packSessions ?? CONFIG.packSesiones,
      descuentoPct: packDiscountPercentage ?? CONFIG.packDescuentoPct,
      redondeo: packRoundingBase ?? CONFIG.packRedondeo,
      propio,
      precio: 0,
      ahorro: 0,
    },
  };
}

const COMBOS: ComboDepilacion[] = [crearCombo({ id: "cuerpo-full", name: "Cuerpo Full" })];

// El body del último PUT /config, capturado por el mock de abajo.
let guardado: Record<string, unknown> | null = null;

/** Enruta por URL, igual que el mock de PreciosPage.test.tsx: `/combos`
 *  devuelve `combos`, todo lo demás es `/config` (GET la trae, PUT la
 *  captura en `guardado`). */
function mockFetchOk(combos: ComboDepilacion[] = COMBOS) {
  return vi.fn(async (url: string, options?: RequestInit) => {
    if (url.includes("/combos")) return { ok: true, json: async () => combos };
    if ((options?.method ?? "GET").toUpperCase() === "PUT") {
      guardado = JSON.parse(String(options?.body));
    }
    return { ok: true, json: async () => CONFIG };
  });
}

beforeEach(() => {
  guardado = null;
  vi.stubGlobal("fetch", mockFetchOk());
});

afterEach(() => {
  mockRole = "admin";
});

describe("PacksPage", () => {
  it("muestra los tres valores por defecto", async () => {
    render(<PacksPage />, { wrapper });
    expect(await screen.findByLabelText(/Sesiones/i)).toHaveValue("3");
    expect(screen.getByLabelText(/Descuento/i)).toHaveValue("15");
    expect(screen.getByLabelText(/Redondeo/i)).toHaveValue("1000");
  });

  it("marca qué packs usan valores propios y cuáles los de arriba", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchOk([
        crearCombo({ id: "a", name: "Cuerpo Full", packSessions: null, packDiscountPercentage: null }),
        crearCombo({
          id: "b",
          name: "Combo de Esenciales",
          packSessions: 5,
          packDiscountPercentage: 20,
          packRoundingBase: 500,
        }),
      ]),
    );
    render(<PacksPage />, { wrapper });
    expect(await screen.findByText(/Cuerpo Full/)).toBeInTheDocument();
    expect(screen.getByText(/Combo de Esenciales/)).toBeInTheDocument();
    expect(screen.getByText(/usa los de arriba/i)).toBeInTheDocument();
    expect(screen.getByText(/propios/i)).toBeInTheDocument();
  });

  it("un combo con pack propio muestra SUS números, no los de arriba", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchOk([
        crearCombo({
          id: "b",
          name: "Combo de Esenciales",
          packSessions: 5,
          packDiscountPercentage: 20,
        }),
      ]),
    );
    render(<PacksPage />, { wrapper });
    const fila = (await screen.findByText(/Combo de Esenciales/)).closest("tr")!;
    expect(fila).toHaveTextContent("5");
    expect(fila).toHaveTextContent("20%");
    expect(fila).toHaveTextContent(/propios/i);
  });

  // Recuperada de PreciosPage.test.tsx (Task 8 la sacó de ahí junto con el
  // input): el 0 es un descuento legítimo, pero "" no lo es. Sin este
  // bloqueo, un campo vacío se colaba como 0 y borraba el descuento del pack
  // en silencio — un bug de plata, no uno cosmético.
  it("bloquea el guardado si el descuento del pack queda vacío, no manda 0 en silencio", async () => {
    const user = userEvent.setup();
    render(<PacksPage />, { wrapper });
    await screen.findByLabelText(/Sesiones/i);

    await user.clear(screen.getByLabelText(/Descuento/i));
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    expect(
      await screen.findByText(/descuento del pack tiene que ser un número entero entre 0 y 100/i),
    ).toBeInTheDocument();
    expect(guardado).toBeNull();
  });

  // Recuperada de PreciosPage.test.tsx: basura (no entero, negativo, > 100)
  // también bloquea, con el mismo mensaje que ya usaba `parseForm` — porque
  // es la MISMA función (`parsePorcentaje`), no una reescrita para esta
  // pantalla.
  it.each([["abc"], ["-5"], ["101"], ["12.5"]])(
    "bloquea el guardado si el descuento del pack tiene basura (%s)",
    async (basura) => {
      const user = userEvent.setup();
      render(<PacksPage />, { wrapper });
      await screen.findByLabelText(/Sesiones/i);

      await user.clear(screen.getByLabelText(/Descuento/i));
      await user.type(screen.getByLabelText(/Descuento/i), basura);
      await user.click(screen.getByRole("button", { name: /guardar/i }));

      expect(
        await screen.findByText(/descuento del pack tiene que ser un número entero entre 0 y 100/i),
      ).toBeInTheDocument();
      expect(guardado).toBeNull();
    },
  );

  it("0 SÍ es un descuento válido: no bloquea el guardado", async () => {
    const user = userEvent.setup();
    render(<PacksPage />, { wrapper });
    await screen.findByLabelText(/Sesiones/i);

    await user.clear(screen.getByLabelText(/Descuento/i));
    await user.type(screen.getByLabelText(/Descuento/i), "0");
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(guardado).not.toBeNull());
    expect(guardado).toMatchObject({ packDiscountPercentage: 0 });
  });

  it("las sesiones y el redondeo del pack también bloquean con basura o vacío", async () => {
    const user = userEvent.setup();
    render(<PacksPage />, { wrapper });
    await screen.findByLabelText(/Sesiones/i);

    await user.clear(screen.getByLabelText(/Sesiones/i));
    await user.click(screen.getByRole("button", { name: /guardar/i }));
    expect(
      await screen.findByText(/sesiones del pack tienen que ser un número entero mayor a cero/i),
    ).toBeInTheDocument();
    expect(guardado).toBeNull();

    await user.type(screen.getByLabelText(/Sesiones/i), "3");
    await user.clear(screen.getByLabelText(/Redondeo/i));
    await user.type(screen.getByLabelText(/Redondeo/i), "0");
    await user.click(screen.getByRole("button", { name: /guardar/i }));
    expect(
      await screen.findByText(/redondeo del pack tiene que ser un número entero mayor a cero/i),
    ).toBeInTheDocument();
    expect(guardado).toBeNull();
  });

  // Recuperada de PreciosPage.test.tsx ("el pack de sesiones se mueve al
  // cambiar el descuento del pack"): ahí ya no queda forma de tocar el input
  // porque se mudó acá. La fila que hereda ("usa los de arriba") tiene que
  // reflejar lo que se está tipeando, no lo último guardado — si no, la lista
  // de abajo mentiría mientras se edita arriba. La fila con pack propio, en
  // cambio, no tiene que moverse: lo suyo no depende de estos inputs.
  it("el pack que usa los valores de arriba se mueve al cambiar el descuento; el que tiene pack propio no", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      mockFetchOk([
        crearCombo({ id: "hereda", name: "Cuerpo Full", packSessions: null, packDiscountPercentage: null }),
        crearCombo({ id: "propio", name: "Combo de Esenciales", packSessions: 5, packDiscountPercentage: 20 }),
      ]),
    );
    render(<PacksPage />, { wrapper });

    const filaHereda = (await screen.findByText("Cuerpo Full")).closest("tr")!;
    const filaPropio = screen.getByText("Combo de Esenciales").closest("tr")!;
    expect(filaHereda).toHaveTextContent("15%");
    expect(filaPropio).toHaveTextContent("20%");

    await user.clear(screen.getByLabelText(/Descuento/i));
    await user.type(screen.getByLabelText(/Descuento/i), "40");

    expect(filaHereda).toHaveTextContent("40%");
    expect(filaPropio).toHaveTextContent("20%");
  });

  it("Guardar manda la config ENTERA, no sólo los tres campos de pack", async () => {
    const user = userEvent.setup();
    render(<PacksPage />, { wrapper });
    await screen.findByLabelText(/Sesiones/i);

    await user.clear(screen.getByLabelText(/Sesiones/i));
    await user.type(screen.getByLabelText(/Sesiones/i), "4");
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(guardado).not.toBeNull());
    expect(guardado).toMatchObject({
      priceFemaleGrande: 19000,
      priceFemaleMediana: 17000,
      priceFemaleChica: 12000,
      priceMaleGrande: 23000,
      priceMaleMediana: 21000,
      priceMaleChica: 16000,
      pricingMinutesFemaleGrande: 10,
      pricingMinutesFemaleMediana: 7,
      pricingMinutesFemaleChica: 5,
      pricingMinutesMaleGrande: 11,
      pricingMinutesMaleMediana: 9,
      pricingMinutesMaleChica: 6,
      tier1RatePerMinute: 1200,
      tier2RatePerMinute: 1000,
      slotMinutesFemaleGrande: 9,
      slotMinutesFemaleMediana: 6,
      slotMinutesFemaleChica: 3,
      slotMinutesMaleGrande: 10,
      slotMinutesMaleMediana: 8,
      slotMinutesMaleChica: 5,
      slotRoundingStep: 5,
      slotMinimumMinutes: 10,
      packSessions: 4,
      packDiscountPercentage: 15,
      packRoundingBase: 1000,
    });
  });

  it("un rol sin permiso de manage no ve el botón Guardar", async () => {
    mockRole = "operator";
    render(<PacksPage />, { wrapper });
    await screen.findByLabelText(/Sesiones/i);
    expect(screen.queryByRole("button", { name: /guardar/i })).not.toBeInTheDocument();
  });
});
