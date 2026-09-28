import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ProveedorasAdminPage } from "./ProveedorasAdminPage";
import { ToastProvider } from "../../components/ui/Toast";
import type { ProviderAdmin, ServiceAgreement } from "../../lib/api-types";

// Mutable para poder probar con distintos roles sin re-declarar el mock por test.
let mockRole = "admin";

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({
    role: mockRole,
    session: { access_token: "test-token" },
    user: null,
    loading: false,
    signOut: vi.fn(),
  }),
}));

const ANCLA = "svc-depilacion";

const ROMINA: ProviderAdmin = {
  id: "p1",
  fullName: "Romina",
  email: null,
  phone: null,
  dni: null,
  cuit: null,
  specialties: null,
  notes: null,
  address: null,
  postalCode: null,
  status: "active",
};

// ── Estado mutable del backend falso ────────────────────────────────────────
let providers: ProviderAdmin[] = [];
let acuerdosDelAncla: ServiceAgreement[] = [];
let anchorServiceId: string | null = ANCLA;

function mockAcuerdosDelAncla(lista: ServiceAgreement[]) {
  acuerdosDelAncla = lista;
}

function ok(data: unknown) {
  return { ok: true, json: async () => data };
}

beforeEach(() => {
  providers = [ROMINA];
  acuerdosDelAncla = [];
  anchorServiceId = ANCLA;

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("/providers/all")) return ok(providers);
      if (url.includes("/providers/") && url.includes("/services")) return ok([]);
      if (url.includes("/providers/") && url.includes("/mp-accounts")) return ok([]);
      if (url.includes("/depilacion/config")) {
        return ok({
          // La pantalla de ficha sólo necesita `anchorServiceId`: el resto de
          // la aritmética de precios no le incumbe.
          anchorServiceId,
          sesionesEsperandoTurno: 0,
        });
      }
      if (url.includes(`/services/${ANCLA}/agreements`)) return ok(acuerdosDelAncla);
      return ok({});
    }),
  );
});

afterEach(() => {
  mockRole = "admin";
  vi.unstubAllGlobals();
});

function Wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <MemoryRouter>{children}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

describe("ProveedorasAdminPage — ficha, comisión de depilación", () => {
  it("muestra la comisión de depilación con link a donde se edita", async () => {
    const user = userEvent.setup();
    mockAcuerdosDelAncla([
      { serviceProviderId: "p1", providerName: "Romina", paymentType: "fixed_per_service", rate: 20000 },
    ]);
    render(<ProveedorasAdminPage />, { wrapper: Wrapper });
    await user.click(await screen.findByText("Romina"));

    expect(await screen.findByText(/Depilación Definitiva/)).toBeInTheDocument();
    // Mismo texto que produce `traduccionDeTarifa` en la pantalla de Comisión:
    // los dos lugares tienen que decir lo mismo del mismo acuerdo.
    expect(screen.getByText(/Cada sesión paga \$20\.000, dure lo que dure\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Configuración/i })).toHaveAttribute(
      "href",
      "/admin/depilacion/configuracion/comision",
    );
  });

  it("no muestra nada si esa proveedora no hace depilación", async () => {
    const user = userEvent.setup();
    mockAcuerdosDelAncla([]);
    render(<ProveedorasAdminPage />, { wrapper: Wrapper });
    await user.click(await screen.findByText("Romina"));

    expect(screen.queryByText(/Depilación Definitiva/)).not.toBeInTheDocument();
  });

  it("no muestra nada si el ancla no está configurada", async () => {
    const user = userEvent.setup();
    anchorServiceId = null;
    mockAcuerdosDelAncla([
      { serviceProviderId: "p1", providerName: "Romina", paymentType: "fixed_per_service", rate: 20000 },
    ]);
    render(<ProveedorasAdminPage />, { wrapper: Wrapper });
    await user.click(await screen.findByText("Romina"));

    expect(screen.queryByText(/Depilación Definitiva/)).not.toBeInTheDocument();
  });

  it("un monto o tipo de pago inválido no rompe la ficha, y no traduce cualquier cosa", async () => {
    const user = userEvent.setup();
    mockAcuerdosDelAncla([
      { serviceProviderId: "p1", providerName: "Romina", paymentType: "percentage", rate: 20 },
    ]);
    render(<ProveedorasAdminPage />, { wrapper: Wrapper });
    await user.click(await screen.findByText("Romina"));

    // La fila igual aparece (está habilitada), pero no hay traducción a plata
    // para un tipo de pago que en depilación no existe.
    expect(await screen.findByText(/Depilación Definitiva/)).toBeInTheDocument();
    expect(screen.queryByText(/\$20/)).not.toBeInTheDocument();
  });

  it("el link a Configuración no aparece para quien no puede editar el catálogo", async () => {
    const user = userEvent.setup();
    mockRole = "operator";
    mockAcuerdosDelAncla([
      { serviceProviderId: "p1", providerName: "Romina", paymentType: "fixed_per_service", rate: 20000 },
    ]);
    render(<ProveedorasAdminPage />, { wrapper: Wrapper });
    await user.click(await screen.findByText("Romina"));

    // El dato se muestra igual: sólo lectura no es lo mismo que invisible.
    expect(await screen.findByText(/Depilación Definitiva/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Configuración/i })).not.toBeInTheDocument();
  });
});
