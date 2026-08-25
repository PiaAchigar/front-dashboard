import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ToastProvider } from "../../../components/ui/Toast";
import { ZonasPage } from "./ZonasPage";
import type { ZonasPorCategoria } from "../../../lib/api-types";

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

const ZONAS: ZonasPorCategoria = {
  grande: [
    {
      id: "z1",
      name: "Pierna entera",
      category: "grande",
      displayOrder: 1,
      isActive: true,
      exclusions: ["z2"],
    },
    {
      id: "z2",
      name: "Media pierna",
      category: "grande",
      displayOrder: 2,
      isActive: true,
      exclusions: ["z1"],
    },
  ],
  mediana: [
    {
      id: "z3",
      name: "Axilas",
      category: "mediana",
      displayOrder: 1,
      isActive: true,
      exclusions: [],
    },
  ],
  chica: [
    { id: "z4", name: "Bozo", category: "chica", displayOrder: 1, isActive: true, exclusions: [] },
  ],
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

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ZONAS,
    })),
  );
});

afterEach(() => {
  mockRole = "admin";
});

describe("ZonasPage", () => {
  it("agrupa las zonas por categoría y muestra el conteo de cada una", async () => {
    render(<ZonasPage />, { wrapper });
    expect(await screen.findByRole("button", { name: /Grande/ })).toHaveTextContent("(2)");
    expect(screen.getByRole("button", { name: /Mediana/ })).toHaveTextContent("(1)");
    expect(screen.getByRole("button", { name: /Chica/ })).toHaveTextContent("(1)");
  });

  it("colapsar una categoría esconde sus zonas y deja las otras", async () => {
    const user = userEvent.setup();
    render(<ZonasPage />, { wrapper });

    // "Pierna entera" aparece dos veces: como zona y como exclusión de Media
    // pierna. Las dos están dentro de la sección Grande, así que colapsarla
    // se las lleva a ambas.
    expect(await screen.findAllByText("Pierna entera")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: /Grande/ }));

    expect(screen.queryByText("Pierna entera")).not.toBeInTheDocument();
    expect(screen.getByText("Axilas")).toBeInTheDocument();
  });

  it("muestra las exclusiones de cada zona, bajo su propia columna", async () => {
    render(<ZonasPage />, { wrapper });
    // Esperar a una fila, no al encabezado: el <thead> se pinta también
    // mientras carga, así que buscarlo a él deja pasar el assert con la tabla
    // todavía vacía.
    expect(await screen.findByRole("button", { name: /Grande/ })).toBeInTheDocument();
    // El "no se combina con" vive en el encabezado, no repetido en cada celda.
    expect(screen.getByText("No se combina con")).toBeInTheDocument();
    // "Media pierna" aparece dos veces: como zona y como exclusión de Pierna
    // entera. Que sean 2 es justamente lo que prueba que la celda se llenó.
    expect(screen.getAllByText("Media pierna")).toHaveLength(2);
    // Bozo no excluye a nadie.
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("el buscador filtra por nombre y también por el de las exclusiones", async () => {
    const user = userEvent.setup();
    render(<ZonasPage />, { wrapper });

    await user.type(await screen.findByPlaceholderText(/Buscar zona/i), "Bozo");
    expect(screen.getByText("Bozo")).toBeInTheDocument();
    expect(screen.queryByText("Axilas")).not.toBeInTheDocument();

    await user.clear(screen.getByPlaceholderText(/Buscar zona/i));
    // "Media pierna" no está en el nombre de Pierna entera, pero sí en sus
    // exclusiones: buscar una tiene que traer la otra.
    await user.type(screen.getByPlaceholderText(/Buscar zona/i), "Media pierna");
    expect(screen.getByRole("button", { name: /Grande/ })).toHaveTextContent("(2)");
    expect(screen.queryByText("Axilas")).not.toBeInTheDocument();
  });

  it("no muestra el botón Agregar para operator (manage, no edit)", async () => {
    mockRole = "operator";
    render(<ZonasPage />, { wrapper });
    expect(await screen.findByRole("button", { name: /Grande/ })).toBeInTheDocument();
    expect(screen.queryByText("Agregar")).not.toBeInTheDocument();
  });

  it("el borrado definitivo es solo para admin", async () => {
    const { unmount } = render(<ZonasPage />, { wrapper });
    expect(await screen.findAllByTitle("Eliminar definitivamente")).not.toHaveLength(0);
    unmount();

    mockRole = "operator";
    render(<ZonasPage />, { wrapper });
    expect(await screen.findByRole("button", { name: /Grande/ })).toBeInTheDocument();
    expect(screen.queryByTitle("Eliminar definitivamente")).not.toBeInTheDocument();
  });

  it("rechaza un orden que no es un entero, sin llamar a la API", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);
    render(<ZonasPage />, { wrapper });

    await user.click(await screen.findByText("Agregar"));
    await user.type(screen.getByLabelText("Nombre *"), "Rodillas");
    const ordenInput = screen.getByLabelText("Orden");
    await user.clear(ordenInput);
    await user.type(ordenInput, "abc");
    const callsAntes = fetchMock.mock.calls.length;

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(
      await screen.findByText("El orden debe ser un número entero mayor o igual a 0."),
    ).toBeInTheDocument();
    // Ni POST /zonas ni PUT /exclusiones: se cortó antes de tocar la red.
    expect(fetchMock.mock.calls.length).toBe(callsAntes);
  });
});
