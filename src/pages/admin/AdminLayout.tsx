import { Outlet } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { can, type Role } from "../../lib/permissions";
import { SectionSubnav } from "../../components/SectionSubnav";
import { PESTANAS, acentoDe } from "../../lib/admin-nav";
import { useServicesAdmin } from "../../hooks/useServicesAdmin";
import { nombresDeArea, useAreas } from "../../hooks/useAreas";
import { contarSinArea } from "../../lib/areas";

export function AdminLayout() {
  const { role } = useAuth();

  // "Sin clasificar" es una pestaña de rescate: aparece SOLO cuando hay algo
  // que rescatar. Una pestaña permanente en cero enseña a ignorarla, y esta
  // tiene que llamar la atención justo el día que deje de estar vacía.
  // Las dos consultas ya están cacheadas por las pantallas de adentro.
  const { data: servicios = [] } = useServicesAdmin(false);
  const { data: areas = [] } = useAreas();
  const huerfanos = contarSinArea(servicios, nombresDeArea(areas));

  const items = PESTANAS.filter((it) => can(role as Role | null, it.section, "view")).map(
    ({ to, label, grupo }) => ({ to, label, accent: acentoDe(grupo) }),
  );
  if (huerfanos > 0 && can(role as Role | null, "catalogo", "view")) {
    items.push({
      to: "/admin/sin-clasificar",
      label: `Sin clasificar (${huerfanos})`,
      accent: acentoDe("promo"),
    });
  }

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
