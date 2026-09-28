import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api-client";
import type { DeleteImpact } from "../components/ResourceManager";
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

/** Los 25 campos que espera el `PUT /config` del backend — forma PLANA, a
 *  diferencia del `DepilationConfig` anidado que devuelve el `GET`.
 *
 *  task-7: `priceGrande`/`priceMediana`/`priceChica` y `pricingMinutesGrande`/
 *  `pricingMinutesMediana`/`pricingMinutesChica` (6 claves, unisex) se
 *  reemplazan por las 12 de abajo, por sexo — el backend (Task 4 de la SDD)
 *  ya no acepta las viejas. */
export type DepilacionConfigInput = {
  priceFemaleGrande: number;
  priceFemaleMediana: number;
  priceFemaleChica: number;
  priceMaleGrande: number;
  priceMaleMediana: number;
  priceMaleChica: number;
  pricingMinutesFemaleGrande: number;
  pricingMinutesFemaleMediana: number;
  pricingMinutesFemaleChica: number;
  pricingMinutesMaleGrande: number;
  pricingMinutesMaleMediana: number;
  pricingMinutesMaleChica: number;
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

/** Lo que devuelve el `GET /config`: la aritmética de precios MÁS dos datos que
 *  no le incumben a `DepilationConfig` y que la pantalla de Configuración sí
 *  necesita — cuál es el servicio ancla (para leer y guardar sus acuerdos) y
 *  cuántas sesiones ya compradas están esperando turno. El backend los agrega
 *  en la respuesta, no en el tipo del motor de precios. */
export type DepilacionConfigResponse = DepilationConfig & {
  anchorServiceId: string | null;
  sesionesEsperandoTurno: number;
};

/** GET /config: la forma ANIDADA que consume directamente `calcularPrecioCombo`. */
export function useDepilacionConfig() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;

  return useQuery({
    queryKey: CONFIG_KEY,
    queryFn: () => apiFetch<DepilacionConfigResponse>("/api/agenda/depilacion/config", token),
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
    // Merge y no reemplazo: la respuesta del PUT es sólo `DepilationConfig`,
    // sin `anchorServiceId` ni `sesionesEsperandoTurno`. Pisar la entrada
    // entera del cache con ella le dejaba la config sin el id del servicio
    // ancla a cualquier pantalla montada (Comisión se quedaba sin poder
    // guardar acuerdos después de que alguien guardara Precios) hasta el
    // siguiente refetch.
    onSuccess: (data) =>
      qc.setQueryData<DepilacionConfigResponse>(CONFIG_KEY, (prev) =>
        prev ? { ...prev, ...data } : undefined,
      ),
  });
}

/** GET /turnos-futuros: cuántos turnos de depilación sin cerrar tiene cada
 *  proveedora. Es lo que se muestra ANTES de dejar sacar a alguien — avisa,
 *  no bloquea. */
export type TurnosFuturosDeProveedora = { providerId: string; turnos: number };

export function useTurnosFuturosDeDepilacion() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;

  return useQuery({
    queryKey: ["depilacion", "turnos-futuros"],
    queryFn: () =>
      apiFetch<TurnosFuturosDeProveedora[]>("/api/agenda/depilacion/turnos-futuros", token),
    enabled: !!token,
    staleTime: 60 * 1000,
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

/** Un combo se crea SIEMPRE como `guardado` (sin precio propio: el precio
 *  sale de la fórmula, que es la razón de ser del diseño). Pero editar un
 *  pack fijo sembrado sí está permitido, así que `kind` y `fixedPrice` viajan
 *  cuando el llamador los manda.
 *
 *  El backend no deja cambiar el `kind` de un combo existente ni dejar sin
 *  precio a un pack fijo (PATCH /combos/:id): mandar el `kind` que la fila ya
 *  tiene no es una decisión de esta pantalla, es repetirle a la API lo que
 *  ella misma va a verificar. */
export type ComboDepilacionInput = {
  name: string;
  description?: string | null;
  isPublishedWeb: boolean;
  displayOrder?: number | null;
  zonaIds: string[];
  kind?: "pack_fijo" | "guardado";
  fixedPrice?: number | null;
  choiceZoneCount?: number;
  /** Pack propio del combo. Las tres o ninguna: mandarlas en `null` es
   *  explícitamente "volvé al pack global", y así lo entiende el backend. */
  packSessions?: number | null;
  packDiscountPercentage?: number | null;
  packRoundingBase?: number | null;
  /** 1.56.0 — Meses de vigencia del pack. `null` = no vence. */
  validityMonths?: number | null;
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
          body: JSON.stringify({
            ...data,
            kind: data.kind ?? "guardado",
            choiceZoneCount: data.choiceZoneCount ?? 0,
          }),
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

// ── Borrado real (hard-delete) ───────────────────────────────────────────
// Mismo par que Servicios y Proveedoras: primero se pide el impacto y recién
// con esa respuesta `ResourceManager` decide si muestra la confirmación o el
// cartel de "no se puede". Distinto de archivar, que es reversible.

/** Preview de impacto: no es una query cacheada, se llama on-demand vía
 *  mutateAsync justo antes de mostrar la confirmación. */
export function useZonaDeleteImpact() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<DeleteImpact>(`/api/agenda/depilacion/zonas/${id}/delete-impact`, token),
  });
}

export function useHardDeleteZona() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/agenda/depilacion/zonas/${id}/permanent`, token, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

export function useComboDepilacionDeleteImpact() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<DeleteImpact>(`/api/agenda/depilacion/combos/${id}/delete-impact`, token),
  });
}

export function useHardDeleteComboDepilacion() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const invalidate = useInvalidateCombos();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/agenda/depilacion/combos/${id}/permanent`, token, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}
