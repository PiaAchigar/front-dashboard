import { Field, TextInput } from "./form";

/**
 * "Semanas para usarlo": el plazo que tiene la clienta, contado desde la compra.
 *
 * Lo comparten los tres formularios que tienen plazo (combo, pack y pack de
 * depilación) para que lo expliquen igual. El (?) es el mismo globo de `Field`,
 * así que se comporta como el resto de las ayudas del dashboard.
 *
 * `obligatorio`: en combos y packs el plazo es obligatorio, y "si lo dejás
 * vacío, no vence" sería mentira; en depilación sí vale, y se muestra.
 */
export function CampoDePlazo({
  valor,
  onChange,
  obligatorio,
}: {
  valor: string;
  onChange: (valor: string) => void;
  obligatorio: boolean;
}) {
  const ayuda = [
    "El plazo empieza a contar el día de la compra, no el del primer turno.",
    "Va en semanas. Por ejemplo, 4 sesiones semanales → 5 semanas.",
    obligatorio ? null : "Si lo dejás vacío, no vence.",
    "Si una clienta necesita más tiempo, se lo podés aplazar desde su ficha en el CRM.",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Field label="Semanas para usarlo" help={ayuda}>
      <TextInput
        inputMode="numeric"
        value={valor}
        required={obligatorio}
        onChange={(e) => onChange(e.target.value)}
        placeholder={obligatorio ? "52" : "Vacío = no vence"}
      />
    </Field>
  );
}
