/**
 * Copia deliberada de `api-sistema-central/src/lib/combo-pricing.ts`.
 *
 * Son dos runtimes distintos (Worker y navegador) sin paquete compartido, así
 * que la duplicación es inevitable. Lo que la hace segura es que las dos tienen
 * los MISMOS tests con los MISMOS casos: si alguien toca una sola, el otro
 * archivo de tests falla. Si cambiás esta fórmula, cambiá también la del
 * backend y los dos archivos de test.
 */
export type ComboPricedLine = {
  servicePrice: number;
  sessionsIncluded: number;
};

export function computeComboSubtotal(lines: ComboPricedLine[]): number {
  return lines.reduce((acc, l) => acc + l.servicePrice * l.sessionsIncluded, 0);
}

export function computeComboFinalPrice(
  subtotal: number,
  priceType: string | null,
  fixedPrice: number | null,
  discountPercentage: number | null,
): number {
  if (priceType === "fixed" && fixedPrice != null) {
    return Math.max(0, fixedPrice);
  }
  if (priceType === "percentage" && discountPercentage != null) {
    return Math.max(0, subtotal - (subtotal * discountPercentage) / 100);
  }
  return subtotal;
}

/**
 * Precio unitario a usar para un servicio dentro de un combo.
 *
 * Se prefiere el precio de lista, pero **hay que caer al de efectivo cuando no
 * hay lista**: en producción 79 de 213 servicios activos tienen
 * `unit_price_list` en NULL y sólo `unit_price_cash` cargado. Sin este
 * respaldo, cualquier combo armado con esos servicios se congelaba en $0 y el
 * combo entero terminaba valiendo $0 —que fue exactamente lo que pasó con el
 * primer combo que se cargó en producción.
 */
export function precioDeServicio(
  unitPriceList: number | string | null | undefined,
  unitPriceCash: number | string | null | undefined,
): number {
  const elegido = unitPriceList ?? unitPriceCash;
  if (elegido == null) return 0;
  const n = Number(elegido);
  return Number.isFinite(n) ? n : 0;
}
