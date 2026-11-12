import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { guardarSilenciado, leerSilenciado } from "./avisos";

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
  const value = useMemo(() => ({ silenciado, setSilenciado, viendo, setViendo }), [silenciado, setSilenciado, viendo]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAvisosEstado(): AvisosCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAvisosEstado fuera de AvisosProvider");
  return c;
}
