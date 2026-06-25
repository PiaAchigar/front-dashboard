import { Outlet } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { SectionSubnav } from "../../components/SectionSubnav";

const SUBNAV = [
  { to: "/configuracion/empresa", label: "Datos de empresa" },
  { to: "/configuracion/usuarios", label: "Usuarios" },
];

export function ConfiguracionLayout() {
  const { role } = useAuth();

  if (role !== "admin") {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <h1 className="font-display text-2xl text-ink">Configuración</h1>
        <p className="mt-2 max-w-sm text-sm text-ink-soft">
          Esta sección es solo para administradores.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-4 pt-5 sm:px-6">
        <h1 className="font-display text-2xl text-ink">Configuración</h1>
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
