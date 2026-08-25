import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ToastProvider } from "../../components/ui/Toast";
import { CombosAdminPage } from "./CombosAdminPage";

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({
    role: "admin",
    session: { access_token: "test-token" },
    user: null,
    loading: false,
    signOut: vi.fn(),
  }),
}));

function makeFetchMock() {
  return vi.fn(async (url: RequestInfo | URL) => {
    const u = String(url);
    if (u.includes("/api/agenda/combos/admin")) {
      return { ok: true, json: async () => [] };
    }
    if (u.includes("/api/agenda/services")) {
      return { ok: true, json: async () => [] };
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
      <MemoryRouter>
        <ToastProvider>{children}</ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", makeFetchMock());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CombosAdminPage", () => {
  it("avisa que los combos se arman con servicios ya cargados", async () => {
    render(<CombosAdminPage />, { wrapper });
    expect(await screen.findByText(/se arma con servicios y actividades que ya estén cargados/i))
      .toBeInTheDocument();
    expect(screen.getByRole("link", { name: /servicios/i })).toHaveAttribute("href", "/admin/servicios");
  });
});
