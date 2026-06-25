import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Globe,
  LayoutGrid,
  LogOut,
  Menu,
  Receipt,
  Settings,
  Users,
  type IconProps,
} from "./icons";

const COLLAPSED_KEY = "dashboard-sidebar-collapsed";

type NavItem = { to: string; label: string; icon: (p: IconProps) => React.ReactElement };

const navItems: NavItem[] = [
  { to: "/agenda",        label: "Agenda",        icon: Calendar },
  { to: "/admin",         label: "Administración", icon: LayoutGrid },
  { to: "/facturacion",   label: "Facturación",   icon: Receipt },
  { to: "/crm",           label: "CRM",           icon: Users },
  { to: "/sitio-web",     label: "Sitio Web",     icon: Globe },
  { to: "/configuracion", label: "Configuración", icon: Settings },
];

export function AppShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // Rail colapsado (solo desktop), persistido. Drawer mobile, efímero.
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === "1");
  const [mobileOpen, setMobileOpen] = useState(false);

  function toggleCollapsed() {
    setCollapsed((c) => {
      localStorage.setItem(COLLAPSED_KEY, c ? "0" : "1");
      return !c;
    });
  }

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  // Visibilidad de labels: en mobile el drawer siempre muestra labels (w-64);
  // en desktop se ocultan cuando el rail está colapsado.
  const labelHidden = collapsed ? "md:hidden" : "";

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Backdrop (solo mobile, cuando el drawer está abierto) */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar — drawer en mobile, rail/ancho en desktop */}
      <aside
        className={[
          "z-40 flex flex-col transition-[width,transform] duration-200 ease-in-out",
          "fixed inset-y-0 left-0 w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "md:static md:translate-x-0",
          collapsed ? "md:w-16" : "md:w-56",
        ].join(" ")}
        style={{ backgroundColor: "var(--color-sidebar)" }}
      >
        {/* Header: logo + toggle colapsar (desktop) */}
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 pt-6 pb-5">
          <div className={`pl-1 ${labelHidden}`}>
            <h1 className="font-display text-xl leading-none text-surface">PiuBella</h1>
            <p className="mt-0.5 font-sans text-[10px] uppercase tracking-widest text-surface/40">
              Dashboard
            </p>
          </div>
          <button
            onClick={toggleCollapsed}
            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded text-surface/50 transition-colors hover:bg-sidebar-hover hover:text-surface md:inline-flex"
            aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-4">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              title={label}
              className={({ isActive }) =>
                [
                  "mb-0.5 flex items-center gap-3 rounded px-3 py-2 font-sans text-sm transition-colors",
                  collapsed ? "md:justify-center" : "",
                  isActive
                    ? "bg-primary text-white"
                    : "text-surface/60 hover:bg-sidebar-hover hover:text-surface/90",
                ].join(" ")
              }
            >
              <Icon size={18} className="shrink-0" />
              <span className={labelHidden}>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Usuario / cerrar sesión */}
        <div className="border-t border-white/10 px-2 py-3">
          <p className={`truncate px-2 pb-1 font-sans text-[11px] text-surface/40 ${labelHidden}`}>
            {user?.email}
          </p>
          <button
            onClick={handleSignOut}
            title="Cerrar sesión"
            className={[
              "flex w-full items-center gap-3 rounded px-3 py-2 font-sans text-xs text-surface/50 transition-colors hover:bg-sidebar-hover hover:text-surface/90",
              collapsed ? "md:justify-center" : "",
            ].join(" ")}
          >
            <LogOut size={16} className="shrink-0" />
            <span className={labelHidden}>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top-bar mobile (con hamburguesa) */}
        <header className="flex shrink-0 items-center gap-3 border-b border-surface-high bg-surface-low px-4 py-3 md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
            className="text-ink"
          >
            <Menu size={22} />
          </button>
          <h1 className="font-display text-lg text-ink">PiuBella</h1>
        </header>

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
