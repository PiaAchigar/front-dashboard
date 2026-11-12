import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn();
const ding = vi.fn();
vi.mock("../lib/api-client", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock("../auth/AuthContext", () => ({ useAuth: () => ({ session: { access_token: "tok" } }) }));
vi.mock("../lib/avisos", async (orig) => ({ ...(await orig<typeof import("../lib/avisos")>()), sonarDing: () => ding() }));

import { AvisosProvider, useAvisosEstado } from "../lib/avisos-context";
import { useAvisosDeMensajes } from "./useAvisosDeMensajes";

const msg = (id: string, conv = "c1") => ({ id, conversationId: conv, contactName: "Ana", content: "hola", createdAt: "2026-11-12T10:00:00Z" });
const wrapper = ({ children }: { children: ReactNode }) => <AvisosProvider>{children}</AvisosProvider>;

function montar(habilitado = true) {
  return renderHook(() => ({ av: useAvisosDeMensajes(habilitado), est: useAvisosEstado() }), { wrapper });
}
const tick = () => act(async () => { await vi.advanceTimersByTimeAsync(10_000); });

beforeEach(() => { vi.useFakeTimers(); apiFetch.mockReset(); ding.mockReset(); localStorage.clear(); });
afterEach(() => vi.useRealTimers());

describe("useAvisosDeMensajes", () => {
  it("primera llamada sin desde; después usa el último hasta cada 10 s", async () => {
    apiFetch.mockResolvedValueOnce({ mensajes: [], hasta: "H0" }).mockResolvedValue({ mensajes: [], hasta: "H0" });
    montar();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(apiFetch.mock.calls[0][0]).toBe("/api/crm/conversations/avisos");
    expect(apiFetch.mock.calls[0][1]).toBe("tok");
    await tick();
    expect(apiFetch.mock.calls[1][0]).toBe("/api/crm/conversations/avisos?desde=H0");
  });

  it("no consulta si no tiene permiso", async () => {
    montar(false);
    await tick();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("muestra aviso y suena cuando llegan mensajes", async () => {
    apiFetch.mockResolvedValueOnce({ mensajes: [], hasta: "H0" }).mockResolvedValueOnce({ mensajes: [msg("1")], hasta: "H1" });
    const { result } = montar();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await tick();
    expect(result.current.av.aviso).toEqual({ texto: "💬 Ana: hola", conversationId: "c1" });
    expect(ding).toHaveBeenCalledTimes(1);
    act(() => result.current.av.cerrar());
    expect(result.current.av.aviso).toBeNull();
  });

  it("silenciado: no avisa ni suena, pero avanza hasta", async () => {
    localStorage.setItem("piubella:avisos-silenciados", "1");
    apiFetch.mockResolvedValueOnce({ mensajes: [], hasta: "H0" }).mockResolvedValueOnce({ mensajes: [msg("1")], hasta: "H1" }).mockResolvedValue({ mensajes: [], hasta: "H1" });
    const { result } = montar();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await tick();
    expect(result.current.av.aviso).toBeNull();
    expect(ding).not.toHaveBeenCalled();
    await tick();
    expect(apiFetch.mock.calls[2][0]).toBe("/api/crm/conversations/avisos?desde=H1");
  });

  it("no avisa si todos los mensajes son de la conversación abierta", async () => {
    apiFetch.mockResolvedValueOnce({ mensajes: [], hasta: "H0" }).mockResolvedValueOnce({ mensajes: [msg("1", "c9")], hasta: "H1" });
    const { result } = montar();
    act(() => result.current.est.setViendo("c9"));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await tick();
    expect(result.current.av.aviso).toBeNull();
    expect(ding).not.toHaveBeenCalled();
  });

  it("avisa si hay mensajes de otra conversación además de la abierta", async () => {
    apiFetch.mockResolvedValueOnce({ mensajes: [], hasta: "H0" }).mockResolvedValueOnce({ mensajes: [msg("1", "c9"), msg("2", "c2")], hasta: "H1" });
    const { result } = montar();
    act(() => result.current.est.setViendo("c9"));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await tick();
    expect(result.current.av.aviso).not.toBeNull();
  });

  it("un error de red no corta el polling", async () => {
    apiFetch.mockRejectedValueOnce(new Error("red")).mockResolvedValue({ mensajes: [], hasta: "H0" });
    montar();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await tick();
    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(apiFetch.mock.calls[1][0]).toBe("/api/crm/conversations/avisos");
  });
});
