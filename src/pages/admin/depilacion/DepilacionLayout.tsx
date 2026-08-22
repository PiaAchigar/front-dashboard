import { Outlet } from "react-router-dom";
import { SectionSubnav } from "../../../components/SectionSubnav";

const SUBNAV = [
  { to: "/admin/depilacion/zonas", label: "Zonas" },
  { to: "/admin/depilacion/precios", label: "Precios" },
  { to: "/admin/depilacion/combos", label: "Combos" },
];

export function DepilacionLayout() {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-4 pt-5 sm:px-6">
        <h1 className="font-display text-2xl text-ink">Depilación</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Zonas, precios y combos del motor de depilación definitiva.
        </p>
        <div className="mt-3">
          <SectionSubnav items={SUBNAV} />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
