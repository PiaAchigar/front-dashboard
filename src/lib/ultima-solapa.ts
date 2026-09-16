/**
 * La última solapa que quedó abierta en cada sección.
 *
 * **El problema.** El sidebar apunta a la sección, no a la solapa: "Administración"
 * va a `/admin` y ahí un redirect fijo mandaba siempre a "Todos los servicios".
 * Si estabas en Estética → Combos, te ibas a la Agenda y volvías, aparecías en
 * otro lado (Pia, 2026-09-16).
 *
 * **Es por prefijo, y los prefijos se anidan.** Una ruta como
 * `/admin/estetica/combos` la recuerdan los dos prefijos que la contienen:
 * `/admin` y `/admin/estetica`. Así el sidebar "Administración" te devuelve a
 * donde estabas, y el sidebar "Estética" te devuelve a la solapa de esa área.
 *
 * `sessionStorage`, igual que la ruta recordada del CRM y de la agenda: es por
 * pestaña, y una pestaña nueva arranca en el destino por defecto.
 */

/**
 * Los prefijos que contienen esta ruta.
 *
 * Tiene que ser **estrictamente más profunda**: `/admin` no se recuerda a sí
 * mismo. Guardarlo haría que el índice de la sección redirija a la sección, o
 * sea a sí mismo, para siempre.
 */
export function prefijosQueRecuerdan(
  prefijos: readonly string[],
  ruta: string,
): string[] {
  return prefijos.filter((p) => ruta.startsWith(`${p}/`) && ruta.length > p.length + 1);
}

/**
 * A dónde mandar a la usuaria cuando entra a la sección por el sidebar.
 *
 * Se revalida que lo guardado siga colgando del prefijo: una clave vieja de
 * una ruta que ya no existe mandaría a una pantalla en blanco.
 */
export function destinoDeSeccion(
  guardada: string | null,
  prefijo: string,
  porDefecto: string,
): string {
  if (!guardada) return porDefecto;
  return prefijosQueRecuerdan([prefijo], guardada).length > 0 ? guardada : porDefecto;
}

const clave = (prefijo: string) => `piubella:solapa:${prefijo}`;

/** Sin storage no hay memoria, y es un lujo: no vale romper la pantalla. */
export function leerSolapa(prefijo: string): string | null {
  try {
    return sessionStorage.getItem(clave(prefijo));
  } catch {
    return null;
  }
}

export function guardarSolapa(prefijo: string, ruta: string): void {
  try {
    sessionStorage.setItem(clave(prefijo), ruta);
  } catch {
    // Modo privado o cookies bloqueadas: se pierde la memoria, nada más.
  }
}
