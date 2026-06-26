const API_URL = import.meta.env.VITE_API_URL as string;

/** Mensaje genérico amigable para errores no esperados (500/502/red). */
export const GENERIC_ERROR =
  "Hubo un problema, no pudimos realizar tu solicitud. Probá de nuevo en un momento.";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiFetch<T>(
  path: string,
  token: string | null,
  options?: RequestInit,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    // Falla de red / CORS / servidor caído: nunca mostramos el error técnico.
    throw new ApiError(0, GENERIC_ERROR);
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    // 5xx y errores sin mensaje propio → genérico. 4xx con mensaje nuestro (validaciones,
    // permisos, 404, 503) → mostramos ese texto, que ya está pensado para el usuario.
    const useServerMsg = Boolean(body.error) && res.status < 500;
    throw new ApiError(res.status, useServerMsg ? (body.error as string) : GENERIC_ERROR);
  }
  return res.json() as Promise<T>;
}
