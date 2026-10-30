/** Plata en pesos con separador de miles; "—" si no hay valor. */
export const money = (n: number | null) =>
  n != null ? `$${n.toLocaleString("es-AR")}` : "—";
