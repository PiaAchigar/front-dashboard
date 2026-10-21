import { useState } from "react";
import { Outlet } from "react-router-dom";
import { SectionSubnav } from "../../../components/SectionSubnav";
import type { ContextoDeArea } from "../contexto-de-area";
import { Plegable, alScrollear, usePliegue } from "../encabezado-plegable";

/**
 * El esqueleto de Actividades y Capacitaciones: título fijo, bajada, solapas y
 * un único scroll para todo lo de abajo. Es el mismo de `AreaLayout` (ver ahí
 * el porqué del scroll único), pero con las solapas por parámetro porque estas
 * dos secciones no son un área del catálogo.
 *
 * Da el mismo `ContextoDeArea`: así una pantalla de adentro puede subir su
 * botón Agregar al renglón del título, como en las áreas.
 *
 * Al bajar por una tabla, el título y la bajada (y "Administración" con la
 * fila de áreas, ver `encabezado-plegable.tsx`) se esconden y quedan sólo las
 * solapas, con un borde que avisa que hay filas arriba.
 */
export function GrupalLayout({
  titulo,
  bajada,
  solapas,
}: {
  titulo: string;
  bajada: string;
  solapas: { to: string; label: string }[];
}) {
  // `useState` y no `useRef`: el portal necesita que se redibuje cuando el nodo existe.
  const [slotAcciones, setSlotAcciones] = useState<HTMLElement | null>(null);
  const contexto: ContextoDeArea = { slotAcciones };
  const { plegado, setPlegado } = usePliegue();

  return (
    <div className="flex h-full flex-col" onScrollCapture={alScrollear(setPlegado)}>
      <div className="shrink-0 px-4 sm:px-6">
        <Plegable>
          <div className="pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="font-display text-2xl text-ink">{titulo}</h1>
              <div ref={setSlotAcciones} className="shrink-0" />
            </div>
            <p className="mt-1 text-sm text-ink-soft">{bajada}</p>
          </div>
        </Plegable>
        <div
          data-testid="solapas-de-la-seccion"
          data-hay-abajo={plegado ? "si" : undefined}
          className={[
            "mt-3 border-b-2 transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none",
            plegado ? "border-primary shadow-[0_6px_8px_-6px_rgba(0,0,0,0.25)]" : "border-transparent",
          ].join(" ")}
        >
          <SectionSubnav items={solapas} />
        </div>
      </div>
      <div className="modal-scroll min-h-0 flex-1 overflow-y-auto">
        <Outlet context={contexto} />
      </div>
    </div>
  );
}
