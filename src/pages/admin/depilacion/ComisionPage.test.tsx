import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ToastProvider } from "../../../components/ui/Toast";
import { ComisionPage } from "./ComisionPage";
import type { DepilationConfig } from "../../../lib/depilation-pricing";
import type { Machine, ProviderAdmin, ServiceAgreement } from "../../../lib/api-types";
import type { EquipoDeDepilacion } from "../../../hooks/useEquiposDeDepilacion";

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

const ANCLA = "svc-depilacion";

/** Los mismos valores que `src/lib/depilation-pricing.test.ts` — esta pantalla
 *  no hace aritmética de precios, pero `GET /config` es de donde salen
 *  `anchorServiceId` y `sesionesEsperandoTurno`, así que la respuesta tiene
 *  que ser la de verdad y no un objeto recortado. */
const CONFIG_BASE: DepilationConfig = {
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

function proveedora(id: string, fullName: string): ProviderAdmin {
  return {
    id,
    fullName,
    email: null,
    phone: null,
    dni: null,
    cuit: null,
    specialties: null,
    notes: null,
    address: null,
    postalCode: null,
    status: "active",
  };
}

const PROVEEDORAS: ProviderAdmin[] = [proveedora("p1", "Romina"), proveedora("p2", "Ana")];

function maquina(id: string, name: string): Machine {
  return {
    id,
    name,
    description: null,
    equipmentType: null,
    requiresOperator: null,
    hourlyCost: null,
    status: "active",
    purchaseDate: null,
    weightKg: null,
    dimensions: null,
    quantity: null,
    maintenanceCount: null,
    lastMaintenanceAt: null,
    maintenanceNotes: null,
    supplierInfo: null,
    warrantyCost: null,
    warrantyExpiry: null,
  } as Machine;
}

/** El catálogo entero de máquinas del centro: las dos de depilación y la HIFU,
 *  que es de otra área y existe justamente para probar que esta pantalla no la
 *  toca. */
const MAQUINAS: Machine[] = [
  maquina("m1", "Crystal 3D Plus"),
  maquina("m2", "Soprano Ice"),
  maquina("m9", "HIFU 50D"),
];

const CRYSTAL: EquipoDeDepilacion = {
  machineId: "m1",
  machineName: "Crystal 3D Plus",
  machineStatus: "active",
};
const SOPRANO: EquipoDeDepilacion = {
  machineId: "m2",
  machineName: "Soprano Ice",
  machineStatus: "active",
};
const HIFU: EquipoDeDepilacion = {
  machineId: "m9",
  machineName: "HIFU 50D",
  machineStatus: "active",
};

const ROMINA_ACUERDO: ServiceAgreement = {
  serviceProviderId: "p1",
  providerName: "Romina",
  paymentType: "fixed_per_service",
  rate: 20000,
};

// ── Estado mutable del backend falso ────────────────────────────────────────
let equipos: EquipoDeDepilacion[] = [];
let acuerdos: ServiceAgreement[] = [];
let config: Record<string, unknown> = {};
let turnosFuturos: { providerId: string; turnos: number }[] = [];
let maquinasPorProveedora: Record<string, EquipoDeDepilacion[]> = {};
/** Deja colgado el GET de las certificaciones, para poder mirar la pantalla en
 *  el estado "todavía no sé qué tiene tildado". */
let maquinasColgadas = false;
/** Todo lo que salió a la red, para poder afirmar que algo NO se mandó. */
let llamadas: { url: string; method: string; body: unknown }[] = [];

function mockEquipos(lista: EquipoDeDepilacion[]) {
  equipos = lista;
}
function mockAcuerdos(lista: ServiceAgreement[]) {
  acuerdos = lista;
}
function mockConfig(extra: Record<string, unknown>) {
  config = { ...CONFIG_BASE, anchorServiceId: ANCLA, sesionesEsperandoTurno: 0, ...extra };
}
function mockTurnosFuturos(lista: { providerId: string; turnos: number }[]) {
  turnosFuturos = lista;
}
function mockMaquinasDeProveedora(providerId: string, lista: EquipoDeDepilacion[]) {
  maquinasPorProveedora[providerId] = lista;
}

function ok(data: unknown) {
  return { ok: true, json: async () => data };
}

const escrituras = () => llamadas.filter((l) => l.method !== "GET");
const llamada = (re: RegExp, method: string) =>
  llamadas.find((l) => re.test(l.url) && l.method === method);
/** Cualquier escritura sobre una URL, sin importar el verbo. Es más fuerte que
 *  preguntar por un DELETE puntual: lo que no se puede tocar, no se toca ni
 *  para borrar ni para volver a escribir. */
const escriturasSobre = (re: RegExp) => escrituras().filter((l) => re.test(l.url));

beforeEach(() => {
  // El escenario por defecto: un equipo, Romina habilitada con monto fijo y
  // certificada en ese equipo. Cada test lo pisa con lo suyo.
  equipos = [CRYSTAL];
  acuerdos = [ROMINA_ACUERDO];
  turnosFuturos = [];
  maquinasPorProveedora = { p1: [CRYSTAL] };
  maquinasColgadas = false;
  llamadas = [];
  mockConfig({});

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options?: RequestInit) => {
      const method = (options?.method ?? "GET").toUpperCase();
      llamadas.push({
        url,
        method,
        body: options?.body ? JSON.parse(String(options.body)) : null,
      });

      const deProveedora = /\/providers\/([^/]+)\/machines/.exec(url);
      if (deProveedora) {
        if (method !== "GET") return ok({ ok: true });
        if (maquinasColgadas) return new Promise(() => {});
        return ok(maquinasPorProveedora[deProveedora[1]] ?? []);
      }
      if (url.includes("/providers/all")) return ok(PROVEEDORAS);
      if (url.includes("/depilacion/turnos-futuros")) return ok(turnosFuturos);
      if (url.includes("/depilacion/equipos")) {
        if (method !== "GET") return ok({ ok: true });
        return ok(equipos);
      }
      if (url.includes("/depilacion/config")) return ok(config);
      if (url.includes("/agreements")) {
        if (method !== "GET") return ok({ ok: true });
        return ok(acuerdos);
      }
      if (url.includes("/agenda/machines")) return ok(MAQUINAS);
      return ok({});
    }),
  );
});

afterEach(() => {
  mockRole = "admin";
});

function Wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={qc}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}

const campoComoCobra = () => screen.getByLabelText(/Cómo cobra/i);
const campoCuanto = () => screen.getByLabelText(/Cuánto/i);
const botonGuardar = () => screen.getByRole("button", { name: /Guardar/i });

describe("ComisionPage", () => {
  it("el desplegable no ofrece porcentaje, y explica por qué", async () => {
    render(<ComisionPage />, { wrapper: Wrapper });
    await screen.findByText(/Quién hace depilación/i);
    await screen.findByText("Romina");
    expect(screen.queryByRole("option", { name: /Porcentaje/i })).not.toBeInTheDocument();
    expect(screen.getByText(/daría \$0/)).toBeInTheDocument();
  });

  it("traduce la tarifa a plata mientras se escribe", async () => {
    const user = userEvent.setup();
    render(<ComisionPage />, { wrapper: Wrapper });
    await screen.findByText(/Quién hace depilación/i);
    await screen.findByText("Romina");

    await user.selectOptions(campoComoCobra(), "per_hour");
    // El acuerdo de Romina ya trae $20.000: se borra antes de escribir, si no
    // el input queda con "2000028000" y la traducción no prueba nada.
    await user.clear(campoCuanto());
    await user.type(campoCuanto(), "28000");

    // $28.000 la hora → una sesión corta (18 min) paga $8.400.
    expect(await screen.findByText(/\$8\.400/)).toBeInTheDocument();
  });

  it("sin equipos no deja agregar proveedoras", async () => {
    mockEquipos([]);
    render(<ComisionPage />, { wrapper: Wrapper });
    expect(await screen.findByText(/Agregá primero un equipo/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Agregar proveedora/i })).toBeDisabled();
  });

  it("el estado vacío dice cuántas sesiones están esperando", async () => {
    mockEquipos([CRYSTAL]);
    mockAcuerdos([]);
    mockConfig({ sesionesEsperandoTurno: 3 });
    render(<ComisionPage />, { wrapper: Wrapper });
    expect(await screen.findByText(/Todavía no hay nadie habilitado/i)).toBeInTheDocument();
    expect(screen.getByText(/3 sesiones compradas esperando turno/i)).toBeInTheDocument();
  });

  it("no muestra el renglón de sesiones esperando cuando son cero", async () => {
    mockEquipos([CRYSTAL]);
    mockAcuerdos([]);
    mockConfig({ sesionesEsperandoTurno: 0 });
    render(<ComisionPage />, { wrapper: Wrapper });
    await screen.findByText(/Todavía no hay nadie habilitado/i);
    expect(screen.queryByText(/esperando turno/i)).not.toBeInTheDocument();
  });

  it("avisa cuántos turnos quedan colgados antes de sacar a una proveedora", async () => {
    const user = userEvent.setup();
    mockEquipos([CRYSTAL]);
    mockAcuerdos([ROMINA_ACUERDO]);
    mockTurnosFuturos([{ providerId: "p1", turnos: 4 }]);
    render(<ComisionPage />, { wrapper: Wrapper });
    await screen.findByText("Romina");

    await user.click(screen.getByRole("button", { name: /Quitar/i }));

    expect(
      await screen.findByText(/4 turnos de depilación sin completar/i),
    ).toBeInTheDocument();
  });

  it("no avisa nada si no tiene turnos colgados", async () => {
    const user = userEvent.setup();
    mockEquipos([CRYSTAL]);
    mockAcuerdos([ROMINA_ACUERDO]);
    mockTurnosFuturos([]);
    render(<ComisionPage />, { wrapper: Wrapper });
    await screen.findByText("Romina");

    await user.click(screen.getByRole("button", { name: /Quitar/i }));

    expect(screen.queryByText(/sin completar/i)).not.toBeInTheDocument();
  });

  it("marca el equipo que no está activo", async () => {
    // `getMachinesForService` filtra `machines.status = 'active'`: un equipo en
    // mantenimiento desaparece de la disponibilidad y la proveedora se queda sin
    // horarios. Mostrarlo como si funcionara es el modo de falla silencioso.
    mockEquipos([{ ...CRYSTAL, machineStatus: "maintenance" }]);
    render(<ComisionPage />, { wrapper: Wrapper });
    expect(await screen.findByText(/no está activa/i)).toBeInTheDocument();
  });

  it("los equipos a tildar por proveedora son SOLO los de depilación", async () => {
    mockEquipos([CRYSTAL]);
    mockMaquinasDeProveedora("p1", [CRYSTAL, HIFU]);
    mockAcuerdos([ROMINA_ACUERDO]);
    render(<ComisionPage />, { wrapper: Wrapper });
    await screen.findByText("Romina");

    // La HIFU la usa para otra área: no se muestra acá, y por lo tanto esta
    // pantalla no la puede desmarcar ni borrar.
    expect(await screen.findByLabelText(/Crystal/)).toBeChecked();
    expect(screen.queryByLabelText(/HIFU/)).not.toBeInTheDocument();
  });

  // ── Guardar ───────────────────────────────────────────────────────────────

  it("guarda los acuerdos y sólo las máquinas que cambiaron", async () => {
    const user = userEvent.setup();
    mockEquipos([CRYSTAL, SOPRANO]);
    mockAcuerdos([ROMINA_ACUERDO]);
    mockMaquinasDeProveedora("p1", [CRYSTAL]);
    render(<ComisionPage />, { wrapper: Wrapper });
    await screen.findByText("Romina");

    await user.click(await screen.findByLabelText(/Soprano/));
    await user.click(botonGuardar());

    await waitFor(() => expect(llamada(/\/agreements$/, "PUT")).toBeTruthy());
    expect(llamada(/\/agreements$/, "PUT")!.body).toEqual({
      agreements: [{ serviceProviderId: "p1", paymentType: "fixed_per_service", rate: 20000 }],
    });
    // Soprano se tildó → PUT. Crystal ya estaba tildada → nadie la vuelve a
    // escribir, y sobre todo nadie la borra.
    await waitFor(() => expect(llamada(/\/providers\/p1\/machines\/m2$/, "PUT")).toBeTruthy());
    expect(llamada(/\/providers\/p1\/machines\/m1$/, "DELETE")).toBeUndefined();
    expect(llamada(/\/providers\/p1\/machines\/m1$/, "PUT")).toBeUndefined();
  });

  // La certificación es GLOBAL por proveedora: `service_provider_machine` no
  // tiene columna de servicio. Si el guardado reconciliara el conjunto en vez
  // de tocar de a un par, destildar la Crystal acá le borraría a Romina la
  // HIFU que usa en otra área — y nadie se enteraría hasta que Romina
  // desapareciera de la agenda de HIFU.
  it("al guardar no toca las máquinas que la proveedora usa en otras áreas", async () => {
    const user = userEvent.setup();
    // Dos equipos de depilación y Romina certificada en los dos: destildar la
    // Crystal la deja con la Soprano, que es lo que hace que este test pruebe
    // el arrastre de certificaciones y no la validación de "sin equipo no se
    // guarda" (que tiene su propio test más abajo).
    mockEquipos([CRYSTAL, SOPRANO]);
    mockAcuerdos([ROMINA_ACUERDO]);
    mockMaquinasDeProveedora("p1", [CRYSTAL, SOPRANO, HIFU]);
    render(<ComisionPage />, { wrapper: Wrapper });
    await screen.findByText("Romina");

    await user.click(await screen.findByLabelText(/Crystal/));
    await user.click(botonGuardar());

    await waitFor(() => expect(llamada(/\/providers\/p1\/machines\/m1$/, "DELETE")).toBeTruthy());
    // Ni un DELETE ni un PUT ni nada: sobre la HIFU esta pantalla no escribe.
    // Preguntar sólo por el DELETE dejaba pasar una versión que la metía en la
    // lista de tildadas y después la volvía a escribir.
    expect(escriturasSobre(/\/providers\/p1\/machines\/m9/)).toHaveLength(0);
  });

  // Ronda de arreglos 1, punto 1. Mientras el GET de certificaciones está en
  // vuelo no se sabe qué tiene tildado la proveedora. Si los tildes se pintan
  // vacíos y habilitados, el primer click congela ese vacío mentiroso en el
  // estado local —que de ahí en más tiene precedencia sobre lo que conteste el
  // servidor— y al guardar sale un DELETE de una máquina que nadie destildó.
  // Como la certificación es global, eso se la saca también de las otras áreas.
  it("no deja tocar los tildes mientras las certificaciones están en vuelo", async () => {
    const user = userEvent.setup();
    maquinasColgadas = true;
    mockEquipos([CRYSTAL]);
    mockAcuerdos([ROMINA_ACUERDO]);
    render(<ComisionPage />, { wrapper: Wrapper });
    await screen.findByText("Romina");

    const tilde = await screen.findByLabelText(/Crystal/);
    expect(tilde).toBeDisabled();

    // Y el click que igual se intente no tiene que dejar rastro: guardar
    // después no puede escribir nada sobre las máquinas de Romina.
    await user.click(tilde);
    await user.click(botonGuardar());

    await waitFor(() => expect(llamada(/\/agreements$/, "PUT")).toBeTruthy());
    expect(escriturasSobre(/\/providers\/p1\/machines/)).toHaveLength(0);
  });

  // Ronda de arreglos 1, punto 2. Dos filas con la misma proveedora no son un
  // problema estético: `diffAgreements` no deduplica, así que las dos van a
  // `toCreate`, y `setServiceAgreements` cierra los acuerdos viejos ANTES de
  // insertar y sin transacción. El índice único parcial hace fallar el INSERT,
  // pero los cierres ya commitearon: la proveedora queda SIN acuerdo activo,
  // cobrando $0. El mismo agujero que esta rama arregla, por otra puerta.
  it("no guarda dos filas con la misma proveedora, y la nombra", async () => {
    const user = userEvent.setup();
    render(<ComisionPage />, { wrapper: Wrapper });
    await screen.findByText("Romina");

    await user.click(screen.getByRole("button", { name: /Agregar proveedora/i }));
    await user.selectOptions(screen.getAllByLabelText("Proveedora")[1], "p1");

    await user.click(botonGuardar());

    expect(await screen.findByText(/Romina está dos veces/i)).toBeInTheDocument();
    expect(escrituras()).toHaveLength(0);
  });

  // Decisión B: una proveedora habilitada sin forma de cobrar reproduce el
  // problema de los $0 que esta pantalla existe para arreglar.
  it("no guarda una fila sin tipo de pago, y dice por qué", async () => {
    const user = userEvent.setup();
    render(<ComisionPage />, { wrapper: Wrapper });
    await screen.findByText("Romina");

    await user.selectOptions(campoComoCobra(), "");
    await user.click(botonGuardar());

    expect(await screen.findByText(/Falta indicar cómo cobra Romina/i)).toBeInTheDocument();
    expect(escrituras()).toHaveLength(0);
  });

  it("no guarda una fila con la tarifa vacía", async () => {
    const user = userEvent.setup();
    render(<ComisionPage />, { wrapper: Wrapper });
    await screen.findByText("Romina");

    await user.clear(campoCuanto());
    await user.click(botonGuardar());

    expect(await screen.findByText(/Falta indicar cuánto cobra Romina/i)).toBeInTheDocument();
    expect(escrituras()).toHaveLength(0);
  });

  it("no guarda una fila con la tarifa en cero", async () => {
    const user = userEvent.setup();
    render(<ComisionPage />, { wrapper: Wrapper });
    await screen.findByText("Romina");

    await user.clear(campoCuanto());
    await user.type(campoCuanto(), "0");
    await user.click(botonGuardar());

    expect(await screen.findByText(/Falta indicar cuánto cobra Romina/i)).toBeInTheDocument();
    expect(escrituras()).toHaveLength(0);
  });

  it("no guarda una fila sin proveedora elegida", async () => {
    const user = userEvent.setup();
    render(<ComisionPage />, { wrapper: Wrapper });
    await screen.findByText("Romina");

    await user.click(screen.getByRole("button", { name: /Agregar proveedora/i }));
    await user.click(botonGuardar());

    expect(await screen.findByText(/Falta elegir la proveedora/i)).toBeInTheDocument();
    expect(escrituras()).toHaveLength(0);
  });

  // ── Equipos ───────────────────────────────────────────────────────────────

  it("agrega un equipo de depilación desde el catálogo de máquinas", async () => {
    const user = userEvent.setup();
    mockEquipos([CRYSTAL]);
    render(<ComisionPage />, { wrapper: Wrapper });
    // La Soprano NO es equipo de depilación todavía, así que sale en el
    // desplegable del catálogo y en ningún otro lado. Crystal sí lo es y
    // aparece dos veces (la lista de equipos y el tilde de Romina): esperarla
    // a ella sería una búsqueda ambigua que pasa o falla según cuál de las dos
    // queries conteste primero.
    await screen.findByRole("option", { name: "Soprano Ice" });
    await user.selectOptions(screen.getByLabelText(/Equipo a agregar/i), "m2");
    await user.click(screen.getByRole("button", { name: /Agregar equipo/i }));

    await waitFor(() => expect(llamada(/\/depilacion\/equipos\/m2$/, "PUT")).toBeTruthy());
  });

  // Ronda de arreglos 1, punto 5: el tacho del bloque de equipos borra en el
  // servidor al instante; el de proveedoras no escribe nada hasta Guardar.
  // Mismo ícono, consecuencias opuestas — la pantalla tiene que decir cuál es
  // cuál antes de que alguien lo descubra apretando.
  it("distingue el borrado inmediato de equipos del guardado diferido de proveedoras", async () => {
    const user = userEvent.setup();
    render(<ComisionPage />, { wrapper: Wrapper });
    await screen.findByText("Romina");

    expect(screen.getByText(/se aplican al instante/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Guardar proveedoras y tarifas/i }),
    ).toBeInTheDocument();

    // Y el diferido es diferido de verdad: quitar a Romina no manda nada.
    await user.click(screen.getByRole("button", { name: /Quitar/i }));
    expect(escrituras()).toHaveLength(0);
  });

  it("un rol sin permiso de manage no ve el botón Guardar", async () => {
    mockRole = "operator";
    render(<ComisionPage />, { wrapper: Wrapper });
    await screen.findByText("Romina");
    expect(screen.queryByRole("button", { name: /Guardar/i })).not.toBeInTheDocument();
  });

  // ── Revisión final ────────────────────────────────────────────────────────

  // F5 + F4. La acción más frecuente de esta pantalla —cambiarle la comisión a
  // alguien— no tenía un solo test. El único que miraba el body afirmaba
  // exactamente el fixture (`fixed_per_service` / 20000), así que una
  // implementación que mandara una constante, o el acuerdo VIEJO ignorando lo
  // que Laura escribió, pasaba la suite entera. El síntoma en producción sería
  // que Laura sube una comisión, ve el toast verde, y se sigue liquidando la
  // vieja.
  it("guardar manda la comisión EDITADA, no la que vino del servidor", async () => {
    const user = userEvent.setup();
    render(<ComisionPage />, { wrapper: Wrapper });
    await screen.findByText("Romina");

    // Los dos campos cambian, y a valores que no están en ningún fixture.
    await user.selectOptions(campoComoCobra(), "per_hour");
    await user.clear(campoCuanto());
    await user.type(campoCuanto(), "35000");
    await user.click(botonGuardar());

    await waitFor(() => expect(llamada(/\/agreements$/, "PUT")).toBeTruthy());
    expect(llamada(/\/agreements$/, "PUT")!.body).toEqual({
      agreements: [{ serviceProviderId: "p1", paymentType: "per_hour", rate: 35000 }],
    });
  });

  it("guardar una proveedora nueva manda lo que se cargó en su fila", async () => {
    const user = userEvent.setup();
    mockEquipos([CRYSTAL]);
    mockAcuerdos([]);
    render(<ComisionPage />, { wrapper: Wrapper });
    await screen.findByRole("button", { name: /Agregar proveedora/i });

    await user.click(screen.getByRole("button", { name: /Agregar proveedora/i }));
    await user.selectOptions(screen.getByLabelText("Proveedora"), "p2");
    await user.selectOptions(campoComoCobra(), "fixed_per_service");
    await user.type(campoCuanto(), "18000");
    await user.click(await screen.findByLabelText(/Crystal/));
    await user.click(botonGuardar());

    await waitFor(() => expect(llamada(/\/agreements$/, "PUT")).toBeTruthy());
    expect(llamada(/\/agreements$/, "PUT")!.body).toEqual({
      agreements: [{ serviceProviderId: "p2", paymentType: "fixed_per_service", rate: 18000 }],
    });
  });

  // G2 (spec §7, primera fila). Sin equipo tildado la proveedora queda
  // habilitada y cobrando, pero `loadAvailabilityContext` cruza los equipos del
  // servicio con su certificación: la intersección da vacío y no hay ni un
  // turno libre. Laura carga a Ana, ve el toast verde, se va a agendar las
  // sesiones ya pagas y no encuentra un solo horario, sin ningún error que lo
  // explique.
  it("no guarda una proveedora sin ningún equipo tildado, y lo dice con esas palabras", async () => {
    const user = userEvent.setup();
    mockEquipos([CRYSTAL]);
    mockAcuerdos([]);
    render(<ComisionPage />, { wrapper: Wrapper });
    await screen.findByRole("button", { name: /Agregar proveedora/i });

    await user.click(screen.getByRole("button", { name: /Agregar proveedora/i }));
    await user.selectOptions(screen.getByLabelText("Proveedora"), "p2");
    await user.selectOptions(campoComoCobra(), "fixed_per_service");
    await user.type(campoCuanto(), "20000");
    // Sin tildar ningún equipo.
    await user.click(botonGuardar());

    expect(await screen.findByText(/Falta tildar con qué equipo trabaja Ana/i)).toBeInTheDocument();
    expect(screen.getByText(/no va a aparecer con horarios/i)).toBeInTheDocument();
    // Y sobre todo: nada salió a la red. Ni el PUT de acuerdos.
    expect(escrituras()).toHaveLength(0);
  });

  it("destildar el último equipo de una proveedora ya guardada tampoco se guarda", async () => {
    const user = userEvent.setup();
    mockEquipos([CRYSTAL]);
    mockAcuerdos([ROMINA_ACUERDO]);
    mockMaquinasDeProveedora("p1", [CRYSTAL]);
    render(<ComisionPage />, { wrapper: Wrapper });
    await screen.findByText("Romina");

    await user.click(await screen.findByLabelText(/Crystal/));
    await user.click(botonGuardar());

    expect(
      await screen.findByText(/Falta tildar con qué equipo trabaja Romina/i),
    ).toBeInTheDocument();
    expect(escrituras()).toHaveLength(0);
  });

  // G3. El aviso viejo decía que los turnos "quedan sin proveedora y hay que
  // reasignarlos a mano". Las dos cláusulas eran falsas: `setServiceAgreements`
  // sólo toca `service_provider_service`, los turnos conservan su
  // `service_provider_id`. Lo que sí pasa —y el aviso callaba— es de plata:
  // cerrado el acuerdo, `getActiveAgreement` devuelve null, `gananciaDelTurno`
  // no calcula, `provider_earning` queda NULL congelado, y
  // `getCommissionsReport` filtra `providerEarning != null`. El turno no se
  // liquida en $0: desaparece de la liquidación.
  it("el aviso de sacar una proveedora habla de la liquidación, no de reasignar turnos", async () => {
    const user = userEvent.setup();
    mockEquipos([CRYSTAL]);
    mockAcuerdos([ROMINA_ACUERDO]);
    mockTurnosFuturos([{ providerId: "p1", turnos: 4 }]);
    render(<ComisionPage />, { wrapper: Wrapper });
    await screen.findByText("Romina");

    await user.click(screen.getByRole("button", { name: /Quitar/i }));

    const aviso = await screen.findByText(/4 turnos de depilación sin completar/i);
    expect(aviso).toHaveTextContent(/no se le va a liquidar nada a Romina/i);
    expect(aviso).toHaveTextContent(/ni siquiera van a aparecer en la liquidación/i);
    // Y ya no dice lo que no pasa.
    expect(aviso).not.toHaveTextContent(/sin proveedora/i);
    expect(aviso).not.toHaveTextContent(/reasignar/i);
  });

  // G4. `Number("20.000")` es 20. Y esta misma pantalla formatea "$20.000" con
  // punto de miles en el pie de fila, o sea le enseña a Laura la notación que
  // rompía el campo: cargaría $20 por sesión creyendo que cargó $20.000.
  it("la tarifa escrita a la argentina (20.000) se guarda como veinte mil", async () => {
    const user = userEvent.setup();
    render(<ComisionPage />, { wrapper: Wrapper });
    await screen.findByText("Romina");

    await user.clear(campoCuanto());
    await user.type(campoCuanto(), "20.000");
    await user.click(botonGuardar());

    await waitFor(() => expect(llamada(/\/agreements$/, "PUT")).toBeTruthy());
    expect(llamada(/\/agreements$/, "PUT")!.body).toEqual({
      agreements: [{ serviceProviderId: "p1", paymentType: "fixed_per_service", rate: 20000 }],
    });
  });

  it("el pie de fila traduce 20.000 como veinte mil, no como veinte", async () => {
    const user = userEvent.setup();
    render(<ComisionPage />, { wrapper: Wrapper });
    await screen.findByText("Romina");

    await user.clear(campoCuanto());
    await user.type(campoCuanto(), "20.000");

    expect(
      await screen.findByText(/Cada sesión paga \$20\.000, dure lo que dure\./),
    ).toBeInTheDocument();
  });

  // G6. `catalogo:view`/`edit` incluyen a `operator`, así que la recepcionista
  // llega a esta pestaña con dos clicks y el GET de acuerdos le contesta. Ver
  // el dato está bien; lo que no puede pasar es que edite tarifas y quite
  // proveedoras durante un rato para descubrir después que no hay Guardar.
  it("un rol sin permiso de manage no puede editar las tarifas ni quitar proveedoras", async () => {
    mockRole = "operator";
    render(<ComisionPage />, { wrapper: Wrapper });
    await screen.findByText("Romina");

    expect(campoComoCobra()).toBeDisabled();
    expect(campoCuanto()).toBeDisabled();
    expect(screen.getByLabelText("Proveedora")).toBeDisabled();
    expect(screen.getByRole("button", { name: /Quitar/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Agregar proveedora/i })).toBeDisabled();
    expect(screen.getByText(/sólo lectura/i)).toBeInTheDocument();
  });

  // G7 (spec §5.2). El <select> recibe `value="percentage"`, que no está entre
  // sus <option>, así que el DOM cae en `selectedIndex 0` y muestra "—" mientras
  // el estado interno sigue diciendo "percentage". Sin aviso, Laura ve un campo
  // vacío, la pantalla no le marca nada, y al guardar le llega un 400 sobre
  // porcentajes que ella nunca eligió.
  it("una fila cargada por porcentaje se muestra con su aviso", async () => {
    mockEquipos([CRYSTAL]);
    mockAcuerdos([
      { serviceProviderId: "p1", providerName: "Romina", paymentType: "percentage", rate: 40 },
    ]);
    render(<ComisionPage />, { wrapper: Wrapper });
    await screen.findByText("Romina");

    expect(
      await screen.findByText(/está cargado por porcentaje, que en depilación no se puede usar/i),
    ).toBeInTheDocument();
  });

  it("no deja guardar una fila cargada por porcentaje, y no manda el PUT", async () => {
    const user = userEvent.setup();
    mockEquipos([CRYSTAL]);
    mockAcuerdos([
      { serviceProviderId: "p1", providerName: "Romina", paymentType: "percentage", rate: 40 },
    ]);
    mockMaquinasDeProveedora("p1", [CRYSTAL]);
    render(<ComisionPage />, { wrapper: Wrapper });
    await screen.findByText("Romina");

    await user.click(botonGuardar());

    expect(
      await screen.findByText(/El acuerdo de Romina está cargado por porcentaje/i),
    ).toBeInTheDocument();
    expect(escrituras()).toHaveLength(0);
  });
});
