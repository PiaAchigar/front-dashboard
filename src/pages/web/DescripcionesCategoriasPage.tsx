import { useMemo, useState } from "react";
import { Field, TextArea } from "../../components/form";
import { Search } from "../../components/icons";
import { useToast } from "../../components/ui/Toast";
import { useCategoriesAdmin, useGuardarDescripcionWeb } from "../../hooks/useCategoriesAdmin";
import { useServicesAdmin } from "../../hooks/useServicesAdmin";
import { categoriasEnLaWeb } from "../../lib/categorias-en-la-web";

const LARGO_MAXIMO = 2000;

/** "Estética" y "estetica" son la misma búsqueda. */
const normalizar = (texto: string) =>
  texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/**
 * Sitio Web → Textos → Categorías: el texto debajo de cada título de /servicios.
 *
 * Lo no guardado se conserva por categoría: Laura puede ir a mirar otra a mitad
 * de escribir sin perder lo que llevaba.
 */
export function DescripcionesCategoriasPage() {
  const toast = useToast();
  const { data: arbol, isLoading: cargandoArbol, error: errorArbol } = useCategoriesAdmin(false);
  const { data: servicios, isLoading: cargandoServicios, error: errorServicios } = useServicesAdmin(false);
  const guardar = useGuardarDescripcionWeb();

  const [busqueda, setBusqueda] = useState("");
  const [elegidaId, setElegidaId] = useState<string | null>(null);
  const [borradores, setBorradores] = useState<Record<string, string>>({});

  const categorias = useMemo(
    () => categoriasEnLaWeb(arbol ?? [], servicios ?? []),
    [arbol, servicios],
  );
  const visibles = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return q ? categorias.filter((c) => normalizar(c.ruta).includes(q)) : categorias;
  }, [categorias, busqueda]);

  const elegida = categorias.find((c) => c.id === elegidaId) ?? null;
  const guardado = elegida?.webDescription ?? "";
  const texto = elegida ? (borradores[elegida.id] ?? guardado) : "";
  const hayCambios = texto.trim() !== guardado;

  function onGuardar() {
    if (!elegida) return;
    const id = elegida.id;
    guardar.mutate(
      { id, webDescription: texto.trim() || null },
      {
        onSuccess: () => {
          setBorradores((previos) => {
            const resto = { ...previos };
            delete resto[id];
            return resto;
          });
          toast.success("Descripción guardada");
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  }

  const error = errorArbol ?? errorServicios;

  return (
    <div className="modal-scroll h-full overflow-y-auto p-2 pl-4 sm:p-4">
      <div className="mx-auto max-w-2xl space-y-4">
        <p className="text-xs text-ink-soft">
          El texto va debajo del título de la categoría, en la página de Servicios. Acá aparecen las
          categorías que hoy se ven en la web. Al guardar, puede tardar unos minutos en verse.
        </p>

        {cargandoArbol || cargandoServicios ? (
          <p className="text-sm text-ink-soft">Cargando…</p>
        ) : error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{(error as Error).message}</p>
        ) : (
          <>
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft"
              />
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar categoría…"
                className="w-full rounded-lg border border-surface-highest bg-white py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-primary"
              />
            </div>

            {visibles.length === 0 ? (
              <p className="text-sm text-ink-soft">No hay categorías con ese nombre.</p>
            ) : (
              <ul className="modal-scroll max-h-72 divide-y divide-surface-high overflow-y-auto rounded-xl border border-surface-high">
                {visibles.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      aria-pressed={c.id === elegidaId}
                      onClick={() => setElegidaId(c.id)}
                      className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                        c.id === elegidaId ? "bg-primary/10 font-medium text-ink" : "text-ink hover:bg-surface-low"
                      }`}
                    >
                      <span>{c.ruta}</span>
                      {borradores[c.id] !== undefined ? (
                        <span className="shrink-0 text-xs text-ink-soft">Sin guardar</span>
                      ) : c.webDescription ? (
                        <span className="shrink-0 text-xs text-primary">Con descripción</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {elegida && (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  onGuardar();
                }}
              >
                <Field label={`Descripción de ${elegida.ruta}`}>
                  <TextArea
                    rows={5}
                    maxLength={LARGO_MAXIMO}
                    value={texto}
                    onChange={(e) => setBorradores({ ...borradores, [elegida.id]: e.target.value })}
                  />
                </Field>
                <div className="flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={!hayCambios || guardar.isPending}
                    className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
                  >
                    {guardar.isPending ? "Guardando…" : "Guardar descripción"}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
