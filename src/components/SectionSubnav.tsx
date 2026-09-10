import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "./icons";
import { extremosOcultos } from "../lib/desplazamiento";

export type SubnavItem = {
  to: string;
  label: string;
  /**
   * Aclaración chiquita al lado de la etiqueta, entre paréntesis.
   *
   * Es un campo aparte y no parte de `label` porque va en otro tamaño: Pia
   * pidió "Combos (Tratamientos)" con la segunda palabra más chica, a modo
   * informativo. Con `label` siendo un string no hay forma de darle otro
   * tamaño, y volverlo ReactNode obligaría a que la config de las pestañas
   * fuera JSX y dejara de poder testearse sin montar React.
   */
  sub?: string;
  /**
   * Acento de la pestaña: las dos clases, escritas enteras. No se deriva una de
   * la otra — Tailwind no compila clases que no aparezcan literales en el
   * código, y el subrayado quedaría invisible.
   */
  accent?: { texto: string; barra: string };
};

/** Velocidad del desplazamiento por hover. A 420 px/s la tira entera de
 *  Administración (unos 1200 px de sobra) se recorre en menos de tres segundos
 *  sin que las etiquetas se vuelvan ilegibles al pasar. */
const PX_POR_SEGUNDO = 420;

/** Cuánto avanza un click: casi una pantalla, dejando una pestaña a la vista
 *  como referencia de dónde estabas. */
const SALTO = 0.8;

/**
 * Sub-navbar horizontal para alternar entre entidades dentro de una sección.
 *
 * La tira desborda —Administración tiene doce pestañas— pero el desborde NO se
 * navega con una barra de scroll: se navega con dos flechas en los extremos que
 * aparecen sólo cuando hay algo cortado de ese lado. El mouse encima desplaza
 * de corrido; el click salta casi una pantalla.
 *
 * El acento se aplica al TEXTO y al subrayado de la pestaña activa, nunca como
 * fondo: los cuatro acentos de Administración necesitan colores de texto
 * distintos para pasar contraste AA sobre fondo relleno, y eso haría que el
 * texto cambiara de color de pestaña en pestaña. Como acento sobre
 * `--color-surface` los cuatro pasan holgados.
 *
 * El color acompaña al nombre, no lo reemplaza: cada pestaña siempre muestra su
 * etiqueta, así que quien no distingue esos tonos usa el sistema igual.
 */
export function SectionSubnav({ items }: { items: SubnavItem[] }) {
  const tira = useRef<HTMLDivElement>(null);
  const [oculto, setOculto] = useState({ izquierda: false, derecha: false });
  const animacion = useRef<number | null>(null);

  const medir = useCallback(() => {
    if (tira.current) setOculto(extremosOcultos(tira.current));
  }, []);

  // `useLayoutEffect` y no `useEffect`: si midiera después de pintar, las
  // flechas aparecerían un cuadro tarde y se vería el parpadeo.
  useLayoutEffect(() => {
    medir();
    const el = tira.current;
    if (!el) return;

    // La tira cambia de ancho al plegar el sidebar o al girar la tablet, y su
    // contenido cambia de ancho cuando termina de cargar la tipografía.
    const observador =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(medir) : null;
    observador?.observe(el);
    window.addEventListener("resize", medir);
    document.fonts?.ready.then(medir).catch(() => {});

    return () => {
      observador?.disconnect();
      window.removeEventListener("resize", medir);
    };
  }, [medir, items]);

  const detener = useCallback(() => {
    if (animacion.current !== null) cancelAnimationFrame(animacion.current);
    animacion.current = null;
  }, []);

  /**
   * Desplaza de corrido mientras el mouse esté encima.
   *
   * Avanza por tiempo transcurrido, no por cuadro: en una máquina lenta la tira
   * se mueve a la misma velocidad, con menos cuadros. El primer cuadro no mueve
   * nada porque todavía no hay un delta contra el cual medir.
   */
  const arrancar = useCallback(
    (direccion: 1 | -1) => {
      detener();
      let anterior: number | null = null;
      const paso = (t: number) => {
        const el = tira.current;
        if (!el) return;
        if (anterior !== null) el.scrollLeft += direccion * PX_POR_SEGUNDO * ((t - anterior) / 1000);
        anterior = t;
        medir();
        animacion.current = requestAnimationFrame(paso);
      };
      animacion.current = requestAnimationFrame(paso);
    },
    [detener, medir],
  );

  // Si el componente se desmonta con el mouse encima, el bucle quedaría vivo
  // escribiendo sobre un nodo que ya no está.
  useEffect(() => detener, [detener]);

  function saltar(direccion: 1 | -1) {
    const el = tira.current;
    if (el) el.scrollLeft += direccion * el.clientWidth * SALTO;
  }

  // Las clases de las flechas van escritas enteras en cada rama en vez de
  // armarse con un template string: Tailwind escanea el código como texto
  // plano y una clase compuesta en runtime no llega al CSS compilado.
  const claseBoton =
    "pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full " +
    "border border-surface-high bg-surface-low text-ink-soft shadow-sm " +
    "transition-colors hover:border-primary/40 hover:bg-surface hover:text-primary";

  return (
    <div className="relative border-b border-surface-high">
      <div ref={tira} onScroll={medir} className="subnav-tira flex gap-1 overflow-x-auto">
        {items.map((it) => {
          const acento = it.accent ?? { texto: "text-primary", barra: "bg-primary" };
          return (
            <NavLink
              key={it.to}
              to={it.to}
              className={({ isActive }) =>
                `relative whitespace-nowrap px-4 py-2.5 text-sm transition-colors ${
                  isActive ? `font-medium ${acento.texto}` : "text-ink-soft hover:text-ink"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {it.label}
                  {it.sub && (
                    <span className="ml-1 text-[0.7em] text-ink-soft">({it.sub})</span>
                  )}
                  {isActive && (
                    <span
                      className={`absolute inset-x-2 -bottom-px h-0.5 rounded-full ${acento.barra}`}
                    />
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </div>

      {/* Las flechas se ocultan con `aria-hidden` además de con opacidad: sin
          eso, un lector de pantalla anunciaría dos controles que no hacen nada.
          `tabIndex={-1}` es a propósito — con el teclado se tabula por las
          pestañas y el navegador ya las trae a la vista solo. */}
      <div
        aria-hidden={!oculto.izquierda}
        className={`pointer-events-none absolute bottom-px left-0 top-0 flex items-center bg-gradient-to-r from-surface via-surface to-transparent pl-0.5 pr-7 transition-opacity duration-150 ${
          oculto.izquierda ? "opacity-100" : "opacity-0"
        }`}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-label="Ver las pestañas de la izquierda"
          className={claseBoton}
          onMouseEnter={() => arrancar(-1)}
          onMouseLeave={detener}
          onClick={() => saltar(-1)}
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      <div
        aria-hidden={!oculto.derecha}
        className={`pointer-events-none absolute bottom-px right-0 top-0 flex items-center bg-gradient-to-l from-surface via-surface to-transparent pl-7 pr-0.5 transition-opacity duration-150 ${
          oculto.derecha ? "opacity-100" : "opacity-0"
        }`}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-label="Ver las pestañas de la derecha"
          className={claseBoton}
          onMouseEnter={() => arrancar(1)}
          onMouseLeave={detener}
          onClick={() => saltar(1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
