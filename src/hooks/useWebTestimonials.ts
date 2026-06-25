import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api-client";
import type { WebTestimonial } from "../lib/api-types";

const KEY = "web-testimonials";

export type TestimonialInput = {
  authorName?: string | null;
  body?: string | null;
  rating?: number | null;
  isVisible?: boolean | null;
};

function useToken() {
  const { session } = useAuth();
  return session?.access_token ?? null;
}

export function useWebTestimonials() {
  const token = useToken();
  return useQuery({
    queryKey: [KEY],
    queryFn: () => apiFetch<WebTestimonial[]>("/api/agenda/web/testimonials", token),
    enabled: !!token,
    staleTime: 60 * 1000,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [KEY] });
}

export function useCreateTestimonial() {
  const token = useToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (data: TestimonialInput) =>
      apiFetch("/api/agenda/web/testimonials", token, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: invalidate,
  });
}

export function useUpdateTestimonial() {
  const token = useToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...patch }: TestimonialInput & { id: string }) =>
      apiFetch(`/api/agenda/web/testimonials/${id}`, token, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: invalidate,
  });
}

export function useDeleteTestimonial() {
  const token = useToken();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/agenda/web/testimonials/${id}`, token, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}
