export const TIP_ANCHO = 260;
const TIP_SEPARACION = 8;

/**
 * Dónde poner el globo de ayuda, en coordenadas de ventana.
 *
 * Preferencia: arriba del ícono. Si no entra arriba, abajo. Si tampoco entra
 * abajo, contra el borde que tenga más lugar — el resultado nunca se sale de
 * la ventana.
 *
 * `alto` tiene que ser el alto MEDIDO del globo. Estimarlo fue el bug: con un
 * texto largo el globo mide ~167px, no los ~96 que se suponían, así que se
 * decidía abrir hacia arriba cuando en realidad no entraba y el `top` quedaba
 * negativo — el globo terminaba por debajo de la barra del navegador.
 */
export function posicionDelGlobo(
  ancla: { top: number; bottom: number; left: number; width: number },
  alto: number,
  ventana: { alto: number; ancho: number },
): { top: number; left: number } {
  let top = ancla.top - TIP_SEPARACION - alto;
  if (top < TIP_SEPARACION) {
    const debajo = ancla.bottom + TIP_SEPARACION;
    top =
      debajo + alto <= ventana.alto - TIP_SEPARACION
        ? debajo
        : Math.max(TIP_SEPARACION, ventana.alto - TIP_SEPARACION - alto);
  }

  const left = Math.min(
    Math.max(TIP_SEPARACION, ancla.left + ancla.width / 2 - TIP_ANCHO / 2),
    Math.max(TIP_SEPARACION, ventana.ancho - TIP_ANCHO - TIP_SEPARACION),
  );
  return { top, left };
}
