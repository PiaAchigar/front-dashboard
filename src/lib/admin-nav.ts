/**
 * La estructura de pestañas de Administración: qué hay, en qué orden y con qué
 * acento. Vive fuera del componente para que Fast Refresh siga andando y para
 * poder testearla sin montar React.
 */
/**
 * Los cuatro grupos de pestañas, por PROPÓSITO — no por posición.
 *
 *   promo    lo comercial: no administra catálogo, lo combina para vender
 *   eje      "qué es": las áreas del catálogo. Son el corazón del sistema
 *   recurso  lo que habilita al catálogo pero no se vende
 *   meta     cómo se ordena todo lo demás
 */
export type Grupo = "promo" | "eje" | "recurso" | "meta";

export type Acento = { texto: string; barra: string };

/**
 * ⚠️ Las clases van ESCRITAS ENTERAS, nunca armadas con `.replace()` ni con
 * template strings.
 *
 * Tailwind escanea el código como texto plano: si la clase no aparece literal
 * en ningún archivo, no la compila. Derivar `bg-promo` de `text-promo` en
 * tiempo de ejecución hace que el CSS no la incluya y el subrayado quede
 * transparente — sin error, sin warning, simplemente invisible. Pasó al
 * escribir esto: `bg-promo` y `bg-resource` no estaban en el bundle.
 */
const ACENTOS: Record<Grupo, Acento> = {
  promo: { texto: "text-promo", barra: "bg-promo" },
  eje: { texto: "text-primary", barra: "bg-primary" },
  recurso: { texto: "text-resource", barra: "bg-resource" },
  meta: { texto: "text-ink", barra: "bg-ink" },
};

export function acentoDe(grupo: Grupo): Acento {
  return ACENTOS[grupo];
}

export type Pestana = {
  to: string;
  label: string;
  grupo: Grupo;
  section: "catalogo" | "proveedoras";
};

/**
 * El orden importa y es el que pidió Pia: primero lo que se vende (Promos),
 * después el catálogo por área, después los recursos que lo habilitan, y
 * Categorías al final porque es meta.
 *
 * Falta INSUMOS y es a propósito, no un olvido: la tabla `products` existe
 * pero está vacía. Laura ya definió los requisitos (2026-09-08): sirve para
 * COSTEAR y para llevar STOCK; el stock baja SOLO cada vez que se realiza un
 * servicio que consume el insumo (hace falta una tabla receta
 * `service_product`: qué insumo usa cada servicio y en qué cantidad, más el
 * enganche en el momento en que un turno pasa a `completed`); no quiere
 * historial de compras por ahora; y sí quiere aviso de stock mínimo.
 * Queda por decidir qué pasa si se completa un servicio sin stock.
 * También faltan las sub-pestañas Combos/Packs de cada área:
 * `combos` está vacía y los packs llegan con V1 de venta y consumo.
 * Una pestaña que no lleva a ningún lado enseña a desconfiar de la barra, así
 * que se agregan cuando tengan destino.
 */
export const PESTANAS: Pestana[] = [
  { to: "/admin/promos", label: "Promos", grupo: "promo", section: "catalogo" },
  { to: "/admin/estetica", label: "Estética", grupo: "eje", section: "catalogo" },
  { to: "/admin/depilacion", label: "Depilación", grupo: "eje", section: "catalogo" },
  { to: "/admin/medicina", label: "Medicina y Dermatología", grupo: "eje", section: "catalogo" },
  { to: "/admin/masajes", label: "Masajes y Bienestar", grupo: "eje", section: "catalogo" },
  { to: "/admin/actividades", label: "Actividades", grupo: "eje", section: "catalogo" },
  { to: "/admin/capacitaciones", label: "Capacitaciones", grupo: "eje", section: "catalogo" },
  { to: "/admin/suscripciones", label: "Suscripciones", grupo: "eje", section: "catalogo" },
  { to: "/admin/servicios", label: "Todos los servicios", grupo: "eje", section: "catalogo" },
  { to: "/admin/proveedores", label: "Proveedores", grupo: "recurso", section: "proveedoras" },
  { to: "/admin/maquinas", label: "Máquinas", grupo: "recurso", section: "catalogo" },
  { to: "/admin/combos", label: "Combos", grupo: "recurso", section: "catalogo" },
  { to: "/admin/categorias", label: "Categorías", grupo: "meta", section: "catalogo" },
];

/**
 * Las áreas del catálogo que tienen pestaña propia. `categoria` tiene que
 * coincidir EXACTO con el `name` de la categoría de eje `area` en la base
 * (migración 1.37.0), porque el filtro compara por nombre.
 *
 * Depilación no está acá: tiene su propio layout con Zonas, Combos y Precios,
 * y sus zonas no viven en `service` sino en `body_zone`.
 */
export const AREAS = [
  { path: "estetica", categoria: "Estética" },
  { path: "medicina", categoria: "Medicina y Dermatología" },
  { path: "masajes", categoria: "Masajes y Bienestar" },
] as const;
