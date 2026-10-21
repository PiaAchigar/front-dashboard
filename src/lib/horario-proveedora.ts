/** Ventana de trabajo semanal de una proveedora. */
export interface WeeklyWindow {
  dayOfWeek: number;
  workStartTime: string;
  workEndTime: string;
}

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/**
 * Resume el horario semanal de una proveedora: "Lun a Vie 09:00–13:00".
 *
 * Agrupa por franja horaria en vez de listar día por día, porque el caso
 * habitual es la misma franja repetida toda la semana y una lista de siete
 * líneas idénticas no se puede leer de un vistazo dentro de un <option>.
 */
export function formatWeeklySchedule(windows: WeeklyWindow[] | undefined): string {
  if (!windows || windows.length === 0) return "";

  const bySlot = new Map<string, number[]>();
  for (const w of windows) {
    const slot = `${w.workStartTime.slice(0, 5)}–${w.workEndTime.slice(0, 5)}`;
    bySlot.set(slot, [...(bySlot.get(slot) ?? []), w.dayOfWeek]);
  }

  return Array.from(bySlot.entries())
    .map(([slot, days]) => {
      const sorted = [...new Set(days)].sort((a, b) => a - b);
      // Días corridos (Lun,Mar,Mié,Jue,Vie) se muestran como rango.
      const isRun =
        sorted.length > 2 && sorted.every((d, i) => i === 0 || d === sorted[i - 1]! + 1);
      const label = isRun
        ? `${DAY_NAMES[sorted[0]!]} a ${DAY_NAMES[sorted[sorted.length - 1]!]}`
        : sorted.map((d) => DAY_NAMES[d]).join(", ");
      return `${label} ${slot}`;
    })
    .join(" · ");
}
