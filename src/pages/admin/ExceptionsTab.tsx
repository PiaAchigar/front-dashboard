import { useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Field, Select, TextArea, TextInput } from "../../components/form";
import { Trash } from "../../components/icons";
import { useToast } from "../../components/ui/Toast";
import {
  useAddException,
  useDeleteException,
  useExceptions,
} from "../../hooks/useProviderAvailability";
import type { ConflictingAppointment } from "../../lib/api-types";

function formatDateAR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const TYPE_LABELS: Record<string, string> = {
  unavailable: "No disponible",
  sick_leave: "Enfermedad",
  vacation: "Vacaciones",
  reduced_hours: "Horario reducido",
  not_coming: "Falta puntual",
  other: "Otro",
};

export function ExceptionsTab({
  providerId,
  readOnly,
}: {
  providerId: string;
  readOnly: boolean;
}) {
  const { data: rows = [], isLoading } = useExceptions(providerId);
  const add = useAddException(providerId);
  const del = useDeleteException(providerId);
  const toast = useToast();

  const [type, setType] = useState("vacation");
  const [rangeMode, setRangeMode] = useState(true);
  const [singleDate, setSingleDate] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [overrideStart, setOverrideStart] = useState("14:00");
  const [overrideEnd, setOverrideEnd] = useState("18:00");
  const [reason, setReason] = useState("");
  const [conflict, setConflict] = useState<ConflictingAppointment[] | null>(null);

  const canAdd = rangeMode ? Boolean(dateStart && dateEnd) : Boolean(singleDate);

  function handleAdd() {
    add.mutate(
      {
        exceptionType: type,
        dateException: rangeMode ? null : singleDate,
        dateStart: rangeMode ? dateStart : null,
        dateEnd: rangeMode ? dateEnd : null,
        timeOverrideStart: type === "reduced_hours" ? overrideStart : null,
        timeOverrideEnd: type === "reduced_hours" ? overrideEnd : null,
        reason: reason.trim() || null,
        isWorking: type === "reduced_hours",
      },
      {
        onSuccess: (created) => {
          toast.success("Excepción agregada");
          setSingleDate("");
          setDateStart("");
          setDateEnd("");
          setReason("");
          if (created.conflictingAppointments.length > 0) {
            setConflict(created.conflictingAppointments);
          }
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
        <p className="text-sm text-ink-soft">Sin excepciones cargadas.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-surface-high bg-white p-2.5 text-sm"
            >
              <div>
                <p className="font-medium text-ink">
                  {TYPE_LABELS[r.exceptionType] ?? r.exceptionType}
                  {" — "}
                  {r.dateException
                    ? formatDateAR(r.dateException)
                    : `${formatDateAR(r.dateStart!)} al ${formatDateAR(r.dateEnd!)}`}
                </p>
                {r.reason && <p className="text-xs text-ink-soft">{r.reason}</p>}
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() =>
                    del.mutate(r.id, {
                      onSuccess: () => toast.success("Excepción eliminada"),
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
        <div className="space-y-3 rounded-xl border border-surface-high p-3">
          <Field label="Tipo">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex gap-3 text-xs text-ink">
            <label className="flex items-center gap-1">
              <input type="radio" checked={!rangeMode} onChange={() => setRangeMode(false)} />
              Día único
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" checked={rangeMode} onChange={() => setRangeMode(true)} />
              Rango de fechas
            </label>
          </div>

          {rangeMode ? (
            <div className="flex gap-2">
              <Field label="Desde">
                <TextInput
                  type="date"
                  value={dateStart}
                  onChange={(e) => setDateStart(e.target.value)}
                />
              </Field>
              <Field label="Hasta">
                <TextInput type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} />
              </Field>
            </div>
          ) : (
            <Field label="Fecha">
              <TextInput
                type="date"
                value={singleDate}
                onChange={(e) => setSingleDate(e.target.value)}
              />
            </Field>
          )}

          {type === "reduced_hours" && (
            <div className="flex gap-2">
              <Field label="Nuevo horario desde">
                <TextInput
                  type="time"
                  value={overrideStart}
                  onChange={(e) => setOverrideStart(e.target.value)}
                />
              </Field>
              <Field label="Nuevo horario hasta">
                <TextInput
                  type="time"
                  value={overrideEnd}
                  onChange={(e) => setOverrideEnd(e.target.value)}
                />
              </Field>
            </div>
          )}

          <Field label="Motivo (opcional)">
            <TextArea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleAdd}
              disabled={!canAdd || add.isPending}
              className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              {add.isPending ? "Agregando…" : "Agregar"}
            </button>
          </div>
        </div>
      )}

      {conflict && (
        <ConfirmDialog
          open
          title="Turnos ya agendados en ese rango"
          message={
            <div>
              <p>Esta proveedora tiene {conflict.length} turno(s) agendado(s) en ese rango:</p>
              <ul className="mt-2 list-disc pl-4">
                {conflict.map((a) => (
                  <li key={a.id}>
                    {new Date(a.appointmentStart).toLocaleString("es-AR")} —{" "}
                    {a.customerName ?? "Cliente"} — {a.serviceName ?? "Servicio"}
                  </li>
                ))}
              </ul>
            </div>
          }
          confirmLabel="Entendido"
          onConfirm={() => setConflict(null)}
          onCancel={() => setConflict(null)}
        />
      )}
    </div>
  );
}
