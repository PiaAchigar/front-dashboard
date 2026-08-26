import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ToastProvider } from "../../../components/ui/Toast";
import { CombosDepilacionPage } from "./CombosDepilacionPage";
import type { ComboDepilacion } from "../../../lib/api-types";
import type { DepilationConfig } from "../../../lib/depilation-pricing";
import type { ZonasPorCategoria } from "../../../lib/api-types";

vi.mock("../../../auth/AuthContext", () => ({
  useAuth: () => ({
    role: "admin",
    session: { access_token: "test-token" },
    user: null,
    loading: false,
    signOut: vi.fn(),
  }),
}));

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

// Pierna entera (z1) sigue activa; Rostro completo (z3) fue archivada pero
// sigue siendo parte del combo guardado más abajo — es el caso que rompía el
// editor.
const ZONAS: ZonasPorCategoria = {
  grande: [
    { id: "z1", name: "Pierna entera", category: "grande", displayOrder: 1, isActive: true, exclusions: [] },
    { id: "z3", name: "Rostro completo", category: "grande", displayOrder: 2, isActive: false, exclusions: [] },
  ],
  mediana: [],
  chica: [
    { id: "z2", name: "Cavado", category: "chica", displayOrder: 1, isActive: true, exclusions: [] },
  ],
};

const COMBO_ARCHIVADA: ComboDepilacion = {
  id: "combo-1",
  name: "Combo con zona archivada",
  description: "desc",
  kind: "guardado",
  fixedPrice: null,
  fixedDurationMinutes: null,
  choiceZoneCount: 0,
  packSessions: null,
  packDiscountPercentage: null,
  packRoundingBase: null,
  isPublishedWeb: false,
  displayOrder: 0,
  isActive: true,
  zonas: [
    { id: "z1", name: "Pierna entera", category: "grande" },
    { id: "z3", name: "Rostro completo", category: "grande" },
  ],
  precioCalculado: 31000, // 19.000 (lista) + 12.000 (escalón 1: 10 × 1.200)
  precioFinal: 31000,
  duracionMinutos: 20,
  pack: { sesiones: 3, descuentoPct: 15, redondeo: 1000, propio: false, precio: 79000, ahorro: 14000 },
};

// Dos packs fijos sobre la misma zona (Cavado, $12.000 de fórmula): uno
// vendido por encima de la fórmula (debe advertir) y otro por debajo (no
// debe advertir) — así el test no puede pasar con una advertencia que
// siempre se muestra o que nunca se muestra.
const PACK_EXCEDE: ComboDepilacion = {
  id: "pack-1",
  name: "Pack con precio alto",
  description: null,
  kind: "pack_fijo",
  fixedPrice: 15000,
  fixedDurationMinutes: null,
  choiceZoneCount: 0,
  packSessions: null,
  packDiscountPercentage: null,
  packRoundingBase: null,
  isPublishedWeb: true,
  displayOrder: 1,
  isActive: true,
  zonas: [{ id: "z2", name: "Cavado", category: "chica" }],
  precioCalculado: 12000,
  precioFinal: 15000,
  duracionMinutos: 10,
  pack: { sesiones: 3, descuentoPct: 15, redondeo: 1000, propio: false, precio: 38000, ahorro: 7000 },
};

const PACK_OK: ComboDepilacion = {
  id: "pack-2",
  name: "Pack con precio normal",
  description: null,
  kind: "pack_fijo",
  fixedPrice: 10000,
  fixedDurationMinutes: null,
  choiceZoneCount: 0,
  packSessions: null,
  packDiscountPercentage: null,
  packRoundingBase: null,
  isPublishedWeb: true,
  displayOrder: 2,
  isActive: true,
  zonas: [{ id: "z2", name: "Cavado", category: "chica" }],
  precioCalculado: 12000,
  precioFinal: 10000,
  duracionMinutos: 10,
  pack: { sesiones: 3, descuentoPct: 15, redondeo: 1000, propio: false, precio: 26000, ahorro: 4000 },
};

const COMBOS: ComboDepilacion[] = [COMBO_ARCHIVADA, PACK_EXCEDE, PACK_OK];

let patchCalls: { url: string; body: Record<string, unknown> }[] = [];

function makeFetchMock() {
  return vi.fn(async (url: RequestInfo | URL, options?: RequestInit) => {
    const u = String(url);
    const method = (options?.method ?? "GET").toUpperCase();

    if (u.includes("/depilacion/zonas")) {
      return { ok: true, json: async () => ZONAS };
    }
    if (u.includes("/depilacion/config")) {
      return { ok: true, json: async () => CONFIG };
    }
    if (method === "PATCH" && u.includes("/depilacion/combos/") && !u.endsWith("/estado")) {
      patchCalls.push({ url: u, body: JSON.parse(String(options?.body)) });
      return {
        ok: true,
        json: async () => ({
          ...COMBO_ARCHIVADA,
          zonas: [{ id: "z1", name: "Pierna entera", category: "grande" }],
        }),
      };
    }
    if (method === "PATCH" && u.endsWith("/estado")) {
      return { ok: true, json: async () => COMBO_ARCHIVADA };
    }
    if (u.includes("/depilacion/combos")) {
      return { ok: true, json: async () => COMBOS };
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
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  patchCalls = [];
  vi.stubGlobal("fetch", makeFetchMock());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CombosDepilacionPage", () => {
  it("lista los combos con su precio ya calculado", async () => {
    render(<CombosDepilacionPage />, { wrapper });
    expect(await screen.findByText("Combo con zona archivada")).toBeInTheDocument();
    expect(screen.getByText("Pack con precio alto")).toBeInTheDocument();
  });

  it("advierte cuando un pack fijo cuesta más que su fórmula, y no cuando no", async () => {
    render(<CombosDepilacionPage />, { wrapper });

    const filaConAdvertencia = (await screen.findByText("Pack con precio alto")).closest("tr");
    expect(filaConAdvertencia).not.toBeNull();
    expect(
      within(filaConAdvertencia as HTMLElement).getByText(/dejó de ser un descuento/i),
    ).toBeInTheDocument();

    const filaSinAdvertencia = screen.getByText("Pack con precio normal").closest("tr");
    expect(filaSinAdvertencia).not.toBeNull();
    expect(
      within(filaSinAdvertencia as HTMLElement).queryByText(/dejó de ser un descuento/i),
    ).not.toBeInTheDocument();
  });


  it("editar un pack fijo conserva su tipo y manda el precio corregido", async () => {
    const user = userEvent.setup();
    render(<CombosDepilacionPage />, { wrapper });

    // "Pack con precio alto" vende a $15.000 lo que por fórmula vale $12.000.
    const fila = (await screen.findByText("Pack con precio alto")).closest("tr");
    await user.click(within(fila as HTMLElement).getByTitle("Editar"));

    const precio = await screen.findByLabelText("Precio del pack *");
    expect(precio).toHaveValue("15000");

    await user.clear(precio);
    await user.type(precio, "10.000");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(patchCalls).toHaveLength(1));
    expect(patchCalls[0]!.url).toContain("/depilacion/combos/pack-1");
    // Sigue siendo pack_fijo: el backend rechaza el cambio de tipo, y mandar
    // "guardado" acá le borraría el precio a un pack sembrado.
    expect(patchCalls[0]!.body).toMatchObject({ kind: "pack_fijo", fixedPrice: 10000 });
  });

  it("un precio de pack que no es un número se corta antes de tocar la red", async () => {
    const user = userEvent.setup();
    render(<CombosDepilacionPage />, { wrapper });

    const fila = (await screen.findByText("Pack con precio alto")).closest("tr");
    await user.click(within(fila as HTMLElement).getByTitle("Editar"));

    const precio = await screen.findByLabelText("Precio del pack *");
    await user.clear(precio);
    await user.type(precio, "gratis");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(
      await screen.findByText(/El precio del pack tiene que ser un número entero/i),
    ).toBeInTheDocument();
    expect(patchCalls).toHaveLength(0);
  });

  it("crear un combo nuevo no ofrece precio propio: se cotiza con la fórmula", async () => {
    const user = userEvent.setup();
    render(<CombosDepilacionPage />, { wrapper });

    await user.click(await screen.findByRole("button", { name: /Nuevo combo|Agregar/ }));
    expect(await screen.findByLabelText("Nombre *")).toBeInTheDocument();
    expect(screen.queryByLabelText("Precio del pack *")).not.toBeInTheDocument();
  });

  it("el buscador filtra por nombre del combo y por el de sus zonas", async () => {
    const user = userEvent.setup();
    render(<CombosDepilacionPage />, { wrapper });

    await screen.findByText("Pack con precio alto");
    const buscador = screen.getByPlaceholderText(/Buscar por nombre/i);

    await user.type(buscador, "precio normal");
    expect(screen.getByText("Pack con precio normal")).toBeInTheDocument();
    expect(screen.queryByText("Pack con precio alto")).not.toBeInTheDocument();

    // "Pierna entera" es una zona, no un nombre de combo: solo la tiene el
    // combo guardado.
    await user.clear(buscador);
    await user.type(buscador, "Pierna entera");
    expect(screen.getByText("Combo con zona archivada")).toBeInTheDocument();
    expect(screen.queryByText("Pack con precio normal")).not.toBeInTheDocument();
  });

  it("al editar un combo con una zona archivada: la identifica por nombre, deja sacarla y guarda bien", async () => {
    const user = userEvent.setup();
    render(<CombosDepilacionPage />, { wrapper });

    // Los packs fijos también son editables, así que hay varios botones
    // "Editar": hay que ir al de esta fila, no al primero que aparezca.
    const fila = (await screen.findByText("Combo con zona archivada")).closest("tr");
    expect(fila).not.toBeNull();
    await user.click(within(fila as HTMLElement).getByTitle("Editar"));

    // La zona archivada aparece identificada por su nombre, no por uuid, y
    // con el motivo de por qué hay que sacarla.
    expect(await screen.findByLabelText("Rostro completo (archivada)")).toBeInTheDocument();
    expect(screen.getByText(/ya no está activa en el catálogo/i)).toBeInTheDocument();

    // Mientras siga tildada no se deja guardar (mejor bloquear acá que dejar
    // que el backend rechace el PATCH con un uuid que nadie puede ubicar).
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();

    // La saca: el checkbox desaparece (no hay forma de volver a tildarla).
    await user.click(screen.getByLabelText("Rostro completo (archivada)"));
    expect(screen.queryByLabelText("Rostro completo (archivada)")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar" })).not.toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(patchCalls).toHaveLength(1));
    expect(patchCalls[0]!.url).toContain("/depilacion/combos/combo-1");
    // La zona archivada no viaja en el PATCH — solo la que quedó tildada.
    expect(patchCalls[0]!.body.zonaIds).toEqual(["z1"]);
  });

  describe("pack de sesiones por combo", () => {
    async function abrirEdicion(user: ReturnType<typeof userEvent.setup>, nombre: string) {
      const fila = (await screen.findByText(nombre)).closest("tr");
      await user.click(within(fila as HTMLElement).getByTitle("Editar"));
    }

    it("un combo sin pack propio arranca en 'usar el por defecto', con los números del global", async () => {
      const user = userEvent.setup();
      render(<CombosDepilacionPage />, { wrapper });
      await abrirEdicion(user, "Combo con zona archivada");

      const porDefecto = await screen.findByRole("radio", { name: /Usar el pack por defecto/i });
      expect(porDefecto).toBeChecked();
      // El texto del radio muestra de dónde parte: 3 sesiones, 15%.
      expect(porDefecto.closest("label")).toHaveTextContent("3 sesiones, 15%");
      // Los campos no se ven mientras use el global.
      expect(screen.queryByLabelText("Sesiones")).not.toBeInTheDocument();
    });

    it("al definir uno propio aparecen los tres campos y el precio en vivo", async () => {
      const user = userEvent.setup();
      render(<CombosDepilacionPage />, { wrapper });
      await abrirEdicion(user, "Combo con zona archivada");

      await user.click(await screen.findByRole("radio", { name: /Definir uno para este combo/i }));

      expect(screen.getByLabelText("Sesiones")).toHaveValue("3");
      expect(screen.getByLabelText("Descuento (%)")).toHaveValue("15");
      expect(screen.getByLabelText("Redondeo ($)")).toHaveValue("1000");

      // El combo son Pierna entera + Rostro completo = $31.000 de fórmula.
      // 31.000 × 3 × 0,85 = 79.050 → 79.000.
      expect(screen.getByTestId("preview-pack-combo")).toHaveTextContent("$79.000");

      await user.clear(screen.getByLabelText("Sesiones"));
      await user.type(screen.getByLabelText("Sesiones"), "5");
      await user.clear(screen.getByLabelText("Descuento (%)"));
      await user.type(screen.getByLabelText("Descuento (%)"), "22");
      // 31.000 × 5 = 155.000; −22% = 120.900 → 121.000.
      expect(screen.getByTestId("preview-pack-combo")).toHaveTextContent("$121.000");
    });

    it("guardar con pack propio manda las tres perillas", async () => {
      const user = userEvent.setup();
      render(<CombosDepilacionPage />, { wrapper });
      await abrirEdicion(user, "Combo con zona archivada");

      // Sacar la zona archivada, que si no bloquea el guardado.
      await user.click(await screen.findByLabelText("Rostro completo (archivada)"));
      await user.click(screen.getByRole("radio", { name: /Definir uno para este combo/i }));
      await user.clear(screen.getByLabelText("Sesiones"));
      await user.type(screen.getByLabelText("Sesiones"), "5");
      await user.clear(screen.getByLabelText("Descuento (%)"));
      await user.type(screen.getByLabelText("Descuento (%)"), "22");
      await user.click(screen.getByRole("button", { name: "Guardar" }));

      await waitFor(() => expect(patchCalls).toHaveLength(1));
      expect(patchCalls[0]!.body).toMatchObject({
        packSessions: 5,
        packDiscountPercentage: 22,
        packRoundingBase: 1000,
      });
    });

    it("guardar con el pack por defecto manda las tres en null, no las omite", async () => {
      const user = userEvent.setup();
      render(<CombosDepilacionPage />, { wrapper });
      await abrirEdicion(user, "Combo con zona archivada");
      await user.click(await screen.findByLabelText("Rostro completo (archivada)"));
      await user.click(screen.getByRole("button", { name: "Guardar" }));

      await waitFor(() => expect(patchCalls).toHaveLength(1));
      // `null` explícito es lo que le dice al backend "volvé al global";
      // omitir el campo no significa lo mismo.
      expect(patchCalls[0]!.body).toMatchObject({
        packSessions: null,
        packDiscountPercentage: null,
        packRoundingBase: null,
      });
    });

    it("un descuento de más de 100 se corta antes de tocar la red", async () => {
      const user = userEvent.setup();
      render(<CombosDepilacionPage />, { wrapper });
      await abrirEdicion(user, "Combo con zona archivada");
      await user.click(await screen.findByLabelText("Rostro completo (archivada)"));
      await user.click(screen.getByRole("radio", { name: /Definir uno para este combo/i }));
      await user.clear(screen.getByLabelText("Descuento (%)"));
      await user.type(screen.getByLabelText("Descuento (%)"), "150");
      await user.click(screen.getByRole("button", { name: "Guardar" }));

      expect(await screen.findByText(/entre 0 y 100/i)).toBeInTheDocument();
      expect(patchCalls).toHaveLength(0);
    });

    it("avisa cuando el descuento es 0 y el pack deja de ser un pack", async () => {
      const user = userEvent.setup();
      render(<CombosDepilacionPage />, { wrapper });
      await abrirEdicion(user, "Combo con zona archivada");
      await user.click(await screen.findByRole("radio", { name: /Definir uno para este combo/i }));
      await user.clear(screen.getByLabelText("Descuento (%)"));
      await user.type(screen.getByLabelText("Descuento (%)"), "0");

      expect(screen.getByText(/dejó de ser un pack/i)).toBeInTheDocument();
    });

    it("el armador de abajo muestra EL MISMO pack que el bloque de arriba", async () => {
      const user = userEvent.setup();
      render(<CombosDepilacionPage />, { wrapper });
      await abrirEdicion(user, "Combo con zona archivada");

      // Con el global, los dos dicen 3 sesiones.
      expect(await screen.findAllByText(/Pack de 3 sesiones/i)).toHaveLength(2);

      await user.click(screen.getByRole("radio", { name: /Definir uno para este combo/i }));
      await user.clear(screen.getByLabelText("Sesiones"));
      await user.type(screen.getByLabelText("Sesiones"), "5");

      // Al definir uno propio, los dos tienen que pasar a 5. Antes el armador
      // se quedaba en 3 y la pantalla mostraba dos precios distintos para lo
      // mismo — la forma más rápida de cobrar mal.
      expect(screen.getAllByText(/Pack de 5 sesiones/i)).toHaveLength(2);
      expect(screen.queryByText(/Pack de 3 sesiones/i)).not.toBeInTheDocument();
    });

    it("en un pack fijo el pack se calcula sobre su precio de catálogo, no sobre la fórmula", async () => {
      const user = userEvent.setup();
      render(<CombosDepilacionPage />, { wrapper });
      // "Pack con precio alto": fijo $15.000, fórmula $12.000.
      await abrirEdicion(user, "Pack con precio alto");
      await user.click(await screen.findByRole("radio", { name: /Definir uno para este combo/i }));

      // 15.000 × 3 × 0,85 = 38.250 → 38.000. Sobre la fórmula daría 31.000.
      expect(screen.getByTestId("preview-pack-combo")).toHaveTextContent("$38.000");
    });
  });
});
