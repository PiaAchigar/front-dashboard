import { Outlet } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { can, type Role } from "../../lib/permissions";
import { SectionSubnav } from "../../components/SectionSubnav";

const SUBNAV = [
  { to: "/admin/servicios", label: "Servicios", section: "catalogo" as const },
  { to: "/admin/proveedoras", label: "Proveedoras", section: "proveedoras" as const },
  { to: "/admin/categorias", label: "Categorías", section: "catalogo" as const },
  { to: "/admin/maquinas", label: "Máquinas", section: "catalogo" as const },
  { to: "/admin/promos", label: "Promos", section: "catalogo" as const },
];

export function AdminLayout() {
  const { role } = useAuth();
  const items = SUBNAV.filter((it) => can(role as Role | null, it.section, "view")).map(
    ({ to, label }) => ({ to, label }),
  );

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-4 pt-5 sm:px-6">
        <h1 className="font-display text-2xl text-ink">Administración</h1>
        <div className="mt-3">
          <SectionSubnav items={items} />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
