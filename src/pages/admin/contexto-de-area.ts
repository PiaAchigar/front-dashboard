import { useOutletContext } from "react-router-dom";

/**
 * Lo que el layout de un área le presta a su pantalla hija.
 *
 * Existe por una razón de espacio: en un portátil, entre la barra de
 * Administración, el título del área, las tres solapas y el buscador, a la
 * tabla le quedaban cuatro filas visibles. La fila propia del
 * `ResourceManager` —un `<h2>` que repetía lo que ya decía la solapa, más el
 * botón Agregar— se llevaba casi cincuenta píxeles para no decir nada nuevo.
 *
 * Así que el botón sube al renglón del título del área. Como el layout está
 * por encima de la pantalla que lo necesita, el dato viaja al revés de lo
 * normal: el layout expone un hueco del DOM y la pantalla dibuja ahí adentro
 * con `createPortal`.
 */
export type ContextoDeArea = {
  /** Dónde dibujar el botón de acción. `null` mientras no montó. */
  slotAcciones: HTMLElement | null;
};

/**
 * El contexto del área, o `null` si la pantalla se montó fuera de un área.
 *
 * `ServiciosAdminPage` corre en los dos lados —adentro de un área y suelta en
 * "Todos los servicios"—, así que la ausencia de contexto es un caso normal,
 * no un error.
 */
export function useContextoDeArea(): ContextoDeArea | null {
  return useOutletContext<ContextoDeArea | null>() ?? null;
}
