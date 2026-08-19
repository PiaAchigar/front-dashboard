import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api-client";

export const EMBEDDINGS_STATUS_KEY = "embeddings-status";

export type EmbeddingsStatus = {
  total: number;
  indexados: number;
  pendientes: number;
  por_tipo: Record<"service" | "activity" | "training", { total: number; pendientes: number }>;
  credencial_activa: boolean;
};

/** Respuesta de un lote. `message` llega cuando ya no queda nada pendiente. */
export type LoteResultado = {
  processed?: number;
  results?: { id: string; status: "success" | "failed"; error?: string }[];
  sinCredito?: boolean;
  message?: string;
};

function useToken() {
  const { session } = useAuth();
  return session?.access_token ?? null;
}

export function useEmbeddingsStatus() {
  const token = useToken();
  return useQuery({
    queryKey: [EMBEDDINGS_STATUS_KEY],
    queryFn: () => apiFetch<EmbeddingsStatus>("/api/ai-config/embeddings-status", token),
    enabled: !!token,
    staleTime: 60 * 1000,
  });
}

/** Un lote de hasta 10 ítems. La pantalla la llama en loop. */
export function useRecalcularLote() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<LoteResultado>("/api/webhooks/recalculate-embeddings", token, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [EMBEDDINGS_STATUS_KEY] }),
  });
}
