import { useState } from "react";
import { useAuth } from "../../../auth/AuthContext";
import { can, type Role } from "../../../lib/permissions";
import { Checkbox, Field, Select } from "../../../components/form";
import { Plus, Trash } from "../../../components/icons";
import { useToast } from "../../../components/ui/Toast";
import { useContextoDeArea } from "../contexto-de-area";
import {
  EditorDeAcuerdos,
  type FilaDeAcuerdo,
  type TipoDePagoOpcion,
} from "../../../components/EditorDeAcuerdos";
import { traduccionDeTarifa, type TipoDePago } from "../../../lib/traduccion-de-tarifa";
import {
  useDepilacionConfig,
  useTurnosFuturosDeDepilacion,
} from "../../../hooks/useDepilacion";
import {
  useAgregarEquipo,
  useEquiposDeDepilacion,
  useSacarEquipo,
  type EquipoDeDepilacion,
} from "../../../hooks/useEquiposDeDepilacion";
import {
  useDeshabilitarMaquina,
  useHabilitarMaquina,
  useMaquinasDeProveedoras,
} from "../../../hooks/useMaquinasDeProveedora";
import { useMachinesList } from "../../../hooks/useMachinesAdmin";
import { useProvidersAdmin } from "../../../hooks/useProvidersAdmin";
import { useServiceAgreements } from "../../../hooks/useServiceAgreements";
import { useSetServiceAgreements } from "../../../hooks/useServicesAdmin";
import type { ServiceAgreement } from "../../../lib/api-types";

const TIPOS_DE_PAGO: TipoDePagoOpcion[] = [
  { value: "fixed_per_service", label: "Monto fijo por sesión" },
  { value: "per_hour", label: "Por hora" },
];

const NOTA_PORCENTAJE =
  "En depilación no se puede cobrar por porcentaje: lo que se vende es el pack, " +
  "no el servicio, así que el porcentaje daría $0.";

const MOTIVO_SIN_EQUIPOS_ID = "comision-motivo-sin-equipos";

function esTipoDePago(valor: string): valor is TipoDePago {
  return valor === "fixed_per_service" || valor === "per_hour";
}

/**
 * La tarifa escrita a la argentina, en pesos.
 *
 * `Number("20.000")` es **20**, no veinte mil — y esta misma pantalla le enseña
 * a Laura la notación que rompe el campo, porque `traduccionDeTarifa` formatea
 * "$20.000" con punto de miles. Cargar $20 creyendo que se cargaron $20.000 no
 * es un error de tipeo recuperable: es una comisión mil veces menor que se
 * congela en `provider_earning` al marcar la sesión como realizada.
 *
 * Vive acá y NO en `EditorDeAcuerdos` a propósito. En Comisión los dos tipos de
 * pago son pesos enteros, así que un punto sólo puede ser separador de miles y
 * se saca sin ambigüedad. En Servicios existe `percentage`, donde "12.5" es
 * doce y medio por ciento legítimo: tocar el parseo compartido lo rompería.
 */
export function montoEnPesos(texto: string): number {
  // La coma sí es decimal en es-AR, así que se conserva como punto decimal.
  const normalizado = texto.replace(/[.\s\u00a0]/g, "").replace(",", ".");
  return Number(normalizado);
}

export function ComisionPage() {
  const { role } = useAuth();
  const puedeEditar = can(role as Role | null, "catalogo", "manage");
  // Mismo criterio que Precios: adentro del layout el que scrollea es el área,
  // y dejar los dos daría una barra adentro de la otra.
  const contextoDeArea = useContextoDeArea();

  const config = useDepilacionConfig();
  const equiposQuery = useEquiposDeDepilacion();
  const equipos = equiposQuery.data ?? [];

  const anchorServiceId = config.data?.anchorServiceId ?? null;
  const acuerdos = useServiceAgreements(anchorServiceId);

  const error = (config.error ?? equiposQuery.error ?? acuerdos.error) as Error | null;

  return (
    <div
      className={`p-2 pl-4 sm:p-4 ${contextoDeArea ? "" : "modal-scroll h-full overflow-y-auto"}`}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error.message}</p>
        )}

        {/* Los equipos van ARRIBA porque el bloque de abajo depende de ellos: las
            máquinas de un turno son la intersección de los equipos del servicio con
            la certificación de la proveedora. Habilitar a alguien sin equipo no la
            hace aparecer con horarios, y nada lo explicaría. */}
        <BloqueDeEquipos
          equipos={equipos}
          cargando={equiposQuery.isLoading}
          puedeEditar={puedeEditar}
        />

        <section className="space-y-3">
          <div>
            <h2 className="font-display text-lg text-ink">Quién hace depilación</h2>
            <p className="text-xs text-ink-soft">
              Quién está habilitada para hacer depilación definitiva y cuánto cobra por
              hacerla.
            </p>
          </div>

          {config.isSuccess && !anchorServiceId ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Todavía no hay un servicio de depilación definitiva en el catálogo, así que no
              hay a qué asociar las proveedoras. Creálo en Servicios y volvé acá.
            </p>
          ) : acuerdos.data && anchorServiceId ? (
            <BloqueDeProveedoras
              anchorServiceId={anchorServiceId}
              acuerdosIniciales={acuerdos.data}
              equipos={equipos}
              sinEquipos={equiposQuery.isSuccess && equipos.length === 0}
              sesionesEsperandoTurno={config.data?.sesionesEsperandoTurno ?? 0}
              puedeEditar={puedeEditar}
            />
          ) : (
            <p className="text-sm text-ink-soft">Cargando…</p>
          )}
        </section>
      </div>
    </div>
  );
}

// ── Bloque 1: los equipos que usa la depilación ─────────────────────────────

function BloqueDeEquipos({
  equipos,
  cargando,
  puedeEditar,
}: {
  equipos: EquipoDeDepilacion[];
  cargando: boolean;
  puedeEditar: boolean;
}) {
  const maquinas = useMachinesList();
  const agregar = useAgregarEquipo();
  const sacar = useSacarEquipo();
  const toast = useToast();
  const [elegida, setElegida] = useState("");
  const [error, setError] = useState<string | null>(null);

  const yaEsEquipo = new Set(equipos.map((e) => e.machineId));
  const disponibles = (maquinas.data ?? []).filter((m) => !yaEsEquipo.has(m.id));

  async function correr(accion: () => Promise<unknown>, exito: string) {
    setError(null);
    try {
      await accion();
      toast.success(exito);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-lg text-ink">Equipos de depilación</h2>
        <p className="text-xs text-ink-soft">
          Las máquinas con las que se hace depilación definitiva. Un turno sólo se puede
          agendar si la proveedora sabe usar alguno de estos equipos.
        </p>
        {/* Este bloque escribe al toque y el de abajo espera al Guardar: los
            dos tienen el mismo tacho, así que la diferencia se dice acá y en
            el texto del botón de abajo, no se deja adivinar. */}
        <p className="text-xs font-medium text-ink-soft">
          Los cambios de este bloque se aplican al instante, sin Guardar.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      )}

      <div className="space-y-2 rounded-xl border border-surface-high p-3">
        {cargando ? (
          <p className="text-sm text-ink-soft">Cargando…</p>
        ) : equipos.length === 0 ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Todavía no hay ningún equipo de depilación.</p>
        ) : (
          <ul className="space-y-2">
            {equipos.map((e) => {
              const nombre = e.machineName ?? "—";
              return (
                <li
                  key={e.machineId}
                  className="rounded-lg border border-surface-high bg-white p-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-ink">{nombre}</span>
                    {puedeEditar && (
                      <button
                        type="button"
                        title={`Sacar ${nombre} de depilación (se aplica al instante)`}
                        onClick={() =>
                          correr(
                            () => sacar.mutateAsync(e.machineId),
                            `${nombre} ya no es un equipo de depilación`,
                          )
                        }
                        className="shrink-0 rounded p-1.5 text-ink-soft transition-colors hover:bg-surface-high hover:text-red-700"
                      >
                        <Trash size={15} />
                      </button>
                    )}
                  </div>
                  {/* La disponibilidad filtra `machines.status = 'active'`: un
                      equipo en mantenimiento desaparece del cruce y la
                      proveedora se queda sin horarios, sin ningún error que lo
                      explique. */}
                  {e.machineStatus !== "active" && (
                    <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">
                      ⚠ {nombre} no está activa: aunque esté tildada en una proveedora, la
                      disponibilidad no la va a usar y esa proveedora no aparece con
                      horarios.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {puedeEditar && (
          <div className="flex items-end justify-end gap-2">
            <Field label="Equipo a agregar">
              <Select value={elegida} onChange={(ev) => setElegida(ev.target.value)}>
                <option value="">Elegí una máquina…</option>
                {disponibles.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name ?? "—"}
                  </option>
                ))}
              </Select>
            </Field>
            <button
              type="button"
              disabled={!elegida}
              onClick={() =>
                correr(async () => {
                  await agregar.mutateAsync(elegida);
                  setElegida("");
                }, "Equipo agregado a depilación")
              }
              className="mb-1.5 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-surface-highest disabled:text-ink-soft"
            >
              <Plus size={15} />
              Agregar equipo
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Bloque 2: quién hace depilación y cuánto cobra ──────────────────────────

function aFilas(acuerdos: ServiceAgreement[]): FilaDeAcuerdo[] {
  return acuerdos.map((a) => ({
    serviceProviderId: a.serviceProviderId,
    paymentType: a.paymentType ?? "",
    rate: a.rate != null ? String(a.rate) : "",
  }));
}

function BloqueDeProveedoras({
  anchorServiceId,
  acuerdosIniciales,
  equipos,
  sinEquipos,
  sesionesEsperandoTurno,
  puedeEditar,
}: {
  anchorServiceId: string;
  acuerdosIniciales: ServiceAgreement[];
  equipos: EquipoDeDepilacion[];
  sinEquipos: boolean;
  sesionesEsperandoTurno: number;
  puedeEditar: boolean;
}) {
  // Mismo criterio que `AgreementsEditor` en ServiciosAdminPage: el estado
  // arranca de lo que vino del servidor y de ahí en más manda el usuario. Sin
  // efectos de sincronización, que pisarían lo que está escribiendo cada vez
  // que react-query refresca la query.
  const [filas, setFilas] = useState<FilaDeAcuerdo[]>(() => aFilas(acuerdosIniciales));
  /** Sólo las proveedoras cuyos tildes tocó el usuario. Lo que no está acá no
   *  se toca al guardar: es la diferencia entre "no cambió" y "desmarcado". */
  const [maquinasEditadas, setMaquinasEditadas] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [avisoDeTurnos, setAvisoDeTurnos] = useState<string | null>(null);

  const proveedoras = useProvidersAdmin(false);
  const turnosFuturos = useTurnosFuturosDeDepilacion();
  const idsEnPantalla = filas.map((f) => f.serviceProviderId).filter(Boolean);
  // `isLoading` NO es opcional acá. Mientras el GET de certificaciones está en
  // vuelo, `tildadas()` devuelve `[]` porque todavía no sabe nada — no porque
  // la proveedora no tenga nada. Un tilde habilitado sobre ese vacío deja que
  // el primer click lo congele en `maquinasEditadas`, que de ahí en más tiene
  // precedencia sobre lo que conteste el servidor, y al guardar sale un DELETE
  // de una máquina que nadie destildó. Como la certificación es global por
  // proveedora, ese DELETE se la saca también de criolipólisis y de HIFU.
  const { porProveedora, isLoading: cargandoCertificaciones } =
    useMaquinasDeProveedoras(idsEnPantalla);

  const guardarAcuerdos = useSetServiceAgreements();
  const habilitarMaquina = useHabilitarMaquina();
  const deshabilitarMaquina = useDeshabilitarMaquina();
  const toast = useToast();

  const equiposIds = new Set(equipos.map((e) => e.machineId));

  function nombreDe(providerId: string): string {
    return (
      proveedoras.data?.find((p) => p.id === providerId)?.fullName ??
      acuerdosIniciales.find((a) => a.serviceProviderId === providerId)?.providerName ??
      "esta proveedora"
    );
  }

  /** Los equipos DE DEPILACIÓN que tiene tildados hoy la proveedora, más lo que
   *  el usuario haya cambiado sin guardar todavía. */
  function tildadas(providerId: string): string[] {
    const guardadas = (porProveedora[providerId] ?? [])
      .map((m) => m.machineId)
      .filter((id) => equiposIds.has(id));
    return maquinasEditadas[providerId] ?? guardadas;
  }

  function alternarMaquina(providerId: string, machineId: string, tildar: boolean) {
    const actuales = tildadas(providerId);
    setMaquinasEditadas((prev) => ({
      ...prev,
      [providerId]: tildar
        ? [...actuales, machineId]
        : actuales.filter((id) => id !== machineId),
    }));
  }

  /** Quitar una fila avisa cuántos turnos quedan colgados. Avisa, no bloquea:
   *  sacarle a la dueña la posibilidad de desarmar algo la deja sin salida
   *  cuando una proveedora renuncia. */
  function alCambiarFilas(nuevas: FilaDeAcuerdo[]) {
    if (nuevas.length < filas.length) {
      const idsNuevas = nuevas.map((n) => n.serviceProviderId);
      const quitada = filas.find(
        (f) => f.serviceProviderId && !idsNuevas.includes(f.serviceProviderId),
      );
      const turnos =
        turnosFuturos.data?.find((t) => t.providerId === quitada?.serviceProviderId)?.turnos ??
        0;
      setAvisoDeTurnos(
        quitada && turnos > 0
          ? `${nombreDe(quitada.serviceProviderId)} tiene ${turnos} ${
              turnos === 1 ? "turno" : "turnos"
            } de depilación sin completar. Si guardás así, ${
              turnos === 1 ? "ese turno se queda" : "esos turnos se quedan"
            } sin acuerdo vigente: cuando ${
              turnos === 1 ? "lo marquen" : "los marquen"
            } como realizado${turnos === 1 ? "" : "s"}, no se le va a liquidar nada a ${nombreDe(
              quitada.serviceProviderId,
            )} y ${turnos === 1 ? "ni siquiera va" : "ni siquiera van"} a aparecer en la liquidación del mes. ${
              turnos === 1 ? "Sacala recién cuando ese turno esté cerrado" : "Sacala recién cuando esos turnos estén cerrados"
            }.`
          : null,
      );
    }
    setFilas(nuevas);
  }

  /** El primer motivo por el que esto no se puede guardar, o `null`.
   *
   *  Una fila sin tipo de pago o sin tarifa es una proveedora habilitada sin
   *  forma de cobrar: exactamente el problema de los $0 que esta pantalla
   *  existe para arreglar, así que no se guarda. */
  function primerError(): string | null {
    // La misma proveedora dos veces no es un descuido estético. `diffAgreements`
    // no deduplica, así que las dos filas van a `toCreate`, y
    // `setServiceAgreements` cierra los acuerdos viejos ANTES de insertar y sin
    // transacción: el índice único parcial hace fallar el INSERT, pero los
    // cierres ya commitearon y la proveedora queda SIN acuerdo activo, cobrando
    // $0. El borde también lo rechaza (PUT /agreements), esto es para que no se
    // llegue hasta ahí.
    const repetida = filas.find(
      (f, i) =>
        f.serviceProviderId &&
        filas.findIndex((o) => o.serviceProviderId === f.serviceProviderId) !== i,
    );
    if (repetida) {
      return `${nombreDe(repetida.serviceProviderId)} está dos veces en la lista: cada proveedora va una sola vez, con un solo acuerdo.`;
    }

    for (const f of filas) {
      if (!f.serviceProviderId) {
        return "Falta elegir la proveedora en una de las filas.";
      }
      const nombre = nombreDe(f.serviceProviderId);
      if (!f.paymentType) {
        return `Falta indicar cómo cobra ${nombre}: una proveedora habilitada sin forma de cobrar factura $0.`;
      }
      // Un acuerdo viejo por porcentaje no aparece en el desplegable, así que
      // el <select> cae en el índice 0 y muestra "—" mientras el estado sigue
      // diciendo "percentage". Sin esta rama la fila se ve vacía, la pantalla
      // no marca nada, y el 400 del servidor llega hablando de un porcentaje
      // que Laura nunca eligió.
      if (!esTipoDePago(f.paymentType)) {
        return `El acuerdo de ${nombre} está cargado por porcentaje, y en depilación el porcentaje daría $0: lo que se vende es el pack, no el servicio. Elegile monto fijo por sesión o por hora.`;
      }
      const monto = montoEnPesos(f.rate);
      if (!f.rate.trim() || !Number.isFinite(monto) || monto <= 0) {
        return `Falta indicar cuánto cobra ${nombre}: con la tarifa vacía o en cero, cada sesión se le paga $0.`;
      }
      // Sin equipo tildado la proveedora queda habilitada y cobrando, pero la
      // disponibilidad cruza los equipos del servicio con su certificación: la
      // intersección da vacío y no aparece ni un turno libre. Es el modo de
      // falla más confuso posible, porque todo parece cargado y el toast sale
      // verde. Mientras el GET de certificaciones está en vuelo no se valida:
      // ahí `tildadas()` devuelve [] porque todavía no sabe, no porque no haya.
      if (
        equipos.length > 0 &&
        !cargandoCertificaciones &&
        tildadas(f.serviceProviderId).length === 0
      ) {
        return `Falta tildar con qué equipo trabaja ${nombre}: sin certificación no hay disponibilidad, así que no va a aparecer con horarios y no se le puede agendar ni una sesión.`;
      }
    }
    return null;
  }

  async function guardar() {
    const motivo = primerError();
    setError(motivo);
    if (motivo) return;

    try {
      // El PUT de acuerdos manda SIEMPRE todas las filas: ese endpoint
      // reconcilia (cierra los viejos y crea los nuevos), no parchea.
      await guardarAcuerdos.mutateAsync({
        id: anchorServiceId,
        agreements: filas.map((f) => ({
          serviceProviderId: f.serviceProviderId,
          paymentType: f.paymentType,
          rate: montoEnPesos(f.rate),
        })),
      });

      // Y después, de a una, las máquinas que cambiaron en cada fila.
      //
      // Sólo los equipos de depilación. Una certificación es GLOBAL por
      // proveedora —`service_provider_machine` no tiene columna de servicio—,
      // así que esta pantalla toca de a un par y nunca uno que no esté
      // mostrando: si reconciliara el conjunto, le borraría a la proveedora
      // las máquinas que usa en criolipólisis o en HIFU.
      for (const f of filas) {
        const deseadas = maquinasEditadas[f.serviceProviderId];
        if (!deseadas) continue;
        const guardadas = (porProveedora[f.serviceProviderId] ?? [])
          .map((m) => m.machineId)
          .filter((id) => equiposIds.has(id));

        for (const machineId of deseadas) {
          if (!guardadas.includes(machineId)) {
            await habilitarMaquina.mutateAsync({
              providerId: f.serviceProviderId,
              machineId,
            });
          }
        }
        for (const machineId of guardadas) {
          if (!deseadas.includes(machineId)) {
            await deshabilitarMaquina.mutateAsync({
              providerId: f.serviceProviderId,
              machineId,
            });
          }
        }
      }

      setMaquinasEditadas({});
      setAvisoDeTurnos(null);
      toast.success("Listo, ya quedó guardado");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-3">
      {filas.length === 0 && (
        <div className="space-y-1 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p>Todavía no hay nadie habilitado para hacer depilación definitiva.</p>
          {sesionesEsperandoTurno > 0 && (
            <p>
              Hay {sesionesEsperandoTurno}{" "}
              {sesionesEsperandoTurno === 1
                ? "sesión comprada esperando turno"
                : "sesiones compradas esperando turno"}
              : hasta que alguien esté habilitada acá, no se pueden agendar.
            </p>
          )}
        </div>
      )}

        {sinEquipos && (
          <p
            id={MOTIVO_SIN_EQUIPOS_ID}
            className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"
          >
            Agregá primero un equipo de depilación acá arriba: sin equipo, habilitar a una
            proveedora no la hace aparecer con horarios.
          </p>
        )}

      {avisoDeTurnos && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          ⚠ {avisoDeTurnos}
        </p>
      )}

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

      <EditorDeAcuerdos
        filas={filas}
        onChange={alCambiarFilas}
        proveedoras={proveedoras.data ?? []}
        tiposDePago={TIPOS_DE_PAGO}
        etiquetaTipoDePago="Cómo cobra"
        etiquetaTarifa="Cuánto cobra ($)"
        deshabilitarAgregar={sinEquipos}
        motivoDeshabilitarAgregar={sinEquipos ? MOTIVO_SIN_EQUIPOS_ID : undefined}
        // `catalogo:view`/`edit` incluyen a `operator`, así que la recepcionista
        // llega a esta pestaña con dos clicks. Ve el dato —sólo lectura no es lo
        // mismo que invisible— pero sin esto podía cambiar tarifas y quitar
        // proveedoras durante un rato largo para descubrir después que no hay
        // botón de Guardar y que todo lo que tocó se tira.
        soloLectura={!puedeEditar}
        nota={NOTA_PORCENTAJE}
        pieDeFila={(fila) => {
          const traduccion = esTipoDePago(fila.paymentType)
            ? traduccionDeTarifa(fila.paymentType, montoEnPesos(fila.rate))
            : null;
          const porcentajeViejo = fila.paymentType !== "" && !esTipoDePago(fila.paymentType);
          return (
            <div className="space-y-1.5">
              {/* El aviso por fila que pedía el spec §5.2: sin esto la fila se
                  ve con "Cómo cobra" vacío y nada explica por qué. */}
              {porcentajeViejo && (
                <p className="rounded bg-amber-50 px-2 py-1 text-amber-900">
                  ⚠ Este acuerdo está cargado por porcentaje, que en depilación no se puede
                  usar. Elegile monto fijo por sesión o por hora antes de guardar.
                </p>
              )}
              {traduccion && <p>{traduccion}</p>}
              {fila.serviceProviderId && equipos.length > 0 && (
                <div>
                  <p className="font-medium">Equipos que sabe usar</p>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    {equipos.map((e) => (
                      <Checkbox
                        key={e.machineId}
                        label={e.machineName ?? "—"}
                        checked={tildadas(fila.serviceProviderId).includes(e.machineId)}
                        disabled={!puedeEditar || cargandoCertificaciones}
                        onChange={(v) => alternarMaquina(fila.serviceProviderId, e.machineId, v)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        }}
      />

      {!puedeEditar && (
        <p className="text-xs text-ink-soft">
          Esto es sólo lectura: las comisiones de depilación las edita quien administra el
          catálogo.
        </p>
      )}

      {puedeEditar && (
        <div className="flex items-center justify-end gap-3">
          {/* Nada de este bloque —ni quitar una proveedora, ni destildar un
              equipo— toca el servidor hasta acá. El bloque de equipos, con el
              mismo tacho, sí borra al instante. */}
          <p className="text-xs text-ink-soft">
            Las proveedoras, las tarifas y los tildes de equipos se guardan recién acá.
          </p>
          <button
            type="button"
            onClick={guardar}
            disabled={guardarAcuerdos.isPending}
            className="shrink-0 rounded-full bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
          >
            Guardar proveedoras y tarifas
          </button>
        </div>
      )}
    </div>
  );
}
