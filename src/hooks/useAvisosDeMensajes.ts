import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api-client";
import { sonarDing, textoDelAviso, type RespuestaAvisos } from "../lib/avisos";
import { useAvisosEstado } from "../lib/avisos-context";

const CADA_MS = 10_000;
const PATH = "/api/crm/conversations/avisos";

export type Aviso = { texto: string; conversationId: string };

/**
 * Consulta cada 10 s los mensajes nuevos de clientas y arma UN aviso por consulta.
 * Sigue avanzando `hasta` aunque esté silenciado, para no acumular avisos.
 */
export function useAvisosDeMensajes(habilitado: boolean) {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const { silenciado, viendo } = useAvisosEstado();
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const hastaRef = useRef<string | null>(null);
  const silenciadoRef = useRef(silenciado);
  const viendoRef = useRef(viendo);
  silenciadoRef.current = silenciado;
  viendoRef.current = viendo;

  useEffect(() => {
    if (!habilitado || !token) return;
    let activo = true;

    let enCurso = false;

    async function consultar() {
      if (enCurso) return; // la consulta anterior sigue en vuelo: no mandar el mismo `desde` dos veces
      enCurso = true;
      try {
        const desde = hastaRef.current;
        const path = desde ? `${PATH}?desde=${encodeURIComponent(desde)}` : PATH;
        const r = await apiFetch<RespuestaAvisos>(path, token, undefined);
        if (!activo) return;
        hastaRef.current = r.hasta;
        if (r.mensajes.length === 0 || silenciadoRef.current) return;
        // La conversación abierta en el CRM no cuenta: ni para el texto ni para el destino.
        const abierta = viendoRef.current;
        const relevantes = abierta ? r.mensajes.filter((m) => m.conversationId !== abierta) : r.mensajes;
        if (relevantes.length === 0) return;
        setAviso(textoDelAviso(relevantes));
        sonarDing();
      } catch {
        /* sin red o 5xx: se reintenta en la próxima vuelta con el mismo `desde` */
      } finally {
        enCurso = false;
      }
    }

    void consultar();
    const id = setInterval(() => void consultar(), CADA_MS);
    return () => {
      activo = false;
      clearInterval(id);
    };
  }, [habilitado, token]);

  const cerrar = useCallback(() => setAviso(null), []);
  return { aviso, cerrar };
}
