import { useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { apiFetch } from "../../lib/api-client";
import type { Customer } from "../../lib/api-types";

type Props = {
  onCreated: (customer: Customer) => void;
  onCancel: () => void;
};

export function QuickCreateCustomer({ onCreated, onCancel }: Props) {
  const { session } = useAuth();
  const token = session?.access_token ?? null;

  const [name, setName] = useState("");
  const [dni, setDni] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{7,8}$/.test(dni)) {
      setError("El DNI debe tener 7 u 8 dígitos");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const customer = await apiFetch<Customer>("/api/billing/customers", token, {
        method: "POST",
        body: JSON.stringify({
          name,
          dni,
          phone: phone || undefined,
          email: email || undefined,
        }),
      });
      onCreated(customer);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear el cliente");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-2 p-3 rounded border border-surface-high bg-surface-low space-y-2"
    >
      <p className="text-xs font-sans font-medium text-ink">Nuevo cliente</p>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-sans text-ink-soft">
            Nombre <span className="text-red-500">*</span>
          </label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full mt-0.5 px-2 py-1.5 text-sm font-sans border border-surface-high rounded bg-white text-ink focus:outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="text-xs font-sans text-ink-soft">
            DNI <span className="text-red-500">*</span>
          </label>
          <input
            required
            value={dni}
            onChange={(e) => setDni(e.target.value)}
            placeholder="12345678"
            className="w-full mt-0.5 px-2 py-1.5 text-sm font-sans border border-surface-high rounded bg-white text-ink focus:outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="text-xs font-sans text-ink-soft">Teléfono</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="11 1234-5678"
            className="w-full mt-0.5 px-2 py-1.5 text-sm font-sans border border-surface-high rounded bg-white text-ink focus:outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="text-xs font-sans text-ink-soft">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full mt-0.5 px-2 py-1.5 text-sm font-sans border border-surface-high rounded bg-white text-ink focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-600 font-sans">{error}</p>}

      <div className="flex gap-2 justify-end pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-sans text-ink-soft hover:text-ink border border-surface-high rounded cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-3 py-1.5 text-xs font-sans bg-primary text-white rounded hover:bg-primary-dark transition-colors disabled:opacity-60 cursor-pointer"
        >
          {loading ? "Guardando..." : "Crear cliente"}
        </button>
      </div>
    </form>
  );
}
