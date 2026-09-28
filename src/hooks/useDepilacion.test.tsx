import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import {
  useDepilacionConfig,
  useGuardarConfig,
  type DepilacionConfigInput,
  type DepilacionConfigResponse,
} from "./useDepilacion";
import type { DepilationConfig } from "../lib/depilation-pricing";

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    role: "admin",
    session: { access_token: "test-token" },
    user: null,
    loading: false,
    signOut: vi.fn(),
  }),
}));

const ANCLA = "svc-depilacion";

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

const ENTRADA = { ...CONFIG, tier1RatePerMinute: 1300 } as unknown as DepilacionConfigInput;

/** El GET devuelve la config MÁS los dos datos de la pantalla de
 *  Configuración; el PUT devuelve sólo la config. Esa asimetría es real (está
 *  así en `routes/agenda/depilacion.ts`) y es justo la que hace falta para que
 *  el test signifique algo. */
function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, options?: RequestInit) => {
      const method = (options?.method ?? "GET").toUpperCase();
      if (method === "PUT") return { ok: true, json: async () => ({ ...CONFIG }) };
      return {
        ok: true,
        json: async () => ({ ...CONFIG, anchorServiceId: ANCLA, sesionesEsperandoTurno: 3 }),
      };
    }),
  );
}

beforeEach(() => {
  stubFetch();
});

describe("useGuardarConfig", () => {
  // Ronda de arreglos 1, punto 4. El `onSuccess` hacía `setQueryData(KEY, data)`
  // —reemplazo— con la respuesta del PUT, que NO trae `anchorServiceId` ni
  // `sesionesEsperandoTurno`. Guardar en Precios o en Packs le dejaba la config
  // en el cache sin el id del servicio ancla, y Comisión, montada al lado, se
  // quedaba sin poder guardar acuerdos hasta el próximo refetch.
  it("guardar no le borra al cache el ancla ni las sesiones esperando", async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(
      () => ({ config: useDepilacionConfig(), guardar: useGuardarConfig() }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.config.data?.anchorServiceId).toBe(ANCLA));

    await result.current.guardar.mutateAsync(ENTRADA);

    const enCache = qc.getQueryData<DepilacionConfigResponse>(["depilacion", "config"]);
    expect(enCache?.anchorServiceId).toBe(ANCLA);
    expect(enCache?.sesionesEsperandoTurno).toBe(3);
    // Y lo que sí vino en la respuesta del PUT se aplicó igual.
    expect(enCache?.tarifaEscalon1).toBe(CONFIG.tarifaEscalon1);
  });
});
