import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ToastProvider } from "../../components/ui/Toast";
import { DescripcionesCategoriasPage } from "./DescripcionesCategoriasPage";

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({
    role: "admin",
    session: { access_token: "test-token" },
    user: null,
    loading: false,
    signOut: vi.fn(),
  }),
}));

const nodo = (id: string, name: string, webDescription: string | null, children: unknown[] = []) => ({
  id,
  name,
  description: "nota interna",
  webDescription,
  displayOrder: 0,
  isActive: true,
  kind: "tecnica",
  children,
});

const ARBOL = [
  nodo("b", "Belleza", null, [nodo("c", "Cejas", "Ya tiene texto")]),
  nodo("m", "Masajes", null),
  nodo("e", "Estética Corporal", null),
];
const SERVICIOS = [
  { id: "s1", isVisible: true, categories: [{ id: "c", name: "Cejas" }] },
  { id: "s2", isVisible: true, categories: [{ id: "m", name: "Masajes" }] },
  { id: "s3", isVisible: true, categories: [{ id: "e", name: "Estética Corporal" }] },
];

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url);
    if (init?.method === "PATCH") return { ok: true, json: async () => ({}) };
    if (u.includes("/api/agenda/categories")) return { ok: true, json: async () => ARBOL };
    if (u.includes("/api/agenda/services")) return { ok: true, json: async () => SERVICIOS };
    return { ok: true, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

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

const patches = () =>
  fetchMock.mock.calls.filter(([, init]) => (init as RequestInit)?.method === "PATCH");

describe("DescripcionesCategoriasPage", () => {
  it("elegir una categoría muestra su descripción, no la nota interna", async () => {
    const user = userEvent.setup();
    render(<DescripcionesCategoriasPage />, { wrapper });
    await user.click(await screen.findByRole("button", { name: /Belleza › Cejas/ }));
    expect(screen.getByLabelText(/Descripción/)).toHaveValue("Ya tiene texto");
    expect(screen.queryByDisplayValue("nota interna")).not.toBeInTheDocument();
  });

  it("el buscador encuentra por cualquier parte de la ruta, sin importar los acentos", async () => {
    const user = userEvent.setup();
    render(<DescripcionesCategoriasPage />, { wrapper });
    await screen.findByRole("button", { name: /Masajes/ });
    await user.type(screen.getByPlaceholderText(/Buscar categoría/), "cejas");
    expect(screen.getByRole("button", { name: /Belleza › Cejas/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Masajes/ })).not.toBeInTheDocument();

    await user.clear(screen.getByPlaceholderText(/Buscar categoría/));
    await user.type(screen.getByPlaceholderText(/Buscar categoría/), "estetica");
    expect(screen.getByRole("button", { name: /Estética Corporal/ })).toBeInTheDocument();
  });

  it("guardar manda el texto a la categoría elegida", async () => {
    const user = userEvent.setup();
    render(<DescripcionesCategoriasPage />, { wrapper });
    await user.click(await screen.findByRole("button", { name: /Masajes/ }));
    await user.type(screen.getByLabelText(/Descripción/), "Para relajar");
    await user.click(screen.getByRole("button", { name: "Guardar descripción" }));

    await waitFor(() => expect(patches()).toHaveLength(1));
    const [url, init] = patches()[0]!;
    expect(String(url)).toContain("/api/agenda/categories/m/descripcion-web");
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ webDescription: "Para relajar" });
  });

  it("cambiar de categoría a mitad de escribir no pierde lo escrito", async () => {
    const user = userEvent.setup();
    render(<DescripcionesCategoriasPage />, { wrapper });
    await user.click(await screen.findByRole("button", { name: /Masajes/ }));
    await user.type(screen.getByLabelText(/Descripción/), "Borrador");
    await user.click(screen.getByRole("button", { name: /Belleza › Cejas/ }));
    await user.click(screen.getByRole("button", { name: /Masajes/ }));
    expect(screen.getByLabelText(/Descripción/)).toHaveValue("Borrador");
  });

  it("sin cambios no se puede guardar", async () => {
    const user = userEvent.setup();
    render(<DescripcionesCategoriasPage />, { wrapper });
    await user.click(await screen.findByRole("button", { name: /Belleza › Cejas/ }));
    expect(screen.getByRole("button", { name: "Guardar descripción" })).toBeDisabled();
  });
});
