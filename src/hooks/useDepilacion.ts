import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api-client";
import type { DepilationConfig } from "../lib/depilation-pricing";
import type {
  ComboDepilacion,
  ZonaCategoria,
  ZonaDepilacion,
  ZonasPorCategoria,
} from "../lib/api-types";

const KEY = ["depilacion", "zonas"];
const CONFIG_KEY = ["depilacion", "config"];
const COMBOS_KEY = ["depilacion", "combos"];

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

// ── Combos ───────────────────────────────────────────────────────────────

/** GET /combos: los 3 packs fijos sembrados + los guardados, cada uno con su
 *  precio ya calculado por el backend (fórmula siempre, fijo solo si aplica). */
export function useCombosDepilacion() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;

  return useQuery({
    queryKey: COMBOS_KEY,
    queryFn: () => apiFetch<ComboDepilacion[]>("/api/agenda/depilacion/combos", token),
    enabled: !!token,
    staleTime: 60 * 1000,
  });
}

/** Lo que este front puede crear/editar: siempre `kind: "guardado"`, sin
 *  precio propio (esa es la razón de ser del diseño — ver depilacion.repo.ts,
 *  `CHECK ck_dc_precio_guardado`). Los packs fijos son de seed, no se tocan
 *  desde acá. */
export type ComboDepilacionInput = {
  name: string;
  description?: string | null;
  isPublishedWeb: boolean;
  displayOrder?: number | null;
  zonaIds: string[];
};

function useInvalidateCombos() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: COMBOS_KEY });
}

/** Alta o edición según venga `id`: POST /combos o PATCH /combos/:id. */
export function useGuardarComboDepilacion() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const invalidate = useInvalidateCombos();

  return useMutation({
    mutationFn: ({ id, ...data }: ComboDepilacionInput & { id?: string }) =>
      apiFetch<ComboDepilacion>(
        id ? `/api/agenda/depilacion/combos/${id}` : "/api/agenda/depilacion/combos",
        token,
        {
          method: id ? "PATCH" : "POST",
          body: JSON.stringify({ ...data, kind: "guardado", choiceZoneCount: 0 }),
        },
      ),
    onSuccess: invalidate,
  });
}

/** Archivar / restaurar: PATCH /combos/:id/estado. */
export function useArchivarComboDepilacion() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const invalidate = useInvalidateCombos();

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiFetch<ComboDepilacion>(`/api/agenda/depilacion/combos/${id}/estado`, token, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: invalidate,
  });
}
