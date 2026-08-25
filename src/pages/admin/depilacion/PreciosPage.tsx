import { useMemo, useState } from "react";
import { useAuth } from "../../../auth/AuthContext";
import { can, type Role } from "../../../lib/permissions";
import { Field, TextInput } from "../../../components/form";
import { useToast } from "../../../components/ui/Toast";
import { money } from "../../../lib/format";
import {
  calcularPrecioCombo,
  calcularPrecioPack,
  type Categoria,
  type DepilationConfig,
  type ZonaParaCotizar,
} from "../../../lib/depilation-pricing";
import {
  useDepilacionConfig,
  useGuardarConfig,
  type DepilacionConfigInput,
} from "../../../hooks/useDepilacion";

/** Los 19 campos del formulario, todos como texto para permitir borrar el
 *  campo mientras se escribe. La validación al guardar (más abajo, `parseForm`)
 *  sí sigue el criterio de `parseDisplayOrder` en ZonasPage: bloquea y muestra
 *  un mensaje propio en vez de mandarle basura al backend. */
type Form = {
  priceGrande: string;
  priceMediana: string;
  priceChica: string;
  pricingMinutesGrande: string;
  pricingMinutesMediana: string;
  pricingMinutesChica: string;
  tier1RatePerMinute: string;
  tier2RatePerMinute: string;
  slotMinutesFemaleGrande: string;
  slotMinutesFemaleMediana: string;
  slotMinutesFemaleChica: string;
  slotMinutesMaleGrande: string;
  slotMinutesMaleMediana: string;
  slotMinutesMaleChica: string;
  slotRoundingStep: string;
  slotMinimumMinutes: string;
  packSessions: string;
  packDiscountPercentage: string;
  packRoundingBase: string;
};

function configToForm(c: DepilationConfig): Form {
  return {
    priceGrande: String(c.precioLista.grande),
    priceMediana: String(c.precioLista.mediana),
    priceChica: String(c.precioLista.chica),
    pricingMinutesGrande: String(c.minutosPrecio.grande),
    pricingMinutesMediana: String(c.minutosPrecio.mediana),
    pricingMinutesChica: String(c.minutosPrecio.chica),
    tier1RatePerMinute: String(c.tarifaEscalon1),
    tier2RatePerMinute: String(c.tarifaEscalon2),
    slotMinutesFemaleGrande: String(c.minutosTurno.mujer.grande),
    slotMinutesFemaleMediana: String(c.minutosTurno.mujer.mediana),
    slotMinutesFemaleChica: String(c.minutosTurno.mujer.chica),
    slotMinutesMaleGrande: String(c.minutosTurno.hombre.grande),
    slotMinutesMaleMediana: String(c.minutosTurno.hombre.mediana),
    slotMinutesMaleChica: String(c.minutosTurno.hombre.chica),
    slotRoundingStep: String(c.redondeoTurno),
    slotMinimumMinutes: String(c.turnoMinimo),
    packSessions: String(c.packSesiones),
    packDiscountPercentage: String(c.packDescuentoPct),
    packRoundingBase: String(c.packRedondeo),
  };
}

/** "" y cualquier cosa no numérica cuentan como 0: la vista previa tiene que
 *  poder recalcular mientras el campo está siendo editado (vacío a mitad de
 *  borrado, por ejemplo), no solo cuando el valor final es válido. */
function toNumber(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/** Arma el `DepilationConfig` anidado que pide `calcularPrecioCombo` a partir
 *  del formulario en su estado ACTUAL — es la clave de la vista previa en
 *  vivo: nunca lee de los datos guardados. */
function formToPreviewConfig(f: Form): DepilationConfig {
  return {
    precioLista: {
      grande: toNumber(f.priceGrande),
      mediana: toNumber(f.priceMediana),
      chica: toNumber(f.priceChica),
    },
    minutosPrecio: {
      grande: toNumber(f.pricingMinutesGrande),
      mediana: toNumber(f.pricingMinutesMediana),
      chica: toNumber(f.pricingMinutesChica),
    },
    tarifaEscalon1: toNumber(f.tier1RatePerMinute),
    tarifaEscalon2: toNumber(f.tier2RatePerMinute),
    minutosTurno: {
      mujer: {
        grande: toNumber(f.slotMinutesFemaleGrande),
        mediana: toNumber(f.slotMinutesFemaleMediana),
        chica: toNumber(f.slotMinutesFemaleChica),
      },
      hombre: {
        grande: toNumber(f.slotMinutesMaleGrande),
        mediana: toNumber(f.slotMinutesMaleMediana),
        chica: toNumber(f.slotMinutesMaleChica),
      },
    },
    redondeoTurno: toNumber(f.slotRoundingStep),
    turnoMinimo: toNumber(f.slotMinimumMinutes),
    packSesiones: toNumber(f.packSessions),
    packDescuentoPct: toNumber(f.packDiscountPercentage),
    packRedondeo: toNumber(f.packRoundingBase),
  };
}

/** Entero positivo estricto: "" o cualquier cosa no numérica (incluye
 *  negativos y decimales) invalida. Mismo criterio que el `enteroPositivo`
 *  del Zod del backend, pero bloqueando ACÁ para no ida-y-vuelta con el
 *  servidor por un typo. */
function parseEnteroPositivo(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return n > 0 ? n : null;
}

/** Igual que arriba pero para `packDiscountPercentage`: ahí el 0 SÍ es un
 *  valor legítimo (combo(s) sin descuento por pack), así que no puede usar
 *  `parseEnteroPositivo` — si lo hiciera, un campo vacío y un 0% tecleado a
 *  propósito serían indistinguibles y los dos rebotarían igual. */
function parsePorcentaje(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return n >= 0 && n <= 100 ? n : null;
}

/** Un campo por cada uno de los 19 de `Form` (mismos nombres que
 *  `DepilacionConfigInput`, así el resultado de validar ya tiene la forma que
 *  pide el PUT). El mensaje es el que ve la clienta si el campo no pasa. */
const CAMPOS: { key: keyof Form; validar: (raw: string) => number | null; mensaje: string }[] = [
  { key: "priceGrande", validar: parseEnteroPositivo, mensaje: "El precio de zona grande tiene que ser un número entero mayor a cero." },
  { key: "priceMediana", validar: parseEnteroPositivo, mensaje: "El precio de zona mediana tiene que ser un número entero mayor a cero." },
  { key: "priceChica", validar: parseEnteroPositivo, mensaje: "El precio de zona chica tiene que ser un número entero mayor a cero." },
  { key: "pricingMinutesGrande", validar: parseEnteroPositivo, mensaje: "Los minutos de precio de zona grande tienen que ser un número entero mayor a cero." },
  { key: "pricingMinutesMediana", validar: parseEnteroPositivo, mensaje: "Los minutos de precio de zona mediana tienen que ser un número entero mayor a cero." },
  { key: "pricingMinutesChica", validar: parseEnteroPositivo, mensaje: "Los minutos de precio de zona chica tienen que ser un número entero mayor a cero." },
  { key: "tier1RatePerMinute", validar: parseEnteroPositivo, mensaje: "La tarifa del primer escalón tiene que ser un número entero mayor a cero." },
  { key: "tier2RatePerMinute", validar: parseEnteroPositivo, mensaje: "La tarifa del segundo escalón tiene que ser un número entero mayor a cero." },
  { key: "slotMinutesFemaleGrande", validar: parseEnteroPositivo, mensaje: "Los minutos de turno (mujer, grande) tienen que ser un número entero mayor a cero." },
  { key: "slotMinutesFemaleMediana", validar: parseEnteroPositivo, mensaje: "Los minutos de turno (mujer, mediana) tienen que ser un número entero mayor a cero." },
  { key: "slotMinutesFemaleChica", validar: parseEnteroPositivo, mensaje: "Los minutos de turno (mujer, chica) tienen que ser un número entero mayor a cero." },
  { key: "slotMinutesMaleGrande", validar: parseEnteroPositivo, mensaje: "Los minutos de turno (hombre, grande) tienen que ser un número entero mayor a cero." },
  { key: "slotMinutesMaleMediana", validar: parseEnteroPositivo, mensaje: "Los minutos de turno (hombre, mediana) tienen que ser un número entero mayor a cero." },
  { key: "slotMinutesMaleChica", validar: parseEnteroPositivo, mensaje: "Los minutos de turno (hombre, chica) tienen que ser un número entero mayor a cero." },
  { key: "slotRoundingStep", validar: parseEnteroPositivo, mensaje: "El redondeo del turno tiene que ser un número entero mayor a cero." },
  { key: "slotMinimumMinutes", validar: parseEnteroPositivo, mensaje: "El turno mínimo tiene que ser un número entero mayor a cero." },
  { key: "packSessions", validar: parseEnteroPositivo, mensaje: "Las sesiones del pack tienen que ser un número entero mayor a cero." },
  { key: "packDiscountPercentage", validar: parsePorcentaje, mensaje: "El descuento del pack tiene que ser un número entero entre 0 y 100." },
  { key: "packRoundingBase", validar: parseEnteroPositivo, mensaje: "El redondeo del pack tiene que ser un número entero mayor a cero." },
];

/** Valida el formulario entero antes de guardar. Corta en el primer campo
 *  inválido — mismo criterio que `parseDisplayOrder` en ZonasPage: bloquea el
 *  guardado y devuelve un mensaje propio en vez de mandar la solicitud y
 *  esperar que el backend la rechace. Crítico para `packDiscountPercentage`:
 *  como el 0 es un valor válido ahí, sin este bloqueo un campo vacío o con
 *  basura se colaba como `0` y borraba el descuento del pack en silencio. */
function parseForm(f: Form): { ok: true; values: DepilacionConfigInput } | { ok: false; error: string } {
  const values = {} as DepilacionConfigInput;
  for (const campo of CAMPOS) {
    const parsed = campo.validar(f[campo.key]);
    if (parsed === null) return { ok: false, error: campo.mensaje };
    (values as Record<string, number>)[campo.key] = parsed;
  }
  return { ok: true, values };
}

/** Los cuatro combos de ejemplo del spec §6.2, elegidos por cobertura de
 *  categorías y de escalones (lista / 1er escalón / 2do escalón). */
const zona = (categoria: Categoria, nombre: string): ZonaParaCotizar => ({
  id: nombre,
  nombre,
  categoria,
});

const EJEMPLOS: { testId: string; nombre: string; zonas: ZonaParaCotizar[] }[] = [
  {
    testId: "preview-cavado-axila",
    nombre: "Cavado + Axila",
    zonas: [zona("chica", "Cavado"), zona("chica", "Axila")],
  },
  {
    testId: "preview-pierna-cavado-rostro",
    nombre: "Pierna + Cavado + Rostro",
    zonas: [zona("grande", "Pierna"), zona("grande", "Rostro"), zona("chica", "Cavado")],
  },
  {
    testId: "preview-pierna-axila-cavado-tira-bozo",
    nombre: "Pierna + Axila + Cavado + Tira + Bozo",
    zonas: [
      zona("grande", "Pierna"),
      zona("chica", "Axila"),
      zona("chica", "Cavado"),
      zona("chica", "Tira"),
      zona("chica", "Bozo"),
    ],
  },
];

/** "Cuerpo Full" es un pack fijo (PDF §6, seed en task-1): 5 zonas grandes +
 *  5 chicas (Pierna entera, Rostro completo, Espalda, Brazos, Glúteos · Axila,
 *  Cavado, Tira de cola, Línea alba, Empeine y dedos de los pies), precio
 *  propio de catálogo $65.000 — ese número NUNCA sale de la fórmula, así que
 *  no se recalcula con el formulario. Lo que SÍ se recalcula es lo que la
 *  fórmula daría para esas mismas 10 zonas ($86.000 con los valores base):
 *  es el dato que importa, porque si las tarifas suben ese equivalente baja
 *  la diferencia con el precio fijo y el pack puede dejar de convenir.
 */
const CUERPO_FULL_PRECIO = 65000;
const CUERPO_FULL_ZONAS: ZonaParaCotizar[] = [
  zona("grande", "Pierna entera"),
  zona("grande", "Rostro completo"),
  zona("grande", "Espalda"),
  zona("grande", "Brazos"),
  zona("grande", "Glúteos"),
  zona("chica", "Axila"),
  zona("chica", "Cavado"),
  zona("chica", "Tira de cola"),
  zona("chica", "Línea alba"),
  zona("chica", "Empeine y dedos de los pies"),
];

export function PreciosPage() {
  const { data, isLoading, error } = useDepilacionConfig();

  return (
    <div className="modal-scroll h-full overflow-y-auto p-2 pl-4 sm:p-4">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {(error as Error).message}
        </p>
      )}
      {isLoading ? (
        <p className="text-sm text-ink-soft">Cargando…</p>
      ) : data ? (
        <PreciosForm config={data} />
      ) : null}
    </div>
  );
}

function PreciosForm({ config }: { config: DepilationConfig }) {
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

  // Se recalcula en cada render con los valores QUE ESTÁN EN EL FORMULARIO,
  // no con `config` (los guardados): es toda la razón de ser de esta pantalla.
  const previewConfig = useMemo(() => formToPreviewConfig(form), [form]);
  const ejemplos = useMemo(
    () =>
      EJEMPLOS.map((e) => ({
        ...e,
        total: calcularPrecioCombo(e.zonas, previewConfig).total,
      })),
    [previewConfig],
  );
  // Pack de 3 sesiones del primer ejemplo (Cavado + Axila): es el único
  // reflejo en vivo de `packSessions`/`packDescuentoPct`/`packRedondeo` — sin
  // esto esas tres perillas se editan a ciegas, igual que pasaba con las
  // otras 16 antes de tener los cuatro ejemplos de fórmula.
  const packEjemplo = useMemo(
    () => calcularPrecioPack(ejemplos[0].total, previewConfig),
    [ejemplos, previewConfig],
  );
  // Lo que darían las 10 zonas de Cuerpo Full si se cotizaran por fórmula en
  // vez de por el precio fijo del pack — este número SÍ se mueve con el
  // formulario, a diferencia de `CUERPO_FULL_PRECIO`.
  const cuerpoFullFormula = useMemo(
    () => calcularPrecioCombo(CUERPO_FULL_ZONAS, previewConfig).total,
    [previewConfig],
  );
  const cuerpoFullDescuentoPct =
    cuerpoFullFormula > 0 ? Math.round((1 - CUERPO_FULL_PRECIO / cuerpoFullFormula) * 100) : 0;
  const cuerpoFullConviene = CUERPO_FULL_PRECIO < cuerpoFullFormula;

  async function save() {
    setFormError(null);
    const parsed = parseForm(form);
    if (!parsed.ok) {
      setFormError(parsed.error);
      return;
    }
    try {
      await guardarConfig.mutateAsync(parsed.values);
      toast.success("Configuración guardada");
    } catch (e) {
      setFormError((e as Error).message);
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 lg:flex-row lg:items-start">
      <form
        className="flex-1 space-y-8"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>⚠ Ojo:</strong> estos valores afectan a todos los combos del negocio —
          cambiar cualquiera de estos números mueve el precio de cada combo que se cotiza con
          la fórmula.
        </p>

        <section className="space-y-4">
          <h2 className="font-display text-lg text-ink">Precios de lista</h2>
          <p className="text-xs text-ink-soft">
            Precio de la primera zona del combo (la más cara), según su categoría.
          </p>
          <div className="flex flex-wrap gap-3">
            <Field label="Grande">
              <TextInput
                inputMode="numeric"
                disabled={!canManage}
                value={form.priceGrande}
                onChange={(e) => set("priceGrande", e.target.value)}
              />
            </Field>
            <Field label="Mediana">
              <TextInput
                inputMode="numeric"
                disabled={!canManage}
                value={form.priceMediana}
                onChange={(e) => set("priceMediana", e.target.value)}
              />
            </Field>
            <Field label="Chica">
              <TextInput
                inputMode="numeric"
                disabled={!canManage}
                value={form.priceChica}
                onChange={(e) => set("priceChica", e.target.value)}
              />
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-lg text-ink">Escalones</h2>
          <p className="text-xs text-ink-soft">
            Tarifa por minuto de la 2ª zona del combo (escalón 1) y de la 3ª en adelante
            (escalón 2).
          </p>
          <div className="flex flex-wrap gap-3">
            <Field label="Tarifa escalón 1 ($/min)">
              <TextInput
                inputMode="numeric"
                disabled={!canManage}
                value={form.tier1RatePerMinute}
                onChange={(e) => set("tier1RatePerMinute", e.target.value)}
              />
            </Field>
            <Field label="Tarifa escalón 2 ($/min)">
              <TextInput
                inputMode="numeric"
                disabled={!canManage}
                value={form.tier2RatePerMinute}
                onChange={(e) => set("tier2RatePerMinute", e.target.value)}
              />
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-lg text-ink">Minutos de precio</h2>
          <p className="text-xs text-ink-soft">
            Minutos por zona que multiplican la tarifa de cada escalón (unisex).
          </p>
          <div className="flex flex-wrap gap-3">
            <Field label="Grande">
              <TextInput
                inputMode="numeric"
                disabled={!canManage}
                value={form.pricingMinutesGrande}
                onChange={(e) => set("pricingMinutesGrande", e.target.value)}
              />
            </Field>
            <Field label="Mediana">
              <TextInput
                inputMode="numeric"
                disabled={!canManage}
                value={form.pricingMinutesMediana}
                onChange={(e) => set("pricingMinutesMediana", e.target.value)}
              />
            </Field>
            <Field label="Chica">
              <TextInput
                inputMode="numeric"
                disabled={!canManage}
                value={form.pricingMinutesChica}
                onChange={(e) => set("pricingMinutesChica", e.target.value)}
              />
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-lg text-ink">Minutos de turno</h2>
          <p className="text-xs text-ink-soft">
            Minutos que se bloquean en la agenda por zona, según el sexo de la clienta.
          </p>
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 text-xs font-medium text-ink-soft">Mujer</p>
              <div className="flex flex-wrap gap-3">
                <Field label="Grande">
                  <TextInput
                    inputMode="numeric"
                    disabled={!canManage}
                    value={form.slotMinutesFemaleGrande}
                    onChange={(e) => set("slotMinutesFemaleGrande", e.target.value)}
                  />
                </Field>
                <Field label="Mediana">
                  <TextInput
                    inputMode="numeric"
                    disabled={!canManage}
                    value={form.slotMinutesFemaleMediana}
                    onChange={(e) => set("slotMinutesFemaleMediana", e.target.value)}
                  />
                </Field>
                <Field label="Chica">
                  <TextInput
                    inputMode="numeric"
                    disabled={!canManage}
                    value={form.slotMinutesFemaleChica}
                    onChange={(e) => set("slotMinutesFemaleChica", e.target.value)}
                  />
                </Field>
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-ink-soft">Hombre</p>
              <div className="flex flex-wrap gap-3">
                <Field label="Grande">
                  <TextInput
                    inputMode="numeric"
                    disabled={!canManage}
                    value={form.slotMinutesMaleGrande}
                    onChange={(e) => set("slotMinutesMaleGrande", e.target.value)}
                  />
                </Field>
                <Field label="Mediana">
                  <TextInput
                    inputMode="numeric"
                    disabled={!canManage}
                    value={form.slotMinutesMaleMediana}
                    onChange={(e) => set("slotMinutesMaleMediana", e.target.value)}
                  />
                </Field>
                <Field label="Chica">
                  <TextInput
                    inputMode="numeric"
                    disabled={!canManage}
                    value={form.slotMinutesMaleChica}
                    onChange={(e) => set("slotMinutesMaleChica", e.target.value)}
                  />
                </Field>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Field label="Redondeo del turno (min)">
                <TextInput
                  inputMode="numeric"
                  disabled={!canManage}
                  value={form.slotRoundingStep}
                  onChange={(e) => set("slotRoundingStep", e.target.value)}
                />
              </Field>
              <Field label="Turno mínimo (min)">
                <TextInput
                  inputMode="numeric"
                  disabled={!canManage}
                  value={form.slotMinimumMinutes}
                  onChange={(e) => set("slotMinimumMinutes", e.target.value)}
                />
              </Field>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-lg text-ink">Pack de sesiones</h2>
          <p className="text-xs text-ink-soft">
            Descuento por pagar varias sesiones del mismo combo juntas.
          </p>
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
            <Field label="Redondeo del pack ($)">
              <TextInput
                inputMode="numeric"
                disabled={!canManage}
                value={form.packRoundingBase}
                onChange={(e) => set("packRoundingBase", e.target.value)}
              />
            </Field>
          </div>
        </section>

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

      <aside className="w-full shrink-0 space-y-3 rounded-xl border border-surface-high bg-white p-4 lg:sticky lg:top-4 lg:w-72">
        <h3 className="font-display text-base text-ink">Vista previa</h3>
        <p className="text-xs text-ink-soft">
          Con los valores del formulario, aunque no se hayan guardado.
        </p>
        <ul className="space-y-3">
          {ejemplos.map((e, i) => (
            <li key={e.testId} data-testid={e.testId} className="border-t border-surface-high pt-2">
              <p className="text-sm text-ink">{e.nombre}</p>
              <p className="font-display text-lg text-ink">{money(e.total)}</p>
              {i === 0 && (
                <p className="mt-0.5 text-xs text-ink-soft" data-testid="preview-cavado-axila-pack">
                  Pack de {form.packSessions || "?"} sesiones: {money(packEjemplo)}
                </p>
              )}
            </li>
          ))}
          <li
            key="preview-cuerpo-full"
            data-testid="preview-cuerpo-full"
            className="border-t border-surface-high pt-2"
          >
            <p className="text-sm text-ink">Cuerpo Full</p>
            <p className="font-display text-lg text-ink">{money(CUERPO_FULL_PRECIO)}</p>
            <p className="text-xs text-ink-soft">
              Pack fijo — precio propio, no usa la fórmula. Por fórmula sería{" "}
              <span data-testid="preview-cuerpo-full-formula">{money(cuerpoFullFormula)}</span>
              {cuerpoFullConviene
                ? ` (${cuerpoFullDescuentoPct}% de descuento sobre la fórmula).`
                : " — ¡el pack fijo ya NO conviene, cuesta igual o más que la fórmula!"}
            </p>
          </li>
        </ul>
      </aside>
    </div>
  );
}
