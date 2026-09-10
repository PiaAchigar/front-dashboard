import { useState } from "react";
import { Outlet } from "react-router-dom";
import { SectionSubnav } from "../../components/SectionSubnav";
import { solapasDeArea, type AreaDeCatalogo } from "../../lib/admin-nav";
import type { ContextoDeArea } from "./contexto-de-area";

/**
 * Las tres solapas de un área del catálogo: Servicios · Combos · Packs.
 *
 * Es el mismo patrón que ya usa Depilación (`DepilacionLayout`), y a propósito:
 * cinco áreas que se navegan igual se aprenden una vez.
 *
 * El orden va de lo simple a lo compuesto, que es como se arman las cosas
 * (spec §4.1): no se puede hacer un combo sin servicios, ni un pack sin algo
 * que repetir.
 *
 * **Un solo scroll, y es este.** El título y las solapas quedan fijos, y todo
 * lo que va abajo —cartel, buscador y tabla— desfila en un único scroll
 * vertical. Antes la tabla scrolleaba adentro de su propia caja de alto fijo:
 * con la pantalla de un portátil eso dejaba cuatro filas a la vista y no había
 * forma de agrandarlas. Ahora la tabla crece a lo que necesite y quien manda es
 * este contenedor. Por eso las pantallas de área le pasan `alturaLibre` al
 * `ResourceManager`: sin eso habría dos barras de scroll, una adentro de la
 * otra, que es peor que el problema original.
 */
export function AreaLayout({ area }: { area: AreaDeCatalogo }) {
  // `useState` y no `useRef` para el hueco: el portal necesita que el componente
  // se vuelva a dibujar cuando el nodo existe, y una ref no avisa de eso.
  const [slotAcciones, setSlotAcciones] = useState<HTMLElement | null>(null);
  const contexto: ContextoDeArea = { slotAcciones };

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-4 pt-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl text-ink">{area.categoria}</h1>
          {/* El hueco donde la pantalla de abajo dibuja su botón Agregar. */}
          <div ref={setSlotAcciones} className="shrink-0" />
        </div>
        <p className="mt-1 text-sm text-ink-soft">{area.bajada}</p>
        <div className="mt-3">
          <SectionSubnav items={solapasDeArea(area)} />
        </div>
      </div>
      <div className="modal-scroll min-h-0 flex-1 overflow-y-auto">
        <Outlet context={contexto} />
      </div>
    </div>
  );
}
