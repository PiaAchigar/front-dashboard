// Copia del contrato de la planilla de servicios (API <-> front). Los repos no
// comparten código: esto espeja api-sistema-central/src/lib/planilla-servicios.ts
// y los dos archivos tienen que cambiar juntos. Sólo tipos y constantes, sin lógica.

// ───────────────────────── Contrato compartido (API ↔ front) ─────────────────────────

export type Celda = string | number | null; // Sí/No viajan como texto

export type FilaServicioPlanilla = {
  fila: number; // número de fila de Excel (la primera de datos es 2)
  id: string | null;
  nombre: Celda;
  codigo: Celda;
  descripcion: Celda;
  precioLista: Celda;
  precioEfectivo: Celda;
  duracion: Celda;
  unidad: Celda;
  requiereOperadora: Celda;
  requiereMaquina: Celda;
  maquina: Celda;
  visibleWeb: Celda;
  destacado: Celda;
  ordenWeb: Celda;
  beneficios: Celda;
  contraindicaciones: Celda;
  instrucciones: Celda;
};
export type FilaAcuerdoPlanilla = { fila: number; servicio: Celda; proveedora: Celda; tipoDePago: Celda; tarifa: Celda };
export type FilaInsumoPlanilla = { fila: number; servicio: Celda; insumo: Celda; cantidad: Celda };
export type FilaCategoriaPlanilla = { fila: number; servicio: Celda; categoria: Celda };

export type ContenidoPlanilla = {
  servicios: FilaServicioPlanilla[];
  acuerdos: FilaAcuerdoPlanilla[];
  insumos: FilaInsumoPlanilla[];
  categorias: FilaCategoriaPlanilla[];
};

export type ListasPlanilla = {
  maquinas: string[];
  proveedoras: string[];
  insumos: string[];
  categorias: string[]; // rutas "Madre › Hija › Nieta"
  tiposDePago: string[]; // ["Por hora", "Porcentaje (%)", "Fijo por servicio"]
};

export type PlanillaDescarga = {
  area: { id: string; nombre: string };
  generadaEn: string; // ISO
  contenido: ContenidoPlanilla;
  listas: ListasPlanilla;
};

export type EntradaPlanilla = { area: string; original: ContenidoPlanilla; editada: ContenidoPlanilla };

export type Pestana = "Servicios" | "Proveedoras" | "Insumos" | "Categorías web" | "Archivo";
export type ErrorDePlanilla = { pestana: Pestana; fila: number | null; mensaje: string };
export type Cambio = { campo: string; antes: string; despues: string }; // `campo` = encabezado de la columna

export type Previsualizacion = {
  errores: ErrorDePlanilla[];
  servicios: { fila: number; id: string | null; nombre: string; tipo: "nuevo" | "modificado"; cambios: Cambio[] }[];
  acuerdos: { fila: number; servicio: string; proveedora: string; tipo: "nuevo" | "cambia"; antes: string | null; despues: string }[];
  insumos: { fila: number; servicio: string; insumo: string; tipo: "nuevo" | "cambia"; antes: number | null; despues: number }[];
  categorias: { fila: number; servicio: string; categoria: string }[];
  combosAfectados: { id: string; nombre: string; kind: "combo" | "pack" }[];
  resumen: { serviciosNuevos: number; serviciosModificados: number; acuerdos: number; insumos: number; categorias: number };
};

export type ServicioNormalizado = {
  name: string | null;
  code: string | null;
  description: string | null;
  unitPriceList: number | null;
  unitPriceCash: number | null;
  estimatedDurationMinutes: number | null;
  unitType: string | null;
  requiresOperator: boolean | null;
  requiresMachine: boolean | null;
  maquina: string | null;
  isVisible: boolean | null;
  isFeatured: boolean | null;
  webSortOrder: number | null;
  benefits: string | null;
  contraindications: string | null;
  specialAttentionNotes: string | null;
};

export const ENCABEZADO_ID = "id (no tocar)";

export const ENCABEZADOS_SERVICIOS: Record<keyof ServicioNormalizado, string> = {
  name: "Nombre",
  code: "Código",
  description: "Descripción",
  unitPriceList: "Precio lista",
  unitPriceCash: "Precio efectivo",
  estimatedDurationMinutes: "Duración (min)",
  unitType: "Unidad",
  requiresOperator: "Requiere operadora",
  requiresMachine: "Requiere máquina",
  maquina: "Máquina",
  isVisible: "Visible en la web",
  isFeatured: "Destacado en el home",
  webSortOrder: "Orden web (destacados)",
  benefits: "Beneficios",
  contraindications: "Contraindicaciones",
  specialAttentionNotes: "Instrucciones especiales",
};

export const ENCABEZADOS_PROVEEDORAS = ["Servicio", "Proveedora", "Tipo de pago", "Tarifa"] as const;
export const ENCABEZADOS_INSUMOS = ["Servicio", "Insumo", "Cantidad"] as const;
export const ENCABEZADOS_CATEGORIAS = ["Servicio", "Categoría web"] as const;

/** Campo normalizado -> campo de la fila de la planilla. */
export const CAMPO_DE_FILA: Record<keyof ServicioNormalizado, keyof FilaServicioPlanilla> = {
  name: "nombre",
  code: "codigo",
  description: "descripcion",
  unitPriceList: "precioLista",
  unitPriceCash: "precioEfectivo",
  estimatedDurationMinutes: "duracion",
  unitType: "unidad",
  requiresOperator: "requiereOperadora",
  requiresMachine: "requiereMaquina",
  maquina: "maquina",
  isVisible: "visibleWeb",
  isFeatured: "destacado",
  webSortOrder: "ordenWeb",
  benefits: "beneficios",
  contraindications: "contraindicaciones",
  specialAttentionNotes: "instrucciones",
};
