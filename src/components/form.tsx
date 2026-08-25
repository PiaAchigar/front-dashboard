import { cloneElement, isValidElement, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
 * El "?" con su globo de ayuda.
 *
 * El globo se dibuja con `createPortal` en el <body> y posición `fixed`, no
 * dentro del campo. Si se dibuja adentro, cualquier ancestro que scrollee lo
 * recorta: en el drawer de "Nueva zona" el formulario tiene `overflow-y-auto`,
 * así que el globo del primer campo —que se abre hacia arriba— quedaba cortado
 * por el borde del área que scrollea, tapado por el título del drawer.
 *
 * Se abre hacia arriba si hay lugar y hacia abajo si no, y se recorta contra
 * los bordes de la ventana para no salirse de pantalla.
 */
function HelpTip({ text, describedById }: { text: string; describedById: string }) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; abajo: boolean } | null>(null);

  const ANCHO = 224; // w-56
  const SEPARACION = 8;

  useLayoutEffect(() => {
    if (!abierto || !anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    // Estimación del alto: alcanza para decidir arriba/abajo. Si no entra
    // arriba se abre hacia abajo, que es el caso del drawer.
    const ALTO_APROX = 96;
    const abajo = r.top < ALTO_APROX + SEPARACION;
    const left = Math.min(
      Math.max(SEPARACION, r.left + r.width / 2 - ANCHO / 2),
      window.innerWidth - ANCHO - SEPARACION,
    );
    setPos({ top: abajo ? r.bottom + SEPARACION : r.top - SEPARACION, left, abajo });
  }, [abierto]);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-label="Ayuda"
        className="inline-flex cursor-help text-ink-soft/70 transition-colors hover:text-primary focus:text-primary focus:outline-none"
        onMouseEnter={() => setAbierto(true)}
        onMouseLeave={() => setAbierto(false)}
        onFocus={() => setAbierto(true)}
        onBlur={() => setAbierto(false)}
        // El "?" explica, no envía: sin esto un Enter con el foco encima
        // dispararía el submit del formulario que lo contiene.
        onClick={(e) => e.preventDefault()}
      >
        <HelpCircle size={13} />
      </button>

      {abierto &&
        pos &&
        createPortal(
          <span
            role="tooltip"
            aria-hidden="true"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: ANCHO,
              transform: pos.abajo ? undefined : "translateY(-100%)",
            }}
            className="pointer-events-none z-[100] rounded-lg bg-ink px-2.5 py-1.5 text-[11px] font-normal leading-snug text-white shadow-lg"
          >
            {text}
          </span>,
          document.body,
        )}
      {/* Copia siempre presente en el DOM: es la que lee un lector de
          pantalla vía aria-describedby. El globo de arriba es solo visual y
          existe únicamente mientras está abierto. */}
      <span id={describedById} className="sr-only">
        {text}
      </span>
    </>
  );
}

/**
 * Un campo de formulario con su etiqueta y, opcionalmente, un "?" que
 * despliega una explicación.
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
 * la explicación se cuelga del campo con `aria-describedby`.
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
        <HelpTip text={help} describedById={helpId} />
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
