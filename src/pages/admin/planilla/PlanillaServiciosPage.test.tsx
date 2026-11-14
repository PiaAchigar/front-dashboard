import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ToastProvider } from "../../../components/ui/Toast";
import { ApiError } from "../../../lib/api-client";
import { PlanillaServiciosPage } from "./PlanillaServiciosPage";
import { ServiciosAdminPage } from "../ServiciosAdminPage";
import type { AreaDeCatalogo } from "../../../lib/admin-nav";
import type { Previsualizacion } from "../../../lib/planilla-tipos";

let rol = "manager";
vi.mock("../../../auth/AuthContext", () => ({
  useAuth: () => ({ role: rol, session: { access_token: "test-token" }, user: null, loading: false, signOut: vi.fn() }),
}));

const apiFetch = vi.fn();
vi.mock("../../../lib/api-client", async (orig) => ({
  ...(await orig<typeof import("../../../lib/api-client")>()),
  apiFetch: (...a: unknown[]) => apiFetch(...a),
}));

const leerLibro = vi.fn();
vi.mock("../../../lib/planilla-excel", () => ({
  leerLibro: (...a: unknown[]) => leerLibro(...a),
  armarLibro: vi.fn(),
  nombreDeArchivo: vi.fn(),
}));

const AREA: AreaDeCatalogo = { path: "estetica", categoria: "Estética", bajada: "x" };

const CONTENIDO = { servicios: [], acuerdos: [], insumos: [], categorias: [] };
const LEIDO = { area: "Estética", original: CONTENIDO, editada: CONTENIDO };

const vacia = (): Previsualizacion => ({
  errores: [], avisos: [], servicios: [], acuerdos: [], insumos: [], categorias: [], maquinas: [], combosAfectados: [],
  resumen: { serviciosNuevos: 0, serviciosModificados: 0, acuerdos: 0, insumos: 0, categorias: 0, maquinas: 0 },
});
const conCambio = (): Previsualizacion => ({
  ...vacia(),
  servicios: [{ fila: 2, id: "s1", nombre: "Limpieza facial", tipo: "modificado", cambios: [{ campo: "Precio lista", antes: "45000", despues: "50000" }] }],
  combosAfectados: [{ id: "c1", nombre: "Combo verano", kind: "combo" }],
  resumen: { serviciosNuevos: 0, serviciosModificados: 1, acuerdos: 0, insumos: 0, categorias: 0, maquinas: 0 },
});
const conError = (): Previsualizacion => ({
  ...conCambio(),
  errores: [{ pestana: "Servicios", fila: 4, mensaje: "El precio efectivo no puede quedar vacío" }],
});

let respuestaPrevia: Previsualizacion;
beforeEach(() => {
  rol = "manager";
  apiFetch.mockReset();
  leerLibro.mockReset();
  localStorage.clear();
  respuestaPrevia = conCambio();
  leerLibro.mockResolvedValue(LEIDO);
  apiFetch.mockImplementation(async (url: string) => {
    if (url.includes("/previsualizar")) return respuestaPrevia;
    if (url.includes("/aplicar")) return { resumen: respuestaPrevia.resumen };
    return [];
  });
});
afterEach(() => vi.unstubAllGlobals());

function Envoltorio({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <MemoryRouter initialEntries={["/admin/estetica/servicios/planilla"]}>
          <Routes>
            <Route path="/admin/estetica/servicios/planilla" element={children} />
            <Route path="/admin/estetica/servicios" element={<div>Lista de servicios</div>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
const montar = () => render(<PlanillaServiciosPage area={AREA} />, { wrapper: Envoltorio });

const archivo = (nombre = "servicios.xlsx") => new File(["x"], nombre);
const soltar = (f: File) => fireEvent.drop(screen.getByTestId("zona-planilla"), { dataTransfer: { files: [f] } });
const llamadasA = (frag: string) => apiFetch.mock.calls.filter(([u]) => String(u).includes(frag));

describe("PlanillaServiciosPage", () => {
  it("sin permiso (operator) dice que no puede usarla", () => {
    rol = "operator";
    montar();
    expect(screen.getByText("No tenés permiso para usar la planilla")).toBeTruthy();
  });

  it("un .csv no se acepta", async () => {
    montar();
    soltar(archivo("servicios.csv"));
    expect(await screen.findByText("Sólo se aceptan archivos .xlsx")).toBeTruthy();
    expect(leerLibro).not.toHaveBeenCalled();
    expect(llamadasA("/previsualizar")).toHaveLength(0);
  });

  it("una planilla de otra área da el error con las dos áreas", async () => {
    leerLibro.mockResolvedValue({ ...LEIDO, area: "Masajes y Bienestar" });
    montar();
    soltar(archivo());
    expect(await screen.findByText("Esta planilla es de «Masajes y Bienestar», no de «Estética»")).toBeTruthy();
    expect(llamadasA("/previsualizar")).toHaveLength(0);
  });

  it("un archivo ilegible muestra el error de leerLibro", async () => {
    leerLibro.mockResolvedValue({ error: "Falta la pestaña «Insumos»" });
    montar();
    soltar(archivo());
    expect(await screen.findByText("Falta la pestaña «Insumos»")).toBeTruthy();
  });

  it("con un error, los muestra en la lista y Guardar queda deshabilitado", async () => {
    respuestaPrevia = conError();
    montar();
    soltar(archivo());
    expect(await screen.findByText(/El precio efectivo no puede quedar vacío/)).toBeTruthy();
    expect(screen.getByText(/Servicios · fila 4/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Guardar" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("sin errores: muestra el antes/después y el aviso de combos; Guardar confirma y llama a aplicar", async () => {
    montar();
    soltar(archivo());
    expect(await screen.findByText("Limpieza facial")).toBeTruthy();
    expect(screen.getByText("Precio lista")).toBeTruthy();
    expect(screen.getByText("45000")).toBeTruthy();
    expect(screen.getByText("50000")).toBeTruthy();
    expect(screen.getByText(/Este combo incluye servicios que cambian de precio y no se actualizan solos/)).toBeTruthy();
    expect(screen.getByText("Combo verano")).toBeTruthy();

    const guardar = screen.getByRole("button", { name: "Guardar" }) as HTMLButtonElement;
    expect(guardar.disabled).toBe(false);
    fireEvent.click(guardar);
    expect(screen.getByText(/Se van a guardar 1 cambio\. Lo que borraste de la planilla no se borra del sistema\./)).toBeTruthy();
    expect(llamadasA("/aplicar")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(llamadasA("/aplicar")).toHaveLength(1));
    expect(JSON.parse(llamadasA("/aplicar")[0][2].body)).toEqual({ area: "Estética", original: CONTENIDO, editada: CONTENIDO });
    expect(await screen.findByText("Lista de servicios")).toBeTruthy();
  });

  it("un nombre que ya usa otro servicio muestra el cartel de aviso y deja guardar igual", async () => {
    respuestaPrevia = {
      ...conCambio(),
      avisos: [{ pestana: "Servicios", fila: 7, mensaje: "Ya existe un servicio llamado «Peeling» (está en Medicina y Dermatología)." }],
    };
    montar();
    soltar(archivo());
    expect(await screen.findByText(/Ya existe un servicio llamado «Peeling»/)).toBeTruthy();
    expect(screen.getByText(/Servicios · fila 7/)).toBeTruthy();
    expect(screen.getByText(/Revisá antes de guardar/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Guardar" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("muestra por servicio las máquinas a agregar y el aviso de máquina nueva", async () => {
    respuestaPrevia = {
      ...vacia(),
      maquinas: [
        { fila: 2, servicio: "Sesión 1 ESTÍMULO", maquina: "Botas de Presoterapia", nueva: false },
        { fila: 3, servicio: "Sesión 1 ESTÍMULO", maquina: "Electrodos Térmicos", nueva: true },
      ],
      avisos: [{ pestana: "Máquinas", fila: 3, mensaje: "Máquina nueva: Electrodos Térmicos" }],
      resumen: { serviciosNuevos: 0, serviciosModificados: 0, acuerdos: 0, insumos: 0, categorias: 0, maquinas: 2 },
    };
    montar();
    soltar(archivo());
    expect(await screen.findByText("Sesión 1 ESTÍMULO: Botas de Presoterapia, Electrodos Térmicos (nueva)")).toBeTruthy();
    expect(screen.getByText(/Máquinas · fila 3 · Máquina nueva: Electrodos Térmicos/)).toBeTruthy();
    expect(screen.getByText(/2 máquinas/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Guardar" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("sin cambios dice 'La planilla no tiene cambios' y no deja guardar", async () => {
    respuestaPrevia = vacia();
    montar();
    soltar(archivo());
    expect(await screen.findByText("La planilla no tiene cambios")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Guardar" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("un 400 con errores al aplicar reemplaza la vista previa con esos errores", async () => {
    apiFetch.mockImplementation(async (url: string) => {
      if (url.includes("/previsualizar")) return respuestaPrevia;
      throw new ApiError(400, "La planilla tiene errores", {
        error: "x", errores: [{ pestana: "Proveedoras", fila: 3, mensaje: "No existe esa proveedora" }],
      });
    });
    montar();
    soltar(archivo());
    await screen.findByText("Limpieza facial");
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText(/No existe esa proveedora/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Guardar" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("entrada desde Servicios", () => {
  const MontarServicios = () => (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider>
        <MemoryRouter>
          <ServiciosAdminPage area="Estética" />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  );

  it("el link 'Planilla Excel' aparece para manager", async () => {
    render(<MontarServicios />);
    const link = await screen.findByRole("link", { name: "Planilla Excel" });
    expect(link.getAttribute("href")).toBe("/planilla");
  });

  it("no aparece para operator", async () => {
    rol = "operator";
    render(<MontarServicios />);
    await screen.findByPlaceholderText(/Buscar/);
    expect(screen.queryByRole("link", { name: "Planilla Excel" })).toBeNull();
  });
});
