import { Outlet } from "react-router-dom";
import { SectionSubnav } from "../../components/SectionSubnav";
import { solapasDeArea, type AreaDeCatalogo } from "../../lib/admin-nav";

/**
 * Las tres solapas de un área del catálogo: Servicios · Combos · Packs.
 *
 * Es el mismo patrón que ya usa Depilación (`DepilacionLayout`), y a propósito:
 * cinco áreas que se navegan igual se aprenden una vez.
 *
 * El orden va de lo simple a lo compuesto, que es como se arman las cosas
 * (spec §4.1): no se puede hacer un combo sin servicios, ni un pack sin algo
 * que repetir.
 */
export function AreaLayout({ area }: { area: AreaDeCatalogo }) {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-4 pt-5 sm:px-6">
        <h1 className="font-display text-2xl text-ink">{area.categoria}</h1>
        <p className="mt-1 text-sm text-ink-soft">{area.bajada}</p>
        <div className="mt-3">
          <SectionSubnav items={solapasDeArea(area)} />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
