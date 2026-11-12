import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useNavigate } from "react-router-dom";

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
let irA: (to: string) => void = () => {};
function Nav() { const n = useNavigate(); irA = (to) => n(to); return null; }
function montarConNavegacion(ruta: string) {
  const r = render(
    <MemoryRouter initialEntries={[ruta]}>
      <AvisosProvider><Nav /><CrmFrame /></AvisosProvider>
    </MemoryRouter>,
  );
  const iframe = r.container.querySelector("iframe")!;
  const enviados: any[] = [];
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

  it("avisos-pedir-estado responde con el estado actual", () => {
    const { enviados } = montar();
    recibir({ type: "piubella:crm:avisos-pedir-estado" });
    expect(enviados).toContainEqual([{ type: "piubella:crm:avisos-estado", silenciado: false }, CRM_URL]);
  });
  it("pedir-estado de otro origin se ignora", () => {
    const { enviados } = montar();
    recibir({ type: "piubella:crm:avisos-pedir-estado" }, "https://evil.test");
    expect(enviados).toHaveLength(0);
  });
  it("si ?conversacion= cambia con el CRM ya abierto, manda abrir al iframe", () => {
    const { enviados } = montarConNavegacion("/crm");
    recibir({ type: "piubella:crm:ready" });
    act(() => irA("/crm?conversacion=zzz"));
    expect(enviados).toContainEqual([{ type: "piubella:crm:abrir", conversationId: "zzz" }, CRM_URL]);
  });
  it("no manda abrir por la conversación inicial", () => {
    const { enviados } = montarConNavegacion("/crm?conversacion=abc");
    recibir({ type: "piubella:crm:ready" });
    expect(enviados.some(([d]: any) => d.type === "piubella:crm:abrir")).toBe(false);
  });
});
