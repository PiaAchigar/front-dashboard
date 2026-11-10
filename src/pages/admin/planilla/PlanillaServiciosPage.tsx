import { useRef, useState, type DragEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { can, type Role } from "../../../lib/permissions";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { useToast } from "../../../components/ui/Toast";
import { ApiError } from "../../../lib/api-client";
import type { AreaDeCatalogo } from "../../../lib/admin-nav";
import { leerLibro } from "../../../lib/planilla-excel";
import type {
  EntradaPlanilla,
  ErrorDePlanilla,
  Previsualizacion,
} from "../../../lib/planilla-tipos";
import {
  useAplicarPlanilla,
  useDescargarPlanilla,
  usePrevisualizarPlanilla,
} from "../../../hooks/usePlanillaServicios";
import { AyudaPlanilla, BotonAyudaPlanilla } from "./AyudaPlanilla";
import { textoAviso } from "../precios/ActualizarPreciosPage";

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const vacio = (t: string | number | null) => (t === null || t === "" ? "(vacío)" : String(t));

function totalDeCambios(p: Previsualizacion): number {
  const r = p.resumen;
  return r.serviciosNuevos + r.serviciosModificados + r.acuerdos + r.insumos + r.categorias;
}

function textoResumen(p: Previsualizacion): string {
  const r = p.resumen;
  return [
    plural(r.serviciosNuevos, "servicio nuevo", "servicios nuevos"),
    plural(r.serviciosModificados, "servicio modificado", "servicios modificados"),
    plural(r.acuerdos, "acuerdo de proveedora", "acuerdos de proveedoras"),
    plural(r.insumos, "insumo", "insumos"),
    plural(r.categorias, "categoría", "categorías"),
  ].join(" · ");
}

export function PlanillaServiciosPage({ area }: { area: AreaDeCatalogo }) {
  const toast = useToast();
  const navigate = useNavigate();
  const { role } = useAuth();
  const r = role as Role | null;
  const permitido = can(r, "catalogo", "manage") && can(r, "proveedoras", "manage");

  const descargar = useDescargarPlanilla(area.categoria);
  const previsualizar = usePrevisualizarPlanilla();
  const aplicar = useAplicarPlanilla();

  const input = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  // Lo que se subió (viaja tal cual a Guardar) y su vista previa.
  const [entrada, setEntrada] = useState<EntradaPlanilla | null>(null);
  const [vista, setVista] = useState<Previsualizacion | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  // La ayuda ocupa el lugar de la pantalla; lo subido queda cargado detrás.
  const [ayuda, setAyuda] = useState(false);

  const volver = `/admin/${area.path}/servicios`;

  if (!permitido) {
    return (
      <div className="modal-scroll h-full overflow-y-auto">
        <div className="mx-auto max-w-4xl p-4">
          <h1 className="font-display text-2xl text-ink">Planilla de servicios</h1>
          <p className="mt-3 text-sm text-ink-soft">No tenés permiso para usar la planilla</p>
        </div>
      </div>
    );
  }

  const bajar = () => {
    setMensaje(null);
    descargar.mutate(undefined, {
      onSuccess: ({ blob, nombre }) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = nombre;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      },
      onError: (e) => toast.error(e.message),
    });
  };

  const recibir = async (f: File | undefined) => {
    setMensaje(null);
    setVista(null);
    setEntrada(null);
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".xlsx")) {
      setMensaje("Sólo se aceptan archivos .xlsx");
      return;
    }
    setLeyendo(true);
    try {
      const leido = await leerLibro(f);
      if ("error" in leido) {
        setMensaje(leido.error);
        return;
      }
      if (leido.area !== area.categoria) {
        setMensaje(`Esta planilla es de «${leido.area}», no de «${area.categoria}»`);
        return;
      }
      const nueva: EntradaPlanilla = { area: leido.area, original: leido.original, editada: leido.editada };
      const prev = await previsualizar.mutateAsync(nueva);
      setEntrada(nueva);
      setVista(prev);
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : "No pudimos leer el archivo");
    } finally {
      setLeyendo(false);
    }
  };

  const alSoltar = (e: DragEvent) => {
    e.preventDefault();
    setArrastrando(false);
    void recibir(e.dataTransfer?.files?.[0]);
  };

  const hayErrores = (vista?.errores.length ?? 0) > 0;
  const nCambios = vista ? totalDeCambios(vista) : 0;

  const guardar = () => {
    if (!entrada) return;
    aplicar.mutate(entrada, {
      onSuccess: ({ resumen }) => {
        setConfirmando(false);
        toast.success(`Planilla guardada: ${textoResumen({ ...vacia(), resumen })}`);
        navigate(volver);
      },
      onError: (e) => {
        setConfirmando(false);
        const errores = e instanceof ApiError ? (e.body as { errores?: ErrorDePlanilla[] } | undefined)?.errores : undefined;
        if (errores && vista) setVista({ ...vista, errores });
        else toast.error(e.message);
      },
    });
  };

  return (
    <div className="modal-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-6 p-4">
        <Link to={volver} className="text-sm font-medium text-primary-dark underline">
          ← Volver a Servicios
        </Link>
        <div className="flex items-center gap-2">
          <h1 className="font-display text-2xl text-ink">Planilla de servicios · {area.categoria}</h1>
          <BotonAyudaPlanilla abierta={ayuda} onClick={() => setAyuda((a) => !a)} />
        </div>

        {ayuda && <AyudaPlanilla onVolver={() => setAyuda(false)} />}

        <div className={ayuda ? "hidden" : "space-y-6"}>

        <section className="space-y-2">
          <h2 className="text-sm font-medium text-ink">1. Descargar la planilla</h2>
          <button
            type="button"
            onClick={bajar}
            disabled={descargar.isPending}
            className="rounded-full border border-surface-highest bg-white px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-high disabled:opacity-50"
          >
            {descargar.isPending ? "Armando la planilla…" : "Descargar planilla"}
          </button>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-medium text-ink">2. Subir la planilla completada</h2>
          <div
            data-testid="zona-planilla"
            onDragOver={(e) => {
              e.preventDefault();
              setArrastrando(true);
            }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={alSoltar}
            onClick={() => input.current?.click()}
            className={[
              "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center text-sm",
              arrastrando ? "border-primary bg-primary/5" : "border-surface-highest bg-surface-low",
            ].join(" ")}
          >
            <p className="text-ink">Arrastrá acá el archivo .xlsx, o tocá para elegirlo</p>
            <input
              ref={input}
              type="file"
              accept=".xlsx"
              hidden
              aria-label="Elegir archivo de planilla"
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                void recibir(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
          {leyendo && <p className="text-sm text-ink-soft">Leyendo la planilla…</p>}
          {mensaje && (
            <p role="alert" className="text-sm text-red-700">
              {mensaje}
            </p>
          )}
        </section>

        {vista && (
          <section className="space-y-4">
            <h2 className="text-sm font-medium text-ink">3. Vista previa</h2>

            {hayErrores && (
              <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
                <p className="font-medium">
                  {plural(vista.errores.length, "error", "errores")}: corregí la planilla y volvé a subirla. No se guardó nada.
                </p>
                <ul className="mt-1 list-disc pl-5">
                  {vista.errores.map((er, i) => (
                    <li key={i}>
                      {er.pestana}
                      {er.fila !== null ? ` · fila ${er.fila}` : ""} · {er.mensaje}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {nCambios === 0 && !hayErrores ? (
              <p className="text-sm text-ink">La planilla no tiene cambios</p>
            ) : (
              <p className="text-sm text-ink">{textoResumen(vista)}</p>
            )}

            {vista.servicios.map((s) => (
              <div key={`${s.fila}-${s.nombre}`} className="overflow-x-auto rounded-xl bg-surface-low p-3 text-sm">
                <p className="font-medium text-ink">
                  {s.nombre}{" "}
                  <span className="font-normal text-ink-soft">
                    ({s.tipo === "nuevo" ? "servicio nuevo" : "modificado"} · fila {s.fila})
                  </span>
                </p>
                {s.cambios.length > 0 && (
                  <table className="mt-2 w-full text-left">
                    <thead className="text-xs text-ink-soft">
                      <tr>
                        <th className="p-1">Campo</th>
                        <th className="p-1">Antes</th>
                        <th className="p-1">Después</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.cambios.map((c) => (
                        <tr key={c.campo} className="text-ink">
                          <td className="p-1">{c.campo}</td>
                          <td className="p-1">{vacio(c.antes)}</td>
                          <td className="p-1">{vacio(c.despues)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}

            {vista.acuerdos.length > 0 && (
              <Bloque titulo="Proveedoras">
                {vista.acuerdos.map((a) => (
                  <li key={a.fila}>
                    {a.servicio} · {a.proveedora}:{" "}
                    {a.tipo === "nuevo" ? `nuevo, ${a.despues}` : `${vacio(a.antes)} → ${a.despues}`}
                  </li>
                ))}
              </Bloque>
            )}
            {vista.insumos.length > 0 && (
              <Bloque titulo="Insumos">
                {vista.insumos.map((i) => (
                  <li key={i.fila}>
                    {i.servicio} · {i.insumo}:{" "}
                    {i.tipo === "nuevo" ? `nuevo, ${i.despues}` : `${vacio(i.antes)} → ${i.despues}`}
                  </li>
                ))}
              </Bloque>
            )}
            {vista.categorias.length > 0 && (
              <Bloque titulo="Categorías web">
                {vista.categorias.map((c) => (
                  <li key={c.fila}>
                    {c.servicio} · {c.categoria}
                  </li>
                ))}
              </Bloque>
            )}

            {vista.combosAfectados.length > 0 && (
              <div className="rounded-xl bg-amber-50 p-3 text-sm text-ink">
                <p>{textoAviso(vista.combosAfectados)} servicios que cambian de precio y no se actualizan solos:</p>
                <ul className="mt-1 list-disc pl-5">
                  {vista.combosAfectados.map((c) => (
                    <li key={c.id}>{c.nombre}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        <div className="sticky bottom-0 flex justify-end bg-surface py-3">
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            disabled={!vista || hayErrores || nCambios === 0 || aplicar.isPending}
            className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
          >
            Guardar
          </button>
        </div>
        </div>

        <ConfirmDialog
          open={confirmando}
          title="Guardar la planilla"
          message={`Se van a guardar ${nCambios} ${nCambios === 1 ? "cambio" : "cambios"}. Lo que borraste de la planilla no se borra del sistema.`}
          confirmLabel="Guardar cambios"
          busy={aplicar.isPending}
          onConfirm={guardar}
          onCancel={() => setConfirmando(false)}
        />
      </div>
    </div>
  );
}

function vacia(): Previsualizacion {
  return {
    errores: [], servicios: [], acuerdos: [], insumos: [], categorias: [], combosAfectados: [],
    resumen: { serviciosNuevos: 0, serviciosModificados: 0, acuerdos: 0, insumos: 0, categorias: 0 },
  };
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-low p-3 text-sm text-ink">
      <p className="font-medium">{titulo}</p>
      <ul className="mt-1 list-disc pl-5">{children}</ul>
    </div>
  );
}
