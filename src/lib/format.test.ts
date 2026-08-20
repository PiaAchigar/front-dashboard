import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDate, formatDateTime, formatDateTimeToDate, money, todayLocal } from "./format";

afterEach(() => {
  vi.useRealTimers();
});

describe("todayLocal", () => {
  it("devuelve el día ART, no el UTC, en la franja de las 21 a las 24", () => {
    // El bug real: una suscripción cargada el 6/8 a las 22:31 ART se guardaba
    // como 2026-08-07 porque `toISOString()` ya estaba en el día siguiente.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-07T01:31:00.000Z")); // 22:31 ART del 6
    expect(todayLocal()).toBe("2026-08-06");
    expect(new Date().toISOString().slice(0, 10)).toBe("2026-08-07"); // lo que NO hay que usar
  });

  it("no se adelanta en el resto del día", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-06T15:00:00.000Z")); // 12:00 ART del 6
    expect(todayLocal()).toBe("2026-08-06");
  });

  it("devuelve el formato de un <input type=\"date\">", () => {
    expect(todayLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("formatDate — columnas `date` puras", () => {
  it("no retrocede un día: parte el string y no convierte de zona", () => {
    // `new Date("2026-08-31")` es medianoche UTC y en ART se ve como el 30.
    expect(formatDate("2026-08-31")).toBe("31/08/2026");
    expect(formatDate("2026-01-01")).toBe("01/01/2026");
  });
});

describe("formatDateTimeToDate — instantes UTC", () => {
  it("convierte a día ART", () => {
    expect(formatDateTimeToDate("2026-08-07T01:31:00.000Z")).toBe("06/08/2026");
    expect(formatDateTimeToDate("2026-08-06T15:00:00.000Z")).toBe("06/08/2026");
  });

  it("muestra un guion cuando no hay fecha", () => {
    expect(formatDateTimeToDate(null)).toBe("—");
    expect(formatDateTimeToDate(undefined)).toBe("—");
    expect(formatDateTimeToDate("")).toBe("—");
  });
});

describe("formatDateTime", () => {
  it("muestra la hora ART en 24 horas", () => {
    // Intl separa fecha y hora con coma en es-AR; el JSDoc de la función dice
    // "DD/MM/AAAA HH:MM" sin ella, pero lo que se muestra es esto.
    expect(formatDateTime("2026-08-07T01:31:00.000Z")).toBe("06/08/2026, 22:31");
  });

  it("no usa AM/PM", () => {
    expect(formatDateTime("2026-08-06T18:00:00.000Z")).not.toMatch(/[ap]\.?\s?m/i);
  });

  it("muestra un guion cuando no hay fecha", () => {
    expect(formatDateTime(null)).toBe("—");
  });
});

describe("money", () => {
  it("usa separador de miles es-AR", () => {
    expect(money(36000)).toBe("$36.000");
    expect(money(1234567)).toBe("$1.234.567");
  });

  it("distingue el cero de la ausencia de dato", () => {
    // Un importe de 0 es un dato; null es "no hay". No se pintan igual.
    expect(money(0)).toBe("$0");
    expect(money(null)).toBe("—");
    expect(money(undefined)).toBe("—");
  });
});
