import { useMemo, useState } from "react";
import { Toggle } from "../../components/Toggle";
import { Search } from "../../components/icons";
import { useToast } from "../../components/ui/Toast";
import { useServicesAdmin, useUpdateServiceAdmin } from "../../hooks/useServicesAdmin";
import { useTrainingsAdmin, useUpdateTrainingWeb } from "../../hooks/useTrainingsWeb";

export function VisiblesWebPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");

  const { data: services = [], isLoading: loadingServices } = useServicesAdmin(false);
  const { data: trainings = [], isLoading: loadingTrainings } = useTrainingsAdmin();
  const updateService = useUpdateServiceAdmin();
  const updateTraining = useUpdateTrainingWeb();

  const q = search.trim().toLowerCase();
  const filteredServices = useMemo(
    () => (q ? services.filter((s) => (s.name ?? "").toLowerCase().includes(q)) : services),
    [services, q],
  );
  const filteredTrainings = useMemo(
    () => (q ? trainings.filter((t) => (t.name ?? "").toLowerCase().includes(q)) : trainings),
    [trainings, q],
  );

  return (
    <div className="modal-scroll h-full overflow-y-auto p-2 pl-4 sm:p-4">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar servicio o capacitación…"
            className="w-full rounded-lg border border-surface-highest bg-white py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-primary"
          />
        </div>

        <Section
          title="Servicios"
          subtitle="Aparecen en el catálogo de servicios de la web pública."
          loading={loadingServices}
          rows={filteredServices.map((s) => ({
            id: s.id,
            name: s.name ?? "—",
            visible: !!s.isVisible,
          }))}
          busy={updateService.isPending}
          onToggle={(id, visible) =>
            updateService.mutate(
              { id, isVisible: visible },
              {
                onSuccess: () => toast.success(visible ? "Servicio visible" : "Servicio oculto"),
                onError: (e: Error) => toast.error(e.message),
              },
            )
          }
        />

        <Section
          title="Capacitaciones"
          subtitle="Aparecen en la sección de capacitaciones de la web pública."
          loading={loadingTrainings}
          rows={filteredTrainings.map((t) => ({
            id: t.id,
            name: t.name ?? "—",
            visible: !!t.isVisible,
          }))}
          busy={updateTraining.isPending}
          onToggle={(id, visible) =>
            updateTraining.mutate(
              { id, isVisible: visible },
              {
                onSuccess: () =>
                  toast.success(visible ? "Capacitación visible" : "Capacitación oculta"),
                onError: (e: Error) => toast.error(e.message),
              },
            )
          }
        />
      </div>
    </div>
  );
}

type Row = { id: string; name: string; visible: boolean };

function Section({
  title,
  subtitle,
  loading,
  rows,
  busy,
  onToggle,
}: {
  title: string;
  subtitle: string;
  loading: boolean;
  rows: Row[];
  busy: boolean;
  onToggle: (id: string, visible: boolean) => void;
}) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="font-display text-lg text-ink">{title}</h2>
        <p className="mt-0.5 text-xs text-ink-soft">{subtitle}</p>
      </div>
      {loading ? (
        <p className="text-sm text-ink-soft">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-ink-soft">No hay elementos.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-surface-high">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-surface-high">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium text-ink">{r.name}</td>
                  <td className="w-24 px-4 py-3">
                    <div className="flex justify-end">
                      <Toggle
                        active={r.visible}
                        disabled={busy}
                        onChange={(v) => onToggle(r.id, v)}
                        label={r.visible ? "Ocultar" : "Mostrar"}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
