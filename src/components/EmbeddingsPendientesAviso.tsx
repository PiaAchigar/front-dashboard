import { Link } from "react-router-dom";
import { useEmbeddingsStatus } from "../hooks/useEmbeddingsStatus";

/**
 * Cartel de aviso para las pantallas donde se cargan servicios y actividades.
 * Se muestra solo cuando hay ítems sin indexar; el resto del tiempo no ocupa
 * lugar. Con el cron horario activo, que este cartel persista más de una hora
 * significa que el recálculo está fallando.
 */
export function EmbeddingsPendientesAviso() {
  const { data } = useEmbeddingsStatus();

  if (!data || data.pendientes === 0) return null;

  const plural = data.pendientes === 1 ? "ítem" : "ítems";

  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <span>
        Hay <strong>{data.pendientes}</strong> {plural} que todavía no aparecen en el buscador de la web.
      </span>
      <Link to="/configuracion/ia" className="font-medium underline underline-offset-2">
        Actualizar buscador →
      </Link>
    </div>
  );
}
