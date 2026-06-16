const LOCALE = "es-AR";

export function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // Monday = 0 offset. Sunday (0) → go back 6, Monday (1) → 0, etc.
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function getWeekDays(date: Date): Date[] {
  const monday = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function formatDayLabel(date: Date): string {
  return date.toLocaleDateString(LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatWeekLabel(date: Date): string {
  const days = getWeekDays(date);
  const first = days[0]!;
  const last = days[6]!;
  const sameMonth = first.getMonth() === last.getMonth();
  if (sameMonth) {
    return `${first.getDate()} – ${last.getDate()} ${last.toLocaleDateString(LOCALE, { month: "short", year: "numeric" })}`;
  }
  return `${first.getDate()} ${first.toLocaleDateString(LOCALE, { month: "short" })} – ${last.getDate()} ${last.toLocaleDateString(LOCALE, { month: "short", year: "numeric" })}`;
}

export function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString(LOCALE, { month: "long", year: "numeric" });
}

export function formatShortDay(date: Date): string {
  return date.toLocaleDateString(LOCALE, { weekday: "short", day: "numeric" });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" });
}

/** Genera slots de HH:MM cada 30 minutos entre openTime y closeTime ("HH:MM:SS"). */
export function generateTimeSlots(openTime: string, closeTime: string): string[] {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  const toLabel = (mins: number) => {
    const h = String(Math.floor(mins / 60)).padStart(2, "0");
    const m = String(mins % 60).padStart(2, "0");
    return `${h}:${m}`;
  };

  const start = toMinutes(openTime);
  const end = toMinutes(closeTime);
  const slots: string[] = [];
  for (let min = start; min < end; min += 30) {
    slots.push(toLabel(min));
  }
  return slots;
}

/** Combina una fecha local "YYYY-MM-DD" y hora "HH:MM" en un ISO string UTC que el API acepta. */
export function toAppointmentISO(dateStr: string, timeStr: string): string {
  return new Date(`${dateStr}T${timeStr}:00`).toISOString();
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
