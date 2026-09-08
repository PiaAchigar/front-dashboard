import type { Insumo, NivelDeStock } from "../hooks/useInsumos";

/**
 * Presentación de los insumos: qué hay que reponer y cómo se pinta el stock.
 *
 * El `nivel` lo calcula el backend (`lib/stock.ts`) para que la pantalla y
 * cualquier aviso futuro usen exactamente el mismo criterio. Acá sólo se
 * decide cómo mostrarlo.
 */

const PRIORIDAD: Record<string, number> = { sin_stock: 0, bajo: 1 };

/**
 * Los insumos que hay que comprar, primero los que no tienen nada.
 *
 * Deja afuera los `desconocido`: un insumo sin stock cargado está a medio
 * cargar, no es una alerta. Avisar por esos entrena a ignorar el aviso.
 */
export function paraReponer(insumos: readonly Insumo[]): Insumo[] {
  return insumos
    .filter((i) => i.nivel === "sin_stock" || i.nivel === "bajo")
    .sort((a, b) => PRIORIDAD[a.nivel]! - PRIORIDAD[b.nivel]!);
}

/**
 * La frase del aviso. Nombra hasta dos insumos porque "3 insumos bajos" obliga
 * a abrir la pantalla para saber cuáles; con el nombre a la vista, muchas veces
 * alcanza con leer.
 */
export function textoDelAviso(insumos: readonly Insumo[]): string | null {
  const faltan = paraReponer(insumos);
  if (faltan.length === 0) return null;

  const nombres = faltan.map((i) => i.name).filter((n): n is string => Boolean(n));
  if (nombres.length === 0) {
    return `Falta reponer ${faltan.length} ${faltan.length === 1 ? "insumo" : "insumos"}`;
  }
  if (nombres.length === 1) return `Falta reponer ${nombres[0]}`;
  if (nombres.length === 2) return `Falta reponer ${nombres[0]} y ${nombres[1]}`;
  return `Falta reponer ${nombres[0]}, ${nombres[1]} y ${nombres.length - 2} más`;
}

/**
 * ⚠️ Las clases van ESCRITAS ENTERAS, nunca armadas con template strings.
 * Tailwind escanea el código como texto plano: una clase derivada en runtime no
 * se compila y el chip queda transparente, sin error ni warning. Pasó de verdad
 * con `bg-promo` en la barra de pestañas.
 */
const ETIQUETAS: Record<NivelDeStock, { texto: string; clase: string }> = {
  sin_stock: { texto: "Sin stock", clase: "bg-red-100 text-red-800" },
  bajo: { texto: "Bajo", clase: "bg-amber-100 text-amber-800" },
  ok: { texto: "En stock", clase: "bg-green-100 text-green-800" },
  desconocido: { texto: "Sin cargar", clase: "bg-surface-high text-ink-soft" },
};

export function etiquetaDeStock(nivel: NivelDeStock) {
  return ETIQUETAS[nivel] ?? ETIQUETAS.desconocido;
}
