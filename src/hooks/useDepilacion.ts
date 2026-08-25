import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api-client";
import type { DepilationConfig } from "../lib/depilation-pricing";
import type { ZonaCategoria, ZonaDepilacion, ZonasPorCategoria } from "../lib/api-types";

const KEY = ["depilacion", "zonas"];
const CONFIG_KEY = ["depilacion", "config"];

export type ZonaInput = {
  name: string;
  category: ZonaCategoria;
  displayOrder: number | null;
};

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: KEY });
}

/** GET /zonas: ya viene agrupado por categoría (grande/mediana/chica), incluye
 *  activas e inactivas — el filtro "Archivadas" lo hace la pantalla. */
export function useZonas() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;

  return useQuery({
    queryKey: KEY,
    queryFn: () => apiFetch<ZonasPorCategoria>("/api/agenda/depilacion/zonas", token),
    enabled: !!token,
    staleTime: 60 * 1000,
  });
}

/** Alta o edición según venga `id`: POST /zonas o PATCH /zonas/:id. */
export function useGuardarZona() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: ({ id, ...data }: ZonaInput & { id?: string }) =>
      apiFetch<ZonaDepilacion>(
        id ? `/api/agenda/depilacion/zonas/${id}` : "/api/agenda/depilacion/zonas",
        token,
        { method: id ? "PATCH" : "POST", body: JSON.stringify(data) },
      ),
    onSuccess: invalidate,
  });
}

/** Archivar / restaurar: PATCH /zonas/:id/estado. */
export function useArchivarZona() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiFetch<ZonaDepilacion>(`/api/agenda/depilacion/zonas/${id}/estado`, token, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: invalidate,
  });
}

/** PUT /zonas/:id/exclusiones: manda la lista completa de zonas con las que
 *  no se combina; el backend escribe las dos direcciones del par. */
export function useGuardarExclusiones() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: ({ id, excludes }: { id: string; excludes: string[] }) =>
      apiFetch(`/api/agenda/depilacion/zonas/${id}/exclusiones`, token, {
        method: "PUT",
        body: JSON.stringify({ excludes }),
      }),
    onSuccess: invalidate,
  });
}

/** Los 19 campos que espera el `PUT /config` del backend — forma PLANA, a
 *  diferencia del `DepilationConfig` anidado que devuelve el `GET`. */
export type DepilacionConfigInput = {
  priceGrande: number;
  priceMediana: number;
  priceChica: number;
  pricingMinutesGrande: number;
  pricingMinutesMediana: number;
  pricingMinutesChica: number;
  tier1RatePerMinute: number;
  tier2RatePerMinute: number;
  slotMinutesFemaleGrande: number;
  slotMinutesFemaleMediana: number;
  slotMinutesFemaleChica: number;
  slotMinutesMaleGrande: number;
  slotMinutesMaleMediana: number;
  slotMinutesMaleChica: number;
  slotRoundingStep: number;
  slotMinimumMinutes: number;
  packSessions: number;
  packDiscountPercentage: number;
  packRoundingBase: number;
};

/** GET /config: la forma ANIDADA que consume directamente `calcularPrecioCombo`. */
export function useDepilacionConfig() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;

  return useQuery({
    queryKey: CONFIG_KEY,
    queryFn: () => apiFetch<DepilationConfig>("/api/agenda/depilacion/config", token),
    enabled: !!token,
    staleTime: 60 * 1000,
  });
}

/** PUT /config: recibe la forma plana, devuelve la anidada ya actualizada. */
export function useGuardarConfig() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: DepilacionConfigInput) =>
      apiFetch<DepilationConfig>("/api/agenda/depilacion/config", token, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => qc.setQueryData(CONFIG_KEY, data),
  });
}
