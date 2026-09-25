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
 * Lo que pide el CRM al tocar "A agendar": la clienta y, según la línea, el
 * servicio o la sesión de depilación concreta (`purchaseServiceId`) de la que
 * tiene que salir el turno — mismos nombres que manda `pedirAgendar`, en
 * `front-crm/src/lib/embed.ts`.
 */
export type AgendarHandoff =
  | { customerId: string; serviceId: string }
  | { customerId: string; purchaseServiceId: string };

// Guardado a nivel de módulo y no en un Context: el CRM y la agenda nunca
// están montados a la vez (viven en rutas distintas bajo el mismo
// `<Outlet/>` de `AppShell`), así que no hace falta un Provider — alcanza
// con que `AgendaFrame` lo lea, una sola vez, apenas `navigate("/agenda")`
// lo deja acá.
let pendiente: AgendarHandoff | null = null;

/**
 * Lo consume `AgendaFrame` al montar: lee el pedido pendiente y lo borra en
 * el mismo paso, para no reusarlo si el staff vuelve a "/agenda" después sin
 * pasar de nuevo por acá.
 */
export function tomarAgendarPendiente(): AgendarHandoff | null {
  const p = pendiente;
  pendiente = null;
  return p;
}

/**
 * Escucha el "llevame a agendar" que manda el iframe del CRM (`pedirAgendar`)
 * y abre la agenda con la clienta y el servicio —o la sesión de depilación—
 * ya cargados.
 *
 * Mismo patrón que `checkout-handoff`, que hace el camino inverso (agenda →
 * facturación): el iframe no puede navegar al dashboard entre origins, así que
 * lo pide por postMessage y el host navega. Va en AppShell, por encima del
 * `<Outlet/>`, para sobrevivir al cambio de ruta.
 *
 * El prefill viaja de acá a `AgendaFrame` por `tomarAgendarPendiente` (una
 * variable de módulo), no por el valor de retorno de este hook: como
 * `AgendaFrame` se monta recién después de este `navigate`, no hay forma de
 * pasárselo por argumentos.
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
      const data = e.data as
        | { type?: string; customerId?: unknown; serviceId?: unknown; purchaseServiceId?: unknown }
        | null;
      if (data?.type !== MSG || typeof data.customerId !== "string") return;

      // Una línea de depilación no tiene servicio propio: gana
      // `purchaseServiceId` si vino. Sin ninguno de los dos no hay a qué
      // turno abrir — no navegamos a ciegas por un mensaje a medio armar.
      if (typeof data.purchaseServiceId === "string") {
        pendiente = { customerId: data.customerId, purchaseServiceId: data.purchaseServiceId };
      } else if (typeof data.serviceId === "string") {
        pendiente = { customerId: data.customerId, serviceId: data.serviceId };
      } else {
        return;
      }
      navigate("/agenda");
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [crmOrigin, navigate]);
}
