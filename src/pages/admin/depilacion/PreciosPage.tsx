import { useMemo, useState } from "react";
import { useAuth } from "../../../auth/AuthContext";
import { can, type Role } from "../../../lib/permissions";
import { Field, TextInput } from "../../../components/form";
import { useToast } from "../../../components/ui/Toast";
import { money } from "../../../lib/format";
import { useContextoDeArea } from "../contexto-de-area";
import {
  calcularPrecioCombo,
  calcularPrecioPack,
  primeraViolacionNoInversion,
  type Categoria,
  type DepilationConfig,
  type LineaCotizacion,
  type Sexo,
  type ZonaParaCotizar,
} from "../../../lib/depilation-pricing";
import {
  useCombosDepilacion,
  useDepilacionConfig,
  useGuardarConfig,
  type DepilacionConfigInput,
} from "../../../hooks/useDepilacion";
import type { ComboDepilacion } from "../../../lib/api-types";
import { parseEnteroPositivo, parsePorcentaje } from "../../../lib/depilation-form-validation";

/** Los 25 campos del formulario, todos como texto para permitir borrar el
 *  campo mientras se escribe. La validación al guardar (más abajo, `parseForm`)
 *  sí sigue el criterio de `parseDisplayOrder` en ZonasPage: bloquea y muestra
 *  un mensaje propio en vez de mandarle basura al backend.
 *
 *  task-7: "Precio de lista" y "Minutos de precio" se abren por sexo (6
 *  campos cada uno, en vez de 3 unisex), igual que "Minutos de turno" ya lo
 *  estaba. */
type Form = {
  priceFemaleGrande: string;
  priceFemaleMediana: string;
  priceFemaleChica: string;
  priceMaleGrande: string;
  priceMaleMediana: string;
  priceMaleChica: string;
  pricingMinutesFemaleGrande: string;
  pricingMinutesFemaleMediana: string;
  pricingMinutesFemaleChica: string;
  pricingMinutesMaleGrande: string;
  pricingMinutesMaleMediana: string;
  pricingMinutesMaleChica: string;
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
    priceFemaleGrande: String(c.precioLista.mujer.grande),
    priceFemaleMediana: String(c.precioLista.mujer.mediana),
    priceFemaleChica: String(c.precioLista.mujer.chica),
    priceMaleGrande: String(c.precioLista.hombre.grande),
    priceMaleMediana: String(c.precioLista.hombre.mediana),
    priceMaleChica: String(c.precioLista.hombre.chica),
    pricingMinutesFemaleGrande: String(c.minutosPrecio.mujer.grande),
    pricingMinutesFemaleMediana: String(c.minutosPrecio.mujer.mediana),
    pricingMinutesFemaleChica: String(c.minutosPrecio.mujer.chica),
    pricingMinutesMaleGrande: String(c.minutosPrecio.hombre.grande),
    pricingMinutesMaleMediana: String(c.minutosPrecio.hombre.mediana),
    pricingMinutesMaleChica: String(c.minutosPrecio.hombre.chica),
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
      mujer: {
        grande: toNumber(f.priceFemaleGrande),
        mediana: toNumber(f.priceFemaleMediana),
        chica: toNumber(f.priceFemaleChica),
      },
      hombre: {
        grande: toNumber(f.priceMaleGrande),
        mediana: toNumber(f.priceMaleMediana),
        chica: toNumber(f.priceMaleChica),
      },
    },
    minutosPrecio: {
      mujer: {
        grande: toNumber(f.pricingMinutesFemaleGrande),
        mediana: toNumber(f.pricingMinutesFemaleMediana),
        chica: toNumber(f.pricingMinutesFemaleChica),
      },
      hombre: {
        grande: toNumber(f.pricingMinutesMaleGrande),
        mediana: toNumber(f.pricingMinutesMaleMediana),
        chica: toNumber(f.pricingMinutesMaleChica),
      },
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

/** Un campo por cada uno de los 25 de `Form` (mismos nombres que
 *  `DepilacionConfigInput`, así el resultado de validar ya tiene la forma que
 *  pide el PUT). El mensaje es el que ve la clienta si el campo no pasa. */
const CAMPOS: { key: keyof Form; validar: (raw: string) => number | null; mensaje: string }[] = [
  { key: "priceFemaleGrande", validar: parseEnteroPositivo, mensaje: "El precio de zona grande (mujer) tiene que ser un número entero mayor a cero." },
  { key: "priceFemaleMediana", validar: parseEnteroPositivo, mensaje: "El precio de zona mediana (mujer) tiene que ser un número entero mayor a cero." },
  { key: "priceFemaleChica", validar: parseEnteroPositivo, mensaje: "El precio de zona chica (mujer) tiene que ser un número entero mayor a cero." },
  { key: "priceMaleGrande", validar: parseEnteroPositivo, mensaje: "El precio de zona grande (hombre) tiene que ser un número entero mayor a cero." },
  { key: "priceMaleMediana", validar: parseEnteroPositivo, mensaje: "El precio de zona mediana (hombre) tiene que ser un número entero mayor a cero." },
  { key: "priceMaleChica", validar: parseEnteroPositivo, mensaje: "El precio de zona chica (hombre) tiene que ser un número entero mayor a cero." },
  { key: "pricingMinutesFemaleGrande", validar: parseEnteroPositivo, mensaje: "Los minutos de precio de zona grande (mujer) tienen que ser un número entero mayor a cero." },
  { key: "pricingMinutesFemaleMediana", validar: parseEnteroPositivo, mensaje: "Los minutos de precio de zona mediana (mujer) tienen que ser un número entero mayor a cero." },
  { key: "pricingMinutesFemaleChica", validar: parseEnteroPositivo, mensaje: "Los minutos de precio de zona chica (mujer) tienen que ser un número entero mayor a cero." },
  { key: "pricingMinutesMaleGrande", validar: parseEnteroPositivo, mensaje: "Los minutos de precio de zona grande (hombre) tienen que ser un número entero mayor a cero." },
  { key: "pricingMinutesMaleMediana", validar: parseEnteroPositivo, mensaje: "Los minutos de precio de zona mediana (hombre) tienen que ser un número entero mayor a cero." },
  { key: "pricingMinutesMaleChica", validar: parseEnteroPositivo, mensaje: "Los minutos de precio de zona chica (hombre) tienen que ser un número entero mayor a cero." },
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
 *  las 25 columnas planas de `DepilacionConfigInput` al `DepilationConfig`
 *  anidado que pide el motor. Duplicado a propósito (no importado desde el
 *  backend, que es otro repo/deploy): es la mitad "cliente" del espejo de la
 *  ronda de fixes 1, punto 1 — separado de `formToPreviewConfig` porque ese
 *  toma el `Form` (strings, tolerante a basura para la vista previa en
 *  vivo) y este toma valores YA validados como enteros. */
function configInputToNested(v: DepilacionConfigInput): DepilationConfig {
  return {
    precioLista: {
      mujer: { grande: v.priceFemaleGrande, mediana: v.priceFemaleMediana, chica: v.priceFemaleChica },
      hombre: { grande: v.priceMaleGrande, mediana: v.priceMaleMediana, chica: v.priceMaleChica },
    },
    minutosPrecio: {
      mujer: {
        grande: v.pricingMinutesFemaleGrande,
        mediana: v.pricingMinutesFemaleMediana,
        chica: v.pricingMinutesFemaleChica,
      },
      hombre: {
        grande: v.pricingMinutesMaleGrande,
        mediana: v.pricingMinutesMaleMediana,
        chica: v.pricingMinutesMaleChica,
      },
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
 *  reemplaza esa validación); si algún día se desalinean, el backend manda.
 *
 *  task-7: la Capa 1 (orden grande ≥ mediana ≥ chica) corre por separado para
 *  cada curva (mujer y hombre), cada una contra sí misma. La Capa 2
 *  (`primeraViolacionNoInversion`) sigue corriendo solo contra mujer — mismo
 *  hueco documentado del lado del backend (Task 4 de la SDD): validar también
 *  la curva de hombre es un cambio de firma de esa función pura, fuera del
 *  alcance de esta tarea. */
function parseForm(f: Form): { ok: true; values: DepilacionConfigInput } | { ok: false; error: string } {
  const values = {} as DepilacionConfigInput;
  for (const campo of CAMPOS) {
    const parsed = campo.validar(f[campo.key]);
    if (parsed === null) return { ok: false, error: campo.mensaje };
    (values as Record<string, number>)[campo.key] = parsed;
  }

  if (values.priceFemaleGrande < values.priceFemaleMediana || values.priceFemaleMediana < values.priceFemaleChica) {
    return {
      ok: false,
      error:
        "El precio de zona grande (mujer) tiene que ser mayor o igual al de zona mediana (mujer), " +
        "y el de zona mediana (mujer) mayor o igual al de zona chica (mujer). Si no, agregar una " +
        "zona más grande a una selección puede terminar costando MENOS que las zonas más chicas " +
        "que ya estaban — y eso nunca puede pasar.",
    };
  }

  if (values.priceMaleGrande < values.priceMaleMediana || values.priceMaleMediana < values.priceMaleChica) {
    return {
      ok: false,
      error:
        "El precio de zona grande (hombre) tiene que ser mayor o igual al de zona mediana (hombre), " +
        "y el de zona mediana (hombre) mayor o igual al de zona chica (hombre). Si no, agregar una " +
        "zona más grande a una selección puede terminar costando MENOS que las zonas más chicas " +
        "que ya estaban — y eso nunca puede pasar.",
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

/** Los tres pasos de `calcularPrecioCombo`, en el mismo orden en que los
 *  aplica el motor. `donde` nombra la sección del formulario que edita los
 *  números de ese paso: sin ese puntero, saber la fórmula no alcanza para
 *  saber qué campo tocar. */
const PASOS = [
  {
    n: 1,
    titulo: "La zona más cara va primera",
    formula: "Se cobra al precio de lista de su categoría.",
    donde: "Precios de lista",
  },
  {
    n: 2,
    titulo: "La segunda zona",
    formula: "Minutos de la zona × tarifa del escalón 1.",
    donde: "Minutos de precio + Escalones",
  },
  {
    n: 3,
    titulo: "De la tercera en adelante",
    formula: "Minutos de la zona × tarifa del escalón 2.",
    donde: "Minutos de precio + Escalones",
  },
];

/** task-7: `precioLista`/`minutosPrecio` se bifurcaron por sexo, pero esta
 *  pantalla no tiene (ni pide) un selector de sexo para la vista previa — es
 *  un ejemplo ilustrativo, no una cotización real. Se fija en "mujer" para
 *  los tres ejemplos de la fórmula y para "Cuerpo Full por fórmula": mismo
 *  criterio que el resto del código (backend Task 2 de la SDD) usa como
 *  default de transición. El armador de Combos (`ArmadorCombo.tsx`), que sí
 *  cotiza de verdad, tiene su propio selector de sexo. */
const SEXO_PREVIEW: Sexo = "mujer";

/** Traduce el `motivo` que devuelve el motor a la cuenta concreta que se hizo,
 *  con los números que están en el formulario en este momento. "escalon_1" no
 *  le dice nada a nadie; "5 min × $1.200" es la cuenta. */
function explicarLinea(linea: LineaCotizacion, config: DepilationConfig): string {
  if (linea.motivo === "lista") return "precio de lista";
  const minutos = config.minutosPrecio[SEXO_PREVIEW][linea.categoria];
  const tarifa = linea.motivo === "escalon_1" ? config.tarifaEscalon1 : config.tarifaEscalon2;
  const escalon = linea.motivo === "escalon_1" ? "escalón 1" : "escalón 2";
  return `${minutos} min × ${money(tarifa)} (${escalon})`;
}

// El PRIMERO es el que se muestra desglosado, y por eso tiene tres zonas: es
// el único tamaño que ejercita los tres pasos de la fórmula (precio de lista,
// escalón 1 y escalón 2). Con dos zonas el escalón 2 se explica arriba pero no
// se ve nunca en acción, que era justo lo que había que evitar.
const EJEMPLOS: { testId: string; nombre: string; zonas: ZonaParaCotizar[] }[] = [
  {
    testId: "preview-pierna-cavado-rostro",
    nombre: "Pierna + Rostro + Cavado",
    zonas: [zona("grande", "Pierna"), zona("grande", "Rostro"), zona("chica", "Cavado")],
  },
  {
    testId: "preview-cavado-axila",
    nombre: "Cavado + Axila",
    zonas: [zona("chica", "Cavado"), zona("chica", "Axila")],
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
  // Precios no tiene botón Agregar, pero sí scroll propio: adentro del layout
  // el que scrollea es el área, y dejar los dos daría una barra adentro de la
  // otra.
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
  // Se guarda la cotización ENTERA, no solo el total: el primer ejemplo se
  // muestra línea por línea (qué zona, por qué motivo, cuánto) y para eso hace
  // falta `lineas`. Es la diferencia entre "confiá en que da $18.000" y "mirá
  // de dónde sale cada peso".
  const ejemplos = useMemo(
    () =>
      EJEMPLOS.map((e) => {
        const cotizacion = calcularPrecioCombo(e.zonas, SEXO_PREVIEW, previewConfig);
        return { ...e, total: cotizacion.total, lineas: cotizacion.lineas };
      }),
    [previewConfig],
  );
  // Pack de 3 sesiones del primer ejemplo (Cavado + Axila): es el único
  // reflejo en vivo de `packSessions`/`packDescuentoPct`/`packRedondeo` — sin
  // esto esas tres perillas se editan a ciegas, igual que pasaba con las
  // otras 16 antes de tener los cuatro ejemplos de fórmula.
  // El primero se muestra desglosado; los otros, compactos.
  const ejemploPrincipal = ejemplos[0]!;
  const otrosEjemplos = ejemplos.slice(1);

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
    () => calcularPrecioCombo(cuerpoFullZonas, SEXO_PREVIEW, previewConfig).total,
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
            Precio de la primera zona del combo (la más cara), según su categoría y el sexo de
            la clienta.
          </p>
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 text-xs font-medium text-ink-soft">Mujer</p>
              <div className="flex flex-wrap gap-3">
                <Field label="Precio grande (mujer)">
                  <TextInput
                    inputMode="numeric"
                    disabled={!canManage}
                    value={form.priceFemaleGrande}
                    onChange={(e) => set("priceFemaleGrande", e.target.value)}
                  />
                </Field>
                <Field label="Precio mediana (mujer)">
                  <TextInput
                    inputMode="numeric"
                    disabled={!canManage}
                    value={form.priceFemaleMediana}
                    onChange={(e) => set("priceFemaleMediana", e.target.value)}
                  />
                </Field>
                <Field label="Precio chica (mujer)">
                  <TextInput
                    inputMode="numeric"
                    disabled={!canManage}
                    value={form.priceFemaleChica}
                    onChange={(e) => set("priceFemaleChica", e.target.value)}
                  />
                </Field>
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-ink-soft">Hombre</p>
              <div className="flex flex-wrap gap-3">
                <Field label="Precio grande (hombre)">
                  <TextInput
                    inputMode="numeric"
                    disabled={!canManage}
                    value={form.priceMaleGrande}
                    onChange={(e) => set("priceMaleGrande", e.target.value)}
                  />
                </Field>
                <Field label="Precio mediana (hombre)">
                  <TextInput
                    inputMode="numeric"
                    disabled={!canManage}
                    value={form.priceMaleMediana}
                    onChange={(e) => set("priceMaleMediana", e.target.value)}
                  />
                </Field>
                <Field label="Precio chica (hombre)">
                  <TextInput
                    inputMode="numeric"
                    disabled={!canManage}
                    value={form.priceMaleChica}
                    onChange={(e) => set("priceMaleChica", e.target.value)}
                  />
                </Field>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-lg text-ink">Escalones</h2>
          <p className="text-xs text-ink-soft">
            Tarifa por minuto de la 2ª zona del combo (escalón 1) y de la 3ª en adelante
            (escalón 2).
          </p>
          <div className="flex flex-wrap gap-3">
            <Field
              label="Tarifa escalón 1 ($/min)"
              help="Lo que vale un minuto de la SEGUNDA zona del combo. La segunda ya no se cobra a precio de lista: comparte el turno con la primera, así que sale más barata. Se multiplica por los minutos de precio de esa zona."
            >
              <TextInput
                inputMode="numeric"
                disabled={!canManage}
                value={form.tier1RatePerMinute}
                onChange={(e) => set("tier1RatePerMinute", e.target.value)}
              />
            </Field>
            <Field
              label="Tarifa escalón 2 ($/min)"
              help="Lo que vale un minuto de la TERCERA zona en adelante. Más barata todavía que el escalón 1, por el mismo motivo. Tiene que ser menor o igual al escalón 1: si fuera mayor, la tercera zona costaría más que la segunda."
            >
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
            Minutos por zona que multiplican la tarifa de cada escalón, según el sexo de la
            clienta.
          </p>
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 text-xs font-medium text-ink-soft">Mujer</p>
              <div className="flex flex-wrap gap-3">
                <Field
                  label="Minutos por zona grande (mujer)"
                  help="Minutos que se le asignan a una zona GRANDE de una mujer para calcular su precio cuando cae en un escalón. OJO: no es la duración del turno, es un multiplicador de la tarifa por minuto. La duración real se configura abajo, en Minutos de turno."
                >
                  <TextInput
                    inputMode="numeric"
                    disabled={!canManage}
                    value={form.pricingMinutesFemaleGrande}
                    onChange={(e) => set("pricingMinutesFemaleGrande", e.target.value)}
                  />
                </Field>
                <Field
                  label="Minutos por zona mediana (mujer)"
                  help="Minutos que se le asignan a una zona MEDIANA de una mujer para calcular su precio cuando cae en un escalón. No es la duración del turno: eso se configura abajo, en Minutos de turno."
                >
                  <TextInput
                    inputMode="numeric"
                    disabled={!canManage}
                    value={form.pricingMinutesFemaleMediana}
                    onChange={(e) => set("pricingMinutesFemaleMediana", e.target.value)}
                  />
                </Field>
                <Field
                  label="Minutos por zona chica (mujer)"
                  help="Minutos que se le asignan a una zona CHICA de una mujer para calcular su precio cuando cae en un escalón. No es la duración del turno: eso se configura abajo, en Minutos de turno."
                >
                  <TextInput
                    inputMode="numeric"
                    disabled={!canManage}
                    value={form.pricingMinutesFemaleChica}
                    onChange={(e) => set("pricingMinutesFemaleChica", e.target.value)}
                  />
                </Field>
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-ink-soft">Hombre</p>
              <div className="flex flex-wrap gap-3">
                <Field
                  label="Minutos por zona grande (hombre)"
                  help="Minutos que se le asignan a una zona GRANDE de un hombre para calcular su precio cuando cae en un escalón. OJO: no es la duración del turno, es un multiplicador de la tarifa por minuto. La duración real se configura abajo, en Minutos de turno."
                >
                  <TextInput
                    inputMode="numeric"
                    disabled={!canManage}
                    value={form.pricingMinutesMaleGrande}
                    onChange={(e) => set("pricingMinutesMaleGrande", e.target.value)}
                  />
                </Field>
                <Field
                  label="Minutos por zona mediana (hombre)"
                  help="Minutos que se le asignan a una zona MEDIANA de un hombre para calcular su precio cuando cae en un escalón. No es la duración del turno: eso se configura abajo, en Minutos de turno."
                >
                  <TextInput
                    inputMode="numeric"
                    disabled={!canManage}
                    value={form.pricingMinutesMaleMediana}
                    onChange={(e) => set("pricingMinutesMaleMediana", e.target.value)}
                  />
                </Field>
                <Field
                  label="Minutos por zona chica (hombre)"
                  help="Minutos que se le asignan a una zona CHICA de un hombre para calcular su precio cuando cae en un escalón. No es la duración del turno: eso se configura abajo, en Minutos de turno."
                >
                  <TextInput
                    inputMode="numeric"
                    disabled={!canManage}
                    value={form.pricingMinutesMaleChica}
                    onChange={(e) => set("pricingMinutesMaleChica", e.target.value)}
                  />
                </Field>
              </div>
            </div>
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
              <Field
                label="Redondeo del turno (min)"
                help="La duración calculada se redondea al múltiplo más cercano de este número, para que los turnos caigan en horarios prolijos. Con 5, un turno de 23 minutos se agenda como 25."
              >
                <TextInput
                  inputMode="numeric"
                  disabled={!canManage}
                  value={form.slotRoundingStep}
                  onChange={(e) => set("slotRoundingStep", e.target.value)}
                />
              </Field>
              <Field
                label="Turno mínimo (min)"
                help="Ningún turno se agenda por menos de esto, por más chica que sea la zona. Cubre la preparación y la limpieza, que llevan lo mismo aunque la depilación dure dos minutos."
              >
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

        {/* Los packs se administran en su propia pestaña (/admin/depilacion/packs).
            Los tres campos SIGUEN en el estado y en el PUT: este formulario manda la
            config entera, así que sacarlos del estado los guardaría vacíos. */}

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

      <aside className="w-full shrink-0 space-y-4 lg:sticky lg:top-4 lg:w-80">
        {/* ── Cómo se calcula ────────────────────────────────────────────
            Va ANTES del ejemplo a propósito: sin saber la forma de la
            fórmula, los números del ejemplo son cuatro cifras sueltas. */}
        <section className="space-y-3 rounded-xl border border-surface-high bg-white p-4">
          <h3 className="font-display text-base text-ink">Cómo se calcula un combo</h3>
          <p className="text-xs text-ink-soft">
            La fórmula es siempre esta y no se edita. Lo que se edita en esta pantalla son los
            números que usa.
          </p>

          <ol className="space-y-2.5">
            {PASOS.map((paso) => (
              <li key={paso.n} className="flex gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-medium text-primary">
                  {paso.n}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-ink">{paso.titulo}</p>
                  <p className="text-xs text-ink-soft">{paso.formula}</p>
                  <p className="mt-0.5 text-[11px] text-ink-soft/80">
                    Se edita en: <span className="text-ink-soft">{paso.donde}</span>
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <p className="rounded-lg bg-surface-low px-3 py-2 text-xs text-ink-soft">
            El total del combo es la suma de sus líneas. Las zonas se ordenan de la más grande a
            la más chica, así que la más cara siempre es la primera y{" "}
            <strong className="font-medium text-ink">agregar una zona nunca baja el total</strong>.
          </p>
        </section>

        {/* ── Ejemplo desglosado ───────────────────────────────────────── */}
        <section className="space-y-3 rounded-xl border border-surface-high bg-white p-4">
          <div>
            <h3 className="font-display text-base text-ink">Ejemplo, paso a paso</h3>
            <p className="text-xs text-ink-soft">
              Calculado con los valores que están ahora en el formulario, estén guardados o no.
              Sirve para ver a dónde llega un cambio antes de aplicarlo.
            </p>
          </div>

          <div data-testid={ejemploPrincipal.testId}>
            <p className="text-sm font-medium text-ink">{ejemploPrincipal.nombre}</p>
            <table className="mt-1.5 w-full text-xs">
              <tbody>
                {ejemploPrincipal.lineas.map((l) => (
                  <tr key={l.zonaId} className="align-baseline">
                    <td className="py-0.5 pr-2 text-ink">
                      {l.nombre}
                      <span className="text-ink-soft"> ({l.categoria})</span>
                    </td>
                    <td className="py-0.5 pr-2 text-ink-soft">
                      {explicarLinea(l, previewConfig)}
                    </td>
                    <td className="py-0.5 text-right tabular-nums text-ink">{money(l.importe)}</td>
                  </tr>
                ))}
                <tr className="border-t border-surface-high">
                  <td className="pt-1.5 text-sm font-medium text-ink" colSpan={2}>
                    Total
                  </td>
                  <td className="pt-1.5 text-right font-display text-base tabular-nums text-ink">
                    {money(ejemploPrincipal.total)}
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="mt-2.5 rounded-lg bg-surface-low px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-ink">
                  Pack de {form.packSessions || "?"} sesiones
                </span>
                <span
                  className="font-display text-sm tabular-nums text-ink"
                  data-testid="preview-pack"
                >
                  {money(packEjemplo)}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-ink-soft">
                {form.packSessions || "?"} × {money(ejemploPrincipal.total)} ={" "}
                {money(ejemploPrincipal.total * toNumber(form.packSessions))}, menos{" "}
                {form.packDiscountPercentage || "?"}%, redondeado a múltiplos de{" "}
                {money(toNumber(form.packRoundingBase))}.
              </p>
            </div>
          </div>

          {/* Los otros ejemplos, compactos: confirman que la fórmula escala
              con más zonas sin repetir todo el desglose. */}
          <ul className="space-y-1.5 border-t border-surface-high pt-2.5">
            {otrosEjemplos.map((e) => (
              <li
                key={e.testId}
                data-testid={e.testId}
                className="flex items-baseline justify-between gap-2 text-xs"
              >
                <span className="min-w-0 text-ink-soft">{e.nombre}</span>
                <span className="shrink-0 tabular-nums text-ink">{money(e.total)}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── El pack fijo, que NO usa la fórmula ──────────────────────── */}
        <section
          className="space-y-1.5 rounded-xl border border-surface-high bg-white p-4"
          data-testid="preview-cuerpo-full"
        >
          <h3 className="font-display text-base text-ink">Cuando el precio no sale de la fórmula</h3>
          <p className="text-xs text-ink-soft">
            Los packs fijos (Cuerpo Full, Cuerpo Completo, Esenciales) tienen precio propio de
            catálogo. Se cobran a ese precio aunque la fórmula dé otro, y se editan en la solapa
            Combos.
          </p>
          <p className="text-xs text-ink-soft">
            Ahí mismo, cada combo puede además definir su propia cantidad de sesiones y su propio
            descuento, en vez de heredar los valores por defecto de la pestaña Packs.
          </p>
          {cuerpoFullCargando ? (
            <p className="text-sm text-ink-soft">Cargando…</p>
          ) : cuerpoFullPrecio != null ? (
            <div className="rounded-lg bg-surface-low px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-ink">Cuerpo Full</span>
                <span className="font-display text-sm tabular-nums text-ink">
                  {money(cuerpoFullPrecio)}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-ink-soft">
                Por fórmula sería{" "}
                <span data-testid="preview-cuerpo-full-formula">{money(cuerpoFullFormula)}</span>
                {cuerpoFullConviene
                  ? ` — ${cuerpoFullDescuentoPct}% de descuento.`
                  : " — ¡el pack fijo ya NO conviene, cuesta igual o más que la fórmula!"}
              </p>
            </div>
          ) : (
            <p className="text-xs text-ink-soft">
              No se pudo cargar el precio del pack fijo "Cuerpo Full".
            </p>
          )}
        </section>
      </aside>
    </div>
  );
}
