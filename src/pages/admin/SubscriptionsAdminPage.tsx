import { useEffect, useState } from "react";
import { useToast } from "../../components/ui/Toast";
import { SubscriptionTable } from "../../components/SubscriptionTable";
import { SubscriptionDetailsModal } from "../../components/SubscriptionDetailsModal";
import { SubscriptionForm } from "../../components/SubscriptionForm";
import { apiFetch } from "../../lib/api-client";
import { useToken } from "../../hooks/useToken";

/**
 * Fila de la tabla admin de suscripciones a actividades/capacitaciones.
 * Devuelta por GET /api/training-subscriptions/admin/list.
 */
export interface SubscriptionWithAttendance {
  id: string;
  customerId: string;
  activityId: string;
  activityName: string;
  activityType: "class" | "machine";
  classesPerMonth: number;
  subscriptionStartDate: string;
  subscriptionEndDate: string | null;
  monthlyAmount: number;
  status: "active" | "paused" | "cancelled";
  notes: string | null;
  /** Clases a las que el cliente realmente fue (tildadas desde la Agenda) */
  attendedThisMonth: number;
  /** Clases agendadas vigentes este mes — consumen cupo aunque no hayan ocurrido */
  scheduledThisMonth: number;
  /** Cupo del plan que queda por agendar: classesPerMonth - scheduledThisMonth */
  classesRemainingThisMonth: number;
  paidDate: string | null;
  paidStatus: "paid" | "pending" | "overdue";
  customerName: string;
}

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

interface SubscriptionFilters {
  clientId: string;
  activityId: string;
  paidStatus: string;
  status: string;
}

const EMPTY_FILTERS: SubscriptionFilters = {
  clientId: "",
  activityId: "",
  paidStatus: "",
  status: "",
};

const SELECT_CLASSNAME =
  "rounded-lg border border-surface-high px-3 py-2 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-50";

export function SubscriptionsAdminPage() {
  const toast = useToast();
  const [subscriptions, setSubscriptions] = useState<SubscriptionWithAttendance[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SubscriptionFilters>(EMPTY_FILTERS);
  const [selectedSubscription, setSelectedSubscription] =
    useState<SubscriptionWithAttendance | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const token = useToken();

  const fetchCustomers = async () => {
    try {
      // Sin ?limit la API devuelve solo los 20 clientes más recientes (default
      // pensado para el autocompletar del facturador). Acá el selector tiene que
      // listarlos a todos.
      const data = await apiFetch<Customer[]>("/api/billing/customers/?limit=1000", token);
      setCustomers(data || []);
    } catch (err) {
      console.error("Error loading customers:", err);
    }
  };

  const fetchActivities = async () => {
    try {
      const data = await apiFetch<{ data: Activity[] }>("/api/activities", token);
      setActivities(data.data || []);
    } catch (err) {
      console.error("Error loading activities:", err);
    }
  };

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.activityId) params.set("activityId", filters.activityId);
      if (filters.status) params.set("status", filters.status);
      if (filters.paidStatus) params.set("paidStatus", filters.paidStatus);
      const qs = params.toString();

      const data = await apiFetch<{ success: boolean; data: SubscriptionWithAttendance[] }>(
        `/api/training-subscriptions/admin/list${qs ? `?${qs}` : ""}`,
        token,
      );

      let rows = data.data || [];
      // El endpoint admin/list todavía no soporta filtrar por cliente (ver Task 2 del plan),
      // así que ese filtro se aplica acá hasta que el backend lo incorpore.
      if (filters.clientId) {
        rows = rows.filter((sub) => sub.customerId === filters.clientId);
      }

      setSubscriptions(rows);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
      toast.error(`Error: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  // `token` va en las deps: RequireAuth ya garantiza sesión antes de montar
  // esta página, pero Supabase renueva el token cada hora y ahí el valor cambia.
  useEffect(() => {
    fetchCustomers();
    fetchActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    fetchSubscriptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, token]);

  const handleFilterChange = (filterName: keyof SubscriptionFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [filterName]: value }));
  };

  const handleSelectSubscription = (sub: SubscriptionWithAttendance) => {
    setSelectedSubscription(sub);
  };

  const handleCreateSuccess = () => {
    setDrawerOpen(false);
    fetchSubscriptions();
  };

  if (error) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-lg bg-red-50 p-4 text-red-900">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 p-2 pl-4 sm:p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-ink">Suscripciones</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Gestiona las suscripciones de clientes a actividades y capacitaciones.
          </p>
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
        >
          + Agregar
        </button>
      </div>

      {/* Subnav de filtros — separado de la tabla */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-surface-high bg-surface-low p-3">
        <select
          value={filters.clientId}
          disabled={Boolean(filters.activityId)}
          onChange={(e) => handleFilterChange("clientId", e.target.value)}
          className={SELECT_CLASSNAME}
          title={filters.activityId ? "Deseleccioná Actividad para filtrar por Cliente" : undefined}
        >
          <option value="">Cliente: todos</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={filters.activityId}
          onChange={(e) => handleFilterChange("activityId", e.target.value)}
          className={SELECT_CLASSNAME}
        >
          <option value="">Actividad: todas</option>
          {activities.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>

        <select
          value={filters.paidStatus}
          onChange={(e) => handleFilterChange("paidStatus", e.target.value)}
          className={SELECT_CLASSNAME}
        >
          <option value="">Estado de pago: todos</option>
          <option value="paid">Pagado</option>
          <option value="pending">Pendiente</option>
          <option value="overdue">Vencido</option>
        </select>

        <select
          value={filters.status}
          onChange={(e) => handleFilterChange("status", e.target.value)}
          className={SELECT_CLASSNAME}
        >
          <option value="">Estado: todos</option>
          <option value="active">Activa</option>
          <option value="paused">Pausada</option>
          <option value="cancelled">Cancelada</option>
        </select>
      </div>

      <div className="modal-scroll min-h-0 flex-1 overflow-auto rounded-lg border border-surface-high bg-white">
        {loading ? (
          <div className="p-6 text-center text-ink-soft">Cargando suscripciones...</div>
        ) : (
          <SubscriptionTable
            subscriptions={subscriptions}
            onSelectSubscription={handleSelectSubscription}
            onRefresh={fetchSubscriptions}
          />
        )}
      </div>

      {selectedSubscription && (
        <SubscriptionDetailsModal
          subscription={selectedSubscription}
          onClose={() => setSelectedSubscription(null)}
          onUpdate={fetchSubscriptions}
        />
      )}

      {drawerOpen && (
        <SubscriptionForm
          customers={customers}
          activities={activities}
          onSuccess={handleCreateSuccess}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </div>
  );
}
