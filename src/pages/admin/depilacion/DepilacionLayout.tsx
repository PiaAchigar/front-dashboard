import { useState } from "react";
import { Outlet } from "react-router-dom";
import { SectionSubnav } from "../../../components/SectionSubnav";
import type { ContextoDeArea } from "../contexto-de-area";

const SUBNAV = [
  { to: "/admin/depilacion/zonas", label: "Zonas" },
  // "Packs" en chiquito porque el armado del pack de depilación vive acá
  // adentro —"Pack de sesiones (por defecto)"— y no en una solapa propia como
  // en el resto de las áreas. Sin la aclaración nadie lo encuentra: es la
  // única área donde Packs no figura en la barra (pedido de Pia, 2026-09-10).
  { to: "/admin/depilacion/precios", label: "Precios", sub: "Packs" },
  { to: "/admin/depilacion/combos", label: "Combos" },
];

/**
 * Depilación se navega igual que las otras áreas, y por eso comparte con ellas
 * el mismo trato del encabezado (ver `AreaLayout`): el botón Agregar sube al
 * renglón del título y el scroll vertical es uno solo, el del contenido.
 *
 * Antes la tabla de Zonas mostraba cinco filas en un portátil, con una fila
 * entera gastada en repetir "Zonas" —que ya lo dice la solapa activa— al lado
 * del botón.
 */
export function DepilacionLayout() {
  // `useState` y no `useRef`: el portal necesita que el componente se vuelva a
  // dibujar cuando el nodo existe, y una ref no avisa de eso.
  const [slotAcciones, setSlotAcciones] = useState<HTMLElement | null>(null);
  const contexto: ContextoDeArea = { slotAcciones };

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-4 pt-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl text-ink">Depilación</h1>
          {/* El hueco donde la pantalla de abajo dibuja su botón Agregar. */}
          <div ref={setSlotAcciones} className="shrink-0" />
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          Zonas, precios y combos del motor de depilación definitiva.
        </p>
        <div className="mt-3">
          <SectionSubnav items={SUBNAV} />
        </div>
      </div>
      <div className="modal-scroll min-h-0 flex-1 overflow-y-auto">
        <Outlet context={contexto} />
      </div>
    </div>
  );
}
