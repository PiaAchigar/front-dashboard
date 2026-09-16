import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const MSG = "piubella:crm:agendar";

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Escucha el "llevame a agendar" que manda el iframe del CRM y abre la agenda.
 *
 * Mismo patrón que `checkout-handoff`, que hace el camino inverso (agenda →
 * facturación): el iframe no puede navegar al dashboard entre origins, así que
 * lo pide por postMessage y el host navega. Va en AppShell, por encima del
 * `<Outlet/>`, para sobrevivir al cambio de ruta.
 *
 * **El mensaje trae la clienta y el servicio, y por ahora no se usan.** Lo que
 * falta para aprovecharlos es que la agenda abra el turno nuevo ya cargado con
 * los dos, y eso es trabajo del lado de la agenda. Cuando esté, se consume acá
 * sin tocar el CRM.
 */
export function useAgendarHandoff(): void {
  const navigate = useNavigate();
  // Se lee acá y no en el módulo: al leerlo al importar, el valor queda
  // congelado antes de que un test pueda ponerlo.
  const crmOrigin = originOf(import.meta.env.VITE_CRM_URL as string | undefined);

  useEffect(() => {
    if (!crmOrigin) return;
    function onMessage(e: MessageEvent) {
      if (e.origin !== crmOrigin) return;
      const data = e.data as { type?: string } | null;
      if (data?.type === MSG) navigate("/agenda");
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [crmOrigin, navigate]);
}
