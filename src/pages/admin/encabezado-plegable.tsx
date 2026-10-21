import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

/**
 * El encabezado que se esconde al bajar (pedido de Pia, 2026-10-21).
 *
 * En Actividades y Capacitaciones, apenas Laura baja por una tabla, todo lo de
 * arriba —"Administración", la fila de áreas y el título de la sección— se
 * pliega y quedan sólo las solapas de la sección arriba de todo, con un borde
 * que avisa que hay filas escondidas por encima. Al volver arriba del todo, se
 * despliega.
 *
 * No se hace moviendo el scroll a la página entera: las tablas tienen su propio
 * scroll (con los títulos de las columnas fijos y el scroll de costado de las
 * tablas anchas), y un `<thead>` sticky deja de quedar fijo apenas un ancestro
 * tiene `overflow`. Por eso lo que se pliega es el encabezado, y el lugar que
 * libera se lo queda la tabla.
 *
 * El estado vive en `AdminLayout` (que es quien dibuja "Administración") y lo
 * mueve `GrupalLayout` (que es quien ve el scroll de sus pantallas).
 */
type Pliegue = { plegado: boolean; setPlegado: (p: boolean) => void };

const ContextoDePliegue = createContext<Pliegue | null>(null);

export function ProveedorDePliegue({ children }: { children: ReactNode }) {
  const [plegado, setPlegado] = useState(false);
  const { pathname } = useLocation();
  // Otra pantalla arranca arriba de todo: el encabezado tiene que verse.
  useEffect(() => setPlegado(false), [pathname]);
  return <ContextoDePliegue.Provider value={{ plegado, setPlegado }}>{children}</ContextoDePliegue.Provider>;
}

/**
 * El pliegue compartido. Fuera de un proveedor (los tests de una pantalla
 * suelta) cada uno tiene el suyo, así nada se rompe.
 */
export function usePliegue(): Pliegue {
  const compartido = useContext(ContextoDePliegue);
  const [plegado, setPlegado] = useState(false);
  return compartido ?? { plegado, setPlegado };
}

/**
 * Lo que se esconde al bajar. Se pliega a alto 0 (con la grilla `0fr`, que
 * anima la altura sin medirla) y queda `inert`: lo que no se ve no se puede
 * enfocar con el tabulador.
 */
export function Plegable({ children }: { children: ReactNode }) {
  const { plegado } = usePliegue();
  return (
    <div
      data-plegado={plegado ? "si" : undefined}
      aria-hidden={plegado || undefined}
      inert={plegado}
      className={[
        "grid shrink-0 transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none",
        plegado ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100",
      ].join(" ")}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

/**
 * Cuánto tiene que sobrar de tabla para que valga plegar: más o menos lo que
 * mide el encabezado. Con menos, al plegar la tabla entraría entera, el scroll
 * volvería a 0 y se desplegaría: un ida y vuelta que se ve como un salto.
 */
export const SOBRANTE_MINIMO_PX = 200;

/**
 * Para el `onScrollCapture` del contenedor: pliega al bajar y despliega al
 * volver arriba del todo. Sólo cuentan los movimientos verticales: el scroll
 * de costado de una tabla ancha o el de la tira de solapas no tocan nada.
 */
export function alScrollear(setPlegado: (p: boolean) => void) {
  return (e: { target: EventTarget }) => {
    const el = e.target;
    if (!(el instanceof HTMLElement)) return;
    const antes = ultimoTop.get(el) ?? 0;
    ultimoTop.set(el, el.scrollTop);
    if (el.scrollTop === antes) return; // se movió de costado
    if (el.scrollTop === 0) setPlegado(false);
    else if (el.scrollHeight - el.clientHeight > SOBRANTE_MINIMO_PX) setPlegado(true);
  };
}

/** El último `scrollTop` visto de cada contenedor, para saber si el scroll fue vertical. */
const ultimoTop = new WeakMap<HTMLElement, number>();
