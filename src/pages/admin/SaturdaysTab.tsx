import { useState } from "react";
import { Field, TextInput } from "../../components/form";
import { Trash } from "../../components/icons";
import { Toggle } from "../../components/Toggle";
import { useToast } from "../../components/ui/Toast";
import {
  useAddSaturday,
  useDeleteSaturday,
  useSaturdaySchedules,
} from "../../hooks/useProviderAvailability";

function formatDateAR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function SaturdaysTab({ providerId, readOnly }: { providerId: string; readOnly: boolean }) {
  const { data: rows = [], isLoading } = useSaturdaySchedules(providerId);
  const add = useAddSaturday(providerId);
  const del = useDeleteSaturday(providerId);
  const toast = useToast();

  const [date, setDate] = useState("");
  const [works, setWorks] = useState(true);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("13:00");

  function handleAdd() {
    if (!date) return;
    add.mutate(
      {
        saturdayDate: date,
        isWorking: works,
        workStartTime: works ? start : null,
        workEndTime: works ? end : null,
      },
      {
        onSuccess: () => {
          toast.success("Sábado agregado");
          setDate("");
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  }

  return (
    <div className="space-y-4">
      {isLoading ? (
        <p className="text-sm text-ink-soft">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-ink-soft">Sin sábados cargados.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-surface-high bg-white p-2.5 text-sm"
            >
              <span>
                <span className="font-medium text-ink">Sábado {formatDateAR(r.saturdayDate)}</span>{" "}
                <span className="text-ink-soft">
                  —{" "}
                  {r.isWorking
                    ? `${r.workStartTime?.slice(0, 5)}–${r.workEndTime?.slice(0, 5)}`
                    : "No trabaja"}
                </span>
              </span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() =>
                    del.mutate(r.id, {
                      onSuccess: () => toast.success("Sábado eliminado"),
                      onError: (e: Error) => toast.error(e.message),
                    })
                  }
                  className="shrink-0 rounded p-1.5 text-ink-soft transition-colors hover:bg-surface-high hover:text-red-700"
                >
                  <Trash size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (
        <div className="space-y-2 rounded-xl border border-surface-high p-3">
          <div className="flex items-end gap-3">
            <Field label="Sábado">
              <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <div className="mb-2 flex items-center gap-2">
              <Toggle active={works} onChange={setWorks} label="Trabaja" />
              <span className="text-xs text-ink-soft">Trabaja</span>
            </div>
          </div>
          {works && (
            <div className="flex gap-2">
              <Field label="Desde">
                <TextInput type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              </Field>
              <Field label="Hasta">
                <TextInput type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </Field>
            </div>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleAdd}
              disabled={!date || add.isPending}
              className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              {add.isPending ? "Agregando…" : "Agregar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
