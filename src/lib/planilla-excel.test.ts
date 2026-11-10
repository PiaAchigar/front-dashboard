// @vitest-environment node
import { describe, expect, it } from "vitest";
import { armarLibro, leerLibro, nombreDeArchivo } from "./planilla-excel";
import { ENCABEZADO_ID, ENCABEZADOS_SERVICIOS, type PlanillaDescarga } from "./planilla-tipos";

const datos: PlanillaDescarga = {
  area: { id: "a1", nombre: "Estética" },
  generadaEn: "2026-11-10T12:00:00.000Z",
  contenido: {
    servicios: [
      {
        fila: 2, id: "s1", nombre: "Limpieza facial", codigo: "LF", descripcion: "Con «comillas», tildes y\nsalto",
        precioLista: 45000, precioEfectivo: 40000, duracion: 60, unidad: "sesión",
        requiereOperadora: "Sí", requiereMaquina: "No", maquina: null, visibleWeb: "Sí", destacado: "No",
        ordenWeb: null, beneficios: null, contraindicaciones: null, instrucciones: null,
      },
      {
        fila: 3, id: "s2", nombre: "Peeling", codigo: null, descripcion: null,
        precioLista: 30000.5, precioEfectivo: 28000, duracion: 45, unidad: null,
        requiereOperadora: "Sí", requiereMaquina: "Sí", maquina: "Láser A", visibleWeb: "No", destacado: "Sí",
        ordenWeb: 2, beneficios: "x".repeat(2000), contraindicaciones: "c", instrucciones: "i",
      },
    ],
    acuerdos: [{ fila: 2, servicio: "Limpieza facial", proveedora: "Ana Pérez", tipoDePago: "Por hora", tarifa: 5000 }],
    insumos: [{ fila: 2, servicio: "Peeling", insumo: "Ácido", cantidad: 1.5 }],
    categorias: [{ fila: 2, servicio: "Limpieza facial", categoria: "Facial › Limpiezas" }],
  },
  listas: {
    maquinas: ["Láser A"], proveedoras: ["Ana Pérez"], insumos: ["Ácido"],
    categorias: ["Facial › Limpiezas"], tiposDePago: ["Por hora", "Porcentaje (%)", "Fijo por servicio"],
  },
};

async function cargar(blob: Blob) {
  const { default: mod } = await import("exceljs");
  const wb = new mod.Workbook();
  await wb.xlsx.load(await blob.arrayBuffer());
  return wb;
}
async function aBlob(wb: { xlsx: { writeBuffer(): Promise<unknown> } }) {
  return new Blob([(await wb.xlsx.writeBuffer()) as ArrayBuffer]);
}

describe("planilla-excel", () => {
  it("arma las pestañas en orden, con las dos últimas escondidas", async () => {
    const wb = await cargar(await armarLibro(datos));
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Servicios", "Proveedoras", "Insumos", "Categorías web", "Listas", "_original"]);
    expect(wb.getWorksheet("Listas")!.state).toBe("veryHidden");
    expect(wb.getWorksheet("_original")!.state).toBe("veryHidden");
    const h = wb.getWorksheet("Servicios")!.getRow(1);
    expect(h.getCell(1).value).toBe(ENCABEZADO_ID);
    expect(h.getCell(2).value).toBe(ENCABEZADOS_SERVICIOS.name);
  });

  it("ida y vuelta: original y editada son iguales a lo descargado", async () => {
    const r = await leerLibro(await (await armarLibro(datos)).arrayBuffer());
    expect(r).toEqual({ area: "Estética", original: datos.contenido, editada: datos.contenido });
  });

  it("acepta un File", async () => {
    const blob = await armarLibro(datos);
    const r = await leerLibro(new File([blob], "x.xlsx"));
    expect("error" in r).toBe(false);
  });

  it("una celda editada se refleja en editada y no en original", async () => {
    const wb = await cargar(await armarLibro(datos));
    wb.getWorksheet("Servicios")!.getRow(2).getCell(5).value = 99000; // Precio lista
    const r = await leerLibro(await (await aBlob(wb)).arrayBuffer());
    if ("error" in r) throw new Error(r.error);
    expect(r.editada.servicios[0].precioLista).toBe(99000);
    expect(r.original.servicios[0].precioLista).toBe(45000);
  });

  it("lee por encabezado aunque reordenen las columnas, y ignora filas vacías", async () => {
    const wb = await cargar(await armarLibro(datos));
    const ws = wb.getWorksheet("Servicios")!;
    const a = ws.getRow(1).getCell(2).value; // Nombre
    const b = ws.getRow(1).getCell(3).value; // Código
    ws.getRow(1).getCell(2).value = b;
    ws.getRow(1).getCell(3).value = a;
    for (const n of [2, 3]) {
      const x = ws.getRow(n).getCell(2).value;
      ws.getRow(n).getCell(2).value = ws.getRow(n).getCell(3).value;
      ws.getRow(n).getCell(3).value = x;
    }
    ws.getRow(6).getCell(4).value = null; // fila vacía
    const r = await leerLibro(await (await aBlob(wb)).arrayBuffer());
    if ("error" in r) throw new Error(r.error);
    expect(r.editada).toEqual(datos.contenido);
  });

  it("un libro sin _original da el error de archivo ajeno", async () => {
    const wb = await cargar(await armarLibro(datos));
    wb.removeWorksheet(wb.getWorksheet("_original")!.id);
    const r = await leerLibro(await (await aBlob(wb)).arrayBuffer());
    expect(r).toEqual({ error: "Este archivo no es una planilla bajada del sistema. Bajá una nueva desde el botón Descargar." });
  });

  it("un _original con contenido incompleto o versión distinta da el error de archivo ajeno", async () => {
    const MSG = { error: "Este archivo no es una planilla bajada del sistema. Bajá una nueva desde el botón Descargar." };
    const conOriginal = async (json: unknown) => {
      const wb = await cargar(await armarLibro(datos));
      const h = wb.getWorksheet("_original")!;
      h.spliceRows(1, h.rowCount);
      h.getCell(1, 1).value = JSON.stringify(json);
      return leerLibro(await (await aBlob(wb)).arrayBuffer());
    };
    for (const falta of ["servicios", "acuerdos", "insumos", "categorias"] as const) {
      const contenido: Record<string, unknown> = { ...datos.contenido };
      delete contenido[falta];
      expect(await conOriginal({ v: 1, area: "Estética", generadaEn: "x", contenido })).toEqual(MSG);
    }
    expect(await conOriginal({ v: 2, area: "Estética", generadaEn: "x", contenido: datos.contenido })).toEqual(MSG);
    expect(await conOriginal({ area: "Estética", generadaEn: "x", contenido: datos.contenido })).toEqual(MSG);
  });

  it("avisa si falta una pestaña o una columna", async () => {
    let wb = await cargar(await armarLibro(datos));
    wb.removeWorksheet(wb.getWorksheet("Insumos")!.id);
    expect(await leerLibro(await (await aBlob(wb)).arrayBuffer())).toEqual({ error: "Falta la pestaña «Insumos»" });

    wb = await cargar(await armarLibro(datos));
    wb.getWorksheet("Insumos")!.getRow(1).getCell(3).value = "Otra cosa";
    expect(await leerLibro(await (await aBlob(wb)).arrayBuffer())).toEqual({ error: "Falta la columna «Cantidad» en «Insumos»" });
  });

  it("parte el _original en trozos de 30.000 caracteres y lo recompone", async () => {
    const grande: PlanillaDescarga = {
      ...datos,
      contenido: {
        ...datos.contenido,
        servicios: Array.from({ length: 30 }, (_, i) => ({ ...datos.contenido.servicios[0], fila: i + 2, id: `s${i}`, nombre: `S${i}`, descripcion: "d".repeat(2000) })),
        acuerdos: [], insumos: [], categorias: [],
      },
    };
    const wb = await cargar(await armarLibro(grande));
    expect(wb.getWorksheet("_original")!.rowCount).toBeGreaterThan(1);
    const r = await leerLibro(await (await armarLibro(grande)).arrayBuffer());
    if ("error" in r) throw new Error(r.error);
    expect(r.original).toEqual(grande.contenido);
  });

  it("nombreDeArchivo", () => {
    expect(nombreDeArchivo("Medicina y Dermatología", "2026-11-10")).toBe("servicios-medicina-y-dermatologia-2026-11-10.xlsx");
    expect(nombreDeArchivo("Estética", "2026-11-10")).toBe("servicios-estetica-2026-11-10.xlsx");
  });
});
