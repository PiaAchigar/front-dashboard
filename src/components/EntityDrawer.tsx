import type { ReactNode } from "react";
import { X } from "./icons";

/**
 * Drawer lateral derecho para alta/edición de una entidad. El cuerpo (`children`)
 * son los campos del formulario, controlados por la página consumidora.
 *
 * Un clic afuera NO lo cierra: un clic de más le borraba a Laura lo que venía
 * cargando (pedido de Pia, 2026-11-06). Se sale por la X, por Cancelar o
 * guardando.
 */
export function EntityDrawer({
  open,
  title,
  children,
  error,
  busy = false,
  canSubmit = true,
  submitLabel = "Guardar",
  widthClass = "max-w-xl",
  readOnly = false,
  faltante = null,
  headerAction,
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
  /**
   * Ancho máximo del panel (clase Tailwind).
   *
   * El default (`max-w-xl`, 576px) es el piso cómodo para un formulario
   * corriente. Los formularios largos —Servicios, Combos, Packs— piden
   * `max-w-2xl`: a 448px, que era el default viejo, los campos entraban tan
   * apretados que costaba leer y escribir (pedido de Pia, 2026-09-10).
   */
  widthClass?: string;
  /** Modo solo lectura: oculta Cancelar/Guardar y muestra solo "Cerrar". */
  readOnly?: boolean;
  /** Nodo opcional a la derecha del título (ej. botón "Editar"). */
  headerAction?: ReactNode;
  onSubmit: () => void;
  /**
   * Qué falta para poder guardar. Se muestra sólo mientras el botón está
   * apagado.
   *
   * Un botón deshabilitado sin explicación es una pared: quien carga ve que no
   * puede seguir y no tiene forma de saber qué le falta, sobre todo en un
   * formulario largo donde el campo vacío quedó fuera de la pantalla. Pasó con
   * el alta de combos (2026-09-10).
   */
  faltante?: string | null;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="modal-scroll fixed inset-0 z-50 flex justify-end bg-ink/40">
      {/* `role="dialog"` + `aria-modal`: es un modal de verdad —tapa la pantalla
          y atrapa el click— y sin el rol un lector de pantalla lo anuncia como
          un bloque más de la página, sin decir que lo de atrás quedó inerte.
          `aria-label` lo nombra con su propio título. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex h-full w-full ${widthClass} flex-col bg-surface-low shadow-xl`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-surface-high px-6 py-4">
          <h3 className="font-display text-xl text-ink">{title}</h3>
          <div className="flex shrink-0 items-center gap-2">
            {headerAction}
            <button
              type="button"
              aria-label="Cerrar"
              onClick={onClose}
              disabled={busy}
              className="rounded-full p-1.5 text-ink-soft transition-colors hover:bg-surface-high hover:text-ink disabled:opacity-50"
            >
              <X size={18} />
            </button>
          </div>
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
          {!readOnly && !canSubmit && faltante && (
            <p className="mb-2 text-xs text-ink-soft">Falta {faltante}.</p>
          )}
          <div className="flex justify-end gap-2">
            {readOnly ? (
              <button
                onClick={onClose}
                className="rounded-full px-5 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-high"
              >
                Cerrar
              </button>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
