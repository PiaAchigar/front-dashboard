/** Switch on/off reutilizable para columnas de visibilidad/destacado. */
export function Toggle({
  active,
  onChange,
  disabled,
  label,
}: {
  active: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!active)}
      disabled={disabled}
      aria-label={label ?? (active ? "Desactivar" : "Activar")}
      className={`relative h-6 w-10 flex-shrink-0 rounded-full transition-colors ${
        active ? "bg-primary" : "bg-surface-highest"
      } disabled:opacity-40`}
    >
      <span
        className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
          active ? "translate-x-4" : "translate-x-1"
        }`}
      />
    </button>
  );
}
