import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../../auth/AuthContext";
import { EntityDrawer } from "../../../components/EntityDrawer";
import { Field, Select, TextInput } from "../../../components/form";
import { useToast } from "../../../components/ui/Toast";
import {
  useCrearEncuentro,
  useEditarEncuentro,
  useEncuentros,
  useGenerarEncuentros,
  type Encuentro,
} from "../../../hooks/useEncuentros";
import { useProvidersAdmin } from "../../../hooks/useProvidersAdmin";
import { useTrainingsAdmin } from "../../../hooks/useTrainingsAdmin";
import { can, type Role } from "../../../lib/permissions";
import { useContextoDeArea } from "../contexto-de-area";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/** "09:00:00" -> "09:00" */
const hhmm = (t: string) => t.slice(0, 5);
/** El input type="time" da "HH:MM"; la API pide "HH:MM:SS". */
const conSegundos = (t: string) => (t.length === 5 ? `${t}:00` : t);

/** "2026-11-05" -> "05/11/2026 (jueves)". UTC para que el huso no corra el día. */
function fechaConDia(d: string) {
  const dia = DIAS[new Date(`${d}T00:00:00Z`).getUTCDay()].toLowerCase();
  return `${d.split("-").reverse().join("/")} (${dia})`;
}

type Form = {
  sessionNumber: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  serviceProviderId: string;
  location: string;
  capacity: string;
};

const EMPTY: Form = {
  sessionNumber: "",
  sessionDate: "",
  startTime: "",
  endTime: "",
  serviceProviderId: "",
  location: "",
  capacity: "",
};

type FormGenerar = {
  desde: string;
  diaDeLaSemana: string;
  startTime: string;
  endTime: string;
  serviceProviderId: string;
  cantidad: string;
};

const TH = "px-3 py-2 text-left text-xs font-medium text-ink-soft";
const TD = "px-3 py-2 text-sm text-ink";
const BTN_PRIMARIO = "rounded-full bg-primary px-4 py-2 text-sm font-medium text-white";

/**
 * Solapa Encuentros de Capacitaciones: las fechas en que se dicta cada
 * capacitación y cuántas personas se anotaron a cada una.
 */
export function EncuentrosPage() {
  const { role } = useAuth();
  const toast = useToast();
  const ctx = useContextoDeArea();
  const r = role as Role | null;
  const canEdit = can(r, "catalogo", "edit");

  const { data: capacitaciones = [] } = useTrainingsAdmin(false);
  const { data: prestadoras = [] } = useProvidersAdmin(false);
  const [capId, setCapId] = useState("");
  // Hasta que elige una, queda la primera.
  useEffect(() => {
    if (!capId && capacitaciones.length > 0) setCapId(capacitaciones[0].id);
  }, [capacitaciones, capId]);
  const cap = capacitaciones.find((c) => c.id === capId) ?? null;

  const { data: encuentros = [], isLoading, error } = useEncuentros(capId || null);
  const crear = useCrearEncuentro(capId);
  const editar = useEditarEncuentro(capId);
  const generar = useGenerarEncuentros(capId);

  const ordenados = useMemo(
    () => [...encuentros].sort((a, b) => a.sessionNumber - b.sessionNumber),
    [encuentros],
  );
  // La API rechaza generar si hay cualquier encuentro, también de baja.
  const puedeGenerar = !isLoading && !error && !!cap && encuentros.length === 0;

  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<Encuentro | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const [abiertoGenerar, setAbiertoGenerar] = useState(false);
  const [formGen, setFormGen] = useState<FormGenerar | null>(null);
  const [errorGen, setErrorGen] = useState<string | null>(null);

  function abrirAlta() {
    setEditando(null);
    // Propone el número siguiente.
    const siguiente = encuentros.reduce((m, e) => Math.max(m, e.sessionNumber), 0) + 1;
    setForm({ ...EMPTY, sessionNumber: String(siguiente) });
    setErrorForm(null);
    setAbierto(true);
  }

  function abrirEdicion(e: Encuentro) {
    setEditando(e);
    setForm({
      sessionNumber: String(e.sessionNumber),
      sessionDate: e.sessionDate,
      startTime: hhmm(e.startTime),
      endTime: hhmm(e.endTime),
      serviceProviderId: e.serviceProviderId ?? "",
      location: e.location ?? "",
      capacity: e.capacity == null ? "" : String(e.capacity),
    });
    setErrorForm(null);
    setAbierto(true);
  }

  async function guardar() {
    if (!form.sessionNumber || !form.sessionDate || !form.startTime || !form.endTime) {
      setErrorForm("Completá el número, la fecha y el horario");
      return;
    }
    // "HH:MM" se compara bien como texto.
    if (form.endTime <= form.startTime) {
      setErrorForm("La hora de fin tiene que ser posterior a la de inicio");
      return;
    }
    const payload = {
      sessionNumber: Number(form.sessionNumber),
      sessionDate: form.sessionDate,
      startTime: conSegundos(form.startTime),
      endTime: conSegundos(form.endTime),
      serviceProviderId: form.serviceProviderId || null,
      location: form.location.trim() || null,
      // Vacío = el cupo de la capacitación
      capacity: form.capacity.trim() === "" ? null : Number(form.capacity),
    };
    try {
      if (editando) await editar.mutateAsync({ id: editando.id, ...payload });
      else await crear.mutateAsync(payload);
      toast.success(editando ? "Encuentro actualizado" : "Encuentro creado");
      setAbierto(false);
    } catch (e) {
      setErrorForm((e as Error).message);
    }
  }

  function alternarActivo(e: Encuentro) {
    const activar = !e.isActive;
    editar.mutate(
      { id: e.id, isActive: activar },
      {
        onSuccess: () => toast.success(activar ? "Encuentro reactivado" : "Encuentro dado de baja"),
        onError: (err: Error) => toast.error(err.message),
      },
    );
  }

  function abrirGenerar() {
    setFormGen({
      desde: "",
      diaDeLaSemana: "1",
      startTime: "",
      endTime: "",
      serviceProviderId: "",
      cantidad: cap?.totalSessions ? String(cap.totalSessions) : "",
    });
    setErrorGen(null);
    setAbiertoGenerar(true);
  }

  async function guardarGenerar() {
    if (!formGen) return;
    if (!formGen.desde || !formGen.startTime || !formGen.endTime) {
      setErrorGen("Completá la fecha de inicio y el horario");
      return;
    }
    if (formGen.endTime <= formGen.startTime) {
      setErrorGen("La hora de fin tiene que ser posterior a la de inicio");
      return;
    }
    if (!formGen.cantidad || Number(formGen.cantidad) < 1) {
      setErrorGen("Indicá cuántos encuentros generar");
      return;
    }
    try {
      await generar.mutateAsync({
        desde: formGen.desde,
        diaDeLaSemana: Number(formGen.diaDeLaSemana),
        startTime: conSegundos(formGen.startTime),
        endTime: conSegundos(formGen.endTime),
        serviceProviderId: formGen.serviceProviderId || null,
        cantidad: Number(formGen.cantidad),
      });
      toast.success("Encuentros generados");
      setAbiertoGenerar(false);
    } catch (e) {
      setErrorGen((e as Error).message);
    }
  }

  const acciones = canEdit && cap && (
    <div className="flex gap-2">
      {puedeGenerar && (
        <button type="button" onClick={abrirGenerar} className={BTN_PRIMARIO}>
          Generar encuentros
        </button>
      )}
      <button type="button" onClick={abrirAlta} className={BTN_PRIMARIO}>
        Agregar encuentro
      </button>
    </div>
  );

  const opcionesPrestadora = prestadoras.map((p) => (
    <option key={p.id} value={p.id}>
      {p.fullName}
    </option>
  ));

  return (
    <div className="px-4 py-4 sm:px-6">
      {ctx?.slotAcciones ? createPortal(acciones || null, ctx.slotAcciones) : acciones}

      <div className="mb-4 max-w-sm">
        <Field label="Capacitación">
          <Select value={capId} onChange={(e) => setCapId(e.target.value)}>
            {capacitaciones.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {error && <p className="mb-3 text-sm text-red-700">{(error as Error).message}</p>}

      <div className="overflow-x-auto rounded-xl border border-surface-high">
        <table className="w-full">
          <thead className="bg-surface-low">
            <tr>
              <th className={TH}>N.º</th>
              <th className={TH}>Fecha</th>
              <th className={TH}>Desde</th>
              <th className={TH}>Hasta</th>
              <th className={TH}>Prestadora</th>
              <th className={TH}>Lugar</th>
              <th className={TH}>Cupo</th>
              <th className={TH}>Anotadas</th>
              <th className={TH}>
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {ordenados.map((e) => (
              <tr key={e.id} className={`border-t border-surface-high ${e.isActive ? "" : "opacity-60"}`}>
                <td className={TD}>{e.sessionNumber}</td>
                <td className={TD}>{fechaConDia(e.sessionDate)}</td>
                <td className={TD}>{hhmm(e.startTime)}</td>
                <td className={TD}>{hhmm(e.endTime)}</td>
                <td className={TD}>{e.providerName ?? "—"}</td>
                <td className={TD}>{e.location ?? "—"}</td>
                <td className={TD}>
                  {e.capacity == null ? `El de la capacitación (${cap?.maxParticipants ?? "—"})` : e.capacity}
                </td>
                <td className={TD}>{e.anotadas}</td>
                <td className={`${TD} whitespace-nowrap text-right`}>
                  {canEdit && (
                    <>
                      <button
                        type="button"
                        onClick={() => abrirEdicion(e)}
                        className="rounded-full px-3 py-1 text-xs text-ink-soft hover:bg-surface-high"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => alternarActivo(e)}
                        disabled={editar.isPending}
                        className="rounded-full px-3 py-1 text-xs text-ink-soft hover:bg-surface-high disabled:opacity-50"
                      >
                        {e.isActive ? "Dar de baja" : "Reactivar"}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && ordenados.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-ink-soft">Esta capacitación todavía no tiene encuentros.</p>
        )}
      </div>

      <EntityDrawer
        open={abierto}
        title={editando ? "Editar encuentro" : "Agregar encuentro"}
        error={errorForm}
        busy={crear.isPending || editar.isPending}
        onSubmit={guardar}
        onClose={() => setAbierto(false)}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="N.º">
            <TextInput type="number" min={1} step={1} value={form.sessionNumber} onChange={(e) => setForm({ ...form, sessionNumber: e.target.value })} />
          </Field>
          <Field label="Fecha">
            <TextInput type="date" value={form.sessionDate} onChange={(e) => setForm({ ...form, sessionDate: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Desde">
            <TextInput type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
          </Field>
          <Field label="Hasta">
            <TextInput type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
          </Field>
        </div>
        <Field label="Prestadora">
          <Select value={form.serviceProviderId} onChange={(e) => setForm({ ...form, serviceProviderId: e.target.value })}>
            <option value="">—</option>
            {opcionesPrestadora}
          </Select>
        </Field>
        <Field label="Lugar">
          <TextInput value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        </Field>
        <Field label="Cupo" help="Vacío = el de la capacitación.">
          <TextInput type="number" min={1} step={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
        </Field>
      </EntityDrawer>

      <EntityDrawer
        open={abiertoGenerar}
        title="Generar encuentros"
        error={errorGen}
        busy={generar.isPending}
        onSubmit={guardarGenerar}
        onClose={() => setAbiertoGenerar(false)}
      >
        {formGen && (
          <>
            <Field label="Desde (fecha)" help="Se genera el primer encuentro en el primer día elegido a partir de esta fecha.">
              <TextInput type="date" value={formGen.desde} onChange={(e) => setFormGen({ ...formGen, desde: e.target.value })} />
            </Field>
            <Field label="Día de la semana">
              <Select value={formGen.diaDeLaSemana} onChange={(e) => setFormGen({ ...formGen, diaDeLaSemana: e.target.value })}>
                {DIAS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Desde">
                <TextInput type="time" value={formGen.startTime} onChange={(e) => setFormGen({ ...formGen, startTime: e.target.value })} />
              </Field>
              <Field label="Hasta">
                <TextInput type="time" value={formGen.endTime} onChange={(e) => setFormGen({ ...formGen, endTime: e.target.value })} />
              </Field>
            </div>
            <Field label="Prestadora">
              <Select value={formGen.serviceProviderId} onChange={(e) => setFormGen({ ...formGen, serviceProviderId: e.target.value })}>
                <option value="">—</option>
                {opcionesPrestadora}
              </Select>
            </Field>
            <Field label="Cantidad" help="Cuántos encuentros semanales crear.">
              <TextInput type="number" min={1} step={1} value={formGen.cantidad} onChange={(e) => setFormGen({ ...formGen, cantidad: e.target.value })} />
            </Field>
          </>
        )}
      </EntityDrawer>
    </div>
  );
}
