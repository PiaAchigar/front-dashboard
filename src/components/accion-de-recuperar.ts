/**
 * El botón que devuelve algo pausado, de baja o archivado (Reactivar,
 * Restaurar). Va en el marrón de la marca, con borde, y al pasar el mouse se
 * llena: en una fila apagada tiene que leerse como lo único vivo, no como un
 * botón deshabilitado más. Blanco sobre `primary-dark` pasa AA; sobre
 * `primary` no.
 */
export const ACCION_RECUPERAR =
  "rounded-full border border-primary/50 bg-white text-primary-dark transition-colors " +
  "hover:border-primary-dark hover:bg-primary-dark hover:text-white " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " +
  "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-primary-dark";

/**
 * Apaga una fila pausada o archivada menos su última celda (la de acciones):
 * con `opacity` en el `<tr>` los botones también se apagaban y parecían
 * deshabilitados.
 */
export const FILA_APAGADA = "[&>td:not(:last-child)]:opacity-60";
