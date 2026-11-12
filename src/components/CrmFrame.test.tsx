import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const CRM_URL = "https://crm.piubella.test";
vi.mock("../auth/AuthContext", () => ({ useAuth: () => ({ session: { access_token: "tok" } }) }));
vi.stubEnv("VITE_CRM_URL", CRM_URL);
const { CrmFrame } = await import("./CrmFrame");
const { AvisosProvider, useAvisosEstado } = await import("../lib/avisos-context");

let estado: ReturnType<typeof useAvisosEstado>;
function Espia() { estado = useAvisosEstado(); return null; }

function montar(ruta = "/crm") {
  const r = render(
    <MemoryRouter initialEntries={[ruta]}>
      <AvisosProvider><Espia /><CrmFrame /></AvisosProvider>
    </MemoryRouter>,
  );
  const iframe = r.container.querySelector("iframe")!;
  const enviados: unknown[] = [];
  Object.defineProperty(iframe, "contentWindow", {
    value: { postMessage: (d: unknown, o: string) => enviados.push([d, o]) },
  });
  return { ...r, iframe, enviados };
}
const recibir = (data: unknown, origin = CRM_URL) =>
  act(() => { window.dispatchEvent(new MessageEvent("message", { data, origin })); });
import { act } from "@testing-library/react";

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("CrmFrame - avisos", () => {
  it("pasa ?conversacion= al iframe", () => {
    expect(montar("/crm?conversacion=abc").iframe.getAttribute("src")).toBe(`${CRM_URL}/inbox?embed=1&conversacion=abc`);
  });
  it("sin conversacion mantiene el src de siempre", () => {
    expect(montar("/crm").iframe.getAttribute("src")).toBe(`${CRM_URL}/?embed=1`);
  });
  it("manda el estado de silencio después del ready y en cada cambio", () => {
    const { enviados } = montar();
    recibir({ type: "piubella:crm:ready" });
    expect(enviados).toContainEqual([{ type: "piubella:crm:avisos-estado", silenciado: false }, CRM_URL]);
    act(() => estado.setSilenciado(true));
    expect(enviados).toContainEqual([{ type: "piubella:crm:avisos-estado", silenciado: true }, CRM_URL]);
  });
  it("avisos-silenciar guarda el estado", () => {
    montar();
    recibir({ type: "piubella:crm:avisos-silenciar", silenciado: true });
    expect(estado.silenciado).toBe(true);
    expect(localStorage.getItem("piubella:avisos-silenciados")).toBe("1");
  });
  it("viendo actualiza la conversación abierta y se limpia al desmontar", () => {
    const { unmount } = montar();
    recibir({ type: "piubella:crm:viendo", conversationId: "c7" });
    expect(estado.viendo).toBe("c7");
    unmount();
  });
  it("ignora mensajes de otro origin", () => {
    montar();
    recibir({ type: "piubella:crm:avisos-silenciar", silenciado: true }, "https://evil.test");
    recibir({ type: "piubella:crm:viendo", conversationId: "x" }, "https://evil.test");
    expect(estado.silenciado).toBe(false);
    expect(estado.viendo).toBeNull();
  });
});
