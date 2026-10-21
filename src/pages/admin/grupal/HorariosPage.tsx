import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../../auth/AuthContext";
import { EntityDrawer } from "../../../components/EntityDrawer";
import { Field, Select, TextInput } from "../../../components/form";
import { useToast } from "../../../components/ui/Toast";
import { formatWeeklySchedule } from "../../../lib/horario-proveedora";
import { useHorarioSemanalProveedoras, useProveedorasActivas } from "../../../hooks/useProveedorasDeHorario";
import { useMachinesList } from "../../../hooks/useMachinesAdmin";
import {
  useActividadesResumen,
  useActivitySchedules,
  useCrearHorario,
  useEditarHorario,
  type ActivitySchedule,
} from "../../../hooks/useActivitySchedules";
import { can, type Role } from "../../../lib/permissions";
import { useContextoDeArea } from "../contexto-de-area";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/** "09:00:00" -> "09:00" */
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : "—");
/** El input type="time" da "HH:MM"; la API pide "HH:MM:SS". */
const conSegundos = (t: string) => (t.length === 5 ? `${t}:00` : t);

const fechaCorta = (d: string) => d.split("-").reverse().join("/");
function vigencia(h: ActivitySchedule) {
  if (!h.validFrom && !h.validUntil) return "Siempre";
  if (h.validFrom && h.validUntil) return `${fechaCorta(h.validFrom)} al ${fechaCorta(h.validUntil)}`;
  return h.validFrom ? `Desde ${fechaCorta(h.validFrom)}` : `Hasta ${fechaCorta(h.validUntil!)}`;
}

type Form = {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  capacity: string;
  machineId: string;
  serviceProviderId: string;
  validFrom: string;
  validUntil: string;
};

const EMPTY: Form = { dayOfWeek: "1", startTime: "", endTime: "", capacity: "", machineId: "", serviceProviderId: "", validFrom: "", validUntil: "" };

const TH = "px-3 py-2 text-left text-xs font-medium text-ink-soft";
const TD = "px-3 py-2 text-sm text-ink";

/**
 * Solapa Horarios de Actividades: cuándo se dicta cada clase (o cuándo se puede
 * usar cada máquina). Es el patrón semanal; las clases fechadas salen de acá.
 */
export function HorariosPage() {
  const { role } = useAuth();
  const toast = useToast();
  const ctx = useContextoDeArea();
  const r = role as Role | null;
  const canManage = can(r, "catalogo", "manage");
  const canEdit = can(r, "catalogo", "edit");

  const { data: actividades = [] } = useActividadesResumen();
  const activas = useMemo(() => actividades.filter((a) => a.isActive), [actividades]);
  const [actividadId, setActividadId] = useState("");
  // Hasta que elige una, queda la primera activa.
  useEffect(() => {
    if (!actividadId && activas.length > 0) setActividadId(activas[0].id);
  }, [activas, actividadId]);
  const actividad = activas.find((a) => a.id === actividadId) ?? null;
  const esMaquina = actividad?.activityType === "machine";

  const { data: horarios = [], isLoading, error } = useActivitySchedules(actividadId || null);
  const { data: maquinas = [] } = useMachinesList();
  const { data: proveedoras = [] } = useProveedorasActivas();
  const { data: horarioProveedoras = {} } = useHorarioSemanalProveedoras();
  const crear = useCrearHorario(actividadId);
  const editar = useEditarHorario(actividadId);

  const ordenados = useMemo(
    () =>
      [...horarios].sort(
        (a, b) =>
          (a.dayOfWeek ?? 0) - (b.dayOfWeek ?? 0) || (a.startTime ?? "").localeCompare(b.startTime ?? ""),
      ),
    [horarios],
  );

  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<ActivitySchedule | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  function abrirAlta() {
    setEditando(null);
    setForm(EMPTY);
    setErrorForm(null);
    setAbierto(true);
  }

  function abrirEdicion(h: ActivitySchedule) {
    setEditando(h);
    setForm({
      dayOfWeek: String(h.dayOfWeek ?? 1),
      startTime: hhmm(h.startTime),
      endTime: hhmm(h.endTime),
      capacity: h.capacity == null ? "" : String(h.capacity),
      machineId: h.machineId ?? "",
      serviceProviderId: h.serviceProviderId ?? "",
      validFrom: h.validFrom ?? "",
      validUntil: h.validUntil ?? "",
    });
    setErrorForm(null);
    setAbierto(true);
  }

  async function guardar() {
    if (!form.startTime || !form.endTime) {
      setErrorForm("Completá la hora de inicio y la de fin");
      return;
    }
    // "HH:MM" se compara bien como texto.
    if (form.endTime <= form.startTime) {
      setErrorForm("La hora de fin tiene que ser posterior a la de inicio");
      return;
    }
    if (esMaquina && !form.machineId) {
      setErrorForm("Elegí la máquina");
      return;
    }
    if (!esMaquina && !form.serviceProviderId) {
      setErrorForm("Elegí la proveedora del horario");
      return;
    }
    const payload = {
      dayOfWeek: Number(form.dayOfWeek),
      startTime: conSegundos(form.startTime),
      endTime: conSegundos(form.endTime),
      // Vacío = sin límite
      capacity: form.capacity.trim() === "" ? null : Number(form.capacity),
      ...(esMaquina ? { machineId: form.machineId } : {}),
      serviceProviderId: form.serviceProviderId || null,
      validFrom: form.validFrom || null,
      validUntil: form.validUntil || null,
    };
    try {
      if (editando) await editar.mutateAsync({ id: editando.id, ...payload });
      else await crear.mutateAsync(payload);
      toast.success(editando ? "Horario actualizado" : "Horario creado");
      setAbierto(false);
    } catch (e) {
      setErrorForm((e as Error).message);
    }
  }

  function alternarActivo(h: ActivitySchedule) {
    const activar = h.isActive === false;
    editar.mutate(
      { id: h.id, isActive: activar },
      {
        onSuccess: () => toast.success(activar ? "Horario reactivado" : "Horario pausado"),
        onError: (e: Error) => toast.error(e.message),
      },
    );
  }

  const nombreMaquina = (id: string | null) => maquinas.find((m) => m.id === id)?.name ?? "—";

  const botonAgregar = canManage && actividad && (
    <button
      type="button"
      onClick={abrirAlta}
      className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white"
    >
      Agregar horario
    </button>
  );

  return (
    <div className="flex h-full flex-col px-4 py-4 sm:px-6">
      {ctx?.slotAcciones ? createPortal(botonAgregar || null, ctx.slotAcciones) : botonAgregar}

      <div className="mb-4 max-w-sm">
        <Field label="Actividad">
          <Select value={actividadId} onChange={(e) => setActividadId(e.target.value)}>
            {activas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {error && <p className="mb-3 text-sm text-red-700">{(error as Error).message}</p>}

      <div className="modal-scroll min-h-0 flex-1 overflow-auto rounded-xl border border-surface-high">
        <table className="w-full">
          <thead className="sticky top-0 z-10 bg-surface-low">
            <tr>
              <th className={TH}>Día</th>
              <th className={TH}>Desde</th>
              <th className={TH}>Hasta</th>
              <th className={TH}>Proveedora</th>
              <th className={TH}>Cupo</th>
              {esMaquina && <th className={TH}>Máquina</th>}
              <th className={TH}>Vigencia</th>
              <th className={TH}>Activo</th>
              <th className={TH}>
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {ordenados.map((h) => (
              <tr key={h.id} className={`border-t border-surface-high ${h.isActive === false ? "opacity-60" : ""}`}>
                <td className={TD}>{h.dayOfWeek == null ? "—" : DIAS[h.dayOfWeek]}</td>
                <td className={TD}>{hhmm(h.startTime)}</td>
                <td className={TD}>{hhmm(h.endTime)}</td>
                <td className={TD}>{h.providerName ?? "—"}</td>
                <td className={TD}>{h.capacity == null ? "Sin límite" : h.capacity}</td>
                {esMaquina && <td className={TD}>{nombreMaquina(h.machineId)}</td>}
                <td className={TD}>{vigencia(h)}</td>
                <td className={TD}>{h.isActive === false ? "Pausado" : "Activo"}</td>
                <td className={`${TD} whitespace-nowrap text-right`}>
                  {canEdit && (
                    <>
                      <button
                        type="button"
                        onClick={() => abrirEdicion(h)}
                        className="rounded-full px-3 py-1 text-xs text-ink-soft hover:bg-surface-high"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => alternarActivo(h)}
                        disabled={editar.isPending}
                        className="rounded-full px-3 py-1 text-xs text-ink-soft hover:bg-surface-high disabled:opacity-50"
                      >
                        {h.isActive === false ? "Reactivar" : "Pausar"}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && ordenados.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-ink-soft">Esta actividad todavía no tiene horarios.</p>
        )}
      </div>

      <EntityDrawer
        open={abierto}
        title={editando ? "Editar horario" : "Agregar horario"}
        error={errorForm}
        busy={crear.isPending || editar.isPending}
        onSubmit={guardar}
        onClose={() => setAbierto(false)}
      >
        <Field label="Día">
          <Select value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })}>
            {DIAS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Desde">
            <TextInput type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
          </Field>
          <Field label="Hasta">
            <TextInput type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
          </Field>
        </div>
        <Field label="Proveedora">
          <Select
            value={form.serviceProviderId}
            onChange={(e) => setForm({ ...form, serviceProviderId: e.target.value })}
          >
            <option value="">{esMaquina ? "Sin proveedora" : "Seleccionar proveedora..."}</option>
            {proveedoras.map((p) => {
              const horario = formatWeeklySchedule(horarioProveedoras[p.id]);
              return (
                <option key={p.id} value={p.id}>
                  {p.fullName ?? "(sin nombre)"}
                  {horario && ` — ${horario}`}
                </option>
              );
            })}
          </Select>
        </Field>
        <p className="-mt-2 text-xs text-ink-soft">
          {form.serviceProviderId
            ? formatWeeklySchedule(horarioProveedoras[form.serviceProviderId]) ||
              "Esta proveedora todavía no tiene horario semanal cargado."
            : "Se muestra el horario semanal de cada una para elegir con criterio."}
        </p>
        <Field label="Cupo" help="Vacío = sin límite.">
          <TextInput type="number" min={1} step={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
        </Field>
        {esMaquina && (
          <Field label="Máquina">
            <Select value={form.machineId} onChange={(e) => setForm({ ...form, machineId: e.target.value })}>
              <option value="">—</option>
              {maquinas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Vigente desde">
            <TextInput type="date" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} />
          </Field>
          <Field label="Vigente hasta">
            <TextInput type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} />
          </Field>
        </div>
      </EntityDrawer>
    </div>
  );
}
