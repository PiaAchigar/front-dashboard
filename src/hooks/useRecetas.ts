import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api-client";

/** Una línea de la receta de un servicio. */
export type LineaReceta = {
  productId: string;
  quantity: number;
  name: string | null;
  unitType: string | null;
  unitCost: number | null;
  isActive: boolean | null;
};

export type Receta = { lineas: LineaReceta[]; costoTotal: number };

/** Un servicio que usa cierto insumo, con la cantidad que consume. */
export type ServicioDeInsumo = {
  serviceId: string;
  quantity: number;
  name: string | null;
  isActive: boolean | null;
};

const KEY = "recetas";

function useToken() {
  const { session } = useAuth();
  return session?.access_token ?? null;
}

export function useServiceSupplies(serviceId: string | null) {
  const token = useToken();
  return useQuery({
    queryKey: [KEY, "servicio", serviceId],
    queryFn: () => apiFetch<Receta>(`/api/agenda/services/${serviceId}/supplies`, token),
    enabled: !!token && !!serviceId,
  });
}

/**
 * Invalida TODO lo que depende de las recetas.
 *
 * Guardar la receta de un servicio cambia también "qué servicios usan este
 * insumo", y la carga masiva cambia la receta de varios servicios a la vez. Una
 * sola invalidación por prefijo cubre las dos direcciones; filtrar por id
 * dejaría la otra vista mostrando datos viejos.
 */
function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [KEY] });
}

export function useSetServiceSupplies() {
  const token = useToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      id,
      supplies,
    }: {
      id: string;
      supplies: { productId: string; quantity: number | null }[];
    }) =>
      apiFetch(`/api/agenda/services/${id}/supplies`, token, {
        method: "PUT",
        body: JSON.stringify({ supplies }),
      }),
    onSuccess: invalidate,
  });
}

export function useInsumoServices(productId: string | null) {
  const token = useToken();
  return useQuery({
    queryKey: [KEY, "insumo", productId],
    queryFn: () =>
      apiFetch<ServicioDeInsumo[]>(`/api/agenda/supplies/${productId}/services`, token),
    enabled: !!token && !!productId,
  });
}

export function useAssignInsumoToServices() {
  const token = useToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      id,
      serviceIds,
      quantity,
    }: {
      id: string;
      serviceIds: string[];
      quantity: number;
    }) =>
      apiFetch<{ agregados: number; actualizados: number; quitados: number }>(
        `/api/agenda/supplies/${id}/services`,
        token,
        { method: "PUT", body: JSON.stringify({ serviceIds, quantity }) },
      ),
    onSuccess: invalidate,
  });
}
