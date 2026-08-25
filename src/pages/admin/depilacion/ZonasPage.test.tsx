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
  it("agrupa las zonas por categoría y muestra el conteo", async () => {
    render(<ZonasPage />, { wrapper });
    expect(await screen.findByText("Grande")).toBeInTheDocument();
    expect(screen.getByText("Pierna entera")).toBeInTheDocument();
  });

  it("muestra las exclusiones de cada zona", async () => {
    render(<ZonasPage />, { wrapper });
    expect(await screen.findByText(/no se combina con Media pierna/i)).toBeInTheDocument();
  });

  it("no muestra el botón Agregar para operator (manage, no edit)", async () => {
    mockRole = "operator";
    render(<ZonasPage />, { wrapper });
    expect(await screen.findByText("Grande")).toBeInTheDocument();
    expect(screen.queryByText("Agregar")).not.toBeInTheDocument();
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
