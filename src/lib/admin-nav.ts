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
 * INSUMOS entra acá, entre los recursos: habilita al catálogo pero no se vende.
 * Está completo (1.41.0 a 1.44.0): catálogo, receta por servicio
 * (`service_product`, editable desde el modal de Servicio o en masa desde el
 * insumo) y descuento automático al pasar un turno a `completed`. Si no
 * alcanza, el insumo queda en negativo y la agenda avisa con un modal; NO se
 * bloquea el turno (decisión de Laura, 2026-09-08: bloquear un turno ya hecho
 * por un dato de inventario mal cargado le frena la caja).
 * Desde la 1.50.0 cada área abre en su propio layout con tres solapas
 * (Servicios · Combos · Packs), igual que Depilación. La pestaña `/admin/combos`
 * de más abajo es la vista vieja sin área y queda mientras haya combos por
 * reubicar.
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
  { to: "/admin/insumos", label: "Insumos", grupo: "recurso", section: "catalogo" },
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
export type AreaDeCatalogo = {
  path: string;
  categoria: string;
  /** La línea que va debajo del título, en el layout del área. */
  bajada: string;
  /**
   * Aclaración chiquita al lado de "Combos" en esa área.
   *
   * Sólo Medicina la lleva: Pia pidió que ahí diga "Combos (Tratamientos)",
   * con la segunda palabra más chica y a modo informativo, porque es como se
   * lo nombra en el consultorio. Las otras áreas dicen "Combos" a secas.
   */
  aliasDeCombos?: string;
};

export const AREAS: readonly AreaDeCatalogo[] = [
  {
    path: "estetica",
    categoria: "Estética",
    bajada: "Servicios, combos y packs de estética.",
  },
  {
    path: "medicina",
    categoria: "Medicina y Dermatología",
    bajada: "Servicios, tratamientos y packs de medicina y dermatología.",
    aliasDeCombos: "Tratamientos",
  },
  {
    path: "masajes",
    categoria: "Masajes y Bienestar",
    bajada: "Servicios, combos y packs de masajes y bienestar.",
  },
] as const;

/**
 * Las tres solapas de un área, en orden de lo simple a lo compuesto.
 *
 * Se arma acá y no en el componente para poder testear las etiquetas sin
 * montar React — igual que `PESTANAS`.
 */
export function solapasDeArea(area: AreaDeCatalogo) {
  return [
    { to: `/admin/${area.path}/servicios`, label: "Servicios" },
    // El alias va en `sub`, que el subnav pinta más chiquito: la palabra que
    // manda sigue siendo "Combos".
    { to: `/admin/${area.path}/combos`, label: "Combos", sub: area.aliasDeCombos },
    { to: `/admin/${area.path}/packs`, label: "Packs" },
  ];
}
