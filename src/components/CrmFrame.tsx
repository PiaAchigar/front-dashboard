import { useCallback, useEffect, useRef } from "react";
import { useAuth } from "../auth/AuthContext";

/**
 * Embebe la app `front-crm` por <iframe> y le pasa el access token del staff por
 * `postMessage` (handshake acotado por origin), igual que `AgendaFrame`/`BillerFrame`.
 *
 * Protocolo:
 *   iframe → host : { type: "piubella:crm:ready" }
 *   host  → iframe: { type: "piubella:crm:token", accessToken }
 */
const CRM_URL = import.meta.env.VITE_CRM_URL as string | undefined;
const READY_MSG = "piubella:crm:ready";
const TOKEN_MSG = "piubella:crm:token";

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
      const data = e.data as { type?: string } | null;
      if (data?.type === READY_MSG) {
        readyRef.current = true;
        sendToken();
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [crmOrigin, sendToken]);

  useEffect(() => {
    sendToken();
  }, [sendToken]);

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
      src={`${CRM_URL}/?embed=1`}
      title="CRM"
      className="h-full w-full border-0"
    />
  );
}
