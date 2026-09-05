import { describe, expect, it } from "vitest";
import {
  agruparParaElFormulario,
  categoriasDelFormulario,
  etiquetaDeCategorias,
  NO_SE_TILDAN,
} from "./categorias";

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

describe("categoriasDelFormulario — el árbol del modal, podado", () => {
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
    expect(nombres(categoriasDelFormulario(ARBOL))).toEqual(["Cosmetología", "Manicuría"]);
  });

  it("se lleva también las hijas del área, no las deja sueltas", () => {
    const todos = JSON.stringify(categoriasDelFormulario(ARBOL));
    expect(todos).not.toContain("Depilación Definitiva Facial");
    expect(todos).not.toContain("Pilates Reformer");
  });

  it("no toca las ramas que no son área", () => {
    const cosmeto = categoriasDelFormulario(ARBOL)[0];
    expect(nombres(cosmeto.children)).toEqual(["Facial"]);
    expect(nombres(cosmeto.children[0].children)).toEqual(["Aparatología"]);
  });

  // Hoy las áreas sólo viven en la raíz, pero nada en la base lo impide.
  it("un área colgada en el medio también se saca, con su rama", () => {
    const arbol = [nodo("Raíz", "tecnica", [nodo("Área", "area", [nodo("Hija", "tecnica")])])];
    expect(categoriasDelFormulario(arbol)[0].children).toEqual([]);
  });

  it("no modifica el árbol original", () => {
    const antes = JSON.stringify(ARBOL);
    categoriasDelFormulario(ARBOL);
    expect(JSON.stringify(ARBOL)).toBe(antes);
  });

  it("un árbol vacío devuelve vacío, no rompe", () => {
    expect(categoriasDelFormulario([])).toEqual([]);
  });

  it("un árbol que es todo áreas queda vacío", () => {
    expect(categoriasDelFormulario([nodo("Actividades", "area")])).toEqual([]);
  });
});

describe("categoriasDelFormulario — lo comercial tampoco se tilda a mano", () => {
  it("saca Promos del Mes y Combos: van a ser pestañas propias, no categorías", () => {
    const arbol = [
      nodo("Promos del Mes", "tecnica"),
      nodo("Combos", "tecnica"),
      nodo("Manicuría", "tecnica"),
    ];
    expect(categoriasDelFormulario(arbol).map((n) => n.id)).toEqual(["Manicuría"]);
  });

  // Verificado contra producción el 2026-09-04. No prueba la base —no puede—
  // pero un cambio de nombre acá tiene que ser deliberado.
  it("los nombres son los exactos de la base", () => {
    expect(NO_SE_TILDAN).toEqual(["Promos del Mes", "Combos"]);
  });

  it("no se lleva una categoría que sólo CONTIENE la palabra", () => {
    // "Combos de Depilación" no es "Combos".
    const arbol = [nodo("Combos de Depilación", "tecnica")];
    expect(categoriasDelFormulario(arbol)).toHaveLength(1);
  });
});

describe("agruparParaElFormulario — las raíces sueltas van bajo un título", () => {
  const ARBOL = [
    nodo("Tratamientos Faciales", "tecnica", [nodo("Manchas", "objetivo")]),
    nodo("Belleza", "tecnica"),
    nodo("Aparatología", "tecnica", [nodo("Venus Legacy", "maquina")]),
    nodo("Manicuría", "tecnica"),
  ];

  it("separa las raíces con hijas de las que no tienen", () => {
    const { ramas, generales } = agruparParaElFormulario(ARBOL);
    expect(ramas.map((n) => n.id)).toEqual(["Tratamientos Faciales", "Aparatología"]);
    expect(generales.map((n) => n.id)).toEqual(["Belleza", "Manicuría"]);
  });

  it("respeta el orden en que vienen dentro de cada grupo", () => {
    const { generales } = agruparParaElFormulario([nodo("Z", "tecnica"), nodo("A", "tecnica")]);
    expect(generales.map((n) => n.id)).toEqual(["Z", "A"]);
  });

  // Masajes hoy no tiene hijas y mañana va a tener cuatro: tiene que saltar
  // sola de un grupo al otro, sin listas fijas que actualizar.
  it("una raíz que gana hijas deja de ser general", () => {
    const antes = agruparParaElFormulario([nodo("Masajes", "tecnica")]);
    expect(antes.generales.map((n) => n.id)).toEqual(["Masajes"]);

    const despues = agruparParaElFormulario([nodo("Masajes", "tecnica", [nodo("Reflexología", "tecnica")])]);
    expect(despues.generales).toEqual([]);
    expect(despues.ramas.map((n) => n.id)).toEqual(["Masajes"]);
  });

  it("un árbol sin raíces sueltas deja Generales vacío", () => {
    const { generales } = agruparParaElFormulario([nodo("A", "tecnica", [nodo("B", "tecnica")])]);
    expect(generales).toEqual([]);
  });

  it("un árbol vacío no rompe", () => {
    expect(agruparParaElFormulario([])).toEqual({ ramas: [], generales: [] });
  });
});
