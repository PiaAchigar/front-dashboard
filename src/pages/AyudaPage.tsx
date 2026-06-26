import { useMemo, useState } from "react";
import { Search } from "../components/icons";
import { HELP_ARTICLES } from "../help/content";

export function AyudaPage() {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  const results = useMemo(() => {
    if (!query) return HELP_ARTICLES;
    return HELP_ARTICLES.filter(
      (a) =>
        a.title.toLowerCase().includes(query) ||
        a.body.toLowerCase().includes(query) ||
        a.tags.some((t) => t.toLowerCase().includes(query)),
    );
  }, [query]);

  return (
    <div className="modal-scroll h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <div>
          <h1 className="font-display text-2xl text-ink">Centro de ayuda</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Buscá cómo usar la plataforma o qué significa cada cosa.
          </p>
        </div>

        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft"
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar… (ej: archivar, promo, máquina)"
            className="w-full rounded-lg border border-surface-highest bg-white py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-primary"
          />
        </div>

        {results.length === 0 ? (
          <p className="text-sm text-ink-soft">No encontramos nada para “{q}”.</p>
        ) : (
          <ul className="space-y-2">
            {results.map((a) => (
              <li key={a.id} className="rounded-xl border border-surface-high bg-white p-4">
                <p className="text-xs uppercase tracking-wide text-ink-soft">{a.section}</p>
                <h2 className="mt-0.5 font-medium text-ink">{a.title}</h2>
                <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{a.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
