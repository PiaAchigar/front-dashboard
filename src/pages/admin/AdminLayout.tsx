import { Outlet } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { can, type Role } from "../../lib/permissions";
import { SectionSubnav } from "../../components/SectionSubnav";
import { PESTANAS, acentoDe } from "../../lib/admin-nav";

export function AdminLayout() {
  const { role } = useAuth();
  const items = PESTANAS.filter((it) => can(role as Role | null, it.section, "view")).map(
    ({ to, label, grupo }) => ({ to, label, accent: acentoDe(grupo) }),
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
