import { useMemo, useState } from "react";
import { useAuth } from "../../../auth/AuthContext";
import { can, type Role } from "../../../lib/permissions";
import { Field, TextInput } from "../../../components/form";
import { useToast } from "../../../components/ui/Toast";
import { money } from "../../../lib/format";
import {
  calcularPrecioCombo,
  calcularPrecioPack,
  primeraViolacionNoInversion,
  type Categoria,
  type DepilationConfig,
  type ZonaParaCotizar,
} from "../../../lib/depilation-pricing";
import {
  useCombosDepilacion,
  useDepilacionConfig,
  useGuardarConfig,
  type DepilacionConfigInput,
} from "../../../hooks/useDepilacion";
import type { ComboDepilacion } from "../../../lib/api-types";

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

/** Mismo mapeo que `aConfigAnidada` en el backend (`depilacion.repo.ts`):
 *  las 19 columnas planas de `DepilacionConfigInput` al `DepilationConfig`
 *  anidado que pide el motor. Duplicado a propósito (no importado desde el
 *  backend, que es otro repo/deploy): es la mitad "cliente" del espejo de la
 *  ronda de fixes 1, punto 1 — separado de `formToPreviewConfig` porque ese
 *  toma el `Form` (strings, tolerante a basura para la vista previa en
 *  vivo) y este toma valores YA validados como enteros. */
function configInputToNested(v: DepilacionConfigInput): DepilationConfig {
  return {
    precioLista: { grande: v.priceGrande, mediana: v.priceMediana, chica: v.priceChica },
    minutosPrecio: {
      grande: v.pricingMinutesGrande,
      mediana: v.pricingMinutesMediana,
      chica: v.pricingMinutesChica,
    },
    tarifaEscalon1: v.tier1RatePerMinute,
    tarifaEscalon2: v.tier2RatePerMinute,
    minutosTurno: {
      mujer: {
        grande: v.slotMinutesFemaleGrande,
        mediana: v.slotMinutesFemaleMediana,
        chica: v.slotMinutesFemaleChica,
      },
      hombre: {
        grande: v.slotMinutesMaleGrande,
        mediana: v.slotMinutesMaleMediana,
        chica: v.slotMinutesMaleChica,
      },
    },
    redondeoTurno: v.slotRoundingStep,
    turnoMinimo: v.slotMinimumMinutes,
    packSesiones: v.packSessions,
    packDescuentoPct: v.packDiscountPercentage,
    packRedondeo: v.packRoundingBase,
  };
}

/** Valida el formulario entero antes de guardar. Corta en el primer campo
 *  inválido — mismo criterio que `parseDisplayOrder` en ZonasPage: bloquea el
 *  guardado y devuelve un mensaje propio en vez de mandar la solicitud y
 *  esperar que el backend la rechace. Crítico para `packDiscountPercentage`:
 *  como el 0 es un valor válido ahí, sin este bloqueo un campo vacío o con
 *  basura se colaba como `0` y borraba el descuento del pack en silencio.
 *
 *  Ronda de fixes 1, punto 1 (Important): espejo EXACTO de la validación de
 *  `configBody` en el backend (`api-sistema-central/src/routes/agenda/depilacion.ts`)
 *  — mismas dos capas, mismo motor (`primeraViolacionNoInversion`) — para que
 *  el aviso de "esto rompe la no-inversión" llegue ANTES de mandar el PUT, no
 *  solo después. El backend sigue siendo la garantía real (esto es UX, no
 *  reemplaza esa validación); si algún día se desalinean, el backend manda. */
function parseForm(f: Form): { ok: true; values: DepilacionConfigInput } | { ok: false; error: string } {
  const values = {} as DepilacionConfigInput;
  for (const campo of CAMPOS) {
    const parsed = campo.validar(f[campo.key]);
    if (parsed === null) return { ok: false, error: campo.mensaje };
    (values as Record<string, number>)[campo.key] = parsed;
  }

  if (values.priceGrande < values.priceMediana || values.priceMediana < values.priceChica) {
    return {
      ok: false,
      error:
        "El precio de zona grande tiene que ser mayor o igual al de zona mediana, y el de zona " +
        "mediana mayor o igual al de zona chica. Si no, agregar una zona más grande a una " +
        "selección puede terminar costando MENOS que las zonas más chicas que ya estaban — y eso " +
        "nunca puede pasar.",
    };
  }

  const violacion = primeraViolacionNoInversion(configInputToNested(values));
  if (violacion) {
    return {
      ok: false,
      error:
        "Con estos precios y tarifas, agregar una zona a una selección puede hacer que el total " +
        "termine costando IGUAL O MENOS que antes de agregarla — y agregar una zona nunca puede " +
        "bajar el precio. Revisá los precios de lista y las tarifas de escalón antes de guardar.",
    };
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
 *  5 chicas, con precio propio de catálogo — ese número NUNCA sale de la
 *  fórmula, así que no se recalcula con el formulario.
 *
 *  Ronda de fixes 2, punto 3 (Important): antes esto era una constante
 *  hardcodeada acá (`CUERPO_FULL_PRECIO = 65000` + las 10 zonas escritas a
 *  mano) — un número del negocio duplicado del que ya vive de verdad en
 *  `depilation_combo.fixed_price`. Si el precio del pack cambiaba en la
 *  base, esta pantalla seguía mostrando el viejo y el cartel de "el pack fijo
 *  ya NO conviene" —que existe justamente para avisar cuando eso pasa—
 *  quedaba calculando contra un número que ya no era el real. Ahora sale de
 *  `useCombosDepilacion()`, la misma fuente que usa el resto del panel.
 */
function buscarCuerpoFull(combos: ComboDepilacion[] | undefined): ComboDepilacion | undefined {
  return combos?.find((c) => c.kind === "pack_fijo" && c.name === "Cuerpo Full");
}

export function PreciosPage() {
  const { data, isLoading, error } = useDepilacionConfig();
  const combosQuery = useCombosDepilacion();

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
        <PreciosForm
          config={data}
          cuerpoFull={buscarCuerpoFull(combosQuery.data)}
          cuerpoFullCargando={combosQuery.isLoading}
        />
      ) : null}
    </div>
  );
}

function PreciosForm({
  config,
  cuerpoFull,
  cuerpoFullCargando,
}: {
  config: DepilationConfig;
  cuerpoFull: ComboDepilacion | undefined;
  cuerpoFullCargando: boolean;
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
  // Las zonas REALES del pack "Cuerpo Full", tal como las devuelve el
  // backend — no una lista escrita a mano que puede desalinearse si alguien
  // cambia las zonas del pack desde la pantalla de Combos.
  const cuerpoFullZonas: ZonaParaCotizar[] = useMemo(
    () => (cuerpoFull?.zonas ?? []).map((z) => ({ id: z.id, nombre: z.name, categoria: z.category })),
    [cuerpoFull],
  );
  // Lo que darían esas zonas si se cotizaran por fórmula en vez de por el
  // precio fijo del pack — este número SÍ se mueve con el formulario, a
  // diferencia de `cuerpoFullPrecio` (que es el precio propio, ajeno a la
  // fórmula).
  const cuerpoFullFormula = useMemo(
    () => calcularPrecioCombo(cuerpoFullZonas, previewConfig).total,
    [cuerpoFullZonas, previewConfig],
  );
  // `null` mientras no se sabe el precio real todavía (combos cargando o el
  // pack no apareció) — a propósito distinto de `0`, para no mostrar ni
  // calcular nada con un número inventado mientras tanto.
  const cuerpoFullPrecio = cuerpoFull?.precioFinal ?? null;
  const cuerpoFullDescuentoPct =
    cuerpoFullPrecio != null && cuerpoFullFormula > 0
      ? Math.round((1 - cuerpoFullPrecio / cuerpoFullFormula) * 100)
      : 0;
  const cuerpoFullConviene = cuerpoFullPrecio != null && cuerpoFullPrecio < cuerpoFullFormula;

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
            Minutos que se bloquean en la agenda por zona, según el sexo del cliente.
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
            {cuerpoFullCargando ? (
              <p className="text-sm text-ink-soft">Cargando…</p>
            ) : cuerpoFullPrecio != null ? (
              <>
                <p className="font-display text-lg text-ink">{money(cuerpoFullPrecio)}</p>
                <p className="text-xs text-ink-soft">
                  Pack fijo — precio propio, no usa la fórmula. Por fórmula sería{" "}
                  <span data-testid="preview-cuerpo-full-formula">{money(cuerpoFullFormula)}</span>
                  {cuerpoFullConviene
                    ? ` (${cuerpoFullDescuentoPct}% de descuento sobre la fórmula).`
                    : " — ¡el pack fijo ya NO conviene, cuesta igual o más que la fórmula!"}
                </p>
              </>
            ) : (
              <p className="text-xs text-ink-soft">
                No se pudo cargar el precio del pack fijo "Cuerpo Full".
              </p>
            )}
          </li>
        </ul>
      </aside>
    </div>
  );
}
