import { afterEach, describe, expect, it, vi } from "vitest";
import { guardarSilenciado, leerSilenciado, sonarDing, textoDelAviso, type MensajeAviso } from "./avisos";

const m = (id: string, conv: string, name: string | null, content = "hola"): MensajeAviso => ({
  id, conversationId: conv, contactName: name, content, createdAt: "2026-11-12T10:00:00Z",
});

describe("textoDelAviso", () => {
  it("un mensaje: nombre y contenido", () => {
    expect(textoDelAviso([m("1", "c1", "María López", "hola, quería saber…")])).toEqual({
      texto: "💬 María López: hola, quería saber…", conversationId: "c1",
    });
  });
  it("varios de la misma clienta", () => {
    const r = textoDelAviso([m("1", "c1", "María López"), m("2", "c1", "María López"), m("3", "c1", "María López")]);
    expect(r).toEqual({ texto: "💬 3 mensajes nuevos de María López", conversationId: "c1" });
  });
  it("varias clientas: la conversación es la del último mensaje", () => {
    const r = textoDelAviso([m("1", "c1", "Ana"), m("2", "c2", "Bea"), m("3", "c3", "María López")]);
    expect(r).toEqual({ texto: "💬 Mensajes nuevos de María López y 2 más", conversationId: "c3" });
  });
  it("sin nombre", () => {
    expect(textoDelAviso([m("1", "c1", null, "hey")]).texto).toBe("💬 Sin nombre: hey");
  });
});

describe("silencio", () => {
  afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
  it("guarda y lee", () => {
    expect(leerSilenciado()).toBe(false);
    guardarSilenciado(true);
    expect(localStorage.getItem("piubella:avisos-silenciados")).toBe("1");
    expect(leerSilenciado()).toBe(true);
    guardarSilenciado(false);
    expect(leerSilenciado()).toBe(false);
  });
  it("si localStorage falla, false y no revienta", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("x"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("x"); });
    expect(leerSilenciado()).toBe(false);
    expect(() => guardarSilenciado(true)).not.toThrow();
  });
});

describe("sonarDing", () => {
  it("ignora el error si no hay audio", () => {
    vi.stubGlobal("AudioContext", class { constructor() { throw new Error("bloqueado"); } });
    expect(() => sonarDing()).not.toThrow();
    vi.unstubAllGlobals();
  });
});
