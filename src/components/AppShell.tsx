import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const navItems = [
  { to: "/agenda", label: "Agenda" },
  { to: "/facturacion", label: "Facturación" },
  { to: "/crm", label: "CRM" },
  { to: "/configuracion", label: "Configuración" },
];

export function AppShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className="w-56 shrink-0 flex flex-col"
        style={{ backgroundColor: "var(--color-sidebar)" }}
      >
        {/* Logo */}
        <div className="px-6 pt-8 pb-6 border-b border-white/10">
          <h1 className="font-display text-2xl text-surface">PiuBella</h1>
          <p className="text-xs text-surface/40 mt-0.5 font-sans uppercase tracking-widest">
            Dashboard
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4">
          {navItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                "flex items-center px-3 py-2 rounded text-sm font-sans mb-0.5 transition-colors " +
                (isActive
                  ? "bg-primary text-white"
                  : "text-surface/60 hover:bg-sidebar-hover hover:text-surface/90")
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="px-6 py-5 border-t border-white/10">
          <p className="text-xs text-surface/40 font-sans truncate">
            {user?.email}
          </p>
          <button
            onClick={handleSignOut}
            className="mt-1.5 text-xs text-surface/40 hover:text-surface/80 transition-colors font-sans cursor-pointer"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto bg-surface">
        <Outlet />
      </main>
    </div>
  );
}
