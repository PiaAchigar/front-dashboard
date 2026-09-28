import { useState } from "react";
import { useAuth } from "../../../auth/AuthContext";
import { can, type Role } from "../../../lib/permissions";
import { Field, TextInput } from "../../../components/form";
import { useToast } from "../../../components/ui/Toast";
import { useContextoDeArea } from "../contexto-de-area";
import type { DepilationConfig } from "../../../lib/depilation-pricing";
import {
  useCombosDepilacion,
  useDepilacionConfig,
  useGuardarConfig,
  type DepilacionConfigInput,
} from "../../../hooks/useDepilacion";
import type { ComboDepilacion } from "../../../lib/api-types";
import { parseEnteroPositivo, parsePorcentaje } from "../../../lib/depilation-form-validation";

/** Los tres campos que edita esta pantalla, como texto — mismo criterio que
 *  `Form` en PreciosPage.tsx: permite borrar el campo mientras se escribe, la
 *  validación real corre recién al guardar. */
type Form = {
  packSessions: string;
  packDiscountPercentage: string;
  packRoundingBase: string;
};

function configToForm(c: DepilationConfig): Form {
  return {
    packSessions: String(c.packSesiones),
    packDiscountPercentage: String(c.packDescuentoPct),
    packRoundingBase: String(c.packRedondeo),
  };
}

/** "" y cualquier cosa no numérica cuentan como 0 — igual que `toNumber` en
 *  PreciosPage.tsx. Sólo se usa para la columna en vivo de la lista de abajo
 *  mientras se edita; la validación que bloquea Guardar es otra, más abajo. */
function toNumber(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/** Los 22 campos de `DepilacionConfigInput` que esta pantalla NO edita, tal
 *  cual salen de la config ya guardada (`config`, la que devolvió el GET).
 *  Existe por lo mismo que el comentario de PreciosPage.tsx sobre los tres
 *  campos de pack: el PUT /config no hace merge parcial, manda la foto
 *  completa. Acá es al revés — 22 campos ajenos a esta pantalla en vez de 3 —
 *  pero el riesgo es el mismo: armar el PUT sólo con `packSessions` /
 *  `packDiscountPercentage` / `packRoundingBase` borraría en silencio el
 *  resto de la configuración de depilación (precios, escalones, minutos de
 *  turno). Espejo, en la dirección inversa (nested → flat), de
 *  `configInputToNested` en PreciosPage.tsx — pero sin parsear: estos 22
 *  valores ya viven validados en `config`, no hace falta volver a chequearlos. */
function configAFlatSalvoPack(
  c: DepilationConfig,
): Omit<DepilacionConfigInput, "packSessions" | "packDiscountPercentage" | "packRoundingBase"> {
  return {
    priceFemaleGrande: c.precioLista.mujer.grande,
    priceFemaleMediana: c.precioLista.mujer.mediana,
    priceFemaleChica: c.precioLista.mujer.chica,
    priceMaleGrande: c.precioLista.hombre.grande,
    priceMaleMediana: c.precioLista.hombre.mediana,
    priceMaleChica: c.precioLista.hombre.chica,
    pricingMinutesFemaleGrande: c.minutosPrecio.mujer.grande,
    pricingMinutesFemaleMediana: c.minutosPrecio.mujer.mediana,
    pricingMinutesFemaleChica: c.minutosPrecio.mujer.chica,
    pricingMinutesMaleGrande: c.minutosPrecio.hombre.grande,
    pricingMinutesMaleMediana: c.minutosPrecio.hombre.mediana,
    pricingMinutesMaleChica: c.minutosPrecio.hombre.chica,
    tier1RatePerMinute: c.tarifaEscalon1,
    tier2RatePerMinute: c.tarifaEscalon2,
    slotMinutesFemaleGrande: c.minutosTurno.mujer.grande,
    slotMinutesFemaleMediana: c.minutosTurno.mujer.mediana,
    slotMinutesFemaleChica: c.minutosTurno.mujer.chica,
    slotMinutesMaleGrande: c.minutosTurno.hombre.grande,
    slotMinutesMaleMediana: c.minutosTurno.hombre.mediana,
    slotMinutesMaleChica: c.minutosTurno.hombre.chica,
    slotRoundingStep: c.redondeoTurno,
    slotMinimumMinutes: c.turnoMinimo,
  };
}

export function PacksPage() {
  const { data, isLoading, error } = useDepilacionConfig();
  const combosQuery = useCombosDepilacion();
  const contextoDeArea = useContextoDeArea();

  return (
    <div
      className={`p-2 pl-4 sm:p-4 ${
        contextoDeArea ? "" : "modal-scroll h-full overflow-y-auto"
      }`}
    >
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {(error as Error).message}
        </p>
      )}
      {isLoading ? (
        <p className="text-sm text-ink-soft">Cargando…</p>
      ) : data ? (
        <PacksForm config={data} combos={combosQuery.data} combosCargando={combosQuery.isLoading} />
      ) : null}
    </div>
  );
}

function PacksForm({
  config,
  combos,
  combosCargando,
}: {
  config: DepilationConfig;
  combos: ComboDepilacion[] | undefined;
  combosCargando: boolean;
}) {
  const { role } = useAuth();
  const r = role as Role | null;
  const canManage = can(r, "catalogo", "manage");
  const toast = useToast();
  const guardarConfig = useGuardarConfig();

  const [form, setForm] = useState<Form>(() => configToForm(config));
  const [formError, setFormError] = useState<string | null>(null);

  function set<K extends keyof Form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setFormError(null);

    // Corta en el primer campo inválido, mismo criterio que `parseForm` en
    // PreciosPage.tsx — y son las MISMAS dos funciones (`parseEnteroPositivo`
    // / `parsePorcentaje`, importadas de `lib/depilation-form-validation`),
    // no una reescritura: dos validaciones del mismo campo en dos archivos
    // se desincronizan.
    const sesiones = parseEnteroPositivo(form.packSessions);
    if (sesiones === null) {
      setFormError("Las sesiones del pack tienen que ser un número entero mayor a cero.");
      return;
    }
    const descuento = parsePorcentaje(form.packDiscountPercentage);
    if (descuento === null) {
      setFormError("El descuento del pack tiene que ser un número entero entre 0 y 100.");
      return;
    }
    const redondeo = parseEnteroPositivo(form.packRoundingBase);
    if (redondeo === null) {
      setFormError("El redondeo del pack tiene que ser un número entero mayor a cero.");
      return;
    }

    try {
      // La config ENTERA, no sólo estos tres campos: ver el comentario de
      // `configAFlatSalvoPack` más arriba.
      await guardarConfig.mutateAsync({
        ...configAFlatSalvoPack(config),
        packSessions: sesiones,
        packDiscountPercentage: descuento,
        packRoundingBase: redondeo,
      });
      toast.success("Configuración guardada");
    } catch (e) {
      setFormError((e as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div>
          <h2 className="font-display text-lg text-ink">Pack de sesiones (por defecto)</h2>
          <p className="text-xs text-ink-soft">
            Los valores que usa cualquier combo que no tenga los suyos cargados aparte. Cada combo
            puede pisarlos desde la pestaña Combos.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Field label="Sesiones">
            <TextInput
              inputMode="numeric"
              disabled={!canManage}
              value={form.packSessions}
              onChange={(e) => set("packSessions", e.target.value)}
            />
          </Field>
          <Field label="Descuento (%)">
            <TextInput
              inputMode="numeric"
              disabled={!canManage}
              value={form.packDiscountPercentage}
              onChange={(e) => set("packDiscountPercentage", e.target.value)}
            />
          </Field>
          <Field label="Redondeo ($)">
            <TextInput
              inputMode="numeric"
              disabled={!canManage}
              value={form.packRoundingBase}
              onChange={(e) => set("packRoundingBase", e.target.value)}
            />
          </Field>
        </div>

        {formError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{formError}</p>
        )}

        {canManage && (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={guardarConfig.isPending}
              className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              {guardarConfig.isPending ? "Guardando…" : "Guardar"}
            </button>
          </div>
        )}
      </form>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-lg text-ink">Qué pack cobra cada combo</h2>
          {/* De sólo lectura a propósito: cada pack se edita en Combos, que es donde
              vive. Esta lista existe para responder la pregunta que Laura tiene al
              mirar los valores de arriba — "¿este pack cobra el descuento que yo
              creo?"— y que tres inputs sueltos no responden. */}
          <p className="text-xs text-ink-soft">
            Sesiones y descuento que se le cobran a cada combo hoy, según herede los valores de
            arriba o tenga los suyos cargados en la pestaña Combos (ver la marca en cada fila).
          </p>
        </div>

        {combosCargando ? (
          <p className="text-sm text-ink-soft">Cargando…</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-high text-left text-xs text-ink-soft">
                <th className="py-1.5 pr-2 font-medium">Combo</th>
                <th className="py-1.5 pr-2 font-medium">Sesiones</th>
                <th className="py-1.5 pr-2 font-medium">Descuento</th>
                <th className="py-1.5 font-medium">Origen</th>
              </tr>
            </thead>
            <tbody>
              {(combos ?? []).map((c) => {
                // El propio del combo gana; si no tiene, hereda el global —
                // y por eso, mientras hereda, muestra lo que HAY EN EL
                // FORMULARIO ahora mismo (aunque no esté guardado todavía),
                // no el último valor guardado: si mostrara el guardado,
                // esta fila mentiría apenas alguien tocara un input de arriba.
                const propio = c.pack.propio;
                const sesiones = propio ? c.pack.sesiones : toNumber(form.packSessions);
                const descuento = propio ? c.pack.descuentoPct : toNumber(form.packDiscountPercentage);
                return (
                  <tr key={c.id} className="border-b border-surface-high last:border-0">
                    <td className="py-1.5 pr-2 text-ink">{c.name}</td>
                    <td className="py-1.5 pr-2 tabular-nums text-ink">{sesiones}</td>
                    <td className="py-1.5 pr-2 tabular-nums text-ink">{descuento}%</td>
                    <td className="py-1.5 text-ink-soft">
                      {propio ? "← propios" : "(usa los de arriba)"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
