import { useEffect, useState } from "react";
import { Field, TextInput } from "../../components/form";
import { Plus, Trash } from "../../components/icons";
import { Toggle } from "../../components/Toggle";
import { useToast } from "../../components/ui/Toast";
import {
  useSaveWeeklyAvailability,
  useWeeklyAvailability,
  type WeeklyRowInput,
} from "../../hooks/useProviderAvailability";

const DAY_ORDER = [1, 2, 3, 4, 5, 0]; // Lun→Dom. Sábado (6) se maneja en la pestaña Sábados.
const DAY_LABELS: Record<number, string> = {
  0: "Domingo",
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
};

type Franja = { workStartTime: string; workEndTime: string };
type Draft = Record<number, Franja[]>;

function emptyDraft(): Draft {
  const d: Draft = {};
  for (const day of DAY_ORDER) d[day] = [];
  return d;
}

export function WeeklyAvailabilityTab({
  providerId,
  readOnly,
}: {
  providerId: string;
  readOnly: boolean;
}) {
  const { data: rows, isLoading } = useWeeklyAvailability(providerId);
  const save = useSaveWeeklyAvailability(providerId);
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(emptyDraft());

  useEffect(() => {
    if (!rows) return;
    const next = emptyDraft();
    for (const r of rows) {
      if (!(r.dayOfWeek in next)) continue; // sábado no debería llegar acá
      next[r.dayOfWeek].push({
        workStartTime: r.workStartTime.slice(0, 5),
        workEndTime: r.workEndTime.slice(0, 5),
      });
    }
    setDraft(next);
  }, [rows]);

  function setDay(day: number, franjas: Franja[]) {
    setDraft((d) => ({ ...d, [day]: franjas }));
  }

  function toggleDay(day: number, works: boolean) {
    setDay(day, works ? [{ workStartTime: "09:00", workEndTime: "18:00" }] : []);
  }

  function updateFranja(day: number, idx: number, patch: Partial<Franja>) {
    setDay(day, draft[day].map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  }

  function addFranja(day: number) {
    setDay(day, [...draft[day], { workStartTime: "09:00", workEndTime: "13:00" }]);
  }

  function removeFranja(day: number, idx: number) {
    setDay(day, draft[day].filter((_, i) => i !== idx));
  }

  function handleSave() {
    const rowsInput: WeeklyRowInput[] = DAY_ORDER.flatMap((day) =>
      draft[day].map((f) => ({
        dayOfWeek: day,
        workStartTime: f.workStartTime,
        workEndTime: f.workEndTime,
      })),
    );
    save.mutate(rowsInput, {
      onSuccess: () => toast.success("Horario semanal guardado"),
      onError: (e: Error) => toast.error(e.message),
    });
  }

  if (isLoading) return <p className="text-sm text-ink-soft">Cargando…</p>;

  return (
    <div className="space-y-3">
      {DAY_ORDER.map((day) => {
        const franjas = draft[day];
        const works = franjas.length > 0;
        return (
          <div key={day} className="rounded-xl border border-surface-high p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink">{DAY_LABELS[day]}</span>
              <Toggle active={works} onChange={(v) => toggleDay(day, v)} disabled={readOnly} />
            </div>
            {works && (
              <div className="mt-2 space-y-2">
                {franjas.map((f, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Field label="Desde">
                      <TextInput
                        type="time"
                        value={f.workStartTime}
                        disabled={readOnly}
                        onChange={(e) => updateFranja(day, idx, { workStartTime: e.target.value })}
                      />
                    </Field>
                    <Field label="Hasta">
                      <TextInput
                        type="time"
                        value={f.workEndTime}
                        disabled={readOnly}
                        onChange={(e) => updateFranja(day, idx, { workEndTime: e.target.value })}
                      />
                    </Field>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => removeFranja(day, idx)}
                        className="mt-4 rounded p-1.5 text-ink-soft transition-colors hover:bg-surface-high hover:text-red-700"
                      >
                        <Trash size={15} />
                      </button>
                    )}
                  </div>
                ))}
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => addFranja(day)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <Plus size={13} /> agregar franja
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
      <div className="rounded-xl border border-dashed border-surface-high p-3 text-sm text-ink-soft">
        Sábado se gestiona en la pestaña "Sábados" (turnos alternados).
      </div>
      {!readOnly && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={save.isPending}
            className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
          >
            {save.isPending ? "Guardando…" : "Guardar horario semanal"}
          </button>
        </div>
      )}
    </div>
  );
}
