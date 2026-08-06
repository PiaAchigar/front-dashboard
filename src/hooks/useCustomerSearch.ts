import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api-client";
import { useToken } from "./useToken";

export type CustomerOption = {
  id: string;
  name: string | null;
  dni: string | null;
  phone: string | null;
  email: string | null;
};

/** Debounce simple: evita pegarle a la API en cada tecla. */
function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/**
 * Busca clientes contra la API (nombre, DNI o teléfono) en vez de traerlos
 * todos.
 *
 * Con 5600+ clientes en producción un `<select>` es inusable y además el
 * listado sin `q` corta en los más recientes, dejando al resto inalcanzable.
 * `searchCustomers` filtra en la base y devuelve como mucho 20 resultados.
 *
 * Requiere 2 caracteres: es el mínimo con el que el resultado empieza a ser
 * útil, y evita una consulta con `%%` que barre la tabla entera.
 */
export function useCustomerSearch(query: string) {
  const token = useToken();
  const debounced = useDebounced(query.trim());

  return useQuery({
    queryKey: ["customer-search", debounced],
    queryFn: () =>
      apiFetch<CustomerOption[]>(
        `/api/billing/customers?q=${encodeURIComponent(debounced)}`,
        token,
      ),
    enabled: Boolean(token) && debounced.length >= 2,
    staleTime: 60 * 1000,
  });
}
