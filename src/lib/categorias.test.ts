import { describe, expect, it } from "vitest";
import { etiquetaDeCategorias } from "./categorias";

const svc = (...cats: (string | null)[]) => ({
  categories: cats.map((name, i) => ({ id: String(i), name })),
});

const ESTETICA = "Estética";
const MEDICINA = "Medicina y Dermatología";
const AREAS = [ESTETICA, MEDICINA, "Masajes y Bienestar"];

describe("etiquetaDeCategorias — la columna Categorías, en texto plano", () => {
  it("lista todas las categorías separadas por comas", () => {
    expect(etiquetaDeCategorias(svc(ESTETICA, "Dermapen"), AREAS)).toBe("Estética, Dermapen");
  });

  it("un servicio en dos áreas las nombra a las dos", () => {
    expect(etiquetaDeCategorias(svc(ESTETICA, MEDICINA, "Dermapen"), AREAS)).toBe(
      "Estética, Medicina y Dermatología, Dermapen",
    );
  });

  // El área es la agrupación gruesa: leyendo de izquierda a derecha se ve
  // primero en qué pestaña vive y después qué técnica es.
  it("las áreas van primero aunque estén cargadas al final", () => {
    expect(etiquetaDeCategorias(svc("Dermapen", "Arrugas", MEDICINA), AREAS)).toBe(
      "Medicina y Dermatología, Dermapen, Arrugas",
    );
  });

  it("sin categorías devuelve un guión, no una cadena vacía", () => {
    expect(etiquetaDeCategorias(svc(), AREAS)).toBe("—");
  });

  it("ignora los nombres nulos sin dejar comas colgando", () => {
    expect(etiquetaDeCategorias(svc(null, ESTETICA, null), AREAS)).toBe("Estética");
  });

  it("un servicio con sólo nombres nulos devuelve guión", () => {
    expect(etiquetaDeCategorias(svc(null), AREAS)).toBe("—");
  });

  it("sin áreas conocidas respeta el orden en que vienen cargadas", () => {
    expect(etiquetaDeCategorias(svc("Dermapen", ESTETICA), [])).toBe("Dermapen, Estética");
  });

  it("no repite una categoría que aparezca dos veces", () => {
    expect(etiquetaDeCategorias(svc(ESTETICA, ESTETICA), AREAS)).toBe("Estética");
  });
});
