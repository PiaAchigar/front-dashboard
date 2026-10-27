import { SIN_AREA, TODAS, type Area } from "../lib/categorias-por-area";

/**
 * Las pastillas de área de Categorías: chicas y cada área de su color, para
 * que filtren sin robarle la vista a la tabla.
 *
 * Tres estados que no se pueden confundir: la elegida va rellena (filtra), la
 * prendida lleva un aro (ahí cae lo que se buscó) y el resto va suave.
 */

type Color = { suave: string; llena: string; aro: string };

// Clases escritas enteras: Tailwind no compila una clase armada en runtime.
const PALETA: Color[] = [
  {
    suave: "bg-pink-50 text-pink-800 border-pink-200",
    llena: "bg-pink-600 text-white border-pink-600",
    aro: "ring-2 ring-pink-500",
  },
  {
    suave: "bg-sky-50 text-sky-800 border-sky-200",
    llena: "bg-sky-600 text-white border-sky-600",
    aro: "ring-2 ring-sky-500",
  },
  {
    suave: "bg-emerald-50 text-emerald-800 border-emerald-200",
    llena: "bg-emerald-600 text-white border-emerald-600",
    aro: "ring-2 ring-emerald-500",
  },
  {
    suave: "bg-violet-50 text-violet-800 border-violet-200",
    llena: "bg-violet-600 text-white border-violet-600",
    aro: "ring-2 ring-violet-500",
  },
  {
    suave: "bg-amber-50 text-amber-800 border-amber-200",
    llena: "bg-amber-600 text-white border-amber-600",
    aro: "ring-2 ring-amber-500",
  },
  {
    suave: "bg-teal-50 text-teal-800 border-teal-200",
    llena: "bg-teal-600 text-white border-teal-600",
    aro: "ring-2 ring-teal-500",
  },
];
const GRIS: Color = {
  suave: "bg-stone-100 text-stone-700 border-stone-300",
  llena: "bg-stone-600 text-white border-stone-600",
  aro: "ring-2 ring-stone-500",
};
const TINTA: Color = {
  suave: "bg-white text-ink-soft border-surface-highest",
  llena: "bg-ink text-white border-ink",
  aro: "ring-2 ring-ink",
};

/** El color de un área sale de su lugar en el árbol: siempre el mismo para la misma área. */
function colorDe(areaId: string, areas: readonly Area[]): Color {
  if (areaId === SIN_AREA) return GRIS;
  const i = areas.findIndex((a) => a.id === areaId);
  return i < 0 ? GRIS : PALETA[i % PALETA.length];
}

export function FiltroDeAreas({
  areas,
  elegida,
  prendidas,
  onElegir,
}: {
  areas: readonly Area[];
  elegida: string;
  prendidas: ReadonlySet<string>;
  onElegir: (id: string) => void;
}) {
  const opciones = [
    { id: TODAS, name: "Todas", color: TINTA },
    ...areas.map((a) => ({
      id: a.id,
      name: a.name,
      color: colorDe(a.id, areas),
    })),
    { id: SIN_AREA, name: "Sin área", color: GRIS },
  ];
  return (
    <div role="group" aria-label="Filtrar por área" className="flex flex-wrap gap-1.5">
      {opciones.map((o) => {
        const esElegida = o.id === elegida;
        const prendida = prendidas.has(o.id);
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={esElegida}
            title={prendida ? "Lo que buscaste está en esta área" : undefined}
            onClick={() => onElegir(o.id)}
            className={[
              "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
              esElegida ? o.color.llena : o.color.suave,
              prendida ? `${o.color.aro} ring-offset-1` : "",
            ].join(" ")}
          >
            {o.name}
          </button>
        );
      })}
    </div>
  );
}

function servicios(n: number): string {
  return n === 1 ? "1 servicio" : `${n} servicios`;
}

/**
 * Las áreas de una fila. Con `cantidades`, cuántos servicios de la rama caen en
 * cada una, dicho con la palabra: un número suelto al lado del área se leía
 * como "subcategorías". Una cantidad en cero es un área heredada por colgar de
 * ella (Actividades, Depilación): se nombra el área sola.
 */
export function AreasDeFila({
  areaIds,
  areas,
  cantidades,
  vacia = false,
}: {
  areaIds: readonly string[];
  areas: readonly Area[];
  cantidades?: ReadonlyMap<string, number>;
  /** Sin ningún servicio: no es "sin área" (no hay nada mal ubicado), es vacía. */
  vacia?: boolean;
}) {
  if (areaIds.length === 0)
    return (
      <span
        className={`rounded-full border px-2 py-px text-[11px] ${vacia ? "border-dashed border-stone-300 text-ink-soft" : GRIS.suave}`}
      >
        {vacia ? "Sin servicios" : "Sin área"}
      </span>
    );
  return (
    <span className="flex flex-wrap gap-1">
      {areas
        .filter((a) => areaIds.includes(a.id))
        .map((a) => {
          const n = cantidades?.get(a.id) ?? 0;
          return (
            <span
              key={a.id}
              className={`whitespace-nowrap rounded-full border px-2 py-px text-[11px] ${colorDe(a.id, areas).suave}`}
            >
              {a.name}
              {n > 0 && <span className="opacity-75"> · {servicios(n)}</span>}
            </span>
          );
        })}
    </span>
  );
}

/**
 * Sumar o sacar un servicio de cada área, tocando la pastilla. La que está va
 * rellena; la que no, suave. La última que queda no se puede sacar: un
 * servicio sin área no aparece en ninguna pestaña (misma regla que el modal
 * del servicio).
 */
export function SelectorDeAreas({
  areas,
  todas = areas,
  elegidas,
  deshabilitado = false,
  onAlternar,
}: {
  areas: readonly Area[];
  /** Todas las áreas, para el color: tiene que ser el mismo que en la tabla
   *  aunque acá se muestren menos. */
  todas?: readonly Area[];
  elegidas: readonly string[];
  deshabilitado?: boolean;
  onAlternar: (areaId: string) => void;
}) {
  return (
    <div role="group" aria-label="Áreas del servicio" className="flex flex-wrap gap-1">
      {areas.map((a) => {
        const esta = elegidas.includes(a.id);
        const ultima = esta && elegidas.length === 1;
        const color = colorDe(a.id, todas);
        return (
          <button
            key={a.id}
            type="button"
            aria-pressed={esta}
            disabled={deshabilitado || ultima}
            title={
              ultima
                ? "Tiene que quedar en al menos un área"
                : esta
                  ? `Sacar de ${a.name}`
                  : `Sumar a ${a.name}`
            }
            onClick={() => onAlternar(a.id)}
            className={[
              "rounded-full border px-2 py-px text-[11px] font-medium transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
              esta ? color.llena : `${color.suave} opacity-70 hover:opacity-100`,
              ultima && !deshabilitado ? "cursor-not-allowed" : "",
            ].join(" ")}
          >
            {a.name}
          </button>
        );
      })}
    </div>
  );
}
