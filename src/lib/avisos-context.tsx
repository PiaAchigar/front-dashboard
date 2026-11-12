import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { guardarSilenciado, leerSilenciado, SILENCIO_KEY } from "./avisos";

type AvisosCtx = {
  silenciado: boolean;
  setSilenciado: (v: boolean) => void;
  /** Conversación abierta en el CRM (null si ninguna o si no está en /crm). */
  viendo: string | null;
  setViendo: (id: string | null) => void;
};

const Ctx = createContext<AvisosCtx | null>(null);

export function AvisosProvider({ children }: { children: ReactNode }) {
  const [silenciado, setSil] = useState(leerSilenciado);
  const [viendo, setViendo] = useState<string | null>(null);
  const setSilenciado = useCallback((v: boolean) => {
    guardarSilenciado(v);
    setSil(v);
  }, []);
  // Silenciar en una pestaña silencia las demás.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === SILENCIO_KEY) setSil(leerSilenciado());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const value = useMemo(() => ({ silenciado, setSilenciado, viendo, setViendo }), [silenciado, setSilenciado, viendo]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAvisosEstado(): AvisosCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAvisosEstado fuera de AvisosProvider");
  return c;
}
