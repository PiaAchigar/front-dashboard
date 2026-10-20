import { useEffect, useState } from "react";
import { Checkbox, Field, Select, TextInput } from "./form";
import { apiFetch } from "../lib/api-client";
import { useToken } from "../hooks/useToken";
import { money } from "../lib/format";

/** Lo que devuelve GET /api/training-subscriptions/:id/cuota?mes= (sin envolver). */
interface CuotaDelMes {
  billingCycleId: string | null;
  mes: string;
  cuota: number;
  pagado: number;
  debe: number;
  isPaid: boolean;
}

type Medio = "cash" | "bank_transfer" | "mercadopago" | "debit_card" | "credit_card";

const MEDIOS: { value: Medio; label: string }[] = [
  { value: "cash", label: "Efectivo" },
  { value: "bank_transfer", label: "Transferencia" },
  { value: "mercadopago", label: "Mercado Pago" },
  { value: "debit_card", label: "Débito" },
  { value: "credit_card", label: "Crédito" },
];

/** Plata con 2 decimales, igual que la API: evita comparar 0.1 + 0.2 a ciegas. */
const redondear = (n: number) => Math.round(n * 100) / 100;

interface CobrarCuotaModalProps {
  subscriptionId: string;
  nombre: string;
  actividad: string;
  /** YYYY-MM */
  mes: string;
  /** Se llama después de un cobro exitoso (para recargar la lista). */
  onCobrado: () => void;
  onClose: () => void;
}

/**
 * Cobro (total o parcial) de la cuota de un mes. El tope es lo que se debe: la API
 * lo vuelve a validar bajo lock, acá solo se evita mandar un cobro que ya sabemos
 * que va a rebotar.
 */
export function CobrarCuotaModal({
  subscriptionId,
  nombre,
  actividad,
  mes,
  onCobrado,
  onClose,
}: CobrarCuotaModalProps) {
  const token = useToken();
  const [cuota, setCuota] = useState<CuotaDelMes | null>(null);
  const [monto, setMonto] = useState("");
  const [medio, setMedio] = useState<Medio>("cash");
  const [conFactura, setConFactura] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vigente = true;
    apiFetch<CuotaDelMes>(`/api/training-subscriptions/${subscriptionId}/cuota?mes=${mes}`, token)
      .then((c) => {
        if (!vigente) return;
        setCuota(c);
        setMonto(String(c.debe));
      })
      .catch((err) => {
        if (vigente) setError(err instanceof Error ? err.message : "Error desconocido");
      });
    return () => {
      vigente = false;
    };
  }, [subscriptionId, mes, token]);

  const importe = monto.trim() === "" ? NaN : redondear(Number(monto));
  const superaDeuda = cuota !== null && Number.isFinite(importe) && importe > cuota.debe;
  const invalido = !Number.isFinite(importe) || importe <= 0;
  const puedeCobrar = cuota !== null && !invalido && !superaDeuda && !enviando;

  const cobrar = async () => {
    if (!puedeCobrar) return;
    setError(null);
    setEnviando(true);
    try {
      await apiFetch(`/api/training-subscriptions/${subscriptionId}/cobrar`, token, {
        method: "POST",
        body: JSON.stringify({ mes, amount: importe, method: medio, wantsInvoice: conFactura }),
      });
      onCobrado();
      onClose();
    } catch (err) {
      // Mensaje de la API tal cual: ya está pensado para quien cobra.
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label="Cobrar cuota"
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-lg bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-lg font-semibold text-ink">Cobrar cuota</h2>
          <p className="text-sm text-ink-soft">
            {nombre} · {actividad} · {mes}
          </p>
        </div>

        {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-900">{error}</div>}

        {cuota ? (
          <div className="space-y-1 rounded-lg border border-surface-high bg-surface-low p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-soft">Cuota</span>
              <span className="text-ink">{money(cuota.cuota)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-soft">Pagado</span>
              <span className="text-ink">{money(cuota.pagado)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span className="text-ink">Debe</span>
              <span className="text-ink">{money(cuota.debe)}</span>
            </div>
          </div>
        ) : (
          !error && <p className="text-sm text-ink-soft">Cargando cuota...</p>
        )}

        <Field label="Monto">
          <TextInput
            type="number"
            min={0}
            step="0.01"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            disabled={cuota === null}
          />
        </Field>
        {superaDeuda && <p className="text-sm text-red-700">No puede superar lo que debe</p>}

        <Field label="Medio de pago">
          <Select value={medio} onChange={(e) => setMedio(e.target.value as Medio)}>
            {MEDIOS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>

        <Checkbox label="Lleva factura" checked={conFactura} onChange={setConFactura} />

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-surface-high px-4 py-2 text-sm font-medium text-ink hover:bg-surface-low"
          >
            Cancelar
          </button>
          <button
            onClick={cobrar}
            disabled={!puedeCobrar}
            className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {enviando ? "Cobrando..." : `Cobrar ${Number.isFinite(importe) ? money(importe) : ""}`.trim()}
          </button>
        </div>
      </div>
    </>
  );
}
