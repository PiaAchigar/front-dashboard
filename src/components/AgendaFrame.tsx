import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { tomarAgendarPendiente, type AgendarHandoff } from "../lib/agendar-handoff";

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
 *
 * Ese handshake corre de nuevo cada vez que este `<iframe>` navega —el `src`
 * cambia sólo cuando hay un pedido de "A agendar" pendiente (ver `handoff`
 * abajo), así que el resto del tiempo el iframe no se recarga y el handshake
 * corre una sola vez, como siempre.
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

  // El pedido de "A agendar" que dejó el CRM (si vinimos de ahí): se captura
  // una sola vez al montar, igual que el handoff de cobro en `BillerFrame` —
  // no hace falta un Context porque el CRM y la agenda nunca están montados
  // a la vez. `tomarAgendarPendiente` ya lo borra al leerlo, así que no
  // queda pegado si el staff vuelve a "/agenda" después.
  const [handoff] = useState<AgendarHandoff | null>(() => tomarAgendarPendiente());

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

  // Los mismos nombres que lee `prefillDesdeUrl` en `front-agenda/src/lib/
  // embed.ts`: `customerId` + `serviceId` o `purchaseServiceId`, según la
  // línea. Sin esto no hay handoff — no hay nada que agregarle a la URL.
  const handoffParams = handoff
    ? `&customerId=${encodeURIComponent(handoff.customerId)}&${
        "purchaseServiceId" in handoff
          ? `purchaseServiceId=${encodeURIComponent(handoff.purchaseServiceId)}`
          : `serviceId=${encodeURIComponent(handoff.serviceId)}`
      }`
    : "";

  return (
    <iframe
      ref={iframeRef}
      // A la RAÍZ y no a "/dia": la raíz de la agenda es la que decide dónde
      // arrancar —la pantalla donde estaba antes de recargar, o la última
      // vista elegida—. Apuntando a "/dia" esa decisión no corría nunca y la
      // agenda volvía siempre al día de hoy (Pia, 2026-09-16).
      //
      // La EXCEPCIÓN es un handoff pendiente: ahí vamos directo a "/dia" a
      // propósito, para no depender de esa decisión — un "A agendar" tiene
      // que abrir el turno nuevo sí o sí, no lo que el staff estaba mirando
      // la última vez.
      src={handoff ? `${AGENDA_URL}/dia?embed=1${handoffParams}` : `${AGENDA_URL}/?embed=1`}
      title="Agenda"
      className="h-full w-full border-0"
    />
  );
}
