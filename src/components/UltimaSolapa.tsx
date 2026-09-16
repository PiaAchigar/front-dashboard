import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import {
  destinoDeSeccion,
  guardarSolapa,
  leerSolapa,
  prefijosQueRecuerdan,
} from "../lib/ultima-solapa";

/**
 * Las secciones que recuerdan en qué solapa quedaste.
 *
 * Están anidadas a propósito: `/admin/estetica` cuelga de `/admin`, y una ruta
 * adentro de Estética la recuerdan las dos. Ver `lib/ultima-solapa.ts`.
 */
export const SECCIONES_CON_SOLAPAS = [
  "/admin",
  "/admin/depilacion",
  "/admin/estetica",
  "/admin/medicina",
  "/admin/masajes",
  "/sitio-web",
  "/configuracion",
] as const;

/** Va anotando en qué solapa está parada la usuaria, sección por sección. */
export function useRecordarSolapa(): void {
  const { pathname } = useLocation();

  useEffect(() => {
    for (const prefijo of prefijosQueRecuerdan(SECCIONES_CON_SOLAPAS, pathname)) {
      guardarSolapa(prefijo, pathname);
    }
  }, [pathname]);
}

/**
 * El índice de una sección: manda a la última solapa abierta, o a la de
 * arranque la primera vez.
 *
 * Reemplaza a un `<Navigate>` con destino fijo. `replace` para que el botón
 * Atrás no quede rebotando contra la redirección.
 */
export function UltimaSolapa({
  seccion,
  porDefecto,
}: {
  seccion: string;
  porDefecto: string;
}) {
  return <Navigate to={destinoDeSeccion(leerSolapa(seccion), seccion, porDefecto)} replace />;
}
