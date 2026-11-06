import type { CategoryNode } from "./api-types";

export type CategoriaEnLaWeb = {
  id: string;
  /** El camino hasta la categoría: "Belleza › Cejas". Hay nombres repetidos en ramas distintas. */
  ruta: string;
  webDescription: string | null;
};

type ServicioMinimo = {
  isVisible: boolean | null;
  categories: { id: string; name: string | null }[];
};

/** Estas tres secciones de la web no dependen de que la categoría tenga servicios. */
const SECCIONES_PROPIAS = new Set(["Depilación Definitiva", "Actividades", "Capacitaciones"]);

/** El mismo criterio que `esVisibleEnLaWeb` de piubella_web/src/app/servicios/page.tsx. */
const puedeSalirEnLaWeb = (c: CategoryNode) => c.kind !== "area" && !(c.name ?? "").includes("Eje");

/**
 * Los títulos que hoy se ven en /servicios: las categorías con algún servicio
 * visible, propio o en una rama de abajo. Sin este filtro Laura elegiría entre
 * 180 categorías y podría escribirle a una que la web no muestra.
 */
export function categoriasEnLaWeb(
  arbol: readonly CategoryNode[],
  servicios: readonly ServicioMinimo[],
): CategoriaEnLaWeb[] {
  const conServicios = new Set(
    servicios.filter((s) => s.isVisible === true).flatMap((s) => s.categories.map((c) => c.id)),
  );

  function recorrer(nodos: readonly CategoryNode[], prefijo: string, esRaiz: boolean): CategoriaEnLaWeb[] {
    return nodos.filter(puedeSalirEnLaWeb).flatMap((c) => {
      const ruta = prefijo ? `${prefijo} › ${c.name}` : (c.name ?? "");
      const debajo = recorrer(c.children, ruta, false);
      const seMuestra =
        conServicios.has(c.id) ||
        debajo.length > 0 ||
        (esRaiz && SECCIONES_PROPIAS.has(c.name ?? ""));
      if (!seMuestra) return [];
      return [{ id: c.id, ruta, webDescription: c.webDescription ?? null }, ...debajo];
    });
  }

  return recorrer(arbol, "", true);
}
