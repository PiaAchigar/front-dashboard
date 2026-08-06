import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useToast } from "./ui/Toast";
import { Field, TextInput, TextArea, Select } from "./form";
import { apiFetch } from "../lib/api-client";

interface Customer {
  id: string;
  name: string;
  dni: string;
  phone: string | null;
  email: string | null;
}

interface Activity {
  id: string;
  name: string;
}

interface SubscriptionFormProps {
  onSuccess: () => void;
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

export function SubscriptionForm({ onSuccess }: SubscriptionFormProps) {
  const toast = useToast();
  const token = localStorage.getItem("access_token") || "";

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [formData, setFormData] = useState(buildEmptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        setLoadingOptions(true);
        const [customersData, activitiesData] = await Promise.all([
          apiFetch<Customer[]>("/api/billing/customers/", token),
          apiFetch<{ data: Activity[] }>("/api/activities", token),
        ]);
        setCustomers(customersData || []);
        setActivities(activitiesData.data || []);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error desconocido";
        toast.error(`No se pudieron cargar clientes/actividades: ${message}`);
      } finally {
        setLoadingOptions(false);
      }
    };

    loadOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData(buildEmptyForm());
    setFormError(null);
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
          subscriptionEndDate: formData.subscriptionEndDate || null,
          monthlyAmount: parseFloat(formData.monthlyAmount),
          notes: formData.notes.trim() || null,
        }),
      });

      toast.success("Suscripción creada");
      resetForm();
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
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-surface-highest bg-white p-6"
    >
      <h2 className="text-lg font-semibold text-ink">Nueva suscripción</h2>

      {formError && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{formError}</div>
      )}

      <Field label="Cliente *">
        <Select
          name="customerId"
          value={formData.customerId}
          onChange={handleChange}
          disabled={loadingOptions}
          required
        >
          <option value="">
            {loadingOptions ? "Cargando clientes..." : "Seleccionar cliente"}
          </option>
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
          disabled={loadingOptions}
          required
        >
          <option value="">
            {loadingOptions ? "Cargando actividades..." : "Seleccionar actividad"}
          </option>
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
          onClick={resetForm}
          disabled={submitting}
          className="flex-1 rounded-lg border border-surface-high px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-low disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={submitting || loadingOptions || Boolean(validationError)}
          className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
        >
          {submitting ? "Guardando..." : "Crear suscripción"}
        </button>
      </div>
    </form>
  );
}
