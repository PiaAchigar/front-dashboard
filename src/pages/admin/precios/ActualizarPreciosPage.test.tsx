import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ActualizarPreciosPage } from "./ActualizarPreciosPage";
import { ToastProvider } from "../../../components/ui/Toast";

let rol = "admin";
vi.mock("../../../auth/AuthContext", () => ({
  useAuth: () => ({
    role: rol,
    session: { access_token: "test-token" },
    user: null,
    loading: false,
    signOut: vi.fn(),
  }),
}));

const nodo = (id: string, name: string, children: unknown[] = [], kind = "tecnica") => ({
  id, name, description: null, displayOrder: 0, isActive: true, kind, children,
});
const ARBOL = [
  nodo("a-estetica", "Estética", [], "area"),
  nodo("c-facial", "Facial", [nodo("c-limpieza", "Limpieza"), nodo("c-peeling", "Peeling")]),
  nodo("c-corporal", "Corporal"),
];

const fila = (id: string, nombre: string, estado: string, antes = 1000, despues = 1100) => ({
  id, nombre, estado,
  listaAntes: estado === "sin_precio" ? null : antes,
  listaDespues: estado === "sin_precio" ? null : despues,
  efectivoAntes: estado === "sin_precio" ? null : antes - 100,
  efectivoDespues: estado === "sin_precio" ? null : despues - 100,
});

let simulacionPor: ((categoryId: string) => typeof simulacion) | null = null;
let simulacion: { servicios: ReturnType<typeof fila>[]; combos: unknown[] };
let respuestaAplicar: { ok: boolean; status: number; body: unknown };
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  rol = "admin";
  simulacionPor = null;
  simulacion = { servicios: [fila("s1", "Limpieza profunda", "cambia"), fila("s2", "Limpieza express", "cambia")], combos: [] };
  respuestaAplicar = { ok: true, status: 200, body: { ajusteId: "a1", aplicados: 2 } };
  fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/api/agenda/categories")) return { ok: true, status: 200, json: async () => ARBOL };
    if (u.includes("/precios/simular")) {
      const cat = JSON.parse(String((init as RequestInit).body)).categoryId;
      return { ok: true, status: 200, json: async () => (simulacionPor ? simulacionPor(cat) : simulacion) };
    }
    if (u.includes("/precios/aplicar"))
      return { ok: respuestaAplicar.ok, status: respuestaAplicar.status, json: async () => respuestaAplicar.body };
    return { ok: true, status: 200, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function montar(entrada = "/admin/servicios/actualizar-precios") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[entrada]}>
        <ToastProvider>
          <Routes>
            <Route path="/admin/servicios/actualizar-precios" element={children} />
            <Route path="/admin/servicios" element={<div>Todos los servicios</div>} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return render(<ActualizarPreciosPage />, { wrapper: Wrapper });
}

const escribirValor = (v = "10") => fireEvent.change(screen.getByLabelText("Valor"), { target: { value: v } });
const llamadas = (frag: string) => fetchMock.mock.calls.filter(([u]) => String(u).includes(frag));
const cuerpoAplicar = () => JSON.parse(String((llamadas("/precios/aplicar")[0][1] as RequestInit).body));

describe("ActualizarPreciosPage", () => {
  it("con ?categoria=<hija> arranca con padre e hija elegidos y muestra la vista previa", async () => {
    montar("/admin/servicios/actualizar-precios?categoria=c-peeling");
    expect(await screen.findByDisplayValue("Facial")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Peeling")).toBeInTheDocument();
    escribirValor();
    expect(await screen.findByText("Limpieza profunda")).toBeInTheDocument();
    expect(JSON.parse(String((llamadas("/precios/simular")[0][1] as RequestInit).body)).categoryId).toBe("c-peeling");
  });

  it("elegir un padre con hijas muestra el segundo selector en 'Toda la categoría'", async () => {
    montar();
    await screen.findByRole("option", { name: "Facial" });
    fireEvent.change(screen.getByLabelText("Categoría"), { target: { value: "c-facial" } });
    expect(screen.getByLabelText("Subcategoría 1")).toHaveDisplayValue("Toda la categoría");
  });

  it("destildar una fila baja el contador y el body de aplicar no la incluye", async () => {
    montar("/admin/servicios/actualizar-precios?categoria=c-facial");
    escribirValor();
    expect(await screen.findByRole("button", { name: "Aplicar a 2 servicios" })).toBeEnabled();
    fireEvent.click(screen.getByLabelText("Incluir Limpieza express"));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar a 1 servicio" }));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    await vi.waitFor(() => expect(llamadas("/precios/aplicar")).toHaveLength(1));
    expect(cuerpoAplicar().servicios).toEqual([{ id: "s1", listaVista: 1000, efectivoVista: 900 }]);
  });

  it("cambiar de categoría después de destildar deja las filas nuevas tildadas y aplica solo esas", async () => {
    simulacionPor = (cat) =>
      cat === "c-limpieza"
        ? { servicios: [fila("n1", "Nueva uno", "cambia"), fila("n2", "Nueva dos", "cambia")], combos: [] }
        : simulacion;
    montar("/admin/servicios/actualizar-precios?categoria=c-facial");
    escribirValor();
    fireEvent.click(await screen.findByLabelText("Incluir Limpieza express"));
    fireEvent.change(await screen.findByLabelText("Subcategoría 1"), { target: { value: "c-limpieza" } });
    expect(await screen.findByText("Nueva uno")).toBeInTheDocument();
    expect(screen.queryByText("Limpieza profunda")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Incluir Nueva uno")).toBeChecked();
    expect(screen.getByLabelText("Incluir Nueva dos")).toBeChecked();
    fireEvent.click(await screen.findByRole("button", { name: "Aplicar a 2 servicios" }));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    await vi.waitFor(() => expect(llamadas("/precios/aplicar")).toHaveLength(1));
    const body = cuerpoAplicar();
    expect(body.categoryId).toBe("c-limpieza");
    expect(body.servicios.map((x: { id: string }) => x.id).sort()).toEqual(["n1", "n2"]);
  });

  it("mientras la entrada viva no alcanzó a la debounced, Aplicar está deshabilitado", async () => {
    montar("/admin/servicios/actualizar-precios?categoria=c-facial");
    escribirValor("10");
    const boton = await screen.findByRole("button", { name: "Aplicar a 2 servicios" });
    expect(boton).toBeEnabled();
    escribirValor("5");
    expect(screen.getByRole("button", { name: /Aplicar a/ })).toBeDisabled();
    await vi.waitFor(() => expect(screen.getByRole("button", { name: /Aplicar a/ })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /Aplicar a/ }));
    expect(screen.getByText(/suben 5%/)).toBeInTheDocument();
  });

  it("sin permiso de edición no simula ni deja aplicar", async () => {
    rol = "sales";
    montar("/admin/servicios/actualizar-precios?categoria=c-facial");
    expect(await screen.findByText("No tenés permiso para actualizar precios.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Valor")).not.toBeInTheDocument();
    expect(llamadas("/precios/simular")).toHaveLength(0);
  });

  it("el resumen muestra el porcentaje con coma decimal", async () => {
    montar("/admin/servicios/actualizar-precios?categoria=c-facial");
    escribirValor("10.5");
    fireEvent.click(await screen.findByRole("button", { name: "Aplicar a 2 servicios" }));
    expect(screen.getByText(/suben 10,5%/)).toBeInTheDocument();
  });

  it("una fila inválida tildada deshabilita Aplicar; sin_precio no se puede tildar", async () => {
    simulacion = { servicios: [fila("s1", "Ok", "cambia"), fila("s2", "Roto", "invalido", 100, 0), fila("s3", "Vacío", "sin_precio")], combos: [] };
    montar("/admin/servicios/actualizar-precios?categoria=c-facial");
    fireEvent.change(screen.getByLabelText("Acción"), { target: { value: "bajar" } });
    escribirValor("100".slice(0, 2));
    expect(await screen.findByText("Roto")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Aplicar a/ })).toBeDisabled();
    expect(screen.getByLabelText("Incluir Vacío")).toBeDisabled();
    expect(screen.getByText("sin precio")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Incluir Roto"));
    expect(screen.getByRole("button", { name: "Aplicar a 1 servicio" })).toBeEnabled();
  });

  it("aplicar pide confirmación con el resumen exacto", async () => {
    montar("/admin/servicios/actualizar-precios?categoria=c-facial");
    escribirValor();
    fireEvent.click(await screen.findByRole("button", { name: "Aplicar a 2 servicios" }));
    expect(
      screen.getByText("2 servicios suben 10%, redondeado a $100. Cambia el precio de lista y el de efectivo."),
    ).toBeInTheDocument();
    expect(llamadas("/precios/aplicar")).toHaveLength(0);
  });

  it("un 409 avisa y vuelve a simular", async () => {
    respuestaAplicar = { ok: false, status: 409, body: { error: "conflicto", conflictos: ["s1"] } };
    montar("/admin/servicios/actualizar-precios?categoria=c-facial");
    escribirValor();
    fireEvent.click(await screen.findByRole("button", { name: "Aplicar a 2 servicios" }));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(await screen.findByText("Alguien cambió un precio mientras mirabas. Revisá la vista previa.")).toBeInTheDocument();
    await vi.waitFor(() => expect(llamadas("/precios/simular").length).toBeGreaterThanOrEqual(2));
  });

  it("muestra el texto fijo de lista y efectivo", () => {
    montar();
    expect(screen.getByText("Cambia el precio de lista y el precio en efectivo.")).toBeInTheDocument();
  });

  it("con ?categoria=<área> o un id que no existe, arranca sin categoría y no simula", async () => {
    for (const id of ["a-estetica", "no-existe"]) {
      fetchMock.mockClear();
      const { unmount } = montar(`/admin/servicios/actualizar-precios?categoria=${id}`);
      await screen.findByRole("option", { name: "Facial" });
      escribirValor();
      expect(screen.getByLabelText("Categoría")).toHaveDisplayValue("Elegí una categoría");
      await new Promise((r) => setTimeout(r, 400));
      expect(llamadas("/precios/simular")).toHaveLength(0);
      expect(screen.getByRole("button", { name: /Aplicar a/ })).toBeDisabled();
      unmount();
    }
  });

  it("en $, '1.000' se lee como 1000 y '1.500' como 1500", async () => {
    montar("/admin/servicios/actualizar-precios?categoria=c-facial");
    fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "monto" } });
    escribirValor("1.000");
    fireEvent.click(await screen.findByRole("button", { name: "Aplicar a 2 servicios" }));
    expect(screen.getByText(/suben \$\s?1\.000,/)).toBeInTheDocument();
    expect(JSON.parse(String((llamadas("/precios/simular")[0][1] as RequestInit).body)).ajuste.valor).toBe(1000);
  });

  it("valor inválido: muestra el motivo debajo del campo", async () => {
    montar("/admin/servicios/actualizar-precios?categoria=c-facial");
    escribirValor("0");
    expect(screen.getByText("El valor tiene que ser mayor que 0.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "monto" } });
    escribirValor("500,5");
    expect(screen.getByText("El monto va en pesos enteros, sin centavos.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "porcentaje" } });
    fireEvent.change(screen.getByLabelText("Acción"), { target: { value: "bajar" } });
    escribirValor("100");
    expect(screen.getByText("Al bajar, el % tiene que ser menor que 100.")).toBeInTheDocument();
    escribirValor("");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("el aviso manda los packs a /packs y los combos a /combos, y nombra los dos tipos", async () => {
    simulacion = {
      ...simulacion,
      combos: [
        { id: "k1", nombre: "Combo uno", areaId: "a-estetica", kind: "combo" },
        { id: "k2", nombre: "Pack dos", areaId: "a-estetica", kind: "pack" },
      ],
    };
    montar("/admin/servicios/actualizar-precios?categoria=c-facial");
    escribirValor();
    expect(await screen.findByText(/Estos 2 combos y packs incluyen/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Combo uno" })).toHaveAttribute("href", "/admin/estetica/combos");
    expect(screen.getByRole("link", { name: "Pack dos" })).toHaveAttribute("href", "/admin/estetica/packs");
  });

  it("el aviso con un solo pack dice 'Este pack incluye'", async () => {
    simulacion = { ...simulacion, combos: [{ id: "k2", nombre: "Pack dos", areaId: null, kind: "pack" }] };
    montar("/admin/servicios/actualizar-precios?categoria=c-facial");
    escribirValor();
    expect(await screen.findByText(/Este pack incluye/)).toBeInTheDocument();
  });
});
