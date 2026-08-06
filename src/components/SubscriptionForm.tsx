import { useState, type ChangeEvent, type FormEvent } from "react";
import { useToast } from "./ui/Toast";
import { Field, TextInput, TextArea, Select } from "./form";
import { apiFetch } from "../lib/api-client";
import { useToken } from "../hooks/useToken";

/**
 * Alta de suscripción de un cliente a una actividad (Task 7 de
 * planning/subscriptions_admin.md). Se abre como drawer desde
 * SubscriptionsAdminPage, que ya tiene cargados clientes y actividades
 * para los filtros — por eso llegan por props en vez de re-fetchearlos.
 */
interface Customer {
  id: string;
  name: string;
}

interface Activity {
  id: string;
  name: string;
}

interface SubscriptionFormProps {
  customers: Customer[];
  activities: Activity[];
  onSuccess: () => void;
  onClose: () => void;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const todayIso = () => new Date().toISOString().split("T")[0];

const buildEmptyForm = () => ({
  customerId: "",
  activityId: "",
  subscriptionStartDate: todayIso(),
  subscriptionEndDate: "",
  monthlyAmount: "",
  notes: "",
});

export function SubscriptionForm({
  customers,
  activities,
  onSuccess,
  onClose,
}: SubscriptionFormProps) {
  const toast = useToast();
  const token = useToken();

  const [formData, setFormData] = useState(buildEmptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validate = (): string | null => {
    if (!formData.customerId || !UUID_RE.test(formData.customerId)) {
      return "Seleccioná un cliente";
    }
    if (!formData.activityId || !UUID_RE.test(formData.activityId)) {
      return "Seleccioná una actividad";
    }
    if (!formData.subscriptionStartDate) {
      return "La fecha de inicio es obligatoria";
    }
    if (!formData.monthlyAmount) {
      return "El monto mensual es obligatorio";
    }
    const amount = parseFloat(formData.monthlyAmount);
    if (isNaN(amount) || amount <= 0) {
      return "El monto mensual debe ser mayor a 0";
    }
    if (
      formData.subscriptionEndDate &&
      formData.subscriptionEndDate < formData.subscriptionStartDate
    ) {
      return "La fecha de fin no puede ser anterior a la fecha de inicio";
    }
    return null;
  };

  const validationError = validate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (validationError) {
      setFormError(validationError);
      return;
    }

    setFormError(null);
    setSubmitting(true);

    try {
      await apiFetch("/api/training-subscriptions", token, {
        method: "POST",
        body: JSON.stringify({
          customerId: formData.customerId,
          activityId: formData.activityId,
          subscriptionStartDate: formData.subscriptionStartDate,
          // El backend valida /^\d{4}-\d{2}-\d{2}$/ o null: nunca mandar "".
          subscriptionEndDate: formData.subscriptionEndDate || null,
          monthlyAmount: parseFloat(formData.monthlyAmount),
          notes: formData.notes.trim() || null,
        }),
      });

      toast.success("Suscripción creada");
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setFormError(message);
      toast.error(`Error al crear suscripción: ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-surface-high px-6 py-4">
          <h2 className="text-lg font-semibold text-ink">Nueva suscripción</h2>
          <button onClick={onClose} className="text-ink-soft transition-colors hover:text-ink">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {formError && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-900">{formError}</div>
          )}

          <Field label="Cliente *">
            <Select
              name="customerId"
              value={formData.customerId}
              onChange={handleChange}
              required
            >
              <option value="">Seleccionar cliente</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Actividad *">
            <Select
              name="activityId"
              value={formData.activityId}
              onChange={handleChange}
              required
            >
              <option value="">Seleccionar actividad</option>
              {activities.map((activity) => (
                <option key={activity.id} value={activity.id}>
                  {activity.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Fecha de inicio *">
            <TextInput
              type="date"
              name="subscriptionStartDate"
              value={formData.subscriptionStartDate}
              onChange={handleChange}
              required
            />
          </Field>

          <Field label="Fecha de fin">
            <TextInput
              type="date"
              name="subscriptionEndDate"
              value={formData.subscriptionEndDate}
              onChange={handleChange}
            />
          </Field>

          <Field label="Monto mensual ($) *">
            <TextInput
              type="number"
              name="monthlyAmount"
              value={formData.monthlyAmount}
              onChange={handleChange}
              placeholder="0.00"
              step="0.01"
              min="0"
              required
            />
          </Field>

          <Field label="Notas">
            <TextArea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Notas adicionales (opcional)"
              rows={3}
            />
          </Field>

          <div className="flex gap-3 border-t border-surface-high pt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 rounded-lg border border-surface-high px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-low disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || Boolean(validationError)}
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              {submitting ? "Guardando..." : "Crear suscripción"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
