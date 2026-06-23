import { useEffect, useRef } from "react";
import { useAuth } from "../auth/AuthContext";

/**
 * Embebe la app `front-agenda` (proyecto independiente) por <iframe> y le pasa
 * el access token del staff por `postMessage` (handshake acotado por origin).
 *
 * Protocolo:
 *   iframe → host : { type: "piubella:agenda:ready" }
 *   host  → iframe: { type: "piubella:agenda:token", accessToken }
 * El host responde al "ready" con el token actual y lo re-empuja en cada refresh.
 */
const AGENDA_URL = import.meta.env.VITE_AGENDA_URL as string;
const READY_MSG = "piubella:agenda:ready";
const TOKEN_MSG = "piubella:agenda:token";

export function AgendaFrame() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const agendaOrigin = new URL(AGENDA_URL).origin;

  // Token actual accesible dentro del listener sin re-suscribirlo.
  const tokenRef = useRef(token);
  tokenRef.current = token;

  // Responder al "ready" del iframe con el token actual.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== agendaOrigin) return;
      const data = e.data as { type?: string } | null;
      if (data?.type === READY_MSG && tokenRef.current) {
        iframeRef.current?.contentWindow?.postMessage(
          { type: TOKEN_MSG, accessToken: tokenRef.current },
          agendaOrigin,
        );
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [agendaOrigin]);

  // Empujar el token cuando cambia (login / refresh ~1h). En la carga inicial
  // el iframe puede no estar listo todavía; para ese caso responde el "ready".
  useEffect(() => {
    if (token) {
      iframeRef.current?.contentWindow?.postMessage(
        { type: TOKEN_MSG, accessToken: token },
        agendaOrigin,
      );
    }
  }, [token, agendaOrigin]);

  return (
    <iframe
      ref={iframeRef}
      src={`${AGENDA_URL}/dia?embed=1`}
      title="Agenda"
      className="h-full w-full border-0"
    />
  );
}
