import { Outlet } from "react-router-dom";
import { SectionSubnav } from "../../components/SectionSubnav";

const SUBNAV = [
  { to: "/sitio-web/textos/inicio", label: "Inicio" },
  { to: "/sitio-web/textos/categorias", label: "Categorías" },
];

/** El sub-menú de Sitio Web → Textos. */
export function TextosWebLayout() {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-4 pt-3 sm:px-6">
        <SectionSubnav items={SUBNAV} />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
