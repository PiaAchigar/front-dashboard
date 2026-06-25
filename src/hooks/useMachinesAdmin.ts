import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api-client";
import type { Machine, MaintenanceLog } from "../lib/api-types";

export type MachineInput = {
  name: string;
  description?: string | null;
  equipmentType?: string | null;
  requiresOperator?: boolean | null;
  hourlyCost?: number | null;
  status?: "active" | "inactive" | "maintenance";
  purchaseDate?: string | null;
  weightKg?: number | null;
  dimensions?: string | null;
  quantity?: number | null;
  maintenanceNotes?: string | null;
  supplierInfo?: string | null;
  warrantyCost?: number | null;
  warrantyExpiry?: string | null;
};

export type LogInput = {
  maintenanceDate: string;
  maintenanceType?: string | null;
  description?: string | null;
  cost?: number | null;
  performedBy?: string | null;
  notes?: string | null;
};

const KEY = "machines-admin";

function useToken() {
  const { session } = useAuth();
  return session?.access_token ?? null;
}

export function useMachinesAdmin(showArchived: boolean) {
  const token = useToken();
  const qs = showArchived ? "?includeInactive=true" : "";
  return useQuery({
    queryKey: [KEY, showArchived],
    queryFn: () => apiFetch<Machine[]>(`/api/agenda/machines${qs}`, token),
    enabled: !!token,
    staleTime: 60 * 1000,
  });
}

/** Lista de máquinas activas para selects (ej. fix de Servicio). */
export function useMachinesList() {
  const token = useToken();
  return useQuery({
    queryKey: [KEY, false],
    queryFn: () => apiFetch<Machine[]>("/api/agenda/machines", token),
    enabled: !!token,
    staleTime: 60 * 1000,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [KEY] });
}

export function useCreateMachine() {
  const token = useToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (data: MachineInput) =>
      apiFetch("/api/agenda/machines", token, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: invalidate,
  });
}

export function useUpdateMachine() {
  const token = useToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...patch }: MachineInput & { id: string }) =>
      apiFetch(`/api/agenda/machines/${id}`, token, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: invalidate,
  });
}

export function useArchiveMachine() {
  const token = useToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/agenda/machines/${id}`, token, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

export function useRestoreMachine() {
  const token = useToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/agenda/machines/${id}/restore`, token, { method: "POST" }),
    onSuccess: invalidate,
  });
}

// ── Logs de mantenimiento (por máquina) ─────────────────────────────────────

export function useMaintenanceLogs(machineId: string | null) {
  const token = useToken();
  return useQuery({
    queryKey: ["machine-logs", machineId],
    queryFn: () => apiFetch<MaintenanceLog[]>(`/api/agenda/machines/${machineId}/logs`, token),
    enabled: !!token && !!machineId,
  });
}

function useInvalidateLogs(machineId: string | null) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["machine-logs", machineId] });
    qc.invalidateQueries({ queryKey: [KEY] }); // maintenance_count cambió
  };
}

export function useCreateLog(machineId: string | null) {
  const token = useToken();
  const invalidate = useInvalidateLogs(machineId);
  return useMutation({
    mutationFn: (data: LogInput) =>
      apiFetch(`/api/agenda/machines/${machineId}/logs`, token, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: invalidate,
  });
}

export function useUpdateLog(machineId: string | null) {
  const token = useToken();
  const invalidate = useInvalidateLogs(machineId);
  return useMutation({
    mutationFn: ({ logId, ...patch }: Partial<LogInput> & { logId: string }) =>
      apiFetch(`/api/agenda/machines/log/${logId}`, token, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: invalidate,
  });
}

export function useDeleteLog(machineId: string | null) {
  const token = useToken();
  const invalidate = useInvalidateLogs(machineId);
  return useMutation({
    mutationFn: (logId: string) =>
      apiFetch(`/api/agenda/machines/log/${logId}`, token, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}
