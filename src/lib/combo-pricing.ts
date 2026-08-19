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
