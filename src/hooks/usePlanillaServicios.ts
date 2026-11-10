import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToken } from "./useToken";
import { apiFetch } from "../lib/api-client";
import { armarLibro, nombreDeArchivo } from "../lib/planilla-excel";
import type { EntradaPlanilla, PlanillaDescarga, Previsualizacion } from "../lib/planilla-tipos";

const BASE = "/api/agenda/planilla-servicios";

/** Hoy en hora local, YYYY-MM-DD (para el nombre del archivo). */
function hoyLocal(): string {
  const d = new Date();
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

/** Baja la planilla del área y arma el .xlsx. Devuelve el archivo y el nombre que lleva. */
export function useDescargarPlanilla(area: string) {
  const token = useToken();
  return useMutation({
    mutationFn: async () => {
      const datos = await apiFetch<PlanillaDescarga>(`${BASE}?area=${encodeURIComponent(area)}`, token);
      const blob = await armarLibro(datos);
      return { blob, nombre: nombreDeArchivo(datos.area.nombre, hoyLocal()) };
    },
  });
}

/** Compara lo subido con el sistema. Los errores de la planilla vienen adentro (`errores`), no como falla. */
export function usePrevisualizarPlanilla() {
  const token = useToken();
  return useMutation({
    mutationFn: (entrada: EntradaPlanilla) =>
      apiFetch<Previsualizacion>(`${BASE}/previsualizar`, token, {
        method: "POST",
        body: JSON.stringify(entrada),
      }),
  });
}

/** Guarda todo o nada. Al terminar refresca lo que muestra servicios, acuerdos y recetas. */
export function useAplicarPlanilla() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entrada: EntradaPlanilla) =>
      apiFetch<{ resumen: Previsualizacion["resumen"] }>(`${BASE}/aplicar`, token, {
        method: "POST",
        body: JSON.stringify(entrada),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services-admin"] });
      qc.invalidateQueries({ queryKey: ["services"] });
      qc.invalidateQueries({ queryKey: ["service-agreements"] });
      qc.invalidateQueries({ queryKey: ["providers-by-service"] });
      qc.invalidateQueries({ queryKey: ["recetas"] });
    },
  });
}
