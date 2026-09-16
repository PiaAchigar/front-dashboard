import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAgendarHandoff } from "./agendar-handoff";

const CRM_ORIGIN = "https://crm.piubella.test";

beforeEach(() => vi.stubEnv("VITE_CRM_URL", `${CRM_ORIGIN}/`));
afterEach(() => vi.unstubAllEnvs());

function App() {
  useAgendarHandoff();
  return (
    <Routes>
      <Route path="/crm" element={<p>pantalla CRM</p>} />
      <Route path="/agenda" element={<p>pantalla agenda</p>} />
    </Routes>
  );
}

/** Un postMessage como el que manda el iframe, con su origin. */
function mandar(data: unknown, origin = CRM_ORIGIN) {
  window.dispatchEvent(new MessageEvent("message", { data, origin }));
}

describe("useAgendarHandoff", () => {
  it("abre la agenda cuando el CRM lo pide", async () => {
    render(
      <MemoryRouter initialEntries={["/crm"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByText("pantalla CRM")).toBeInTheDocument();

    mandar({ type: "piubella:crm:agendar", customerId: "c1", serviceId: "s1" });

    expect(await screen.findByText("pantalla agenda")).toBeInTheDocument();
  });

  it("ignora el mensaje que viene de otro origin", () => {
    render(
      <MemoryRouter initialEntries={["/crm"]}>
        <App />
      </MemoryRouter>,
    );

    mandar({ type: "piubella:crm:agendar" }, "https://cualquier-cosa.test");

    expect(screen.getByText("pantalla CRM")).toBeInTheDocument();
  });

  it("ignora un mensaje que no es el suyo", () => {
    render(
      <MemoryRouter initialEntries={["/crm"]}>
        <App />
      </MemoryRouter>,
    );

    mandar({ type: "piubella:crm:ready" });

    expect(screen.getByText("pantalla CRM")).toBeInTheDocument();
  });

  it("sin VITE_CRM_URL no escucha a nadie", () => {
    // Un origin vacío aceptaría cualquier mensaje: antes de navegar por algo
    // que no se puede verificar, mejor no hacer nada.
    vi.stubEnv("VITE_CRM_URL", "");
    render(
      <MemoryRouter initialEntries={["/crm"]}>
        <App />
      </MemoryRouter>,
    );

    mandar({ type: "piubella:crm:agendar" });

    expect(screen.getByText("pantalla CRM")).toBeInTheDocument();
  });
});
