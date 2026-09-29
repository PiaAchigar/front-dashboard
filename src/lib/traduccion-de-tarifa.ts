/**
 * Qué cobra la proveedora, dicho con números en vez de con teoría.
 *
 * "Por hora" y "monto fijo por sesión" se eligen de un desplegable y no se
 * distinguen hasta fin de mes, cuando la diferencia ya se pagó. Esto la muestra
 * mientras Laura escribe.
 *
 * Los dos minutos no son inventados: 60 es el presupuesto de un pack típico
 * (Cuerpo Full) y 18 es lo que ocupan dos zonas medianas — la sesión corta más
 * común.
 */
export type TipoDePago = "fixed_per_service" | "per_hour";

const SESION_LARGA = 60;
const SESION_CORTA = 18;

const PESOS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

/** `null` cuando no hay monto: un "$0" mientras se escribe es ruido, no dato. */
export function traduccionDeTarifa(tipo: TipoDePago, monto: number): string | null {
  if (!Number.isFinite(monto) || monto <= 0) return null;

  // El formatter de Intl agrega non-breaking space entre $ y número en es-AR; lo sacamos.
  const formatoMonto = (n: number) => PESOS.format(n).replace(/\$\u00a0/, "$");

  if (tipo === "fixed_per_service") {
    return `Cada sesión paga ${formatoMonto(monto)}, dure lo que dure.`;
  }

  const larga = formatoMonto(Math.round((monto * SESION_LARGA) / 60));
  const corta = formatoMonto(Math.round((monto * SESION_CORTA) / 60));
  return `Una sesión de ${SESION_LARGA} min paga ${larga}. Una de ${SESION_CORTA} min paga ${corta}.`;
}
