import { useState, useEffect } from "react";

interface Subscription {
  id: string;
  activityId: string;
  customerId: string;
  subscriptionStartDate: string;
  subscriptionEndDate?: string | null;
  status: "active" | "paused" | "cancelled";
  monthlyAmount: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SubscriptionTableProps {
  customerId: string;
  refreshTrigger?: number;
  onSelectSubscription?: (subscriptionId: string) => void;
}

export function SubscriptionTable({
  customerId,
  refreshTrigger = 0,
  onSelectSubscription,
}: SubscriptionTableProps) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSubscriptions = async () => {
      try {
        setLoading(true);
        setError(null);
        const apiUrl = import.meta.env.VITE_API_URL as string;
        const response = await fetch(
          `${apiUrl}/api/training-subscriptions?customerId=${encodeURIComponent(customerId)}`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
            },
          }
        );

        if (!response.ok) throw new Error("Failed to fetch subscriptions");

        const json = await response.json();
        setSubscriptions(json.data || []);
      } catch (err) {
        console.error("Error fetching subscriptions:", err);
        setError("Could not load subscriptions");
      } finally {
        setLoading(false);
      }
    };

    fetchSubscriptions();
  }, [customerId, refreshTrigger]);

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "paused":
        return "bg-yellow-100 text-yellow-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return <div className="rounded-lg bg-white p-6 text-center text-ink-soft">Cargando...</div>;
  }

  if (error) {
    return <div className="rounded-lg bg-red-50 p-6 text-sm text-red-700">{error}</div>;
  }

  if (subscriptions.length === 0) {
    return (
      <div className="rounded-lg bg-white p-6 text-center text-ink-soft">
        Sin suscripciones activas
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-surface-highest bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-surface-highest bg-surface-high">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-ink">Actividad ID</th>
            <th className="px-4 py-3 text-left font-semibold text-ink">Fecha de inicio</th>
            <th className="px-4 py-3 text-left font-semibold text-ink">Estado</th>
            <th className="px-4 py-3 text-left font-semibold text-ink">Monto mensual</th>
            <th className="px-4 py-3 text-left font-semibold text-ink">Notas</th>
            <th className="px-4 py-3 text-center font-semibold text-ink">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-highest">
          {subscriptions.map((subscription) => (
            <tr key={subscription.id} className="hover:bg-surface-high">
              <td className="px-4 py-3 font-mono text-xs text-ink-soft">
                {subscription.activityId.slice(0, 8)}...
              </td>
              <td className="px-4 py-3 text-ink">{subscription.subscriptionStartDate}</td>
              <td className="px-4 py-3">
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadgeClass(subscription.status)}`}>
                  {subscription.status}
                </span>
              </td>
              <td className="px-4 py-3 text-ink">${parseFloat(subscription.monthlyAmount).toFixed(2)}</td>
              <td className="px-4 py-3 text-ink-soft text-xs max-w-xs truncate">
                {subscription.notes || "-"}
              </td>
              <td className="px-4 py-3 text-center">
                <button
                  onClick={() => onSelectSubscription?.(subscription.id)}
                  className="text-primary hover:underline text-xs font-medium"
                >
                  Ver asistencia
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
