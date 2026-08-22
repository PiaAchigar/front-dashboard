import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ToastProvider } from "../../../components/ui/Toast";
import { ZonasPage } from "./ZonasPage";
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
});
