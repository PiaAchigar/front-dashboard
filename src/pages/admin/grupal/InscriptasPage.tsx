import { useEffect, useState } from "react";
import { Field, Select } from "../../../components/form";
import { useInscriptas } from "../../../hooks/useInscriptas";
import { useTrainingsAdmin } from "../../../hooks/useTrainingsAdmin";
import { formatDateTimeToDate, money } from "../../../lib/format";

const TH = "px-3 py-2 text-left text-xs font-medium text-ink-soft";
const TD = "px-3 py-2 text-sm text-ink";

/**
 * Solapa Inscriptas de Capacitaciones: quiénes compraron cada capacitación, cuánto
 * les falta pagar y en cuántos encuentros están anotadas. Sólo lectura: anotar y
 * sacar llegan con la entrega 2.
 */
export function InscriptasPage() {
  const { data: capacitaciones = [] } = useTrainingsAdmin(false);
  const [capId, setCapId] = useState("");
  // Hasta que elige una, queda la primera.
  useEffect(() => {
    if (!capId && capacitaciones.length > 0) setCapId(capacitaciones[0].id);
  }, [capacitaciones, capId]);

  const { data: inscriptas = [], isLoading, error } = useInscriptas(capId || null);

  return (
    <div className="px-4 py-4 sm:px-6">
      <div className="mb-4 max-w-sm">
        <Field label="Capacitación">
          <Select value={capId} onChange={(e) => setCapId(e.target.value)}>
            {capacitaciones.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {error && <p className="mb-3 text-sm text-red-700">{(error as Error).message}</p>}

      <div className="overflow-x-auto rounded-xl border border-surface-high">
        <table className="w-full">
          <thead className="bg-surface-low">
            <tr>
              <th className={TH}>Nombre</th>
              <th className={TH}>Comprada el</th>
              <th className={TH}>Debe</th>
              <th className={TH}>Encuentros</th>
            </tr>
          </thead>
          <tbody>
            {inscriptas.map((i) => (
              <tr key={i.customerPurchaseId} className="border-t border-surface-high">
                <td className={TD}>{i.nombre}</td>
                <td className={TD}>{formatDateTimeToDate(i.compradaEl)}</td>
                <td className={TD}>
                  {i.debe > 0 ? <span className="text-red-700">{`Debe ${money(i.debe)}`}</span> : "Pagada"}
                </td>
                <td className={TD}>{`${i.encuentrosAnotada} de ${i.encuentrosTotales}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && !error && inscriptas.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-ink-soft">Todavía nadie compró esta capacitación.</p>
        )}
      </div>
    </div>
  );
}
