import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api-client";
import { todayLocal } from "../lib/format";
import type { PromotionAdmin } from "../lib/api-types";

/**
 * Las promos vigentes HOY, publicadas o no.
 *
 * Fechas en hora local del negocio (`todayLocal`), no UTC: una promo que vence
 * hoy no puede desaparecer tres horas antes. Mismo criterio que
 * `promoEstaVigente` del backend.
 */
export function promoVigente(
  p: { validFrom?: string | null; validUntil?: string | null },
  hoy: string,
): boolean {
  if (p.validFrom && p.validFrom > hoy) return false;
  if (p.validUntil && p.validUntil < hoy) return false;
  return true;
}

export function usePromotions() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;

  return useQuery({
    queryKey: ["promotions", "admin"],
    // El endpoint público filtra por `is_visible_web` desde 1.53.0, y ésta es
    // la pantalla donde se decide ese tilde: tiene que ver TODAS.
    queryFn: () => apiFetch<PromotionAdmin[]>("/api/agenda/promotions/admin", token),
    // Lo que el endpoint público SÍ filtraba y se perdió al pasar al de
    // admin: la vigencia. Sin esto "Promo del Mes" lista promos vencidas
    // —"hasta 12 de marzo"— con su toggle de Destacada listo para tildar algo
    // que no va a aparecer en la home. El filtro vuelve acá y no al endpoint
    // porque el endpoint también alimenta el ABM de Promos, que necesita ver
    // las vencidas para poder editarlas.
    select: (promos: PromotionAdmin[]) => {
      const hoy = todayLocal();
      return promos.filter((p) => promoVigente(p, hoy));
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  });
}
