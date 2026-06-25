import type { ReactNode } from "react";

/**
 * Drawer lateral derecho para alta/edición de una entidad. El cuerpo (`children`)
 * son los campos del formulario, controlados por la página consumidora.
 */
export function EntityDrawer({
  open,
  title,
  children,
  error,
  busy = false,
  canSubmit = true,
  submitLabel = "Guardar",
  onSubmit,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  error?: string | null;
  busy?: boolean;
  canSubmit?: boolean;
  submitLabel?: string;
  onSubmit: () => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="modal-scroll fixed inset-0 z-50 flex justify-end bg-ink/40" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col bg-surface-low shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-surface-high px-6 py-4">
          <h3 className="font-display text-xl text-ink">{title}</h3>
        </div>

        <form
          className="flex-1 overflow-y-auto px-6 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <div className="space-y-4">{children}</div>
        </form>

        <div className="shrink-0 border-t border-surface-high px-6 py-4">
          {error && (
            <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              disabled={busy}
              className="rounded-full px-4 py-2 text-sm text-ink-soft transition-colors hover:bg-surface-high disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={onSubmit}
              disabled={busy || !canSubmit}
              className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              {busy ? "Guardando…" : submitLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
