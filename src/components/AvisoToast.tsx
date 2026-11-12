import { useEffect } from "react";
import type { Aviso } from "../hooks/useAvisosDeMensajes";

const DURACION_MS = 6000;

/** Toast de mensaje nuevo: abajo a la derecha, ~6 s, con cruz. Tocarlo abre la conversación. */
export function AvisoToast({
  aviso,
  onAbrir,
  onCerrar,
}: {
  aviso: Aviso | null;
  onAbrir: (conversationId: string) => void;
  onCerrar: () => void;
}) {
  useEffect(() => {
    if (!aviso) return;
    const id = setTimeout(onCerrar, DURACION_MS);
    return () => clearTimeout(id);
  }, [aviso, onCerrar]);

  if (!aviso) return null;
  return (
    <div
      role="status"
      className="fixed right-4 bottom-4 z-50 flex max-w-sm items-start gap-2 rounded border border-surface-highest bg-surface-low py-3 pr-2 pl-4 shadow-lg"
    >
      <button
        type="button"
        onClick={() => {
          onAbrir(aviso.conversationId);
          onCerrar();
        }}
        className="text-ink flex-1 text-left font-sans text-sm hover:text-primary"
      >
        {aviso.texto}
      </button>
      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar aviso"
        className="text-ink-soft h-6 w-6 shrink-0 rounded text-lg leading-none hover:bg-surface-high"
      >
        ×
      </button>
    </div>
  );
}
