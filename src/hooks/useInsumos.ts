import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api-client";

/** El nivel lo calcula el backend, para que la pantalla y los avisos usen el mismo criterio. */
export type NivelDeStock = "sin_stock" | "bajo" | "ok" | "desconocido";

export type Insumo = {
  id: string;
  name: string | null;
  description: string | null;
  code: string | null;
  unitType: string | null;
  quantityInStock: number | null;
  minimumStock: number | null;
  /** Lo que CUESTA la unidad. No confundir con `unitPrice`, que es a cuánto se vende. */
  unitCost: number | null;
  unitPrice: number | null;
  supplierInfo: string | null;
  taxCategory: string | null;
  isActive: boolean | null;
  nivel: NivelDeStock;
};

export type InsumoInput = {
  name: string;
  description?: string | null;
  code?: string | null;
  unitType?: string | null;
  quantityInStock?: number | null;
  minimumStock?: number | null;
  unitCost?: number | null;
  unitPrice?: number | null;
  supplierInfo?: string | null;
  taxCategory?: string | null;
};

const KEY = "insumos";

function useToken() {
  const { session } = useAuth();
  return session?.access_token ?? null;
}

export function useInsumos(showArchived: boolean) {
  const token = useToken();
  const qs = showArchived ? "?includeInactive=true" : "";
  return useQuery({
    queryKey: [KEY, showArchived],
    queryFn: () => apiFetch<Insumo[]>(`/api/agenda/supplies${qs}`, token),
    enabled: !!token,
    staleTime: 60 * 1000,
  });
}

/** Una sola invalidación por prefijo alcanza para las dos vistas (activos y archivados). */
function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [KEY] });
}

export function useCreateInsumo() {
  const token = useToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (data: InsumoInput) =>
      apiFetch("/api/agenda/supplies", token, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: invalidate,
  });
}

export function useUpdateInsumo() {
  const token = useToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<InsumoInput> & { id: string }) =>
      apiFetch(`/api/agenda/supplies/${id}`, token, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: invalidate,
  });
}

export function useArchiveInsumo() {
  const token = useToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/agenda/supplies/${id}`, token, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

export function useRestoreInsumo() {
  const token = useToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/agenda/supplies/${id}/restore`, token, { method: "POST" }),
    onSuccess: invalidate,
  });
}
