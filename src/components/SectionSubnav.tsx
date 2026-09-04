import { NavLink } from "react-router-dom";

export type SubnavItem = {
  to: string;
  label: string;
  /**
   * Acento de la pestaña: las dos clases, escritas enteras. No se deriva una de
   * la otra — Tailwind no compila clases que no aparezcan literales en el
   * código, y el subrayado quedaría invisible.
   */
  accent?: { texto: string; barra: string };
};

/**
 * Sub-navbar horizontal para alternar entre entidades dentro de una sección.
 *
 * El acento se aplica al TEXTO y al subrayado de la pestaña activa, nunca como
 * fondo: los cuatro acentos de Administración necesitan colores de texto
 * distintos para pasar contraste AA sobre fondo relleno, y eso haría que el
 * texto cambiara de color de pestaña en pestaña. Como acento sobre
 * `--color-surface` los cuatro pasan holgados.
 *
 * El color acompaña al nombre, no lo reemplaza: cada pestaña siempre muestra su
 * etiqueta, así que quien no distingue esos tonos usa el sistema igual.
 */
export function SectionSubnav({ items }: { items: SubnavItem[] }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-surface-high">
      {items.map((it) => {
        const acento = it.accent ?? { texto: "text-primary", barra: "bg-primary" };
        return (
          <NavLink
            key={it.to}
            to={it.to}
            className={({ isActive }) =>
              `relative whitespace-nowrap px-4 py-2.5 text-sm transition-colors ${
                isActive ? `font-medium ${acento.texto}` : "text-ink-soft hover:text-ink"
              }`
            }
          >
            {({ isActive }) => (
              <>
                {it.label}
                {isActive && (
                  <span
                    className={`absolute inset-x-2 -bottom-px h-0.5 rounded-full ${acento.barra}`}
                  />
                )}
              </>
            )}
          </NavLink>
        );
      })}
    </div>
  );
}
