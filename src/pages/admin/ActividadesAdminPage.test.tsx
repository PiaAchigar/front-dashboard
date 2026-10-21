import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActividadesAdminPage } from "./ActividadesAdminPage";
import { ToastProvider } from "../../components/ui/Toast";

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({
    role: "admin",
    session: { access_token: "test-token" },
    user: null,
    loading: false,
    signOut: vi.fn(),
  }),
}));

let llamadas: { url: string; method: string; body?: Record<string, unknown> }[] = [];
const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => data });

beforeEach(() => {
  llamadas = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      llamadas.push({ url, method, body: init?.body ? JSON.parse(init.body as string) : undefined });
      if (/\/api\/activities(\?.*)?$/.test(url) && method === "GET") return ok({ success: true, data: [] });
      return ok({ success: true, data: {} });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("ActividadesAdminPage", () => {
  it("el drawer de actividad ya no pide proveedora y el alta no manda serviceProviderId", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ToastProvider>
          <MemoryRouter>
            <ActividadesAdminPage />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>,
    );
    await user.click(await screen.findByRole("button", { name: "+ Agregar" }));
    // El formulario se dibuja recién cuando termina de cargar la lista.
    const nombre = await screen.findByPlaceholderText("Pilates, Yoga, etc.");
    expect(screen.queryByText(/Proveedora/)).toBeNull();

    await user.type(nombre, "ZZ Yoga");
    await user.clear(screen.getByPlaceholderText("4"));
    await user.type(screen.getByPlaceholderText("4"), "8");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(llamadas.some((l) => l.method === "POST")).toBe(true));
    const post = llamadas.find((l) => l.method === "POST")!;
    expect(post.url).toContain("/api/activities");
    expect(post.body).not.toHaveProperty("serviceProviderId");
    expect(post.body).toMatchObject({ name: "ZZ Yoga", activityType: "class", classesPerMonth: 8 });
  });
});
