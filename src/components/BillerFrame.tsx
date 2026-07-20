import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useCheckoutHandoff } from "../lib/checkout-handoff";

/**
 * Embebe la app `front-biller` (módulo de facturación) por <iframe> y le pasa
 * el access token del staff por `postMessage` (handshake acotado por origin),
 * igual que `AgendaFrame`.
 *
 * Protocolo:
 *   iframe → host : { type: "piubella:biller:ready" }
 *   host  → iframe: { type: "piubella:biller:token", accessToken }
 * El host SOLO envía el token después del "ready": antes de que cargue el biller,
 * el `contentWindow` está en `about:blank` y un postMessage con el targetOrigin
 * del biller fallaría.
 *
 * El biller trae su propio sub-menú (Checkout, Facturas, Caja, Comisiones), por
 * eso se embebe en su raíz con `?embed=1` (sin ocultar su chrome).
 */
const BILLER_URL = import.meta.env.VITE_BILLER_URL as string | undefined;
const READY_MSG = "piubella:biller:ready";
const TOKEN_MSG = "piubella:biller:token";

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function BillerFrame() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const billerOrigin = originOf(BILLER_URL);

  // Turno que la agenda pidió cobrar (si vinimos de un "Cobrar"): se captura
  // una sola vez al montar y se limpia del contexto para no reusarlo si el
  // staff vuelve a esta ruta después.
  const { pending, clear } = useCheckoutHandoff();
  const [handoff] = useState(pending);
  useEffect(() => {
    if (pending) clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Flag de "iframe listo" — solo se escribe en el handler, nunca en render.
  const readyRef = useRef(false);

  // Envía el token al iframe — solo si ya avisó "ready" y hay token.
  const sendToken = useCallback(() => {
    if (!billerOrigin || !readyRef.current || !token) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: TOKEN_MSG, accessToken: token },
      billerOrigin,
    );
  }, [billerOrigin, token]);

  // Escucha el "ready" del iframe y responde con el token actual.
  useEffect(() => {
    if (!billerOrigin) return;
    function onMessage(e: MessageEvent) {
      if (e.origin !== billerOrigin) return;
      const data = e.data as { type?: string } | null;
      if (data?.type === READY_MSG) {
        readyRef.current = true;
        sendToken();
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [billerOrigin, sendToken]);

  // Re-empuja el token cuando cambia (login / refresh ~1h). No hace nada hasta
  // que el iframe esté listo (readyRef), evitando el postMessage a about:blank.
  useEffect(() => {
    sendToken();
  }, [sendToken]);

  if (!BILLER_URL || !billerOrigin) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-ink font-sans text-sm font-medium">
          La facturación no está configurada.
        </p>
        <p className="text-ink-soft font-sans text-xs">
          Falta la variable de entorno <code>VITE_BILLER_URL</code> (debe ser una
          URL absoluta, ej: <code>https://front-biller.tu-dominio.com</code>).
        </p>
      </div>
    );
  }

  const handoffParams = handoff
    ? `&appointmentId=${encodeURIComponent(handoff.appointmentId)}&customerId=${encodeURIComponent(handoff.customerId)}`
    : "";

  return (
    <iframe
      ref={iframeRef}
      src={`${BILLER_URL}/?embed=1${handoffParams}`}
      title="Facturación"
      className="h-full w-full border-0"
    />
  );
}
