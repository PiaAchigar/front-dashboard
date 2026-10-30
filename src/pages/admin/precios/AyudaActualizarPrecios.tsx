import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, HelpCircle } from "../../../components/icons";

/**
 * La ayuda de Actualizar precios (pedido de Pia, 2026-10-30): qué hace la
 * pantalla, qué toca y qué no. Escrita para Laura. Mismo patrón que la del
 * Nuevo turno de front-agenda.
 */

const VISTA = "ayuda-actualizar-precios-vista";

/** La primera vez en esta computadora: true una sola vez, y queda anotado. */
function usePrimeraVez(): boolean {
  const [primera] = useState(() => {
    try {
      return !localStorage.getItem(VISTA);
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (!primera) return;
    try {
      localStorage.setItem(VISTA, "1");
    } catch {
      // Sin almacenamiento: late cada vez, no pasa nada.
    }
  }, [primera]);
  return primera;
}

/** El (?) del título. La primera vez da tres latidos de luz para decir "acá estoy". */
export function BotonAyuda({ abierta, onClick }: { abierta: boolean; onClick: () => void }) {
  const late = usePrimeraVez();
  return (
    <button
      type="button"
      aria-label="Cómo actualizar precios"
      aria-expanded={abierta}
      title="Ayuda"
      onClick={onClick}
      className={[
        "shrink-0 rounded-full p-1.5 transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        abierta ? "bg-primary/10 text-primary" : "text-ink-soft hover:bg-surface-high hover:text-ink",
        late ? "ayuda-latido" : "",
      ].join(" ")}
    >
      <HelpCircle size={20} aria-hidden />
    </button>
  );
}

/** Ocupa el lugar de la pantalla; lo que Laura había armado sigue cargado detrás. */
export function AyudaActualizarPrecios({ onVolver }: { onVolver: () => void }) {
  const arriba = useRef<HTMLDivElement>(null);
  // Con llaves: en Chrome nuevo scrollIntoView devuelve una promesa, y si el
  // efecto la devuelve React la toma por limpieza y rompe al desmontar.
  useEffect(() => {
    arriba.current?.scrollIntoView?.({ block: "start" });
  }, []);

  return (
    <div ref={arriba} className="space-y-4 text-sm text-ink">
      <BotonVolver onClick={onVolver} />

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Para qué sirve</h2>
        <p>
          Subir o bajar los precios de todo un grupo de servicios de una sola vez, en vez de uno por uno.
          Antes de aplicar ves cómo queda cada servicio, y recién cuando tocás <b>Aplicar</b> se guarda.
        </p>
      </section>

      <Tema titulo="Cambia el precio de lista y el de efectivo">
        <p>
          Siempre los dos, con el mismo porcentaje o el mismo monto. No se puede cambiar uno solo desde acá.
        </p>
      </Tema>

      <Tema titulo="Qué servicios entran y cuáles no">
        <p>
          Entran los servicios <b>activos</b> de la categoría que elegís y de todas sus subcategorías.
        </p>
        <p>
          No entran <b>depilación</b>, <b>actividades</b> ni <b>capacitaciones</b>: esos precios se cambian
          en sus propias pantallas.
        </p>
      </Tema>

      <Tema titulo="El redondeo">
        <p>
          Después de calcular, el precio se redondea al múltiplo que elijas, para que no queden precios
          raros.
        </p>
        <p>
          Ejemplo: un servicio de $45.150 con un aumento del 10% da $49.665. Redondeado a $1.000 queda en{" "}
          <b>$50.000</b>.
        </p>
      </Tema>

      <Tema titulo="Si un servicio no querés tocarlo">
        <p>
          En la lista de servicios podés <b>destildar</b> los que quieras dejar como están. El resto se
          actualiza igual.
        </p>
      </Tema>

      <Tema titulo="Los combos no se actualizan solos">
        <p>
          Si cambiás el precio de un servicio, los combos y packs que lo incluyen no se modifican. Después
          de aplicar, revisalos con los links que aparecen en pantalla.
        </p>
      </Tema>

      <Tema titulo="Al bajar, nunca queda en $0">
        <p>
          Si bajás, no se permite dejar ningún precio en $0. Si algún servicio quedaría así, la pantalla
          te lo marca y tenés que corregirlo antes de aplicar.
        </p>
      </Tema>

      <Tema titulo="Queda registrado">
        <p>
          Cada ajuste que aplicás queda guardado en el historial: quién lo hizo, cuándo, y el precio de cada
          servicio antes y después.
        </p>
      </Tema>

      <BotonVolver onClick={onVolver} />
    </div>
  );
}

function BotonVolver({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-ml-2 flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-primary-dark transition-colors hover:bg-surface-high focus-visible:outline-2 focus-visible:outline-primary"
    >
      <ChevronLeft size={16} aria-hidden />
      Volver
    </button>
  );
}

/** Lo que no hace falta leer de entrada: cerrado, se abre al tocarlo. */
function Tema({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <details className="group rounded-xl border border-surface-highest bg-white">
      <summary className="cursor-pointer list-none px-3 py-2 font-medium marker:hidden">
        <span className="mr-1.5 inline-block text-ink-soft transition-transform group-open:rotate-90">›</span>
        {titulo}
      </summary>
      <div className="space-y-2 px-3 pb-3">{children}</div>
    </details>
  );
}
