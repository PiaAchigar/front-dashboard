import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { apiFetch } from "../../lib/api-client";
import type { Customer } from "../../lib/api-types";

type Props = {
  value: Customer | null;
  onChange: (customer: Customer | null) => void;
  onCreateNew: () => void;
};

function useDebounce(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function CustomerSearch({ value, onChange, onCreateNew }: Props) {
  const { session } = useAuth();
  const token = session?.access_token ?? null;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  // Cierra el dropdown al clickear afuera
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Busca al escribir o muestra recientes al abrir vacío
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const path = debouncedQuery
      ? `/api/billing/customers?q=${encodeURIComponent(debouncedQuery)}`
      : "/api/billing/customers";
    apiFetch<Customer[]>(path, token)
      .then(setResults)
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [debouncedQuery, open, token]);

  function select(customer: Customer) {
    onChange(customer);
    setOpen(false);
    setQuery("");
  }

  function clear() {
    onChange(null);
    setQuery("");
  }

  // Si ya hay un cliente seleccionado, muestra el tag
  if (value) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded border border-surface-high bg-surface-low">
        <span className="text-sm font-sans text-ink flex-1 truncate">
          {value.name}
          {value.phone && <span className="text-ink-soft ml-2 text-xs">{value.phone}</span>}
        </span>
        <button
          type="button"
          onClick={clear}
          className="text-ink-soft hover:text-ink text-xs font-sans cursor-pointer"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        placeholder="Buscar por nombre, DNI o teléfono..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        className="w-full px-3 py-2 text-sm font-sans border border-surface-high rounded bg-white text-ink placeholder:text-ink-soft/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
      />

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-surface-high rounded shadow-md max-h-56 overflow-y-auto">
          {loading && (
            <p className="px-3 py-2 text-xs text-ink-soft font-sans">Buscando...</p>
          )}
          {!loading && results.length === 0 && (
            <p className="px-3 py-2 text-xs text-ink-soft font-sans">Sin resultados</p>
          )}
          {!loading &&
            results.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => select(c)}
                className="w-full text-left px-3 py-2 hover:bg-surface transition-colors cursor-pointer"
              >
                <p className="text-sm font-sans text-ink truncate">{c.name}</p>
                <p className="text-xs font-sans text-ink-soft">
                  {[c.phone, c.dni ? `DNI ${c.dni}` : null].filter(Boolean).join(" · ")}
                </p>
              </button>
            ))}
          <div className="border-t border-surface-high">
            <button
              type="button"
              onClick={() => { setOpen(false); onCreateNew(); }}
              className="w-full text-left px-3 py-2 text-xs font-sans text-primary hover:bg-surface transition-colors cursor-pointer"
            >
              + Crear cliente nuevo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
