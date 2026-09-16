import { describe, expect, it } from "vitest";
import { serviciosParaCombo } from "./servicios-de-combo";
import type { Service } from "./api-types";

const ESTETICA = "Estética";
const MEDICINA = "Medicina y Dermatología";

const svc = (id: string, name: string, ...areas: string[]) =>
  ({
    id,
    name,
    categories: areas.map((a, i) => ({ id: `${id}-${i}`, name: a })),
  }) as Service;

const LIMPIEZA = svc("1", "Limpieza facial", ESTETICA);
const BOTOX = svc("2", "Baby Botox", MEDICINA);
const DERMAPEN = svc("3", "Dermapen", ESTETICA, MEDICINA);
const TODOS = [LIMPIEZA, BOTOX, DERMAPEN];

describe("serviciosParaCombo", () => {
  it("deja afuera el servicio de otra área", () => {
    // El caso que motivó todo: Baby Botox no va en un combo de Estética.
    expect(serviciosParaCombo(TODOS, ESTETICA)).not.toContain(BOTOX);
  });

  it("incluye el que está en dos áreas, en las dos", () => {
    expect(serviciosParaCombo(TODOS, ESTETICA)).toContain(DERMAPEN);
    expect(serviciosParaCombo(TODOS, MEDICINA)).toContain(DERMAPEN);
  });

  it("sin área devuelve todo: es la pantalla general", () => {
    expect(serviciosParaCombo(TODOS, undefined)).toEqual(TODOS);
  });

  it("no le saca la lista al servicio de otra área que el combo YA tiene", () => {
    // Si se cayera, la fila lo mostraría como "archivado" y mandaría a
    // reemplazar un servicio que existe y está activo.
    expect(serviciosParaCombo(TODOS, ESTETICA, ["2"])).toContain(BOTOX);
  });

  it("mantiene el orden de la lista original", () => {
    const orden = serviciosParaCombo(TODOS, ESTETICA, ["2"]).map((s) => s.id);
    expect(orden).toEqual(["1", "2", "3"]);
  });

  it("ignora los ids vacíos de las filas recién agregadas", () => {
    expect(serviciosParaCombo(TODOS, ESTETICA, ["", null, undefined])).toEqual([
      LIMPIEZA,
      DERMAPEN,
    ]);
  });
});
