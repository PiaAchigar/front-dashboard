import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useAvisosEstado } from "../lib/avisos-context";

/**
 * Embebe la app `front-crm` por <iframe> y le pasa el access token del staff por
 * `postMessage` (handshake acotado por origin), igual que `AgendaFrame`/`BillerFrame`.
 *
 * Protocolo:
 *   iframe → host : { type: "piubella:crm:ready" }
 *   host  → iframe: { type: "piubella:crm:token", accessToken }
 *   host  → iframe: { type: "piubella:crm:avisos-estado", silenciado }
 *   iframe → host : { type: "piubella:crm:avisos-silenciar", silenciado }
 *   iframe → host : { type: "piubella:crm:viendo", conversationId | null }
 */
const CRM_URL = import.meta.env.VITE_CRM_URL as string | undefined;
const READY_MSG = "piubella:crm:ready";
const TOKEN_MSG = "piubella:crm:token";
const ESTADO_MSG = "piubella:crm:avisos-estado";
const SILENCIAR_MSG = "piubella:crm:avisos-silenciar";
const VIENDO_MSG = "piubella:crm:viendo";

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function CrmFrame() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const crmOrigin = originOf(CRM_URL);
  const readyRef = useRef(false);
  const [params] = useSearchParams();
  const conversacion = params.get("conversacion");
  const { silenciado, setSilenciado, setViendo } = useAvisosEstado();

  const sendEstado = useCallback(() => {
    if (!crmOrigin || !readyRef.current) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: ESTADO_MSG, silenciado },
      crmOrigin,
    );
  }, [crmOrigin, silenciado]);

  const sendToken = useCallback(() => {
    if (!crmOrigin || !readyRef.current || !token) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: TOKEN_MSG, accessToken: token },
      crmOrigin,
    );
  }, [crmOrigin, token]);

  useEffect(() => {
    if (!crmOrigin) return;
    function onMessage(e: MessageEvent) {
      if (e.origin !== crmOrigin) return;
      const data = e.data as
        | { type?: string; silenciado?: unknown; conversationId?: unknown }
        | null;
      if (data?.type === READY_MSG) {
        readyRef.current = true;
        sendToken();
        sendEstado();
      } else if (data?.type === SILENCIAR_MSG && typeof data.silenciado === "boolean") {
        setSilenciado(data.silenciado);
      } else if (data?.type === VIENDO_MSG) {
        setViendo(typeof data.conversationId === "string" ? data.conversationId : null);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [crmOrigin, sendToken, sendEstado, setSilenciado, setViendo]);

  // Al salir del CRM ya no hay conversación abierta.
  useEffect(() => () => setViendo(null), [setViendo]);

  useEffect(() => {
    sendEstado();
  }, [sendEstado]);

  useEffect(() => {
    sendToken();
  }, [sendToken]);

  // El src se calcula una sola vez: si cambiara con la ruta, recargaría el iframe.
  const [src] = useState(() =>
    conversacion
      ? `${CRM_URL}/inbox?embed=1&conversacion=${encodeURIComponent(conversacion)}`
      : `${CRM_URL}/?embed=1`,
  );

  if (!CRM_URL || !crmOrigin) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-ink font-sans text-sm font-medium">
          El CRM no está configurado.
        </p>
        <p className="text-ink-soft font-sans text-xs">
          Falta la variable de entorno <code>VITE_CRM_URL</code> (debe ser una URL
          absoluta, ej: <code>https://front-crm.tu-dominio.com</code>).
        </p>
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      src={src}
      title="CRM"
      className="h-full w-full border-0"
    />
  );
}
