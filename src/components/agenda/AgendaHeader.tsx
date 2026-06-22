import { useProviders } from "../../hooks/useProviders";
import { useServices } from "../../hooks/useServices";
import {
  addDays,
  formatDayLabel,
  formatWeekLabel,
  formatMonthLabel,
} from "../../lib/agenda-utils";

export type AgendaView = "day" | "week" | "month";

type Props = {
  date: Date;
  view: AgendaView;
  filterProviderId: string | null;
  filterServiceId: string | null;
  onDateChange: (date: Date) => void;
  onViewChange: (view: AgendaView) => void;
  onFilterProviderChange: (id: string | null) => void;
  onFilterServiceChange: (id: string | null) => void;
  onNewAppointment: () => void;
};

const VIEWS: { key: AgendaView; label: string }[] = [
  { key: "day", label: "Día" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
];

export function AgendaHeader({
  date,
  view,
  filterProviderId,
  filterServiceId,
  onDateChange,
  onViewChange,
  onFilterProviderChange,
  onFilterServiceChange,
  onNewAppointment,
}: Props) {
  const { data: providers = [] } = useProviders();
  const { data: services = [] } = useServices();

  function navigate(direction: -1 | 1) {
    if (view === "day") {
      onDateChange(addDays(date, direction));
    } else if (view === "week") {
      onDateChange(addDays(date, direction * 7));
    } else {
      const d = new Date(date);
      d.setMonth(d.getMonth() + direction);
      onDateChange(d);
    }
  }

  function goToday() {
    onDateChange(new Date());
  }

  function getLabel() {
    if (view === "day") return formatDayLabel(date);
    if (view === "week") return formatWeekLabel(date);
    return formatMonthLabel(date);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 px-6 py-3 bg-white border-b border-surface-high">
      {/* Navegación de fecha */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 rounded hover:bg-surface text-ink-soft hover:text-ink transition-colors cursor-pointer"
          aria-label="Anterior"
        >
          ‹
        </button>
        <button
          onClick={goToday}
          className="px-2.5 py-1 text-xs font-sans font-medium rounded border border-surface-high hover:bg-surface transition-colors cursor-pointer"
        >
          Hoy
        </button>
        <button
          onClick={() => navigate(1)}
          className="p-1.5 rounded hover:bg-surface text-ink-soft hover:text-ink transition-colors cursor-pointer"
          aria-label="Siguiente"
        >
          ›
        </button>
      </div>

      {/* Etiqueta de fecha */}
      <span className="font-sans text-sm font-medium text-ink capitalize min-w-48">
        {getLabel()}
      </span>

      {/* Toggle de vista */}
      <div className="flex rounded border border-surface-high overflow-hidden ml-auto">
        {VIEWS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onViewChange(key)}
            className={
              "px-3 py-1.5 text-xs font-sans font-medium transition-colors cursor-pointer " +
              (view === key
                ? "bg-primary text-white"
                : "bg-white text-ink-soft hover:bg-surface")
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filtro Prestadora */}
      <select
        value={filterProviderId ?? ""}
        onChange={(e) => onFilterProviderChange(e.target.value || null)}
        className="px-2.5 py-1.5 text-xs font-sans border border-surface-high rounded bg-white text-ink focus:outline-none focus:border-primary cursor-pointer"
      >
        <option value="">Todas las prestadoras</option>
        {providers.map((p) => (
          <option key={p.id} value={p.id}>
            {p.fullName}
          </option>
        ))}
      </select>

      {/* Filtro Servicio */}
      <select
        value={filterServiceId ?? ""}
        onChange={(e) => onFilterServiceChange(e.target.value || null)}
        className="px-2.5 py-1.5 text-xs font-sans border border-surface-high rounded bg-white text-ink focus:outline-none focus:border-primary cursor-pointer"
      >
        <option value="">Todos los servicios</option>
        {services.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      {/* Nuevo turno */}
      <button
        onClick={onNewAppointment}
        className="px-3 py-1.5 bg-primary text-white text-xs font-sans font-medium rounded hover:bg-primary-dark transition-colors cursor-pointer"
      >
        + Nuevo turno
      </button>
    </div>
  );
}
