import { forwardRef, useImperativeHandle, useState } from "react";
import { Checkbox, TextInput } from "../../components/form";
import { money } from "../../lib/format";
import { costoDeLineas, ordenarParaElector, type Cantidades } from "../../lib/receta-ui";
import { useInsumos, type Insumo } from "../../hooks/useInsumos";
import { useServiceSupplies } from "../../hooks/useRecetas";

export type SuppliesHandle = {
  getSupplies: () => { productId: string; quantity: number | null }[];
};

function Fila({
  insumo,
  cantidad,
  onToggle,
  onCantidad,
}: {
  insumo: Insumo;
  cantidad: string | undefined;
  onToggle: (v: boolean) => void;
  onCantidad: (v: string) => void;
}) {
  const elegido = cantidad !== undefined;
  return (
    <li className="flex items-center gap-2 py-1">
      <div className="min-w-0 flex-1">
        <Checkbox label={insumo.name ?? "—"} checked={elegido} onChange={onToggle} />
      </div>
      {elegido && (
        <div className="flex shrink-0 items-center gap-1.5">
          <TextInput
            type="number"
            min={0}
            step="0.001"
            value={cantidad}
            onChange={(e) => onCantidad(e.target.value)}
            className="w-20 text-right"
            aria-label={`Cantidad de ${insumo.name ?? "insumo"}`}
          />
          <span className="w-14 text-xs text-ink-soft">{insumo.unitType ?? "unid."}</span>
        </div>
      )}
    </li>
  );
}

/**
 * Editor de la receta: qué insumos consume el servicio y cuánto de cada uno.
 *
 * Mantiene su propio estado y el padre lo lee por ref al guardar, igual que
 * `AgreementsEditor`. Se re-monta por `key` cuando cambia el servicio, así que
 * no necesita effects.
 */
const SuppliesEditor = forwardRef<SuppliesHandle, { initial: Cantidades; catalogo: Insumo[] }>(
  function SuppliesEditor({ initial, catalogo }, ref) {
    const [cantidades, setCantidades] = useState<Cantidades>(initial);
    // Arranca abierto si el servicio ya lleva insumos: se ve lo que hay sin un clic.
    const [lleva, setLleva] = useState(Object.keys(initial).length > 0);
    const [busqueda, setBusqueda] = useState("");

    useImperativeHandle(
      ref,
      () => ({
        getSupplies: () =>
          // Destildar "lleva insumos" manda la lista vacía, que BORRA la receta.
          // Es lo que significa el destilde: este servicio ya no consume nada.
          lleva
            ? Object.entries(cantidades).map(([productId, texto]) => ({
                productId,
                quantity: texto.trim() === "" ? null : Number(texto),
              }))
            : [],
      }),
      [cantidades, lleva],
    );

    const { elegidos, resto } = ordenarParaElector(catalogo, cantidades, busqueda);
    const costo = costoDeLineas(catalogo, cantidades);

    function toggle(id: string, v: boolean) {
      setCantidades((c) => {
        const siguiente = { ...c };
        // Se tilda primero y se escribe la cantidad después: "1" es el caso más
        // común y evita que quede en blanco y no se guarde.
        if (v) siguiente[id] = "1";
        else delete siguiente[id];
        return siguiente;
      });
    }

    return (
      <div className="space-y-2 rounded-xl border border-surface-high p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">Insumos</p>
        <Checkbox label="Este servicio lleva insumos" checked={lleva} onChange={setLleva} />

        {lleva && (
          <div className="space-y-2">
            {catalogo.length === 0 ? (
              <p className="text-sm text-ink-soft">
                Todavía no hay insumos cargados. Se cargan en la pestaña Insumos.
              </p>
            ) : (
              <>
                <TextInput
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar insumo…"
                />

                {elegidos.length > 0 && (
                  <div>
                    <p className="mb-0.5 text-xs font-medium text-ink-soft">Los que usa</p>
                    <ul className="rounded-lg border border-surface-high bg-white px-2.5 py-1">
                      {elegidos.map((i) => (
                        <Fila
                          key={i.id}
                          insumo={i}
                          cantidad={cantidades[i.id]}
                          onToggle={(v) => toggle(i.id, v)}
                          onCantidad={(v) => setCantidades((c) => ({ ...c, [i.id]: v }))}
                        />
                      ))}
                    </ul>
                    <p className="mt-1 text-xs text-ink-soft">
                      Cuesta <strong className="text-ink">{money(costo)}</strong> en insumos cada
                      vez que se hace.
                    </p>
                  </div>
                )}

                <div>
                  <p className="mb-0.5 text-xs font-medium text-ink-soft">
                    {elegidos.length > 0 ? "Todos" : "Elegí los que usa"}
                  </p>
                  <ul className="max-h-56 overflow-y-auto rounded-lg border border-surface-high bg-white px-2.5 py-1">
                    {resto.length === 0 ? (
                      <li className="py-1 text-sm text-ink-soft">
                        {busqueda.trim() ? "Ningún insumo coincide." : "No queda ninguno."}
                      </li>
                    ) : (
                      resto.map((i) => (
                        <Fila
                          key={i.id}
                          insumo={i}
                          cantidad={cantidades[i.id]}
                          onToggle={(v) => toggle(i.id, v)}
                          onCantidad={(v) => setCantidades((c) => ({ ...c, [i.id]: v }))}
                        />
                      ))
                    )}
                  </ul>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  },
);

/** Carga la receta vigente y re-monta el editor (key) cuando cambia el servicio. */
export function SuppliesSection({
  serviceId,
  editorRef,
}: {
  serviceId: string | null;
  editorRef: React.Ref<SuppliesHandle>;
}) {
  const { data: catalogo = [] } = useInsumos(false);
  const { data, isLoading } = useServiceSupplies(serviceId);

  if (serviceId && isLoading) return <p className="text-sm text-ink-soft">Cargando insumos…</p>;

  const initial: Cantidades = {};
  for (const l of data?.lineas ?? []) initial[l.productId] = String(l.quantity);

  return (
    <SuppliesEditor
      key={serviceId ?? "new"}
      ref={editorRef}
      initial={initial}
      catalogo={catalogo}
    />
  );
}
