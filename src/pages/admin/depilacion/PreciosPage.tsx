import { useMemo, useState } from "react";
import { useAuth } from "../../../auth/AuthContext";
import { can, type Role } from "../../../lib/permissions";
import { Field, TextInput } from "../../../components/form";
import { useToast } from "../../../components/ui/Toast";
import { money } from "../../../lib/format";
import {
  calcularPrecioCombo,
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
 *  campo mientras se escribe (mismo criterio que `displayOrder` en ZonasPage). */
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

function formToInput(f: Form): DepilacionConfigInput {
  return {
    priceGrande: toNumber(f.priceGrande),
    priceMediana: toNumber(f.priceMediana),
    priceChica: toNumber(f.priceChica),
    pricingMinutesGrande: toNumber(f.pricingMinutesGrande),
    pricingMinutesMediana: toNumber(f.pricingMinutesMediana),
    pricingMinutesChica: toNumber(f.pricingMinutesChica),
    tier1RatePerMinute: toNumber(f.tier1RatePerMinute),
    tier2RatePerMinute: toNumber(f.tier2RatePerMinute),
    slotMinutesFemaleGrande: toNumber(f.slotMinutesFemaleGrande),
    slotMinutesFemaleMediana: toNumber(f.slotMinutesFemaleMediana),
    slotMinutesFemaleChica: toNumber(f.slotMinutesFemaleChica),
    slotMinutesMaleGrande: toNumber(f.slotMinutesMaleGrande),
    slotMinutesMaleMediana: toNumber(f.slotMinutesMaleMediana),
    slotMinutesMaleChica: toNumber(f.slotMinutesMaleChica),
    slotRoundingStep: toNumber(f.slotRoundingStep),
    slotMinimumMinutes: toNumber(f.slotMinimumMinutes),
    packSessions: toNumber(f.packSessions),
    packDiscountPercentage: toNumber(f.packDiscountPercentage),
    packRoundingBase: toNumber(f.packRoundingBase),
  };
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

/** "Cuerpo Full" es un pack fijo (PDF §6): precio propio de catálogo, nunca
 *  sale de la fórmula, así que no se recalcula con el formulario. Se muestra
 *  igual porque es uno de los cuatro ejemplos del spec §6.2 — la gracia es
 *  que la pantalla deje claro que ESTE no se mueve. */
const CUERPO_FULL_PRECIO = 65000;

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

  async function save() {
    setFormError(null);
    try {
      await guardarConfig.mutateAsync(formToInput(form));
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
          {ejemplos.map((e) => (
            <li key={e.testId} data-testid={e.testId} className="border-t border-surface-high pt-2">
              <p className="text-sm text-ink">{e.nombre}</p>
              <p className="font-display text-lg text-ink">{money(e.total)}</p>
            </li>
          ))}
          <li
            key="preview-cuerpo-full"
            data-testid="preview-cuerpo-full"
            className="border-t border-surface-high pt-2"
          >
            <p className="text-sm text-ink">Cuerpo Full</p>
            <p className="font-display text-lg text-ink">{money(CUERPO_FULL_PRECIO)}</p>
            <p className="text-xs text-ink-soft">Pack fijo — precio propio, no usa la fórmula.</p>
          </li>
        </ul>
      </aside>
    </div>
  );
}
