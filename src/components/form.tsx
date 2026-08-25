import { cloneElement, isValidElement, useId } from "react";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { HelpCircle } from "./icons";

const fieldClass =
  "w-full rounded-xl border border-surface-highest bg-white px-3 py-2 text-sm text-ink outline-none focus:border-primary disabled:bg-surface-high disabled:text-ink-soft";

/**
 * Un campo de formulario con su etiqueta y, opcionalmente, un "?" que al
 * pasarle el mouse despliega una explicación.
 *
 * Sin `help` la etiqueta envuelve al campo (asociación implícita), que es como
 * funcionaron siempre los ~135 campos de la app.
 *
 * Con `help` NO se puede envolver: el nombre accesible de un <label> se arma
 * con TODO su texto, tooltip incluido, así que el campo "Orden" pasaría a
 * llamarse "Orden Posición en la lista: el número más chico va primero…" para
 * un lector de pantalla y para cualquier búsqueda por etiqueta (ni
 * `aria-hidden` ni `aria-describedby` lo evitan: el texto sigue estando
 * adentro). Por eso, en ese caso, la etiqueta se ata al campo por `htmlFor` y
 * el tooltip queda afuera, colgado del campo con `aria-describedby` — que es
 * el atributo hecho para esto: el nombre sigue siendo "Orden" y la
 * explicación se anuncia aparte.
 */
export function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: ReactNode;
}) {
  const baseId = useId();
  const fieldId = `${baseId}-field`;
  const helpId = `${baseId}-help`;

  const labelClass = "mb-1 flex items-center gap-1 text-xs font-medium text-ink-soft";

  if (!help) {
    return (
      <label className="block">
        <span className={labelClass}>{label}</span>
        {children}
      </label>
    );
  }

  // `id` solo se pone si el hijo no traía uno propio: pisarlo rompería
  // cualquier referencia que ya existiera hacia ese campo.
  const campo = isValidElement<{ id?: string; "aria-describedby"?: string }>(children)
    ? cloneElement(children, {
        id: children.props.id ?? fieldId,
        "aria-describedby": helpId,
      })
    : children;
  const forId = isValidElement<{ id?: string }>(children)
    ? (children.props.id ?? fieldId)
    : fieldId;

  return (
    <div className="block">
      <div className={labelClass}>
        <label htmlFor={forId}>{label}</label>
        <span className="group relative inline-flex cursor-help">
          <HelpCircle size={13} className="text-ink-soft/70" />
          <span
            id={helpId}
            role="tooltip"
            className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden w-52 -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1.5 text-[11px] font-normal leading-snug text-white shadow-lg group-hover:block"
          >
            {help}
          </span>
        </span>
      </div>
      {campo}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldClass} ${props.className ?? ""}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  // `resize-none` es el default, pero si quien lo usa ya pasa su propia clase de
  // resize no la agregamos: dejar las dos y confiar en cuál gana depende del
  // orden en que Tailwind emite el CSS, que no es algo que convenga suponer.
  const traeResize = (props.className ?? "").includes("resize");
  return (
    <textarea
      {...props}
      className={`${fieldClass} ${traeResize ? "" : "resize-none"} ${props.className ?? ""}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${fieldClass} ${props.className ?? ""}`} />;
}

export function Checkbox({
  label,
  checked,
  onChange,
  disabled,
  describedBy,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  /** id de un elemento (ej. el motivo de un disabled) para `aria-describedby`.
   *  Sin esto un lector de pantalla anuncia "deshabilitado" sin decir por qué. */
  describedBy?: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[var(--color-primary)]"
      />
      {label}
    </label>
  );
}
