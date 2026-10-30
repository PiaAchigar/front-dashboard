import { Select } from "../../../components/form";
import type { CategoryNode } from "../../../lib/api-types";

/** Hijas que cuentan: las de eje "area" no son categorías de servicio. */
const hijas = (n: CategoryNode) => n.children.filter((c) => c.kind !== "area");

/** Camino de la raíz hasta `id` (incluido), o [] si no está en el árbol. */
export function camino(nodos: CategoryNode[], id: string): CategoryNode[] {
  for (const n of nodos) {
    if (n.id === id) return [n];
    const sub = camino(hijas(n), id);
    if (sub.length) return [n, ...sub];
  }
  return [];
}

/**
 * Cascada de selectores: uno por nivel. El de hijas arranca en "Toda la
 * categoría" (= la categoría del nivel de arriba, con toda su rama).
 * `valor` es la categoría más profunda elegida; al entrar con una hija
 * (?categoria=) la cascada se arma sola con sus ancestros.
 */
export function SelectorDeRama({
  arbol,
  valor,
  onChange,
}: {
  arbol: CategoryNode[];
  valor: string | null;
  onChange: (id: string | null) => void;
}) {
  const raices = arbol.filter((c) => c.kind !== "area");
  const ruta = valor ? camino(raices, valor) : [];

  // Niveles: el primero siempre; uno más por cada nodo elegido que tenga hijas.
  const niveles: { opciones: CategoryNode[]; elegido: string }[] = [
    { opciones: raices, elegido: ruta[0]?.id ?? "" },
  ];
  ruta.forEach((n, i) => {
    const sub = hijas(n);
    if (sub.length) niveles.push({ opciones: sub, elegido: ruta[i + 1]?.id ?? "" });
  });

  return (
    <div className="flex flex-wrap gap-3">
      {niveles.map((nivel, i) => (
        <Select
          key={i}
          aria-label={i === 0 ? "Categoría" : `Subcategoría ${i}`}
          value={nivel.elegido}
          onChange={(e) => {
            const id = e.target.value;
            // "Toda la categoría" vuelve al nivel de arriba (o a nada, en el primero).
            onChange(id || (i === 0 ? null : ruta[i - 1].id));
          }}
          className="max-w-xs"
        >
          <option value="">{i === 0 ? "Elegí una categoría" : "Toda la categoría"}</option>
          {nivel.opciones.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      ))}
    </div>
  );
}
