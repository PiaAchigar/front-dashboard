import { useMemo, useState } from "react";
import { EntityDrawer } from "../../components/EntityDrawer";
import { Checkbox, Field, TextInput } from "../../components/form";
import { useToast } from "../../components/ui/Toast";
import { useServicesAdmin } from "../../hooks/useServicesAdmin";
import { useAssignInsumoToServices, useInsumoServices } from "../../hooks/useRecetas";
import type { Insumo } from "../../hooks/useInsumos";

/**
 * Carga masiva: este insumo, esta cantidad, a todos los servicios que se
 * marquen.
 *
 * Existe porque cargar las recetas desde cada servicio son 120 modales. Si
 * "guantes" lo usan 90 servicios, esto lo resuelve en una pantalla.
 *
 * ⚠️ Una sola cantidad para todos los marcados. Si un servicio usa una cantidad
 * distinta, se ajusta después desde su propio modal — mezclar cantidades
 * distintas acá volvería la pantalla tan lenta de completar como los 120
 * modales que viene a evitar.
 */
export function AsignarInsumoDrawer({
  insumo,
  onClose,
}: {
  insumo: Insumo | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const { data: servicios = [], isLoading } = useServicesAdmin(false);
  const { data: yaUsan = [], isLoading: cargandoUso } = useInsumoServices(insumo?.id ?? null);
  const asignar = useAssignInsumoToServices();

  const [busqueda, setBusqueda] = useState("");
  const [marcados, setMarcados] = useState<Set<string> | null>(null);
  const [cantidad, setCantidad] = useState("1");
  const [error, setError] = useState<string | null>(null);

  // `null` = todavía no se tocó nada, así que vale lo que ya está guardado.
  // Sembrar el estado directo dependería de CUÁNDO llega la consulta.
  const seleccion = useMemo(
    () => marcados ?? new Set(yaUsan.map((s) => s.serviceId)),
    [marcados, yaUsan],
  );

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return servicios;
    return servicios.filter((s) => (s.name ?? "").toLowerCase().includes(q));
  }, [servicios, busqueda]);

  function alternar(id: string) {
    const siguiente = new Set(seleccion);
    if (siguiente.has(id)) siguiente.delete(id);
    else siguiente.add(id);
    setMarcados(siguiente);
  }

  function marcarVisibles(v: boolean) {
    const siguiente = new Set(seleccion);
    for (const s of visibles) {
      if (v) siguiente.add(s.id);
      else siguiente.delete(s.id);
    }
    setMarcados(siguiente);
  }

  function guardar() {
    if (!insumo) return;
    const n = Number(cantidad);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Poné una cantidad mayor a 0.");
      return;
    }
    setError(null);
    asignar.mutate(
      { id: insumo.id, serviceIds: [...seleccion], quantity: n },
      {
        onSuccess: (r) => {
          toast.success(
            `${r.agregados} servicio(s) nuevos, ${r.actualizados} actualizados, ${r.quitados} quitados`,
          );
          onClose();
        },
        onError: (e: Error) => setError(e.message),
      },
    );
  }

  const cargando = isLoading || cargandoUso;

  return (
    <EntityDrawer
      open={!!insumo}
      title={`Asignar ${insumo?.name ?? "insumo"} a servicios`}
      error={error}
      busy={asignar.isPending}
      canSubmit={!cargando}
      onSubmit={guardar}
      onClose={onClose}
    >
      <Field label="Cantidad que consume cada servicio *">
        <TextInput
          type="number"
          min={0}
          step="0.001"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
        />
      </Field>
      <p className="-mt-1 text-xs text-ink-soft">
        Se aplica la misma cantidad a todos los marcados
        {insumo?.unitType ? ` (${insumo.unitType})` : ""}. Si alguno usa otra, se ajusta después
        desde ese servicio.
      </p>

      <Field label="Servicios">
        <TextInput
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar servicio…"
        />
      </Field>

      <div className="flex items-center gap-3 text-xs">
        <span className="text-ink-soft">{seleccion.size} marcados</span>
        <button
          type="button"
          onClick={() => marcarVisibles(true)}
          className="font-medium text-primary hover:underline"
        >
          Marcar los {visibles.length} de la lista
        </button>
        <button
          type="button"
          onClick={() => marcarVisibles(false)}
          className="font-medium text-primary hover:underline"
        >
          Desmarcarlos
        </button>
      </div>

      {cargando ? (
        <p className="text-sm text-ink-soft">Cargando servicios…</p>
      ) : (
        <ul className="max-h-80 overflow-y-auto rounded-lg border border-surface-high bg-white px-2.5 py-1">
          {visibles.length === 0 ? (
            <li className="py-1 text-sm text-ink-soft">Ningún servicio coincide.</li>
          ) : (
            visibles.map((s) => (
              <li key={s.id} className="py-1">
                <Checkbox
                  label={s.name ?? "—"}
                  checked={seleccion.has(s.id)}
                  onChange={() => alternar(s.id)}
                />
              </li>
            ))
          )}
        </ul>
      )}

      <p className="text-xs text-ink-soft">
        Desmarcar un servicio le saca <strong>este</strong> insumo. El resto de su receta queda
        como está.
      </p>
    </EntityDrawer>
  );
}
