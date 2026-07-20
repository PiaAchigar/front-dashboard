import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

export type CheckoutHandoff = { appointmentId: string; customerId: string };

type Ctx = {
  pending: CheckoutHandoff | null;
  clear: () => void;
};

const CheckoutHandoffContext = createContext<Ctx>({ pending: null, clear: () => {} });

const AGENDA_URL = import.meta.env.VITE_AGENDA_URL as string | undefined;
const MSG = "piubella:agenda:checkout";

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Escucha el pedido de "Cobrar" que manda el iframe de agenda por postMessage
 * (turno + cliente) y navega a Facturación. Vive en AppShell (por encima del
 * <Outlet/>) para sobrevivir el cambio de ruta entre Agenda y Facturación —
 * si viviera dentro de AgendaFrame se desmontaría antes de poder navegar.
 */
export function CheckoutHandoffProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<CheckoutHandoff | null>(null);
  const navigate = useNavigate();
  const agendaOrigin = originOf(AGENDA_URL);

  useEffect(() => {
    if (!agendaOrigin) return;
    function onMessage(e: MessageEvent) {
      if (e.origin !== agendaOrigin) return;
      const data = e.data as
        | { type?: string; appointmentId?: unknown; customerId?: unknown }
        | null;
      if (
        data?.type === MSG &&
        typeof data.appointmentId === "string" &&
        typeof data.customerId === "string"
      ) {
        setPending({ appointmentId: data.appointmentId, customerId: data.customerId });
        navigate("/facturacion");
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [agendaOrigin, navigate]);

  return (
    <CheckoutHandoffContext.Provider value={{ pending, clear: () => setPending(null) }}>
      {children}
    </CheckoutHandoffContext.Provider>
  );
}

export function useCheckoutHandoff(): Ctx {
  return useContext(CheckoutHandoffContext);
}
