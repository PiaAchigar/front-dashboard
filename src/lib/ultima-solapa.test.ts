import { afterEach, describe, expect, it, vi } from "vitest";
import {
  destinoDeSeccion,
  guardarSolapa,
  leerSolapa,
  prefijosQueRecuerdan,
} from "./ultima-solapa";

const SECCIONES = ["/admin", "/admin/estetica", "/sitio-web"];

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("prefijosQueRecuerdan", () => {
  it("una ruta anidada la recuerdan los dos prefijos que la contienen", () => {
    // Así el sidebar "Administración" vuelve a donde estabas y el sidebar
    // "Estética" vuelve a la solapa de esa área.
    expect(prefijosQueRecuerdan(SECCIONES, "/admin/estetica/combos")).toEqual([
      "/admin",
      "/admin/estetica",
    ]);
  });

  it("la sección NO se recuerda a sí misma", () => {
    // Guardar "/admin" haría que el índice de /admin redirija a /admin: un
    // bucle infinito.
    expect(prefijosQueRecuerdan(SECCIONES, "/admin")).toEqual([]);
    expect(prefijosQueRecuerdan(SECCIONES, "/admin/")).toEqual([]);
  });

  it("una ruta de otra sección no la recuerda ninguna", () => {
    expect(prefijosQueRecuerdan(SECCIONES, "/agenda")).toEqual([]);
  });

  it("no confunde un prefijo con el principio de otro nombre", () => {
    expect(prefijosQueRecuerdan(["/admin"], "/administradores/x")).toEqual([]);
  });
});

describe("destinoDeSeccion", () => {
  it("la primera vez, al destino por defecto", () => {
    expect(destinoDeSeccion(null, "/admin", "/admin/promos")).toBe("/admin/promos");
  });

  it("después, a la última solapa", () => {
    expect(destinoDeSeccion("/admin/estetica/combos", "/admin", "/admin/promos")).toBe(
      "/admin/estetica/combos",
    );
  });

  it("descarta lo guardado si ya no cuelga de la sección", () => {
    // Una clave vieja de una ruta que se renombró mandaría a una pantalla en
    // blanco.
    expect(destinoDeSeccion("/viejo/lo-que-sea", "/admin", "/admin/promos")).toBe(
      "/admin/promos",
    );
  });
});

describe("el storage", () => {
  it("guarda y devuelve por sección", () => {
    guardarSolapa("/admin", "/admin/promos");
    guardarSolapa("/sitio-web", "/sitio-web/textos");
    expect(leerSolapa("/admin")).toBe("/admin/promos");
    expect(leerSolapa("/sitio-web")).toBe("/sitio-web/textos");
  });

  it("si el navegador no deja tocarlo, no rompe", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    expect(leerSolapa("/admin")).toBeNull();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    expect(() => guardarSolapa("/admin", "/admin/promos")).not.toThrow();
  });
});
