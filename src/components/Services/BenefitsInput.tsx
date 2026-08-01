import { useState } from "react";

interface BenefitsInputProps {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** true si `service.description` ya tiene contenido: avisa que este campo
   *  complementa (no reemplaza) esa descripción existente. */
  hasExistingDescription?: boolean;
}

const RECOMMENDED_LENGTH = 500;

/** Textarea reutilizable para campos de contenido RAG del servicio
 *  (beneficios, contraindicaciones, instrucciones especiales). */
export function BenefitsInput({
  label,
  description,
  value,
  onChange,
  placeholder,
  hasExistingDescription,
}: BenefitsInputProps) {
  const [showWarning, setShowWarning] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const newValue = e.target.value;
    if (hasExistingDescription && newValue && !showWarning) {
      setShowWarning(true);
    }
    onChange(newValue);
  }

  return (
    <div className="mb-4">
      <label className="mb-1 block text-xs font-medium text-ink-soft">{label}</label>
      {description && <p className="mb-2 text-xs text-ink-soft/70">{description}</p>}
      {hasExistingDescription && showWarning && (
        <div className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          ⚠️ Este servicio ya tiene descripción. Los datos aquí complementarán la búsqueda, no
          la reemplazan.
        </div>
      )}
      <textarea
        value={value}
        onChange={handleChange}
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
