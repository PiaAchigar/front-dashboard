interface BenefitsInputProps {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Si el texto sale publicado en la web o si queda sólo para la búsqueda.
   *  Decide dónde conviene escribir cada cosa, así que se dice en el campo y
   *  no en un instructivo aparte. */
  sePublica: boolean;
}

const RECOMMENDED_LENGTH = 500;

/** Textarea de los campos que alimentan la búsqueda de tratamientos
 *  (beneficios, contraindicaciones, instrucciones especiales). */
export function BenefitsInput({
  label,
  description,
  value,
  onChange,
  placeholder,
  sePublica,
}: BenefitsInputProps) {
  return (
    <div className="mb-4">
      <label className="mb-1 block text-xs font-medium text-ink-soft">{label}</label>
      {/* Beneficios se publica tal cual en la tarjeta de resultados de la web,
          debajo de la descripción y con su propio rótulo. Contraindicaciones e
          Instrucciones Especiales no se muestran en ninguna parte del sitio:
          ayudan al buscador y le sirven al equipo. */}
      <p
        className={`mb-1 text-xs font-medium ${sePublica ? "text-primary" : "text-ink-soft"}`}
      >
        {sePublica
          ? "Se publica en la web, debajo de la descripción del servicio."
          : "No se publica: mejora la búsqueda y queda para el equipo."}
      </p>
      {description && <p className="mb-2 text-xs text-ink-soft/70">{description}</p>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full resize-none rounded-xl border border-surface-highest bg-white px-3 py-2 text-sm text-ink outline-none focus:border-primary"
      />
      <p className="mt-1 text-xs text-ink-soft/70">
        {value.length} / {RECOMMENDED_LENGTH} caracteres
      </p>
    </div>
  );
}
