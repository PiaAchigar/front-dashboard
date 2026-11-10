// Arma y lee el .xlsx de la carga masiva de servicios, todo en el navegador.
// ExcelJS se importa dinámico: no entra al bundle inicial.

import {
  CAMPO_DE_FILA,
  ENCABEZADO_ID,
  ENCABEZADOS_CATEGORIAS,
  ENCABEZADOS_INSUMOS,
  ENCABEZADOS_PROVEEDORAS,
  ENCABEZADOS_SERVICIOS,
  type Celda,
  type ContenidoPlanilla,
  type FilaServicioPlanilla,
  type PlanillaDescarga,
  type ServicioNormalizado,
} from "./planilla-tipos";

const TROZO = 30000;
const ULTIMA_FILA_DESPLEGABLES = 2000;
const ERROR_ARCHIVO_AJENO = "Este archivo no es una planilla bajada del sistema. Bajá una nueva desde el botón Descargar.";

type Excel = typeof import("exceljs");
type Hoja = import("exceljs").Worksheet;

async function cargarExcelJS(): Promise<Excel> {
  const m = (await import("exceljs")) as unknown as { default?: Excel } & Excel;
  return m.default ?? m;
}

const CLAVES_SERVICIO = Object.keys(ENCABEZADOS_SERVICIOS) as (keyof ServicioNormalizado)[];
const COLUMNAS_SI_NO: (keyof ServicioNormalizado)[] = ["requiresOperator", "requiresMachine", "isVisible", "isFeatured"];

function letra(n: number): string {
  let s = "";
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
}

// ───────────────────────── Armar ─────────────────────────

export async function armarLibro(d: PlanillaDescarga): Promise<Blob> {
  const ExcelJS = await cargarExcelJS();
  const wb = new ExcelJS.Workbook();
  const generadaEn = d.generadaEn;

  const hojaServicios = wb.addWorksheet("Servicios");
  const hojaProv = wb.addWorksheet("Proveedoras");
  const hojaIns = wb.addWorksheet("Insumos");
  const hojaCat = wb.addWorksheet("Categorías web");
  const hojaListas = wb.addWorksheet("Listas", { state: "veryHidden" });
  const hojaOriginal = wb.addWorksheet("_original", { state: "veryHidden" });

  // Listas: A Sí/No, B máquinas, C proveedoras, D insumos, E categorías, F tipos de pago.
  const listas: string[][] = [
    ["Sí", "No"],
    d.listas.maquinas,
    d.listas.proveedoras,
    d.listas.insumos,
    d.listas.categorias,
    d.listas.tiposDePago,
  ];
  listas.forEach((valores, i) => valores.forEach((v, j) => (hojaListas.getCell(j + 1, i + 1).value = v)));
  const rango = (col: number) => (listas[col - 1].length ? `Listas!$${letra(col)}$1:$${letra(col)}$${listas[col - 1].length}` : null);

  const desplegable = (hoja: Hoja, col: number, formula: string | null) => {
    if (!formula) return;
    for (let r = 2; r <= ULTIMA_FILA_DESPLEGABLES; r++) {
      hoja.getCell(r, col).dataValidation = { type: "list", allowBlank: true, formulae: [formula] };
    }
  };
  const encabezado = (hoja: Hoja, titulos: readonly string[]) => {
    const fila = hoja.getRow(1);
    titulos.forEach((t, i) => (fila.getCell(i + 1).value = t));
    fila.font = { bold: true };
    hoja.views = [{ state: "frozen", ySplit: 1 }];
  };
  const NOMBRES_SERVICIOS = `Servicios!$B$2:$B$${ULTIMA_FILA_DESPLEGABLES}`;

  // Servicios
  const titulos = [ENCABEZADO_ID, ...CLAVES_SERVICIO.map((k) => ENCABEZADOS_SERVICIOS[k])];
  encabezado(hojaServicios, titulos);
  hojaServicios.getColumn(1).width = 10;
  hojaServicios.getColumn(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
  CLAVES_SERVICIO.forEach((k, i) => {
    hojaServicios.getColumn(i + 2).width = k === "description" || k === "benefits" || k === "contraindications" || k === "specialAttentionNotes" ? 40 : 20;
  });
  d.contenido.servicios.forEach((f, i) => {
    const fila = hojaServicios.getRow(i + 2);
    fila.getCell(1).value = f.id;
    CLAVES_SERVICIO.forEach((k, j) => (fila.getCell(j + 2).value = f[CAMPO_DE_FILA[k]] as Celda));
  });
  CLAVES_SERVICIO.forEach((k, j) => {
    if (COLUMNAS_SI_NO.includes(k)) desplegable(hojaServicios, j + 2, rango(1));
    if (k === "maquina") desplegable(hojaServicios, j + 2, rango(2));
  });

  // Relaciones
  encabezado(hojaProv, ENCABEZADOS_PROVEEDORAS);
  d.contenido.acuerdos.forEach((f, i) => {
    [f.servicio, f.proveedora, f.tipoDePago, f.tarifa].forEach((v, j) => (hojaProv.getCell(i + 2, j + 1).value = v));
  });
  desplegable(hojaProv, 1, NOMBRES_SERVICIOS);
  desplegable(hojaProv, 2, rango(3));
  desplegable(hojaProv, 3, rango(6));

  encabezado(hojaIns, ENCABEZADOS_INSUMOS);
  d.contenido.insumos.forEach((f, i) => {
    [f.servicio, f.insumo, f.cantidad].forEach((v, j) => (hojaIns.getCell(i + 2, j + 1).value = v));
  });
  desplegable(hojaIns, 1, NOMBRES_SERVICIOS);
  desplegable(hojaIns, 2, rango(4));

  encabezado(hojaCat, ENCABEZADOS_CATEGORIAS);
  d.contenido.categorias.forEach((f, i) => {
    [f.servicio, f.categoria].forEach((v, j) => (hojaCat.getCell(i + 2, j + 1).value = v));
  });
  desplegable(hojaCat, 1, NOMBRES_SERVICIOS);
  desplegable(hojaCat, 2, rango(5));
  [hojaProv, hojaIns, hojaCat].forEach((h) => h.columns.forEach((c) => (c.width = 30)));

  // _original: lo que se bajó, en trozos (una celda de Excel admite ~32.000 caracteres).
  const json = JSON.stringify({ v: 1, area: d.area.nombre, generadaEn, contenido: d.contenido });
  for (let i = 0, fila = 1; i < json.length; i += TROZO, fila++) {
    hojaOriginal.getCell(fila, 1).value = json.slice(i, i + TROZO);
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

// ───────────────────────── Leer ─────────────────────────

function aCelda(v: unknown): Celda {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") return v.trim() === "" ? null : v;
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("error" in o) return null;
    if ("result" in o || "formula" in o || "sharedFormula" in o) return aCelda(o.result);
    if (Array.isArray(o.richText)) return aCelda((o.richText as { text: string }[]).map((t) => t.text).join(""));
    if (typeof o.text === "string") return aCelda(o.text);
  }
  const t = String(v);
  return t.trim() === "" ? null : t;
}

type ResultadoLectura = { area: string; original: ContenidoPlanilla; editada: ContenidoPlanilla } | { error: string };

function leerHoja<T>(
  hoja: Hoja,
  nombre: string,
  encabezados: readonly string[],
  armar: (fila: number, v: Record<string, Celda>) => T,
): T[] | { error: string } {
  const columnas = new Map<string, number>();
  hoja.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
    const t = aCelda(cell.value);
    if (typeof t === "string") columnas.set(t.trim(), col);
  });
  for (const e of encabezados) {
    if (!columnas.has(e)) return { error: `Falta la columna «${e}» en «${nombre}»` };
  }
  const filas: T[] = [];
  for (let r = 2; r <= hoja.rowCount; r++) {
    const fila = hoja.getRow(r);
    const v: Record<string, Celda> = {};
    for (const e of encabezados) v[e] = aCelda(fila.getCell(columnas.get(e)!).value);
    if (encabezados.every((e) => v[e] === null)) continue;
    filas.push(armar(r, v));
  }
  return filas;
}

export async function leerLibro(archivo: File | ArrayBuffer): Promise<ResultadoLectura> {
  const ExcelJS = await cargarExcelJS();
  const wb = new ExcelJS.Workbook();
  try {
    const buf = archivo instanceof ArrayBuffer ? archivo : await archivo.arrayBuffer();
    await wb.xlsx.load(buf);
  } catch {
    return { error: ERROR_ARCHIVO_AJENO };
  }

  // _original
  const hojaOriginal = wb.getWorksheet("_original");
  if (!hojaOriginal) return { error: ERROR_ARCHIVO_AJENO };
  let texto = "";
  for (let r = 1; r <= hojaOriginal.rowCount; r++) {
    const c = aCelda(hojaOriginal.getCell(r, 1).value);
    if (c !== null) texto += String(c);
  }
  let guardado: { area: string; contenido: ContenidoPlanilla };
  try {
    guardado = JSON.parse(texto);
    if (typeof guardado?.area !== "string" || !guardado.contenido || !Array.isArray(guardado.contenido.servicios)) throw new Error();
  } catch {
    return { error: ERROR_ARCHIVO_AJENO };
  }

  const hojas: Record<string, Hoja> = {};
  for (const n of ["Servicios", "Proveedoras", "Insumos", "Categorías web"]) {
    const h = wb.getWorksheet(n);
    if (!h) return { error: `Falta la pestaña «${n}»` };
    hojas[n] = h;
  }

  const servicios = leerHoja<FilaServicioPlanilla>(
    hojas["Servicios"],
    "Servicios",
    [ENCABEZADO_ID, ...CLAVES_SERVICIO.map((k) => ENCABEZADOS_SERVICIOS[k])],
    (fila, v) => {
      const id = v[ENCABEZADO_ID];
      const base: Record<string, Celda | number> = { fila };
      for (const k of CLAVES_SERVICIO) base[CAMPO_DE_FILA[k]] = v[ENCABEZADOS_SERVICIOS[k]];
      return { ...base, id: id === null ? null : String(id).trim() || null } as unknown as FilaServicioPlanilla;
    },
  );
  if ("error" in servicios) return servicios;

  const acuerdos = leerHoja(hojas["Proveedoras"], "Proveedoras", ENCABEZADOS_PROVEEDORAS, (fila, v) => ({
    fila, servicio: v["Servicio"], proveedora: v["Proveedora"], tipoDePago: v["Tipo de pago"], tarifa: v["Tarifa"],
  }));
  if ("error" in acuerdos) return acuerdos;

  const insumos = leerHoja(hojas["Insumos"], "Insumos", ENCABEZADOS_INSUMOS, (fila, v) => ({
    fila, servicio: v["Servicio"], insumo: v["Insumo"], cantidad: v["Cantidad"],
  }));
  if ("error" in insumos) return insumos;

  const categorias = leerHoja(hojas["Categorías web"], "Categorías web", ENCABEZADOS_CATEGORIAS, (fila, v) => ({
    fila, servicio: v["Servicio"], categoria: v["Categoría web"],
  }));
  if ("error" in categorias) return categorias;

  return { area: guardado.area, original: guardado.contenido, editada: { servicios, acuerdos, insumos, categorias } };
}

// ───────────────────────── Nombre de archivo ─────────────────────────

export function nombreDeArchivo(area: string, hoy: string): string {
  const slug = area
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `servicios-${slug}-${hoy}.xlsx`;
}
