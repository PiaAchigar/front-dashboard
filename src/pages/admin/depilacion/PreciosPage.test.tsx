import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ToastProvider } from "../../../components/ui/Toast";
import { PreciosPage } from "./PreciosPage";
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

// precioLista/minutosPrecio de mujer: mismos valores que
// src/lib/depilation-pricing.test.ts, así los totales esperados de los
// combos de ejemplo son los que ya están probados ahí — la vista previa de
// esta pantalla se calcula en "mujer" (`SEXO_PREVIEW` en PreciosPage.tsx).
// Los de hombre son DISTINTOS a propósito (mismo criterio que el backend,
// Task 2 de la SDD): si el mapeo de ida y vuelta cruzara mujer/hombre, un
// fixture con los dos iguales no lo detectaría.
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

// Ronda de fixes 2, punto 3 (Important): las mismas 5 grandes + 5 chicas que
// antes estaban escritas a mano en PreciosPage.tsx, ahora como la respuesta
// de GET /combos que consume `useCombosDepilacion()` — con precioFinal:
// 65000 (el precio propio del pack) y precioCalculado: 86000 (la fórmula con
// CONFIG de abajo), igual que ya está probado en depilacion.test.ts del
// backend.
const CUERPO_FULL: ComboDepilacion = {
  id: "combo-cuerpo-full",
  name: "Cuerpo Full",
  description: null,
  kind: "pack_fijo",
  fixedPrice: 65000,
  fixedDurationMinutes: null,
  choiceZoneCount: 0,
  packSessions: null,
  packDiscountPercentage: null,
  packRoundingBase: null,
  isPublishedWeb: true,
  displayOrder: 1,
  isActive: true,
  zonas: [
    { id: "z1", name: "Pierna entera", category: "grande" },
    { id: "z2", name: "Rostro completo", category: "grande" },
    { id: "z3", name: "Espalda", category: "grande" },
    { id: "z4", name: "Brazos", category: "grande" },
    { id: "z5", name: "Glúteos", category: "grande" },
    { id: "z6", name: "Axila", category: "chica" },
    { id: "z7", name: "Cavado", category: "chica" },
    { id: "z8", name: "Tira de cola", category: "chica" },
    { id: "z9", name: "Línea alba", category: "chica" },
    { id: "z10", name: "Empeine y dedos de los pies", category: "chica" },
  ],
  precioCalculado: 86000,
  precioFinal: 65000,
  duracionMinutos: 60,
  pack: { sesiones: 3, descuentoPct: 15, redondeo: 1000, propio: false, precio: 166000, ahorro: 29000 },
};
const COMBOS: ComboDepilacion[] = [CUERPO_FULL];

// El body del último PUT /config, capturado por el mock de abajo — así los
// tests de guardado pueden verificar lo que se mandó sin repetir el hallazgo
// de la llamada adentro de cada `it`.
let guardado: Record<string, unknown> | null = null;

/** Enruta por URL: `/config` devuelve `CONFIG` (o captura el PUT en
 *  `guardado`), `/combos` devuelve `combos` (por defecto `COMBOS`, con
 *  "Cuerpo Full" adentro) — las dos queries de `PreciosPage`
 *  (`useDepilacionConfig` + `useCombosDepilacion`) salen en paralelo, así que
 *  el mock tiene que poder responder a las dos. */
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

  // Ronda de fixes 2, punto 3 (Important): mientras el precio de Cuerpo Full
  // salía de una constante hardcodeada, esta pantalla no dependía de ningún
  // fetch para mostrarlo — ahora sí, y mientras ese fetch está en vuelo (o si
  // el pack no aparece en la respuesta) la vista previa no puede mostrar un
  // número inventado ni romper el resto del formulario.
  it("mientras cargan los combos, Cuerpo Full no muestra un precio inventado", async () => {
    let resolverCombos!: (value: unknown) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/combos")) {
          return new Promise((resolve) => {
            resolverCombos = () => resolve({ ok: true, json: async () => COMBOS });
          });
        }
        return { ok: true, json: async () => CONFIG };
      }),
    );

    render(<PreciosPage />, { wrapper });

    // El resto del formulario (que solo depende de la config) ya está listo…
    expect(await screen.findByTestId("preview-cavado-axila")).toHaveTextContent("$18.000");
    // …pero Cuerpo Full todavía no tiene el precio real: ni "$65.000" ni
    // ningún otro número inventado mientras el fetch de combos sigue en vuelo.
    expect(screen.getByTestId("preview-cuerpo-full")).not.toHaveTextContent("$65.000");
    expect(screen.getByTestId("preview-cuerpo-full")).not.toHaveTextContent("$0");

    resolverCombos(undefined);

    expect(await screen.findByText("$65.000")).toBeInTheDocument();
  });

  it("si el pack Cuerpo Full no aparece en /combos, no rompe ni inventa un precio", async () => {
    vi.stubGlobal("fetch", mockFetchOk([])); // combos sin "Cuerpo Full"

    render(<PreciosPage />, { wrapper });

    expect(await screen.findByTestId("preview-cavado-axila")).toHaveTextContent("$18.000");
    expect(screen.getByTestId("preview-cuerpo-full")).not.toHaveTextContent("$65.000");
    expect(screen.getByTestId("preview-cuerpo-full")).not.toHaveTextContent("$0");
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

  it("Guardar manda las 25 columnas (12 por sexo) en forma plana al PUT /config", async () => {
    const user = userEvent.setup();
    render(<PreciosPage />, { wrapper });
    await screen.findByTestId("preview-cavado-axila");

    await user.clear(screen.getByLabelText(/escalón 1/i));
    await user.type(screen.getByLabelText(/escalón 1/i), "1300");
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

  // Task 8 (SDD 2026-09-28-configuracion-de-depilacion): la sección "Pack de
  // sesiones (por defecto)" sale del render, se muda a su propia pestaña
  // (Task 9). Este test es la mitad "se fue de la vista".
  it("ya no muestra la sección de packs", async () => {
    render(<PreciosPage />, { wrapper });
    await screen.findByTestId("preview-cavado-axila");
    expect(screen.queryByText(/Pack de sesiones/i)).not.toBeInTheDocument();
  });

  // La otra mitad, y la que importa: el PUT manda la config ENTERA, no solo
  // los campos visibles. Si alguien saca packSessions/packDiscountPercentage/
  // packRoundingBase del *estado* del formulario (no solo del render), este
  // test tiene que ponerse rojo — ese sería el bug que borra en silencio los
  // packs que la dueña ya tenía configurados. Reusa el patrón real del
  // archivo (variable `guardado`, poblada por `mockFetchOk` en el PUT) en vez
  // de un mock nuevo: así ejercita el guardado real del formulario, no una
  // función auxiliar.
  it("sigue mandando los valores de packs al guardar aunque la sección no se vea", async () => {
    const user = userEvent.setup();
    render(<PreciosPage />, { wrapper });
    await screen.findByTestId("preview-cavado-axila");

    await user.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(guardado).not.toBeNull());
    expect(guardado).toMatchObject({
      packSessions: expect.anything(),
      packDiscountPercentage: expect.anything(),
      packRoundingBase: expect.anything(),
    });
  });

  it("pide el precio de lista para mujer y para hombre", async () => {
    render(<PreciosPage />, { wrapper });
    expect(await screen.findByLabelText(/precio.*grande.*mujer/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/precio.*grande.*hombre/i)).toBeInTheDocument();
  });

  it("guarda las doce columnas por sexo", async () => {
    const user = userEvent.setup();
    render(<PreciosPage />, { wrapper });
    await user.clear(await screen.findByLabelText(/precio.*grande.*hombre/i));
    await user.type(screen.getByLabelText(/precio.*grande.*hombre/i), "23000");
    await user.click(screen.getByRole("button", { name: /guardar/i }));
    await waitFor(() => expect(guardado).toMatchObject({ priceMaleGrande: 23000 }));
  });

  it("muestra el mensaje de error del backend tal cual, sin reemplazarlo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, options?: RequestInit) => {
        if (options?.method === "PUT") {
          return {
            ok: false,
            status: 400,
            json: async () => ({ error: "La tarifa del primer escalón tiene que ser mayor a cero" }),
          };
        }
        if (url.includes("/combos")) return { ok: true, json: async () => COMBOS };
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

  // Task 8: las dos pruebas de validación del descuento del pack ("queda
  // vacío" / "tiene basura") vivían acá porque el input "Descuento (%)"
  // estaba en esta pantalla. Task 8 saca ese input del render (sigue en el
  // estado, ver comentario en PreciosPage.tsx) — la validación sigue
  // existiendo en `parseForm`, pero ya no hay forma de disparar un valor
  // vacío o con basura desde ESTA pantalla, así que las pruebas se mudan con
  // el input a la pestaña Packs (Task 9).

  // Ronda de fixes 2, punto 1 (Important): espejo de la validación de
  // no-inversión del backend. El caso concreto del revisor — priceFemaleGrande:
  // 1000 pasa "entero y positivo" pero hace que agregar una zona grande a 2
  // chicas baje el precio de $18.000 a $12.000 — tiene que quedar bloqueado
  // ACÁ, antes de que el formulario le mande nada al backend.
  //
  // task-7: la Capa 1 (orden grande ≥ mediana ≥ chica) se aplica por sexo,
  // cada curva contra sí misma — de ahí los dos últimos tests, que prueban
  // que tocar SOLO la curva de hombre bloquea sin tocar la de mujer, y
  // viceversa.
  describe("no-inversión", () => {
    const campoPriceGrandeMujer = () => screen.getByLabelText(/precio.*grande.*mujer/i);
    const campoPriceMedianaMujer = () => screen.getByLabelText(/precio.*mediana.*mujer/i);
    const campoPriceGrandeHombre = () => screen.getByLabelText(/precio.*grande.*hombre/i);
    const campoPriceMedianaHombre = () => screen.getByLabelText(/precio.*mediana.*hombre/i);

    it("bloquea el guardado con priceFemaleGrande: 1000 — el caso concreto del revisor", async () => {
      const user = userEvent.setup();
      render(<PreciosPage />, { wrapper });
      await screen.findByTestId("preview-cavado-axila");

      const fetchMock = vi.mocked(fetch);
      const callsAntes = fetchMock.mock.calls.length;

      await user.clear(campoPriceGrandeMujer());
      await user.type(campoPriceGrandeMujer(), "1000");
      await user.click(screen.getByRole("button", { name: /guardar/i }));

      expect(
        await screen.findByText(/puede terminar costando MENOS/i),
      ).toBeInTheDocument();
      // Ni un PUT: el guardado se cortó antes de tocar la red, igual que el
      // resto de los bloqueos de `parseForm`.
      expect(fetchMock.mock.calls.length).toBe(callsAntes);
    });

    it("bloquea el guardado si priceFemaleGrande queda por debajo de priceFemaleMediana", async () => {
      const user = userEvent.setup();
      render(<PreciosPage />, { wrapper });
      await screen.findByTestId("preview-cavado-axila");

      await user.clear(campoPriceGrandeMujer());
      await user.type(campoPriceGrandeMujer(), "15000"); // < priceFemaleMediana (17000)
      await user.click(screen.getByRole("button", { name: /guardar/i }));

      expect(
        await screen.findByText(/zona grande \(mujer\).*mayor o igual.*zona mediana \(mujer\)/i),
      ).toBeInTheDocument();
    });

    it("bloquea el guardado si priceMaleGrande queda por debajo de priceMaleMediana, sin tocar mujer", async () => {
      const user = userEvent.setup();
      render(<PreciosPage />, { wrapper });
      await screen.findByTestId("preview-cavado-axila");

      await user.clear(campoPriceGrandeHombre());
      await user.type(campoPriceGrandeHombre(), "18000"); // < priceMaleMediana (21000)
      await user.click(screen.getByRole("button", { name: /guardar/i }));

      expect(
        await screen.findByText(/zona grande \(hombre\).*mayor o igual.*zona mediana \(hombre\)/i),
      ).toBeInTheDocument();
      expect(guardado).toBeNull();
    });

    it("no bloquea un cambio de precios que respeta el orden y la no-inversión", async () => {
      const user = userEvent.setup();
      render(<PreciosPage />, { wrapper });
      await screen.findByTestId("preview-cavado-axila");

      // Subir mediana (mujer) sin pasar a grande (17000 -> 18000, sigue <= 19000).
      await user.clear(campoPriceMedianaMujer());
      await user.type(campoPriceMedianaMujer(), "18000");
      await user.click(screen.getByRole("button", { name: /guardar/i }));

      await waitFor(() => expect(guardado).not.toBeNull());
      expect(screen.queryByText(/puede terminar costando MENOS/i)).not.toBeInTheDocument();
    });

    it("no bloquea un cambio de precios de hombre que respeta el orden", async () => {
      const user = userEvent.setup();
      render(<PreciosPage />, { wrapper });
      await screen.findByTestId("preview-cavado-axila");

      // Subir mediana (hombre) sin pasar a grande (21000 -> 22000, sigue <= 23000).
      await user.clear(campoPriceMedianaHombre());
      await user.type(campoPriceMedianaHombre(), "22000");
      await user.click(screen.getByRole("button", { name: /guardar/i }));

      await waitFor(() => expect(guardado).toMatchObject({ priceMaleMediana: 22000 }));
      expect(screen.queryByText(/puede terminar costando MENOS/i)).not.toBeInTheDocument();
    });
  });

  // Ronda de fixes 1, punto 2(a): el pack fijo de Cuerpo Full no se mueve
  // (tiene precio propio), pero el equivalente por fórmula SÍ — es la señal
  // de que ese "fijo" puede dejar de convenir si suben las tarifas.
  it("Cuerpo Full: el precio fijo no se mueve, el equivalente por fórmula sí", async () => {
    const user = userEvent.setup();
    render(<PreciosPage />, { wrapper });

    // 5 grandes + 5 chicas: 19.000 + 10×1.200 + 3×10×1.000 + 5×5×1.000 = 86.000
    expect(await screen.findByTestId("preview-cuerpo-full-formula")).toHaveTextContent("$86.000");
    expect(screen.getByTestId("preview-cuerpo-full")).toHaveTextContent("$65.000");

    await user.clear(screen.getByLabelText(/escalón 1/i));
    await user.type(screen.getByLabelText(/escalón 1/i), "1300");

    // Sube 100 en el único minuto de escalón 1 del combo (10 min): +1.000
    expect(screen.getByTestId("preview-cuerpo-full-formula")).toHaveTextContent("$87.000");
    // El precio fijo del pack sigue siendo el mismo: $65.000, ajeno a la fórmula.
    expect(screen.getByTestId("preview-cuerpo-full")).toHaveTextContent("$65.000");
  });

  // Ronda de fixes 2, punto 3 (Important): el cartel de "el pack fijo ya NO
  // conviene" existía en el código pero no tenía NINGÚN test — justo el
  // cartel que tiene que avisar cuando bajar las tarifas hace que el precio
  // fijo del pack deje de ser un descuento sobre la fórmula.
  it('Cuerpo Full: muestra el cartel "ya NO conviene" cuando la fórmula cae por debajo del precio fijo', async () => {
    const user = userEvent.setup();
    render(<PreciosPage />, { wrapper });
    await screen.findByTestId("preview-cuerpo-full-formula");
    expect(screen.getByTestId("preview-cuerpo-full")).not.toHaveTextContent(/ya NO conviene/i);

    // tier2: 1000 -> 100. Con 5 grandes + 5 chicas, la fórmula de Cuerpo Full
    // cae de $86.000 a $36.500 — por debajo de los $65.000 fijos del pack.
    await user.clear(screen.getByLabelText(/escalón 2/i));
    await user.type(screen.getByLabelText(/escalón 2/i), "100");

    expect(screen.getByTestId("preview-cuerpo-full-formula")).toHaveTextContent("$36.500");
    expect(screen.getByTestId("preview-cuerpo-full")).toHaveTextContent(/ya NO conviene/i);
    // El precio propio del pack no se mueve con la fórmula.
    expect(screen.getByTestId("preview-cuerpo-full")).toHaveTextContent("$65.000");
  });

  // Task 8: esta prueba (Ronda de fixes 1, punto 2(b)) editaba el descuento
  // del pack vía el input "Descuento (%)" para confirmar que la vista previa
  // reaccionaba. Ese input se mudó a la pestaña Packs (Task 9); acá no queda
  // forma de tocar `form.packDiscountPercentage` desde la UI. La vista previa
  // en sí sigue viva y sigue leyendo `form.packSessions` / `packDiscountPercentage`
  // / `packRoundingBase` (ver "explica la cuenta del pack..." más abajo), solo
  // que ya no es editable desde acá.

  describe("panel explicativo", () => {
    it("muestra los tres pasos de la fórmula y dónde se edita cada uno", async () => {
      render(<PreciosPage />, { wrapper });
      await screen.findByTestId("preview-cavado-axila");

      expect(screen.getByText(/La zona más cara va primera/i)).toBeInTheDocument();
      expect(screen.getByText(/precio de lista de su categoría/i)).toBeInTheDocument();
      expect(screen.getByText(/Minutos de la zona × tarifa del escalón 1/i)).toBeInTheDocument();
      expect(screen.getByText(/Minutos de la zona × tarifa del escalón 2/i)).toBeInTheDocument();

      // El puntero a la sección del formulario: sin esto, saber la fórmula no
      // alcanza para saber qué campo tocar. Aparece dos veces —el encabezado
      // de la sección y el puntero del paso 1— y esa coincidencia exacta es
      // la que hace que se pueda seguir.
      expect(screen.getAllByText("Precios de lista")).toHaveLength(2);
      expect(screen.getAllByText("Minutos de precio + Escalones")).toHaveLength(2);
    });

    it("dice explícitamente que la fórmula no se edita, solo sus números", async () => {
      render(<PreciosPage />, { wrapper });
      await screen.findByTestId("preview-cavado-axila");
      expect(screen.getByText(/La fórmula es siempre esta y no se edita/i)).toBeInTheDocument();
    });

    it("desglosa el ejemplo línea por línea, mostrando los TRES pasos", async () => {
      render(<PreciosPage />, { wrapper });
      const bloque = await screen.findByTestId("preview-pierna-cavado-rostro");

      // Paso 1 — Pierna (grande) es la más cara: precio de lista = $19.000
      expect(bloque).toHaveTextContent(/Pierna.*grande.*precio de lista/i);
      expect(bloque).toHaveTextContent("$19.000");
      // Paso 2 — Rostro (grande) es la segunda: 10 min × $1.200 = $12.000
      expect(bloque).toHaveTextContent(/Rostro.*grande.*10 min × \$1\.200 \(escalón 1\)/i);
      expect(bloque).toHaveTextContent("$12.000");
      // Paso 3 — Cavado (chica) es la tercera: 5 min × $1.000 = $5.000. Esta
      // línea es la razón de que el ejemplo tenga tres zonas y no dos: con dos
      // el escalón 2 no aparece nunca.
      expect(bloque).toHaveTextContent(/Cavado.*chica.*5 min × \$1\.000 \(escalón 2\)/i);
      expect(bloque).toHaveTextContent("$5.000");
      // Y el total es la suma.
      expect(bloque).toHaveTextContent("$36.000");
    });

    it("el desglose se recalcula al cambiar un valor, sin guardar", async () => {
      const user = userEvent.setup();
      render(<PreciosPage />, { wrapper });
      const bloque = await screen.findByTestId("preview-pierna-cavado-rostro");
      expect(bloque).toHaveTextContent(/10 min × \$1\.200/);

      await user.clear(screen.getByLabelText(/escalón 1/i));
      await user.type(screen.getByLabelText(/escalón 1/i), "1300");

      // La cuenta mostrada cambia, no solo el resultado.
      expect(bloque).toHaveTextContent(/10 min × \$1\.300/);
      expect(bloque).toHaveTextContent("$13.000");
      expect(bloque).toHaveTextContent("$37.000");
      // El escalón 2 no se tocó: la tercera línea sigue igual.
      expect(bloque).toHaveTextContent(/5 min × \$1\.000/);
    });

    it("explica la cuenta del pack con los números del formulario", async () => {
      render(<PreciosPage />, { wrapper });
      const bloque = await screen.findByTestId("preview-pierna-cavado-rostro");

      // 3 × $36.000 = $108.000, −15%, redondeado a $1.000 → $92.000
      expect(bloque).toHaveTextContent(/3 × \$36\.000 = \$108\.000/);
      expect(bloque).toHaveTextContent(/menos 15%/i);
      expect(bloque).toHaveTextContent(/múltiplos de \$1\.000/i);
      expect(screen.getByTestId("preview-pack")).toHaveTextContent("$92.000");
    });

    it("aclara que los packs fijos no usan la fórmula y dónde se editan", async () => {
      render(<PreciosPage />, { wrapper });
      const bloque = await screen.findByTestId("preview-cuerpo-full");

      expect(bloque).toHaveTextContent(/precio propio de catálogo/i);
      expect(bloque).toHaveTextContent(/se editan en la solapa Combos/i);
      expect(bloque).toHaveTextContent("$65.000");
    });
  });
});
