import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useToken } from "./useToken";
import { apiFetch } from "../lib/api-client";
import { useToast } from "../components/ui/Toast";

export type Ajuste = {
  direccion: "subir" | "bajar";
  modo: "porcentaje" | "monto";
  valor: number;
  /** 1 = sin redondeo (igual redondea a pesos enteros). */
  redondeo: 1 | 100 | 500 | 1000;
};

export type EstadoFila = "cambia" | "no_cambia" | "sin_precio" | "invalido";

export type FilaSimulada = {
  id: string;
  nombre: string;
  listaAntes: number | null;
  listaDespues: number | null;
  efectivoAntes: number | null;
  efectivoDespues: number | null;
  estado: EstadoFila;
};

export type ComboAfectado = { id: string; nombre: string; areaId: string | null };

export type Simulacion = { servicios: FilaSimulada[]; combos: ComboAfectado[] };

export type EntradaSimulacion = { categoryId: string; ajuste: Ajuste };

/** Vista previa. `null` = todavía no hay nada que consultar (sin categoría o valor inválido). */
export function useSimularAjuste(entrada: EntradaSimulacion | null) {
  const token = useToken();
  return useQuery({
    queryKey: ["precios-simular", entrada],
    queryFn: () =>
      apiFetch<Simulacion>("/api/agenda/precios/simular", token, {
        method: "POST",
        body: JSON.stringify(entrada),
      }),
    enabled: !!token && !!entrada,
    // Es un cálculo sobre precios vivos: nunca reusar una vista previa vieja.
    staleTime: 0,
    gcTime: 0,
  });
}

export type EntradaAplicar = EntradaSimulacion & {
  servicios: { id: string; listaVista: number | null; efectivoVista: number | null }[];
};

export function useAplicarAjuste() {
  const token = useToken();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  return useMutation({
    mutationFn: (data: EntradaAplicar) =>
      apiFetch<{ ajusteId: string; aplicados: number }>("/api/agenda/precios/aplicar", token, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: ({ aplicados }) => {
      qc.invalidateQueries({ queryKey: ["services-admin"] });
      qc.invalidateQueries({ queryKey: ["services"] });
      toast.success(`Precios actualizados: ${aplicados} ${aplicados === 1 ? "servicio" : "servicios"}`);
      navigate("/admin/servicios");
    },
  });
}
