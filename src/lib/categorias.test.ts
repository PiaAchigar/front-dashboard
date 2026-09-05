import { describe, expect, it } from "vitest";
import { categoriasDeLaWeb, etiquetaDeCategorias } from "./categorias";

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

type Nodo = { id: string; name: string; kind: string; children: Nodo[] };
const nodo = (id: string, kind: string, children: Nodo[] = []): Nodo => ({
  id,
  name: id,
  kind,
  children,
});

describe("categoriasDeLaWeb — el árbol del modal, sin las áreas del panel", () => {
  // Estética, Medicina y Masajes están archivadas, así que no llegan al árbol.
  // Depilación Definitiva, Actividades y Capacitaciones NO lo están, y se
  // colaban entre las categorías de la web como si fueran una más.
  const ARBOL = [
    nodo("Cosmetología", "tecnica", [nodo("Facial", "objetivo", [nodo("Aparatología", "tecnica")])]),
    nodo("Depilación Definitiva", "area", [
      nodo("Depilación Definitiva Facial", "tecnica"),
      nodo("Depilación Definitiva Corporal", "tecnica"),
    ]),
    nodo("Actividades", "area", [nodo("Pilates Reformer", "tecnica")]),
    nodo("Manicuría", "tecnica"),
  ];

  const nombres = (ns: Nodo[]) => ns.map((n) => n.id);

  it("saca las raíces que son área", () => {
    expect(nombres(categoriasDeLaWeb(ARBOL))).toEqual(["Cosmetología", "Manicuría"]);
  });

  it("se lleva también las hijas del área, no las deja sueltas", () => {
    const todos = JSON.stringify(categoriasDeLaWeb(ARBOL));
    expect(todos).not.toContain("Depilación Definitiva Facial");
    expect(todos).not.toContain("Pilates Reformer");
  });

  it("no toca las ramas que no son área", () => {
    const cosmeto = categoriasDeLaWeb(ARBOL)[0];
    expect(nombres(cosmeto.children)).toEqual(["Facial"]);
    expect(nombres(cosmeto.children[0].children)).toEqual(["Aparatología"]);
  });

  // Hoy las áreas sólo viven en la raíz, pero nada en la base lo impide.
  it("un área colgada en el medio también se saca, con su rama", () => {
    const arbol = [nodo("Raíz", "tecnica", [nodo("Área", "area", [nodo("Hija", "tecnica")])])];
    expect(categoriasDeLaWeb(arbol)[0].children).toEqual([]);
  });

  it("no modifica el árbol original", () => {
    const antes = JSON.stringify(ARBOL);
    categoriasDeLaWeb(ARBOL);
    expect(JSON.stringify(ARBOL)).toBe(antes);
  });

  it("un árbol vacío devuelve vacío, no rompe", () => {
    expect(categoriasDeLaWeb([])).toEqual([]);
  });

  it("un árbol que es todo áreas queda vacío", () => {
    expect(categoriasDeLaWeb([nodo("Actividades", "area")])).toEqual([]);
  });
});
