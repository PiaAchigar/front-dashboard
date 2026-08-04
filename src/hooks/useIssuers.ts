import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api-client";

const KEY = "arca-issuers";

/** Facturador ARCA. Las credenciales (token/cert/key) NUNCA vuelven del backend. */
export type Issuer = {
  id: string;
  name: string | null;
  cuit: string | null;
  environment: "homo" | "prod" | null;
  pointOfSale: number | null;
  invoiceType: string | null;
  isActive: boolean | null;
  isDefault: boolean | null;
  notes: string | null;
  createdAt: string | null;
};

export type IssuerInput = {
  name: string;
  cuit: string;
  sdkToken: string;
  cert: string;
  key: string;
  environment: "homo" | "prod";
  pointOfSale: number;
  invoiceType: "A" | "B" | "C";
  isDefault: boolean;
  notes?: string;
};

/** En edición los secretos son opcionales: si van vacíos, se conservan los actuales. */
export type IssuerPatch = Partial<IssuerInput> & { isActive?: boolean };

function useToken() {
  const { session } = useAuth();
  return session?.access_token ?? null;
}

export function useIssuers() {
  const token = useToken();
  return useQuery({
    queryKey: [KEY],
    queryFn: () => apiFetch<Issuer[]>("/api/billing/issuers", token),
    enabled: !!token,
    staleTime: 30 * 1000,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [KEY] });
}

export function useCreateIssuer() {
  const token = useToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (data: IssuerInput) =>
      apiFetch<Issuer>("/api/billing/issuers", token, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: invalidate,
  });
}

export function useUpdateIssuer() {
  const token = useToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...data }: IssuerPatch & { id: string }) =>
      apiFetch<Issuer>(`/api/billing/issuers/${id}`, token, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: invalidate,
  });
}

/** Baja lógica: la fila queda para poder auditar las facturas ya emitidas. */
export function useDeactivateIssuer() {
  const token = useToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/billing/issuers/${id}`, token, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}
