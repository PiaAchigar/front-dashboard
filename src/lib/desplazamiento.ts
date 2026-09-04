/**
 * Qué extremos de una tira horizontal quedaron fuera de la vista.
 *
 * Es lo que decide si se muestra cada flecha de `SectionSubnav`. Vive acá,
 * separado del componente, porque es aritmética pura y se puede probar sin
 * montar React ni simular un navegador con layout.
 */

/** Las tres medidas de un elemento que scrollea. Un `HTMLElement` encaja tal cual. */
export type Vista = { scrollLeft: number; scrollWidth: number; clientWidth: number };

export type Extremos = { izquierda: boolean; derecha: boolean };

/**
 * Un pixel de tolerancia.
 *
 * Los anchos de un layout flexible casi nunca son enteros, y el navegador
 * redondea `scrollWidth` para arriba. Sin este margen, una tira que entra justa
 * reporta un pixel de desborde y muestra para siempre una flecha derecha que no
 * desplaza nada — que es justo el defecto que las flechas vienen a reemplazar.
 */
const TOLERANCIA = 1;

export function extremosOcultos(v: Vista): Extremos {
  return {
    izquierda: v.scrollLeft > TOLERANCIA,
    derecha: v.scrollLeft + v.clientWidth < v.scrollWidth - TOLERANCIA,
  };
}
