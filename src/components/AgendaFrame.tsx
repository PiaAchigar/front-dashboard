import { useCallback, useEffect, useRef } from "react";
import { useAuth } from "../auth/AuthContext";

/**
 * Embebe la app `front-agenda` (proyecto independiente) por <iframe> y le pasa
 * el access token del staff por `postMessage` (handshake acotado por origin).
 *
 * Protocolo:
 *   iframe → host : { type: "piubella:agenda:ready" }
 *   host  → iframe: { type: "piubella:agenda:token", accessToken }
 * El host SOLO envía el token después del "ready": antes de que el iframe cargue
 * front-agenda, su `contentWindow` está en `about:blank` (origin del padre) y un
 * postMessage con targetOrigin de la agenda fallaría.
 */
const AGENDA_URL = import.meta.env.VITE_AGENDA_URL as string | undefined;
const READY_MSG = "piubella:agenda:ready";
const TOKEN_MSG = "piubella:agenda:token";

/** Origin de la URL de la agenda, o null si la env falta o es inválida. */
function agendaOriginOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function AgendaFrame() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const agendaOrigin = agendaOriginOf(AGENDA_URL);

  // Flag de "iframe listo" — solo se escribe en el handler, nunca en render.
  const readyRef = useRef(false);

  // Envía el token al iframe — solo si ya avisó "ready" y hay token.
  const sendToken = useCallback(() => {
    if (!agendaOrigin || !readyRef.current || !token) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: TOKEN_MSG, accessToken: token },
      agendaOrigin,
    );
  }, [agendaOrigin, token]);

  // Escucha el "ready" del iframe y responde con el token actual.
  useEffect(() => {
    if (!agendaOrigin) return;
    function onMessage(e: MessageEvent) {
      if (e.origin !== agendaOrigin) return;
      const data = e.data as { type?: string } | null;
      if (data?.type === READY_MSG) {
        readyRef.current = true;
        sendToken();
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [agendaOrigin, sendToken]);

  // Re-empuja el token cuando cambia (login / refresh ~1h). No hace nada hasta
  // que el iframe esté listo (readyRef), evitando el postMessage a about:blank.
  useEffect(() => {
    sendToken();
  }, [sendToken]);

  // Sin env válida no hay iframe que mostrar: evita el crash (URL inválida) y
  // explica qué falta en vez de dejar la pantalla en blanco.
  if (!AGENDA_URL || !agendaOrigin) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-ink font-sans text-sm font-medium">
          La agenda no está configurada.
        </p>
        <p className="text-ink-soft font-sans text-xs">
          Falta la variable de entorno <code>VITE_AGENDA_URL</code> (debe ser una
          URL absoluta, ej: <code>https://front-agenda.tu-dominio.com</code>).
        </p>
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      src={`${AGENDA_URL}/dia?embed=1`}
      title="Agenda"
      className="h-full w-full border-0"
    />
  );
}
