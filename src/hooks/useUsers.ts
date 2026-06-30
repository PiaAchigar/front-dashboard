import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api-client";
import type { AdminUser } from "../lib/api-types";
import type { Role } from "../lib/permissions";

export type { Role } from "../lib/permissions";

const KEY = "admin-users";

function useToken() {
  const { session } = useAuth();
  return session?.access_token ?? null;
}

export function useUsers() {
  const token = useToken();
  return useQuery({
    queryKey: [KEY],
    queryFn: () => apiFetch<AdminUser[]>("/api/users", token),
    enabled: !!token,
    staleTime: 30 * 1000,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [KEY] });
}

export function useCreateUser() {
  const token = useToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (data: { email: string; password: string; role: Role }) =>
      apiFetch("/api/users", token, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: invalidate,
  });
}

export function useUpdateUserRole() {
  const token = useToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) =>
      apiFetch(`/api/users/${id}`, token, { method: "PATCH", body: JSON.stringify({ role }) }),
    onSuccess: invalidate,
  });
}

export function useDeleteUser() {
  const token = useToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/users/${id}`, token, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}
