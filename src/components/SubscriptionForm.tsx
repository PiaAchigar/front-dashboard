import { useState, useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import { Field, TextInput, TextArea, Select } from "./form";

interface Activity {
  id: string;
  name: string;
  description?: string | null;
}

interface SubscriptionFormProps {
  onSuccess: () => void;
}

export function SubscriptionForm({ onSuccess }: SubscriptionFormProps) {
  const { user } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    activityId: "",
    subscriptionStartDate: new Date().toISOString().split("T")[0],
    subscriptionEndDate: "",
    monthlyAmount: "",
    notes: "",
  });

  // Fetch activities on mount
  useEffect(() => {
    const fetchActivities = async () => {
      try {
        setLoading(true);
        const apiUrl = import.meta.env.VITE_API_URL as string;
        const response = await fetch(`${apiUrl}/api/activities`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
          },
        });

        if (!response.ok) throw new Error("Failed to fetch activities");

        const json = await response.json();
        setActivities(json.data || []);
      } catch (err) {
        console.error("Error fetching activities:", err);
        setError("Could not load activities");
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user?.id) {
      setError("Not authenticated. Please log in.");
      return;
    }

    if (!formData.activityId || !formData.monthlyAmount) {
      setError("Activity and monthly amount are required");
      return;
    }

    try {
      setSubmitting(true);
      const apiUrl = import.meta.env.VITE_API_URL as string;

      const body = {
        activityId: formData.activityId,
        customerId: user.id,
        subscriptionStartDate: formData.subscriptionStartDate,
        subscriptionEndDate: formData.subscriptionEndDate ? formData.subscriptionEndDate : null,
        monthlyAmount: parseFloat(formData.monthlyAmount),
        notes: formData.notes || null,
      };

      const response = await fetch(`${apiUrl}/api/training-subscriptions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create subscription");
      }

      // Reset form
      setFormData({
        activityId: "",
        subscriptionStartDate: new Date().toISOString().split("T")[0],
        subscriptionEndDate: "",
        monthlyAmount: "",
        notes: "",
      });

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-surface-highest bg-white p-6">
      <h2 className="text-lg font-semibold text-ink">Nueva Suscripción</h2>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <Field label="Actividad *">
        <Select
          name="activityId"
          value={formData.activityId}
          onChange={handleInputChange}
          disabled={loading}
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
          onChange={handleInputChange}
          required
        />
      </Field>

      <Field label="Fecha de fin">
        <TextInput
          type="date"
          name="subscriptionEndDate"
          value={formData.subscriptionEndDate}
          onChange={handleInputChange}
        />
      </Field>

      <Field label="Monto mensual ($) *">
        <TextInput
          type="number"
          name="monthlyAmount"
          value={formData.monthlyAmount}
          onChange={handleInputChange}
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
          onChange={handleInputChange}
          placeholder="Notas adicionales (opcional)"
          rows={3}
        />
      </Field>

      <button
        type="submit"
        disabled={submitting || loading}
        className="w-full rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90 disabled:bg-surface-highest disabled:text-ink-soft"
      >
        {submitting ? "Guardando..." : "Crear suscripción"}
      </button>
    </form>
  );
}
