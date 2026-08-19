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

/**
 * Convierte el `error` del backend en algo legible.
 *
 * No siempre es un string: cuando falla un `zValidator` de Hono, el campo viene
 * con el objeto de error de Zod. Antes eso llegaba tal cual al constructor de
 * `ApiError`, que hace `super(message)`, y JavaScript lo convertía a
 * "[object Object]" — un mensaje que no dice nada y que además esconde la causa
 * real. Pasó con un servicio cuya descripción excedía el largo permitido: en
 * pantalla se veía "[object Object]" y hubo que ir a leer el código del backend
 * para entender qué estaba mal.
 */
function textoDeError(error: unknown): string {
  if (typeof error === "string") return error;

  // Forma de un ZodError: { issues: [{ path: [...], message: "..." }, ...] }
  const issues = (error as { issues?: { path?: unknown[]; message?: string }[] } | null)?.issues;
  if (Array.isArray(issues) && issues.length > 0) {
    return issues
      .map((i) => {
        const campo = Array.isArray(i.path) ? i.path.join(".") : "";
        return campo ? `${campo}: ${i.message}` : (i.message ?? "");
      })
      .filter(Boolean)
      .join(" · ");
  }

  const message = (error as { message?: unknown } | null)?.message;
  if (typeof message === "string") return message;

  return GENERIC_ERROR;
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
    const body = (await res.json().catch(() => ({}))) as { error?: unknown };
    // 5xx y errores sin mensaje propio → genérico. 4xx con mensaje nuestro (validaciones,
    // permisos, 404, 503) → mostramos ese texto, que ya está pensado para el usuario.
    const useServerMsg = Boolean(body.error) && res.status < 500;
    throw new ApiError(res.status, useServerMsg ? textoDeError(body.error) : GENERIC_ERROR);
  }
  return res.json() as Promise<T>;
}
