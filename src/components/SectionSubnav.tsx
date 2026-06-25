import { NavLink } from "react-router-dom";

/** Sub-navbar horizontal para alternar entre entidades dentro de una sección. */
export function SectionSubnav({ items }: { items: { to: string; label: string }[] }) {
  return (
    <div className="flex gap-1 border-b border-surface-high">
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          className={({ isActive }) =>
            `relative whitespace-nowrap px-4 py-2.5 text-sm transition-colors ${
              isActive ? "font-medium text-primary" : "text-ink-soft hover:text-ink"
            }`
          }
        >
          {({ isActive }) => (
            <>
              {it.label}
              {isActive && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
              )}
            </>
          )}
        </NavLink>
      ))}
    </div>
  );
}
