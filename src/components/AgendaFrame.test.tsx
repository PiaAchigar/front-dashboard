import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tomarAgendarPendiente, useAgendarHandoff } from "../lib/agendar-handoff";

const AGENDA_URL = "https://agenda.piubella.test";
const CRM_ORIGIN = "https://crm.piubella.test";

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    session: { access_token: "tok" },
    user: null,
    role: "admin",
    loading: false,
    signOut: vi.fn(),
  }),
}));

// `AgendaFrame` lee `VITE_AGENDA_URL` como const de MÓDULO (igual que
// `BillerFrame`): hay que stubearla ANTES de importar el componente, o el
// valor queda congelado en `undefined` desde antes de que corra el primer
// test (mismo motivo por el que `agendar-handoff.ts` lee `VITE_CRM_URL`
// adentro del hook y no a nivel de módulo).
vi.stubEnv("VITE_AGENDA_URL", AGENDA_URL);
const { AgendaFrame } = await import("./AgendaFrame");

/** El mismo hook que usa el dashboard de verdad para escuchar al CRM. */
function Escucha() {
  useAgendarHandoff();
  return null;
}

function mandar(data: unknown, origin = CRM_ORIGIN) {
  window.dispatchEvent(new MessageEvent("message", { data, origin }));
}

/**
 * Deja un pedido pendiente en el módulo, tal como lo hace `useAgendarHandoff`
 * cuando el mensaje del CRM llega de verdad — así `AgendaFrame` se prueba con
 * el dato ya puesto, sin reimplementar el parseo del mensaje (eso ya lo
 * prueba `agendar-handoff.test.tsx`).
 */
function dejarPendiente(data: unknown) {
  const { unmount } = render(
    <MemoryRouter initialEntries={["/crm"]}>
      <Escucha />
    </MemoryRouter>,
  );
  mandar(data);
  unmount();
}

function src(): string | null {
  return screen.getByTitle("Agenda").getAttribute("src");
}

beforeEach(() => {
  vi.stubEnv("VITE_CRM_URL", `${CRM_ORIGIN}/`);
});

afterEach(() => {
  // No `vi.unstubAllEnvs()`: se llevaría puesta `VITE_AGENDA_URL`, que sólo
  // se lee una vez al importar (arriba) y no se vuelve a stubear.
  tomarAgendarPendiente();
});

describe("AgendaFrame — el handoff de \"A agendar\" del CRM", () => {
  it("sin ningún pedido pendiente, abre la raíz de siempre", () => {
    render(<AgendaFrame />);
    expect(src()).toBe(`${AGENDA_URL}/?embed=1`);
  });

  it("con un servicio pendiente, abre \"/dia\" con customerId y serviceId", () => {
    dejarPendiente({ type: "piubella:crm:agendar", customerId: "cu1", serviceId: "svc-full" });
    render(<AgendaFrame />);
    expect(src()).toBe(`${AGENDA_URL}/dia?embed=1&customerId=cu1&serviceId=svc-full`);
  });

  it("con una línea de depilación pendiente, abre \"/dia\" con customerId y purchaseServiceId — no serviceId", () => {
    dejarPendiente({ type: "piubella:crm:agendar", customerId: "cu1", purchaseServiceId: "cps-depi-1" });
    render(<AgendaFrame />);
    expect(src()).toBe(`${AGENDA_URL}/dia?embed=1&customerId=cu1&purchaseServiceId=cps-depi-1`);
  });

  it("se consume una sola vez: un segundo montaje ya no lo repite", () => {
    dejarPendiente({ type: "piubella:crm:agendar", customerId: "cu1", serviceId: "svc-full" });

    const primero = render(<AgendaFrame />);
    expect(src()).toContain("serviceId=svc-full");
    primero.unmount();

    render(<AgendaFrame />);
    expect(src()).toBe(`${AGENDA_URL}/?embed=1`);
  });
});
