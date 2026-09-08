import type { Insumo } from "../hooks/useInsumos";

/**
 * Cómo se arma el selector de insumos de un servicio.
 *
 * Las cantidades viven como texto en el formulario (`{ [insumoId]: "2" }`)
 * porque mientras se escribe pasan por estados que no son un número todavía:
 * "", "0.", "1.". Convertirlas en cada tecla haría saltar el input.
 */
export type Cantidades = Record<string, string>;

/** Sin acentos y en minúsculas: buscar "esteriles" tiene que encontrar "estériles". */
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Separa el catálogo en los que usa el servicio y el resto.
 *
 * Los elegidos NO se filtran por la búsqueda: si al buscar otra cosa
 * desaparecieran, parecería que se perdieron —y al guardar se guardarían
 * igual—, así que la pantalla estaría mintiendo.
 */
export function ordenarParaElector(
  catalogo: readonly Insumo[],
  cantidades: Cantidades,
  busqueda: string,
): { elegidos: Insumo[]; resto: Insumo[] } {
  const q = normalizar(busqueda.trim());
  const elegidos: Insumo[] = [];
  const resto: Insumo[] = [];

  for (const i of catalogo) {
    // Tildado con la cantidad vacía sigue siendo tildado: se tilda primero y se
    // escribe el número después.
    if (cantidades[i.id] !== undefined) elegidos.push(i);
    else if (!q || normalizar(i.name ?? "").includes(q)) resto.push(i);
  }
  return { elegidos, resto };
}

/** Lo que cuesta en insumos hacer el servicio una vez, con lo tildado hasta ahora. */
export function costoDeLineas(catalogo: readonly Insumo[], cantidades: Cantidades): number {
  let total = 0;
  for (const i of catalogo) {
    const texto = cantidades[i.id];
    if (texto === undefined || texto.trim() === "") continue;
    const cantidad = Number(texto);
    if (!Number.isFinite(cantidad) || cantidad <= 0) continue;
    total += cantidad * (i.unitCost ?? 0);
  }
  return Math.round(total * 100) / 100;
}
