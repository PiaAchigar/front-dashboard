// Punto único de conversión de fechas del dashboard, espejo de
// front-agenda/src/lib/format.ts y front-facturador/src/lib/format.ts.
//
// El navegador de la clienta está en ART, pero `new Date().toISOString()` es
// SIEMPRE UTC: entre las 21:00 y las 24:00 ART devuelve el día siguiente. Así
// aparecía "07/08/2026" como fecha de inicio de una suscripción cargada el 6 a
// las 22:31. Toda fecha que se muestre o se mande al backend pasa por acá.
const TZ = "America/Argentina/Buenos_Aires";

/** Fecha local ART como YYYY-MM-DD (valor de un <input type="date">). */
export function todayLocal(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

/** "DD/MM/AAAA" a partir de "YYYY-MM-DD" (fecha pura, sin zona horaria). */
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

/** "DD/MM/AAAA" en hora local ART a partir de un instante ISO UTC. */
export function formatDateTimeToDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

/** "DD/MM/AAAA HH:MM" en hora local ART a partir de un instante ISO UTC. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/** Importe en pesos con separadores es-AR. */
export function money(n: number | null | undefined): string {
  return n == null ? "—" : `$${n.toLocaleString("es-AR")}`;
}
