import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useEmbeddingsStatus } from "../hooks/useEmbeddingsStatus";

/**
 * Cartel de aviso para las pantallas donde se cargan servicios y actividades.
 * Se muestra solo cuando hay ítems sin indexar; el resto del tiempo no ocupa
 * lugar.
 *
 * Dice dos cosas además del número, y las dos hacen falta:
 *
 * - Que se actualiza solo. El cron del Worker corre a la hora en punto
 *   (`crons = [..., "0 * * * *"]` en wrangler.toml). Sin decirlo, un cartel
 *   ámbar que aparece solo se lee como "algo se rompió" y quien lo ve siente
 *   que tiene que correr a arreglarlo.
 * - Que conviene editar todo y actualizar una vez al final, en lugar de una
 *   corrida por cada servicio tocado. Eso sí se lo decimos solo a quien puede
 *   apretar el botón: al resto le sobra.
 *
 * `/admin/servicios` y `/admin/actividades` (donde vive este cartel) no
 * tienen guard de rol, pero `/configuracion/ia` sí (`ConfiguracionLayout`
 * corta con `role !== "admin"`). Sin este chequeo, un usuario
 * manager/operator/sales veía el link, hacía clic y aterrizaba en "esta
 * sección es solo para administradores".
 */
export function EmbeddingsPendientesAviso() {
  const { role } = useAuth();
  const { data } = useEmbeddingsStatus();

  if (!data || data.pendientes === 0) return null;

  const esAdmin = role === "admin";
  const plural = data.pendientes === 1 ? "ítem" : "ítems";
  const verbo = data.pendientes === 1 ? "aparece" : "aparecen";

  return (
    <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>
          Hay <strong>{data.pendientes}</strong> {plural} que todavía no {verbo}{" "}
          en el buscador de la web.
        </span>
        {esAdmin && (
          <Link
            to="/configuracion/ia"
            className="font-medium underline underline-offset-2"
          >
            Actualizar buscador →
          </Link>
        )}
      </div>
      <p className="mt-1 text-xs text-amber-800">
        {esAdmin
          ? "Si vas a editar o cargar más, terminá todo y actualizá una sola vez al final: cada actualización consume tokens de OpenAI. Y si no lo hacés, se actualiza solo cada hora en punto."
          : "Se actualiza solo cada hora en punto."}
      </p>
    </div>
  );
}
