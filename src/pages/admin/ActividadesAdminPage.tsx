import { useEffect, useState } from "react";
import { useToast } from "../../components/ui/Toast";
import { Checkbox, Field, TextArea, TextInput } from "../../components/form";
import { Trash, Archive, Pencil } from "../../components/icons";
import { apiFetch } from "../../lib/api-client";
import { useToken } from "../../hooks/useToken";

interface Activity {
  id: string;
  name: string;
  description: string | null;
  activityType: "class" | "machine";
  serviceProviderId: string | null;
  classesPerMonth: number;
  monthlyBasePrice: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

type Form = {
  name: string;
  description: string;
  activity_type: "class" | "machine";
  service_provider_id: string | null;
  classes_per_month: string;
  monthly_base_price: string;
  is_active: boolean;
};

interface ServiceProvider {
  id: string;
  name: string;
}

const EMPTY_FORM: Form = {
  name: "",
  description: "",
  activity_type: "class",
  service_provider_id: null,
  classes_per_month: "0",
  monthly_base_price: "0",
  is_active: true,
};

export function ActividadesAdminPage() {
  const toast = useToast();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [serviceProviders, setServiceProviders] = useState<ServiceProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const token = useToken();

  const fetchServiceProviders = async () => {
    try {
      const data = await apiFetch<{ data: ServiceProvider[] }>("/api/agenda/providers", token);
      setServiceProviders(data.data || []);
    } catch (err) {
      console.error("Error loading service providers:", err);
    }
  };

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const data = await apiFetch<{ data: Activity[] }>("/api/activities", token);
      setActivities(data.data || []);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
      toast.error(`Error: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServiceProviders();
    fetchActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setDrawerOpen(true);
  };

  const openEdit = (activity: Activity) => {
    setEditing(activity);
    setForm({
      name: activity.name,
      description: activity.description || "",
      activity_type: activity.activityType,
      service_provider_id: activity.serviceProviderId,
      classes_per_month: String(activity.classesPerMonth),
      monthly_base_price: String(activity.monthlyBasePrice),
      is_active: activity.isActive,
    });
    setFormError(null);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  };

  const handleSave = async () => {
    setFormError(null);

    if (!form.name.trim()) {
      setFormError("El nombre es obligatorio");
      return;
    }

    const classesPerMonth = parseInt(form.classes_per_month, 10);
    const price = parseFloat(form.monthly_base_price);

    if (isNaN(classesPerMonth) || classesPerMonth < 0) {
      setFormError("Clases/mes debe ser un número >= 0");
      return;
    }

    if (isNaN(price) || price < 0) {
      setFormError("El precio debe ser un número >= 0");
      return;
    }

    if (form.activity_type === "class" && !form.service_provider_id) {
      setFormError("Debes seleccionar una proveedora para actividades de tipo clase");
      return;
    }

    setSubmitting(true);
    try {
      const url = editing ? `/api/activities/${editing.id}` : "/api/activities";
      const method = editing ? "PATCH" : "POST";
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        activityType: form.activity_type,
        serviceProviderId: form.service_provider_id || null,
        classesPerMonth: classesPerMonth,
        monthlyBasePrice: price,
      };

      await apiFetch<Activity>(url, token, {
        method,
        body: JSON.stringify(payload),
      });

      toast.success(editing ? "Actividad actualizada" : "Actividad creada");
      closeDrawer();
      await fetchActivities();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (id: string) => {
    if (!confirm("¿Archivar esta actividad?")) return;

    try {
      await apiFetch<Activity>(`/api/activities/${id}`, token, {
        method: "DELETE",
      });

      toast.success("Actividad archivada");
      await fetchActivities();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      toast.error(`Error al archivar: ${message}`);
    }
  };

  const handleHardDelete = async (id: string, name: string) => {
    const confirmed = window.confirm(
      `⚠️ ELIMINAR PERMANENTEMENTE\n\n"${name}"\n\nEsta acción NO se puede deshacer. ¿Estás seguro?`
    );
    if (!confirmed) return;

    try {
      await apiFetch<{ id: string }>(`/api/activities/${id}/hard`, token, {
        method: "DELETE",
      });

      toast.success("Actividad eliminada permanentemente");
      await fetchActivities();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      toast.error(`Error al eliminar: ${message}`);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="text-center text-ink-soft">Cargando actividades...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-lg bg-red-50 p-4 text-red-900">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 p-2 pl-4 sm:p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-ink">Actividades</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Gestiona las actividades mensuales (Pilates, Yoga, máquinas, etc.)
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
        >
          + Agregar
        </button>
      </div>

      <div className="modal-scroll min-h-0 flex-1 overflow-auto rounded-lg border border-surface-high bg-white">
        {activities.length === 0 ? (
          <div className="p-6 text-center text-ink-soft">
            No hay actividades registradas.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-high bg-surface-low sticky top-0">
                <th className="px-6 py-3 text-left font-medium text-ink">Actividad</th>
                <th className="px-6 py-3 text-left font-medium text-ink">Tipo</th>
                <th className="px-6 py-3 text-left font-medium text-ink">Clases/Mes</th>
                <th className="px-6 py-3 text-left font-medium text-ink">Precio Mensual</th>
                <th className="px-6 py-3 text-left font-medium text-ink">Estado</th>
                <th className="px-6 py-3 text-left font-medium text-ink">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-high">
              {activities.map((activity) => (
                <tr key={activity.id} className="hover:bg-surface-low">
                  <td className="px-6 py-3">
                    <span className="font-medium text-ink">{activity.name}</span>
                    {activity.description && (
                      <div className="text-xs text-ink-soft mt-1">{activity.description}</div>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                      activity.activityType === "class"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-purple-100 text-purple-700"
                    }`}>
                      {activity.activityType === "class" ? "Clase" : "Máquina"}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-ink-soft">
                    {activity.activityType === "machine" ? "—" : activity.classesPerMonth ?? "—"}
                  </td>
                  <td className="px-6 py-3 text-ink-soft">
                    ${activity.monthlyBasePrice != null ? activity.monthlyBasePrice.toLocaleString("es-AR") : "—"}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                      activity.isActive
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-700"
                    }`}>
                      {activity.isActive ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEdit(activity)}
                        title="Editar"
                        className="rounded p-1.5 text-ink-soft transition-colors hover:bg-surface-high hover:text-blue-700"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleArchive(activity.id)}
                        title="Archivar"
                        className="rounded p-1.5 text-ink-soft transition-colors hover:bg-surface-high hover:text-orange-700"
                      >
                        <Archive size={16} />
                      </button>
                      <button
                        onClick={() => handleHardDelete(activity.id, activity.name)}
                        title="Eliminar permanentemente"
                        className="rounded p-1.5 text-ink-soft transition-colors hover:bg-surface-high hover:text-red-700"
                      >
                        <Trash size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Drawer Modal */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={closeDrawer}
            aria-hidden
          />

          {/* Drawer */}
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-surface-high px-6 py-4">
              <h2 className="text-lg font-semibold text-ink">
                {editing ? "Editar Actividad" : "Nueva Actividad"}
              </h2>
              <button
                onClick={closeDrawer}
                className="text-ink-soft transition-colors hover:text-ink"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6 p-6">
              {formError && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-900">
                  {formError}
                </div>
              )}

              <Field label="Nombre *">
                <TextInput
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Pilates, Yoga, etc."
                />
              </Field>

              <Field label="Descripción">
                <TextArea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Detalles opcionales..."
                  rows={3}
                />
              </Field>

              <Field label="Tipo *">
                {editing ? (
                  <div className="rounded-lg border border-surface-high bg-surface-low px-4 py-2">
                    <p className="text-sm text-ink">
                      {form.activity_type === "class" ? "Clase" : "Máquina"}
                    </p>
                    <p className="mt-1 text-xs text-ink-soft">(No editable después de crear)</p>
                  </div>
                ) : (
                  <select
                    value={form.activity_type}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        activity_type: e.target.value as "class" | "machine",
                        classes_per_month: e.target.value === "machine" ? "0" : form.classes_per_month,
                      })
                    }
                    className="rounded-lg border border-surface-high px-3 py-2 text-sm text-ink"
                  >
                    <option value="class">Clase</option>
                    <option value="machine">Máquina</option>
                  </select>
                )}
              </Field>

              {form.activity_type === "class" && (
                <Field label="Proveedora *">
                  <select
                    value={form.service_provider_id || ""}
                    onChange={(e) => setForm({ ...form, service_provider_id: e.target.value || null })}
                    className="rounded-lg border border-surface-high px-3 py-2 text-sm text-ink"
                  >
                    <option value="">Seleccionar proveedora...</option>
                    {serviceProviders.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              {form.activity_type === "class" && (
                <Field label="Clases por mes *">
                  <TextInput
                    type="number"
                    inputMode="numeric"
                    value={form.classes_per_month}
                    onChange={(e) => setForm({ ...form, classes_per_month: e.target.value })}
                    min="1"
                    placeholder="4"
                  />
                </Field>
              )}

              <Field label="Precio Mensual ($) *">
                <TextInput
                  type="number"
                  inputMode="decimal"
                  value={form.monthly_base_price}
                  onChange={(e) => setForm({ ...form, monthly_base_price: e.target.value })}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                />
              </Field>

              <div className="flex items-center gap-3">
                <Checkbox
                  label="Activa"
                  checked={form.is_active}
                  onChange={(checked) => setForm({ ...form, is_active: checked })}
                />
              </div>

              <div className="flex gap-3 border-t border-surface-high pt-6">
                <button
                  onClick={closeDrawer}
                  className="flex-1 rounded-lg border border-surface-high px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-low"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
                >
                  {submitting ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
