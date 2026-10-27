import { EntityDrawer } from "../../components/EntityDrawer";
import { SelectorDeAreas } from "../../components/PastillasDeArea";
import { useToast } from "../../components/ui/Toast";
import { useSetServiceCategories } from "../../hooks/useServicesAdmin";
import type { Service } from "../../lib/api-types";
import {
  areasConServicios,
  serviciosDeLaRama,
  type Area,
  type CategoriaPlana,
} from "../../lib/categorias-por-area";

/**
 * El panel que se abre al tocar una categoría: qué servicios tiene —ella y sus
 * subcategorías— y en qué área está cada uno, con el área editable ahí mismo.
 *
 * Existe porque el área no es de la categoría sino del servicio: para que
 * "Estética Corporal" deje de estar en Medicina hay que mover sus servicios, y
 * sin este panel eso era abrir uno por uno en otra pantalla.
 */
export function ServiciosDeCategoria({
  categoria,
  categorias,
  servicios,
  areas,
  puedeEditar,
  onClose,
}: {
  categoria: CategoriaPlana | null;
  categorias: readonly CategoriaPlana[];
  servicios: readonly Service[];
  areas: readonly Area[];
  puedeEditar: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const guardar = useSetServiceCategories();

  if (!categoria) return null;
  const grupos = serviciosDeLaRama(categoria.id, categorias, servicios);
  const ofrecidas = areasConServicios(areas, servicios);
  const total = new Set(grupos.flatMap((g) => g.servicios.map((s) => s.id))).size;

  function alternar(s: Service, areaId: string) {
    const ids = s.categories.map((c) => c.id);
    const categoryIds = ids.includes(areaId) ? ids.filter((id) => id !== areaId) : [...ids, areaId];
    const area = areas.find((a) => a.id === areaId)?.name ?? "el área";
    guardar.mutate(
      { id: s.id, categoryIds },
      {
        onSuccess: () =>
          toast.success(
            ids.includes(areaId)
              ? `${s.name ?? "El servicio"} salió de ${area}`
              : `${s.name ?? "El servicio"} ahora está en ${area}`,
          ),
        onError: (e: Error) => toast.error(e.message),
      },
    );
  }

  return (
    <EntityDrawer
      open
      readOnly
      title={categoria.name ?? "Categoría"}
      onSubmit={() => {}}
      onClose={onClose}
    >
      {grupos.length === 0 ? (
        <p className="text-sm text-ink-soft">
          Esta categoría no tiene servicios. Se le asignan desde cada servicio, en “Categorías de la
          web”.
        </p>
      ) : (
        <>
          <p className="text-sm text-ink-soft">
            {total === 1 ? "1 servicio" : `${total} servicios`}.{" "}
            {puedeEditar
              ? "Tocá un área para sumar o sacar el servicio de ella. Se guarda al instante."
              : "Las áreas pintadas son en las que está cada servicio."}
          </p>
          {grupos.map((g) => (
            <section key={g.categoria.id} className="space-y-1">
              {g.camino && <h4 className="text-sm font-semibold text-ink">{g.camino}</h4>}
              <ul className="divide-y divide-surface-high rounded-xl border border-surface-high bg-white">
                {g.servicios.map((s) => {
                  const suyas = areas
                    .filter((a) => s.categories.some((c) => c.id === a.id))
                    .map((a) => a.id);
                  return (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-3 py-2"
                    >
                      <span className="text-sm text-ink">{s.name ?? "—"}</span>
                      <SelectorDeAreas
                        // Las que hoy tienen servicios, más las que ya tenga
                        // éste: un área suya nunca puede desaparecer de la vista.
                        areas={areas.filter(
                          (a) => suyas.includes(a.id) || ofrecidas.some((o) => o.id === a.id),
                        )}
                        todas={areas}
                        elegidas={suyas}
                        deshabilitado={!puedeEditar || guardar.isPending}
                        onAlternar={(areaId) => alternar(s, areaId)}
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </>
      )}
    </EntityDrawer>
  );
}
