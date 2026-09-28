import { Outlet } from "react-router-dom";
import { SectionSubnav } from "../../../components/SectionSubnav";

const SUBNAV = [
  { to: "/admin/depilacion/configuracion/comision", label: "Comisión" },
  { to: "/admin/depilacion/configuracion/precios", label: "Precios por zona" },
];

/**
 * Las dos mitades de la configuración de depilación: quién la hace y cuánto
 * cobra, y cuánto sale cada zona. Reusa el mismo `SectionSubnav` de las
 * pestañas grandes — una segunda barra de navegación propia sería otro
 * componente que mantener para la misma decisión de siempre.
 */
export function ConfiguracionLayout() {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-4 pt-3 sm:px-6">
        <SectionSubnav items={SUBNAV} />
      </div>
      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
