/**
 * Validaciones de los campos numéricos de la configuración de depilación,
 * compartidas entre `PreciosPage` (los 25 campos de la config), `PacksPage`
 * (los 3 del pack) y `ComisionPage` (la tarifa de cada proveedora).
 * Vivían duplicadas como funciones locales en cada pantalla hasta la Tarea 9:
 * dos copias de la misma regla en dos archivos se desincronizan (alguien
 * corrige una y se olvida de la otra), así que se mudaron acá.
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

/**
 * La tarifa escrita a la argentina, en pesos.
 *
 * `Number("20.000")` es **20**, no veinte mil — y la pantalla de Comisión le
 * enseña a Laura la notación que rompe el campo, porque `traduccionDeTarifa`
 * formatea "$20.000" con punto de miles. Cargar $20 creyendo que se cargaron
 * $20.000 no es un error de tipeo recuperable: es una comisión mil veces menor
 * que se congela en `provider_earning` al marcar la sesión como realizada.
 *
 * Vive acá y NO en `EditorDeAcuerdos` a propósito. En Comisión los dos tipos
 * de pago son pesos enteros, así que un punto sólo puede ser separador de miles y
 * se saca sin ambigüedad. En Servicios existe `percentage`, donde "12.5" es
 * doce y medio por ciento legítimo: tocar el parseo compartido lo rompería.
 */
export function montoEnPesos(texto: string): number {
  // La coma sí es decimal en es-AR, así que se conserva como punto decimal.
  const normalizado = texto.replace(/[.\s\u00a0]/g, "").replace(",", ".");
  return Number(normalizado);
}
