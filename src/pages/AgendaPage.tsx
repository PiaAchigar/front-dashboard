import { useMemo, useState } from "react";
import { AgendaHeader, type AgendaView } from "../components/agenda/AgendaHeader";
import { DayView } from "../components/agenda/DayView";
import { WeekView } from "../components/agenda/WeekView";
import { AppointmentModal, type ModalIntent } from "../components/agenda/AppointmentModal";
import { useAgendaAppointments, useInvalidateAppointments } from "../hooks/useAgendaAppointments";
import { useProviders } from "../hooks/useProviders";
import { useCompanyConfig } from "../hooks/useCompanyConfig";
import { buildProviderColorMap } from "../lib/agenda-colors";
import { toLocalDateString } from "../lib/agenda-utils";
import type { Appointment } from "../lib/api-types";

const DEFAULT_OPEN = "09:00";
const DEFAULT_CLOSE = "20:00";

function getTodayForDay(config: ReturnType<typeof useCompanyConfig>["data"], date: Date) {
  const dayOfWeek = date.getDay();
  const hours = config?.openHours.find((h) => h.dayOfWeek === dayOfWeek);
  if (!hours?.isOpen || !hours.openingTime || !hours.closingTime) return null;
  return { open: hours.openingTime.slice(0, 5), close: hours.closingTime.slice(0, 5) };
}

export function AgendaPage() {
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState<AgendaView>("day");
  const [filterProviderId, setFilterProviderId] = useState<string | null>(null);
  const [filterServiceId, setFilterServiceId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalIntent | null>(null);

  const dateStr = toLocalDateString(date);
  const invalidate = useInvalidateAppointments();

  const { data: appointments = [], isLoading: loadingAppts } = useAgendaAppointments(dateStr);
  const { data: providers = [] } = useProviders();
  const { data: config } = useCompanyConfig();

  const colorMap = useMemo(
    () => buildProviderColorMap(providers.map((p) => p.id)),
    [providers],
  );

  const hours = getTodayForDay(config, date);
  const openTime = hours?.open ?? DEFAULT_OPEN;
  const closeTime = hours?.close ?? DEFAULT_CLOSE;

  function handleSlotClick(providerId: string, time: string) {
    setModal({ mode: "create", providerId, date, time });
  }

  function handleAppointmentClick(appointment: Appointment) {
    setModal({ mode: "edit", appointment });
  }

  function handleNewAppointment() {
    const defaultProvider = filterProviderId ?? providers[0]?.id ?? "";
    setModal({ mode: "create", providerId: defaultProvider, date, time: openTime });
  }

  function handleSaved(savedDate: string) {
    invalidate(savedDate);
  }

  function handleDayClick(d: Date) {
    setDate(d);
    setView("day");
  }

  const isClosed = hours === null;

  return (
    <div className="flex flex-col h-full">
      <AgendaHeader
        date={date}
        view={view}
        filterProviderId={filterProviderId}
        filterServiceId={filterServiceId}
        onDateChange={setDate}
        onViewChange={setView}
        onFilterProviderChange={setFilterProviderId}
        onFilterServiceChange={setFilterServiceId}
        onNewAppointment={handleNewAppointment}
      />

      {/* Cuerpo */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {loadingAppts && view === "day" && (
          <p className="text-xs text-ink-soft font-sans text-center py-3">Cargando turnos...</p>
        )}

        {isClosed && view === "day" && (
          <div className="flex items-center justify-center flex-1 text-ink-soft text-sm font-sans">
            El local está cerrado este día
          </div>
        )}

        {!isClosed && view === "day" && (
          <DayView
            appointments={appointments}
            providers={providers}
            colorMap={colorMap}
            filterProviderId={filterProviderId}
            filterServiceId={filterServiceId}
            openTime={openTime}
            closeTime={closeTime}
            onAppointmentClick={handleAppointmentClick}
            onSlotClick={handleSlotClick}
          />
        )}

        {view === "week" && (
          <WeekView
            date={date}
            providers={providers}
            colorMap={colorMap}
            filterProviderId={filterProviderId}
            filterServiceId={filterServiceId}
            onDayClick={handleDayClick}
            onAppointmentClick={handleAppointmentClick}
          />
        )}

        {view === "month" && (
          <div className="flex items-center justify-center flex-1 text-ink-soft text-sm font-sans">
            Vista mensual — próximamente
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <AppointmentModal
          intent={modal}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
