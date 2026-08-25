import { useEffect, useMemo, useState } from "react";
import { Checkbox } from "../form";
import { money } from "../../lib/format";
import {
  buscarPackFijo,
  calcularDuracionTurno,
  calcularPrecioCombo,
  calcularPrecioPack,
  zonasBloqueadas,
  type Categoria,
  type Cotizacion,
  type DepilationConfig,
  type Exclusion,
  type LineaCotizacion,
  type PackFijo,
  type Sexo,
  type ZonaParaCotizar,
} from "../../lib/depilation-pricing";

const CATEGORIAS: { key: Categoria; label: string }[] = [
  { key: "grande", label: "Grande" },
  { key: "mediana", label: "Mediana" },
  { key: "chica", label: "Chica" },
];

/** `lista` → "precio de lista"; el resto usa la posición real de la línea, no
 *  el motivo a secas: `escalon_2` cubre la 3ª zona en adelante, y "3ª zona"
 *  fijo para una línea que en realidad es la 5ª sería un motivo mentiroso. */
function motivoTexto(linea: LineaCotizacion): string {
  return linea.motivo === "lista" ? "precio de lista" : `${linea.posicion}ª zona`;
}

export type ArmadorComboState = {
  zonaIds: string[];
  sexo: Sexo;
  cotizacion: Cotizacion;
  duracionMinutos: number;
  packFijo: PackFijo | null;
};

export type ArmadorComboProps = {
  /** Zonas seleccionables (ya filtradas a activas por quien monta el componente). */
  zonas: ZonaParaCotizar[];
  exclusiones: Exclusion[];
  config: DepilationConfig;
  packs: PackFijo[];
  onCambio?: (state: ArmadorComboState) => void;
  /** Zonas ya tildadas al montar — para editar un combo guardado existente. */
  zonaIdsIniciales?: string[];
};

/**
 * El armador de combos: tilda zonas, cotiza en cada clic con el motor local
 * (`depilation-pricing.ts`), nunca pide precio al servidor. Es un componente,
 * no una página — quien lo monta decide qué hacer con `onCambio`.
 */
export function ArmadorCombo({
  zonas,
  exclusiones,
  config,
  packs,
  onCambio,
  zonaIdsIniciales,
}: ArmadorComboProps) {
  const [zonaIds, setZonaIds] = useState<string[]>(zonaIdsIniciales ?? []);
  const [sexo, setSexo] = useState<Sexo>("mujer");

  const nombrePorId = useMemo(() => {
    const m = new Map<string, string>();
    for (const z of zonas) m.set(z.id, z.nombre);
    return m;
  }, [zonas]);

  const seleccionadas = useMemo(
    () => zonas.filter((z) => zonaIds.includes(z.id)),
    [zonas, zonaIds],
  );

  const cotizacion = useMemo(
    () => calcularPrecioCombo(seleccionadas, config),
    [seleccionadas, config],
  );

  const packFijo = useMemo(() => buscarPackFijo(zonaIds, packs), [zonaIds, packs]);

  // Mismo criterio que el backend (`POST /cotizar`): la duración fija del
  // pack, si tiene una cargada, gana sobre la calculada.
  const duracionMinutos = useMemo(
    () => packFijo?.duracionFija ?? calcularDuracionTurno(seleccionadas, sexo, config),
    [packFijo, seleccionadas, sexo, config],
  );

  const bloqueadas = useMemo(
    () => zonasBloqueadas(zonaIds, exclusiones),
    [zonaIds, exclusiones],
  );

  // El total que se muestra y del que sale el pack de 3: el fijo del pack si
  // hay uno, si no la fórmula. Nunca al revés.
  const totalMostrado = packFijo ? packFijo.precioFijo : cotizacion.total;
  const packTotal = useMemo(
    () => calcularPrecioPack(totalMostrado, config),
    [totalMostrado, config],
  );
  const packAhorro = totalMostrado * config.packSesiones - packTotal;

  useEffect(() => {
    onCambio?.({ zonaIds, sexo, cotizacion, duracionMinutos, packFijo });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onCambio no es estable entre renders del padre
  }, [zonaIds, sexo, cotizacion, duracionMinutos, packFijo]);

  function toggleZona(id: string) {
    if (bloqueadas.has(id)) return;
    setZonaIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <fieldset className="flex items-center gap-4">
          <legend className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-soft">
            Sexo
          </legend>
          {(["mujer", "hombre"] as const).map((s) => (
            <label key={s} className="flex items-center gap-1.5 text-sm text-ink">
              <input
                type="radio"
                name="armador-sexo"
                value={s}
                checked={sexo === s}
                onChange={() => setSexo(s)}
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
              {s === "mujer" ? "Mujer" : "Hombre"}
            </label>
          ))}
        </fieldset>

        {CATEGORIAS.map((cat) => {
          const zonasCat = zonas.filter((z) => z.categoria === cat.key);
          if (zonasCat.length === 0) return null;
          return (
            <div key={cat.key}>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-soft">
                {cat.label}
              </p>
              <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
                {zonasCat.map((z) => {
                  const bloqueadaPor = bloqueadas.get(z.id);
                  return (
                    <div key={z.id}>
                      <Checkbox
                        label={z.nombre}
                        checked={zonaIds.includes(z.id)}
                        disabled={Boolean(bloqueadaPor)}
                        onChange={() => toggleZona(z.id)}
                      />
                      {bloqueadaPor && (
                        <p className="pl-6 text-xs text-ink-soft">
                          Ya incluida en {nombrePorId.get(bloqueadaPor) ?? bloqueadaPor}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <aside className="h-fit space-y-3 rounded-xl border border-surface-high bg-white p-4 lg:sticky lg:top-4">
        <h3 className="font-display text-base text-ink">Presupuesto</h3>

        {cotizacion.lineas.length === 0 ? (
          <p className="text-sm text-ink-soft">Elegí al menos una zona.</p>
        ) : (
          <ul className="space-y-2">
            {cotizacion.lineas.map((l) => (
              <li key={l.zonaId} className="flex items-baseline justify-between gap-2 text-sm">
                <div>
                  <p className="text-ink">{l.nombre}</p>
                  <p className="text-xs text-ink-soft">{motivoTexto(l)}</p>
                </div>
                <p className="shrink-0 font-medium text-ink">{money(l.importe)}</p>
              </li>
            ))}
          </ul>
        )}

        {packFijo && (
          <p className="rounded-lg bg-primary/10 px-3 py-2 text-xs text-ink">
            Esta combinación es el pack <strong>{packFijo.nombre}</strong>:{" "}
            {money(packFijo.precioFijo)} en vez de {money(cotizacion.total)}.
          </p>
        )}

        <div className="border-t border-surface-high pt-2">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-medium text-ink">Total</p>
            <p className="font-display text-lg text-ink" data-testid="total">
              {money(totalMostrado)}
            </p>
          </div>
          <div className="flex items-baseline justify-between">
            <p className="text-xs text-ink-soft">Turno</p>
            <p className="text-xs text-ink-soft" data-testid="duracion">
              {duracionMinutos} min
            </p>
          </div>
        </div>

        {cotizacion.lineas.length > 0 && (
          <button
            type="button"
            className="w-full space-y-0.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-left transition-colors hover:bg-primary/10"
          >
            <p className="text-xs font-medium text-ink-soft">
              Pack de {config.packSesiones} sesiones
            </p>
            <p className="font-display text-base text-ink">{money(packTotal)}</p>
            <p className="text-xs text-ink-soft">Ahorrás {money(packAhorro)}</p>
          </button>
        )}
      </aside>
    </div>
  );
}
