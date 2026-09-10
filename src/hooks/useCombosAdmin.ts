import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api-client";
import type { ComboAdmin, TarifarioDeArea } from "../lib/api-types";

export type ComboLineInput = {
  serviceId: string;
  /** Opcional desde la 1.50.0: un combo es UNA sesión de cada servicio
   *  (spec §4.3). Repetir es trabajo de un pack. */
  sessionsIncluded?: number;
};

export type ComboInput = {
  name: string;
  description?: string | null;
  priceType: "fixed" | "percentage";
  fixedPrice?: number | null;
  discountPercentage?: number | null;
  validityMonths: number;
  isVisibleWeb?: boolean | null;
  displayOrder?: number | null;
  // ── 1.50.0 ───────────────────────────────────────────────────────────────
  /** Obligatoria: el área se elige al crear, no se deduce de los servicios. */
  areaCategoryId: string;
  kind?: "combo" | "pack";
  packOfComboId?: string | null;
  packSessions?: number | null;
  packDiscountPercentage?: number | null;
  packRoundingBase?: number | null;
  servicesTogether?: boolean | null;
  lines: ComboLineInput[];
};

const KEY = "combos-admin";

/**
 * Los combos o packs de un área.
 *
 * `areaCategoryId` y `kind` van en la queryKey además de en la URL: sin eso,
 * las solapas Combos y Packs de la misma área compartirían caché y una
 * mostraría lo de la otra.
 */
export function useCombosAdmin(
  showArchived: boolean,
  filtro: { areaCategoryId?: string | null; kind?: "combo" | "pack" } = {},
) {
  const { session } = useAuth();
  const token = session?.access_token ?? null;

  const params = new URLSearchParams();
  if (showArchived) params.set("includeInactive", "true");
  if (filtro.areaCategoryId) params.set("areaCategoryId", filtro.areaCategoryId);
  if (filtro.kind) params.set("kind", filtro.kind);
  const qs = params.toString() ? `?${params}` : "";

  return useQuery({
    queryKey: [KEY, showArchived, filtro.areaCategoryId ?? null, filtro.kind ?? null],
    queryFn: () => apiFetch<ComboAdmin[]>(`/api/agenda/combos/admin${qs}`, token),
    // Sin área no hay nada que pedir: la pantalla todavía está esperando que
    // carguen las categorías.
    enabled: !!token && filtro.areaCategoryId !== null,
    staleTime: 60 * 1000,
  });
}

/**
 * Qué ya existe igual a lo que se está por guardar.
 *
 * Se consulta ANTES de crear: avisar después de haber creado el duplicado no
 * evita nada. Nunca bloquea — devuelve la lista y quien carga decide.
 */
export function useChequeoDeDuplicados() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  return useMutation({
    mutationFn: (data: ComboInput) =>
      apiFetch<{ duplicados: { id: string; name: string }[] }>(
        "/api/agenda/combos/admin/duplicados",
        token,
        { method: "POST", body: JSON.stringify(data) },
      ),
  });
}

/** El tarifario de packs de cada área. */
export function useTarifarios() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  return useQuery({
    queryKey: ["tarifarios-de-area"],
    queryFn: () => apiFetch<TarifarioDeArea[]>("/api/agenda/combos/admin/tarifarios", token),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  });
}

export function useGuardarTarifario() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      areaCategoryId,
      ...valores
    }: {
      areaCategoryId: string;
      packSessions: number;
      packDiscountPercentage: number;
      packRoundingBase: number;
    }) =>
      apiFetch(`/api/agenda/combos/admin/tarifarios/${areaCategoryId}`, token, {
        method: "PUT",
        body: JSON.stringify(valores),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tarifarios-de-area"] });
      // Cambiar la política cambia el precio que muestran los packs que la
      // siguen, así que la lista queda vieja.
      qc.invalidateQueries({ queryKey: [KEY] });
    },
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: [KEY] });
    qc.invalidateQueries({ queryKey: ["combos"] }); // la web pública también los lee
  };
}

export function useCreateCombo() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (data: ComboInput) =>
      apiFetch("/api/agenda/combos/admin", token, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: invalidate,
  });
}

export function useUpdateComboAdmin() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...data }: ComboInput & { id: string }) =>
      apiFetch(`/api/agenda/combos/admin/${id}`, token, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: invalidate,
  });
}

export function useArchiveCombo() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/agenda/combos/admin/${id}`, token, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

export function useRestoreCombo() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/agenda/combos/admin/${id}/restore`, token, { method: "POST" }),
    onSuccess: invalidate,
  });
}

export function useDeleteCombo() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/agenda/combos/admin/${id}/delete`, token, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}
