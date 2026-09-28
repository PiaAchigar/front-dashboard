import type { JSX, ReactNode } from "react";
import { Field, Select, TextInput } from "./form";
import { Plus, Trash } from "./icons";

export type TipoDePagoOpcion = {
  value: "per_hour" | "percentage" | "fixed_per_service";
  label: string;
};

export type FilaDeAcuerdo = { serviceProviderId: string; paymentType: string; rate: string };

/**
 * Editor de acuerdos proveedora↔servicio: qué proveedora, con qué tipo de
 * pago y a qué tarifa. Extraído de ServiciosAdminPage (Tarea 10) para que
 * Comisión de depilación (Tarea 11) lo reuse en vez de copiarlo — dos
 * copias del mismo editor se desincronizan apenas alguien arregla un bug
 * en una y se olvida de la otra.
 *
 * Es un componente controlado (`filas` + `onChange`): quien lo usa decide
 * cómo persistir el estado. ServiciosAdminPage lo guarda en un ref porque
 * su editor no usa effects y se re-monta por `key` cuando cambia el
 * servicio; Comisión puede manejarlo distinto.
 */
export function EditorDeAcuerdos({
  filas,
  onChange,
  proveedoras,
  tiposDePago,
  pieDeFila,
  nota,
  etiquetaTipoDePago = "Tipo de pago",
  etiquetaTarifa,
  deshabilitarAgregar = false,
  motivoDeshabilitarAgregar,
}: {
  filas: FilaDeAcuerdo[];
  onChange: (filas: FilaDeAcuerdo[]) => void;
  proveedoras: { id: string; fullName: string | null }[];
  tiposDePago: TipoDePagoOpcion[];
  /** Renglón bajo cada fila. Lo usa Depilación para la traducción a plata. */
  pieDeFila?: (fila: FilaDeAcuerdo) => ReactNode;
  /** Texto fijo bajo el desplegable. Lo usa Depilación para explicar el porcentaje. */
  nota?: ReactNode;
  /** Las etiquetas de los dos campos de plata. Por defecto las de Servicios;
   *  Depilación las pide en el idioma de Laura ("Cómo cobra" / "Cuánto cobra"),
   *  que es el que usa el resto de esa pantalla. */
  etiquetaTipoDePago?: string;
  /** Sin esto la etiqueta de la tarifa alterna entre "Tarifa (%)" y
   *  "Tarifa ($)" según el tipo de pago elegido. Quien no ofrece porcentaje
   *  —Depilación— no necesita esa alternancia y puede fijar el texto.
   *  Ojo: sólo reemplaza la variante en pesos. Si la fila está en
   *  `percentage`, gana "Tarifa (%)" igual — la unidad no es negociable. */
  etiquetaTarifa?: string;
  /** Apaga el botón de agregar. Depilación lo usa mientras no haya ningún
   *  equipo cargado: habilitar a alguien sin equipo no la hace aparecer con
   *  horarios. */
  deshabilitarAgregar?: boolean;
  /** Qué elemento explica el `disabled` de arriba, para `aria-describedby`.
   *  Un botón apagado sin motivo anunciado no se puede entender con lector de
   *  pantalla. */
  motivoDeshabilitarAgregar?: string;
}): JSX.Element {
  const patch = (i: number, p: Partial<FilaDeAcuerdo>) =>
    onChange(filas.map((x, idx) => (idx === i ? { ...x, ...p } : x)));

  return (
    <div className="space-y-2 rounded-xl border border-surface-high p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
        Proveedoras y tarifa
      </p>
      {nota && <p className="text-xs text-ink-soft">{nota}</p>}
      {filas.length === 0 ? (
        <p className="text-sm text-ink-soft">Sin proveedoras asignadas.</p>
      ) : (
        <ul className="space-y-2">
          {filas.map((a, i) => (
            <li
              key={i}
              className="rounded-lg border border-surface-high bg-white p-2.5"
            >
              <div className="flex items-end gap-2">
                <Field label="Proveedora">
                  <Select
                    value={a.serviceProviderId}
                    onChange={(e) => patch(i, { serviceProviderId: e.target.value })}
                  >
                    <option value="">Elegí proveedora…</option>
                    {proveedoras.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.fullName ?? "—"}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={etiquetaTipoDePago}>
                  <Select
                    value={a.paymentType}
                    onChange={(e) => patch(i, { paymentType: e.target.value })}
                  >
                    <option value="">—</option>
                    {tiposDePago.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                {/* El porcentaje gana SIEMPRE, aunque la pantalla haya fijado
                    su propia etiqueta: son puntos porcentuales, no pesos, y un
                    "($)" arriba de un 40 miente sobre lo que se está cargando.
                    La etiqueta de la pantalla es vocabulario; esto es la
                    unidad. */}
                <Field
                  label={
                    a.paymentType === "percentage"
                      ? "Tarifa (%)"
                      : (etiquetaTarifa ?? "Tarifa ($)")
                  }
                >
                  <TextInput
                    inputMode="numeric"
                    value={a.rate}
                    onChange={(e) => patch(i, { rate: e.target.value })}
                    placeholder="0"
                  />
                </Field>
                <button
                  type="button"
                  title="Quitar proveedora"
                  onClick={() => onChange(filas.filter((_, idx) => idx !== i))}
                  className="mb-1.5 shrink-0 rounded p-1.5 text-ink-soft transition-colors hover:bg-surface-high hover:text-red-700"
                >
                  <Trash size={15} />
                </button>
              </div>
              {pieDeFila && <div className="mt-1 pl-1 text-xs text-ink-soft">{pieDeFila(a)}</div>}
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-end">
        <button
          type="button"
          disabled={deshabilitarAgregar}
          aria-describedby={motivoDeshabilitarAgregar}
          onClick={() =>
            onChange([...filas, { serviceProviderId: "", paymentType: "", rate: "" }])
          }
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-surface-highest disabled:text-ink-soft"
        >
          <Plus size={15} />
          Agregar proveedora
        </button>
      </div>
    </div>
  );
}
