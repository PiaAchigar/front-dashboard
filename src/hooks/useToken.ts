import { useAuth } from "../auth/AuthContext";

/**
 * Token de acceso para llamar a la API.
 *
 * Sale de la sesión de Supabase, NO de localStorage: la app nunca escribe una
 * clave `access_token` suelta ahí. Leerla de localStorage devuelve siempre
 * null, `apiFetch` omite el header Authorization y todo endpoint protegido
 * responde 401 — un fallo que además queda invisible mientras el endpoint que
 * se está llamando no exija auth.
 *
 * Mismo patrón que ya usaban los hooks de src/hooks (useIssuers, useUsers...),
 * centralizado acá para que no se vuelva a copiar mal.
 */
export function useToken(): string | null {
  const { session } = useAuth();
  return session?.access_token ?? null;
}
