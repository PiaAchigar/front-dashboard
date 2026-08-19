import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api-client";
import { EMBEDDINGS_STATUS_KEY } from "./useEmbeddingsStatus";

const KEY = "ai-credentials";

/** Credencial de un proveedor de IA. La api_key NUNCA vuelve del backend. */
export type AICredential = {
  id: string;
  provider: string | null;
  model: string | null;
  is_active: boolean;
  created_at: string | null;
};

export type ValidacionResultado = {
  valid: boolean;
  error?: string;
  detalle?: string;
  esFaltaDeCredito?: boolean;
};

export type CredencialInput = { provider: "openai"; api_key: string; model: string };

function useToken() {
  const { session } = useAuth();
  return session?.access_token ?? null;
}

export function useAICredentials() {
  const token = useToken();
  return useQuery({
    queryKey: [KEY],
    queryFn: () => apiFetch<AICredential[]>("/api/ai-config/credentials", token),
    enabled: !!token,
    staleTime: 30 * 1000,
  });
}

/** Prueba la key contra OpenAI sin guardar nada. */
export function useValidarCredencial() {
  const token = useToken();
  return useMutation({
    mutationFn: (data: CredencialInput) =>
      apiFetch<ValidacionResultado>("/api/ai-config/validate", token, {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}

/** Guarda la credencial. Desactiva la anterior del mismo proveedor, en transacción. */
export function useGuardarCredencial() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CredencialInput) =>
      apiFetch<AICredential>("/api/ai-config/credentials", token, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      // Guardar una credencial nueva puede cambiar `credencial_activa`.
      qc.invalidateQueries({ queryKey: [EMBEDDINGS_STATUS_KEY] });
    },
  });
}
