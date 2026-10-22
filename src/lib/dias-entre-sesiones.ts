/** Texto de ayuda del campo "Días entre sesiones", igual en los cinco formularios. */
export const AYUDA_DIAS_ENTRE_SESIONES = "Cada cuántos días se sugiere la próxima sesión al agendar";

/** De la columna al input: vacío cuando no hay días cargados. */
export function diasAForm(dias: number | null | undefined): string {
  return dias != null ? String(dias) : "";
}

/** Del input al payload. Vacío es `null` (el campo es opcional); un entero
 *  mayor a cero es el valor; cualquier otra cosa es `undefined` (inválido).
 *  Se manda SIEMPRE: la API borra el campo si no viaja. */
export function parseDiasEntreSesiones(raw: string): number | null | undefined {
  const t = raw.trim();
  if (t === "") return null;
  if (!/^\d+$/.test(t)) return undefined;
  const n = Number(t);
  return n > 0 ? n : undefined;
}

export const ERROR_DIAS_ENTRE_SESIONES =
  "Los días entre sesiones tienen que ser un número entero mayor a cero (o dejarlo vacío).";
