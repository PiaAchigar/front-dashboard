import type { ReactNode } from "react";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-ink/40 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-surface-low p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-lg text-ink">{title}</h3>
        <div className="mt-2 text-sm text-ink-soft">{message}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-full px-4 py-2 text-sm text-ink-soft transition-colors hover:bg-surface-high disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-full px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 ${
              danger ? "bg-red-700 hover:bg-red-800" : "bg-primary hover:bg-primary-dark"
            }`}
          >
            {busy ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
