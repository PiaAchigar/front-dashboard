import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api-client";
import type { WebGalleryItem } from "../lib/api-types";

const KEY = "web-gallery";

export type GalleryInput = {
  publicUrl?: string | null;
  alt?: string | null;
  caption?: string | null;
  sortOrder?: number | null;
  isVisible?: boolean | null;
};

function useToken() {
  const { session } = useAuth();
  return session?.access_token ?? null;
}

export function useWebGallery() {
  const token = useToken();
  return useQuery({
    queryKey: [KEY],
    queryFn: () => apiFetch<WebGalleryItem[]>("/api/agenda/web/gallery", token),
    enabled: !!token,
    staleTime: 60 * 1000,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [KEY] });
}

export function useCreateGalleryItem() {
  const token = useToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (data: GalleryInput) =>
      apiFetch("/api/agenda/web/gallery", token, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: invalidate,
  });
}

export function useUpdateGalleryItem() {
  const token = useToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...patch }: GalleryInput & { id: string }) =>
      apiFetch(`/api/agenda/web/gallery/${id}`, token, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: invalidate,
  });
}

export function useDeleteGalleryItem() {
  const token = useToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/agenda/web/gallery/${id}`, token, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}
