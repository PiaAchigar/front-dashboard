/**
 * Une una lista en castellano: "el nombre, el precio y la vigencia".
 *
 * Con "y" al final y no una coma seca — se lee como lo diría una persona, que
 * es lo que hace falta cuando el texto le explica a alguien qué le está
 * faltando para poder guardar.
 */
export function listar(items: readonly string[]): string | null {
  if (items.length === 0) return null;
  if (items.length === 1) return items[0]!;
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}
