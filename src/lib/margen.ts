/**
 * Costo → precio de venta, y a la inversa.
 *
 * Un insumo puede además venderse a la clienta (una crema que se usa en el
 * tratamiento y también se lleva a casa). El precio se piensa como un
 * porcentaje sobre lo que costó, así que los dos campos se calculan uno al
 * otro y Laura puede escribir el que tenga a mano.
 */

/** `numeric(10,2)` en la base: redondear acá evita que el input muestre 4655.664999. */
function dosDecimales(n: number): number {
  return Math.round(n * 100) / 100;
}

export function precioDesdeMargen(
  costo: number | null | undefined,
  margenPct: number | null | undefined,
): number | null {
  if (costo == null || margenPct == null) return null;
  return dosDecimales(costo * (1 + margenPct / 100));
}

/**
 * Con costo 0 devuelve null en vez de dividir por cero — un insumo que salió
 * gratis no tiene margen que calcular, y "Infinity%" en un input no ayuda a
 * nadie.
 *
 * Un margen negativo (precio por debajo del costo) se devuelve tal cual: si el
 * precio quedó mal cargado, el número tiene que decirlo.
 */
export function margenDesdePrecio(
  costo: number | null | undefined,
  precio: number | null | undefined,
): number | null {
  if (costo == null || precio == null || costo === 0) return null;
  return Math.round(((precio - costo) / costo) * 1000) / 10;
}
