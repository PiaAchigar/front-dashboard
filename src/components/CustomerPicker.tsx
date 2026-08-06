import { useEffect, useRef, useState } from "react";
import { useCustomerSearch, type CustomerOption } from "../hooks/useCustomerSearch";

/**
 * Selector de cliente con búsqueda.
 *
 * Reemplaza al `<select>` que traía la lista completa: en producción hay más de
 * 5600 clientes, así que la lista entera no es navegable ni cabe en una
 * respuesta razonable. Acá se escribe y la API filtra por nombre, DNI o
 * teléfono.
 *
 * El cliente seleccionado lo mantiene el padre (no solo el id) para poder
 * mostrar su nombre sin tener que volver a pedirlo a la API.
 */
export function CustomerPicker({
  selected,
  onSelect,
  placeholder = "Buscar cliente por nombre, DNI o teléfono…",
  disabled = false,
  className = "",
}: {
  selected: CustomerOption | null;
  onSelect: (customer: CustomerOption | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: results = [], isFetching } = useCustomerSearch(query);

  // Cerrar al clickear afuera. No se usa onBlur porque el click en una opción
  // dispara blur antes que el click y la lista se cerraría sin seleccionar.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const handleSelect = (customer: CustomerOption) => {
    onSelect(customer);
    setQuery("");
    setOpen(false);
  };

  const handleClear = () => {
    onSelect(null);
    setQuery("");
    setOpen(false);
  };

  const needsMoreChars = query.trim().length > 0 && query.trim().length < 2;

  // Con un cliente elegido se muestra su nombre en modo "chip" y el input pasa
  // a un segundo plano: volver a buscar exige limpiar primero, para que no
  // quede la duda de si lo que se ve es lo seleccionado o lo tipeado.
  if (selected) {
    return (
      <div
        className={`flex items-center gap-2 rounded-lg border border-surface-high bg-white px-3 py-2 text-sm ${className}`}
      >
        <span className="truncate text-ink">{selected.name ?? "(sin nombre)"}</span>
        {selected.dni && <span className="shrink-0 text-xs text-ink-soft">DNI {selected.dni}</span>}
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled}
          className="ml-auto shrink-0 text-ink-soft transition-colors hover:text-ink disabled:opacity-50"
          aria-label="Quitar cliente seleccionado"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        type="search"
        value={query}
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-surface-high px-3 py-2 text-sm text-ink outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
      />

      {open && (needsMoreChars || isFetching || results.length > 0 || query.trim().length >= 2) && (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-surface-high bg-white shadow-lg">
          {needsMoreChars && (
            <li className="px-3 py-2 text-sm text-ink-soft">Escribí al menos 2 caracteres…</li>
          )}

          {!needsMoreChars && isFetching && (
            <li className="px-3 py-2 text-sm text-ink-soft">Buscando…</li>
          )}

          {!needsMoreChars && !isFetching && results.length === 0 && (
            <li className="px-3 py-2 text-sm text-ink-soft">Sin resultados.</li>
          )}

          {results.map((customer) => (
            <li key={customer.id}>
              <button
                type="button"
                onClick={() => handleSelect(customer)}
                className="flex w-full flex-col items-start px-3 py-2 text-left transition-colors hover:bg-surface-low"
              >
                <span className="text-sm text-ink">{customer.name ?? "(sin nombre)"}</span>
                <span className="text-xs text-ink-soft">
                  {[customer.dni && `DNI ${customer.dni}`, customer.phone]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
