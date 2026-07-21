import { useState } from "react";
import { ExceptionsTab } from "./ExceptionsTab";
import { SaturdaysTab } from "./SaturdaysTab";
import { WeeklyAvailabilityTab } from "./WeeklyAvailabilityTab";

type Tab = "weekly" | "saturdays" | "exceptions";

const TABS: { key: Tab; label: string }[] = [
  { key: "weekly", label: "Semanal" },
  { key: "saturdays", label: "Sábados" },
  { key: "exceptions", label: "Excepciones" },
];

export function AvailabilityPanel({
  open,
  providerId,
  providerName,
  readOnly,
  onClose,
}: {
  open: boolean;
  providerId: string;
  providerName: string;
  readOnly: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("weekly");
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-3xl flex-col bg-surface-low shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-surface-high px-6 py-4">
          <h3 className="font-display text-xl text-ink">Disponibilidad — {providerName}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-1.5 text-sm text-ink-soft transition-colors hover:bg-surface-high"
          >
            Cerrar
          </button>
        </div>

        <div className="flex shrink-0 gap-2 border-b border-surface-high px-6 py-3">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === t.key ? "bg-primary text-white" : "text-ink-soft hover:bg-surface-high"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="modal-scroll flex-1 overflow-y-auto px-6 py-4">
          {tab === "weekly" && <WeeklyAvailabilityTab providerId={providerId} readOnly={readOnly} />}
          {tab === "saturdays" && <SaturdaysTab providerId={providerId} readOnly={readOnly} />}
          {tab === "exceptions" && <ExceptionsTab providerId={providerId} readOnly={readOnly} />}
        </div>
      </div>
    </div>
  );
}
