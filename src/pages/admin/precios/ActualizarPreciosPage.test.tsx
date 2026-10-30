import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ActualizarPreciosPage } from "./ActualizarPreciosPage";
import { ToastProvider } from "../../../components/ui/Toast";

vi.mock("../../../auth/AuthContext", () => ({
  useAuth: () => ({
    role: "admin",
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

let simulacion: { servicios: ReturnType<typeof fila>[]; combos: unknown[] };
let respuestaAplicar: { ok: boolean; status: number; body: unknown };
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  simulacion = { servicios: [fila("s1", "Limpieza profunda", "cambia"), fila("s2", "Limpieza express", "cambia")], combos: [] };
  respuestaAplicar = { ok: true, status: 200, body: { ajusteId: "a1", aplicados: 2 } };
  fetchMock = vi.fn(async (url: RequestInfo | URL) => {
    const u = String(url);
    if (u.includes("/api/agenda/categories")) return { ok: true, status: 200, json: async () => ARBOL };
    if (u.includes("/precios/simular")) return { ok: true, status: 200, json: async () => simulacion };
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

  it("cambiar de categoría después de destildar deja todas las filas nuevas tildadas", async () => {
    montar("/admin/servicios/actualizar-precios?categoria=c-facial");
    escribirValor();
    fireEvent.click(await screen.findByLabelText("Incluir Limpieza express"));
    expect(screen.getByRole("button", { name: "Aplicar a 1 servicio" })).toBeInTheDocument();
    fireEvent.change(await screen.findByLabelText("Subcategoría 1"), { target: { value: "c-limpieza" } });
    expect(await screen.findByRole("button", { name: "Aplicar a 2 servicios" })).toBeInTheDocument();
    expect(screen.getByLabelText("Incluir Limpieza express")).toBeChecked();
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
});
