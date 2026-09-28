/**
 * Validaciones de los campos numéricos de la configuración de depilación,
 * compartidas entre `PreciosPage` (los 25 campos de la config) y `PacksPage`
 * (los 3 del pack). Vivían duplicadas como funciones locales en cada
 * pantalla hasta la Tarea 9: dos copias de la misma regla en dos archivos se
 * desincronizan (alguien corrige una y se olvida de la otra), así que se
 * mudaron acá.
 */

/** Entero positivo estricto: "" o cualquier cosa no numérica (incluye
 *  negativos y decimales) invalida. Mismo criterio que el `enteroPositivo`
 *  del Zod del backend, pero bloqueando ACÁ para no ida-y-vuelta con el
 *  servidor por un typo. */
export function parseEnteroPositivo(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return n > 0 ? n : null;
}

/** Igual que arriba pero para `packDiscountPercentage`: ahí el 0 SÍ es un
 *  valor legítimo (combo(s) sin descuento por pack), así que no puede usar
 *  `parseEnteroPositivo` — si lo hiciera, un campo vacío y un 0% tecleado a
 *  propósito serían indistinguibles y los dos rebotarían igual. */
export function parsePorcentaje(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return n >= 0 && n <= 100 ? n : null;
}
