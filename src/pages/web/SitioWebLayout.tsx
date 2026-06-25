import { Outlet } from "react-router-dom";
import { SectionSubnav } from "../../components/SectionSubnav";

const SUBNAV = [
  { to: "/sitio-web/visibles", label: "Visibles" },
  { to: "/sitio-web/destacados", label: "Destacados" },
  { to: "/sitio-web/textos", label: "Textos" },
  { to: "/sitio-web/galeria", label: "Galería" },
  { to: "/sitio-web/testimonios", label: "Testimonios" },
  { to: "/sitio-web/faq", label: "FAQ" },
];

export function SitioWebLayout() {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-4 pt-5 sm:px-6">
        <h1 className="font-display text-2xl text-ink">Sitio Web</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Gestioná el contenido que se muestra en la página pública de PiuBella.
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
