import { Outlet } from "react-router-dom";
import { SectionSubnav } from "../../components/SectionSubnav";

const SUBNAV = [
  { to: "/admin/servicios", label: "Servicios" },
  { to: "/admin/proveedoras", label: "Proveedoras" },
  { to: "/admin/categorias", label: "Categorías" },
  { to: "/admin/maquinas", label: "Máquinas" },
  { to: "/admin/promos", label: "Promos" },
];

export function AdminLayout() {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-4 pt-5 sm:px-6">
        <h1 className="font-display text-2xl text-ink">Administración</h1>
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
