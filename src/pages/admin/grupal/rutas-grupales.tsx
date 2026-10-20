import { Navigate, Route } from "react-router-dom";
import { solapasDeActividades, solapasDeCapacitaciones } from "../../../lib/admin-nav";
import { ActividadesAdminPage } from "../ActividadesAdminPage";
import { CapacitacionesAdminPage } from "../CapacitacionesAdminPage";
import { SubscriptionsAdminPage } from "../SubscriptionsAdminPage";
import { GrupalLayout } from "./GrupalLayout";

/**
 * Las rutas de Actividades y Capacitaciones, aparte de `App.tsx` para poder
 * testearlas montadas tal cual (mismo criterio que `DepilacionRoutes`).
 * Se llama como función dentro de `<Route path="admin">`, no como componente:
 * `<Routes>` sólo acepta `<Route>` o fragmentos como hijos.
 */
export function rutasGrupales() {
  return (
    <>
      <Route
        path="actividades"
        element={
          <GrupalLayout
            titulo="Actividades"
            bajada="Clases con suscripción mensual: sus horarios y quiénes están suscriptas."
            solapas={solapasDeActividades()}
          />
        }
      >
        <Route index element={<Navigate to="lista" replace />} />
        <Route path="lista" element={<ActividadesAdminPage />} />
        <Route path="suscripciones" element={<SubscriptionsAdminPage />} />
      </Route>
      <Route
        path="capacitaciones"
        element={
          <GrupalLayout
            titulo="Capacitaciones"
            bajada="Capacitaciones y talleres: sus encuentros y quiénes se inscribieron."
            solapas={solapasDeCapacitaciones()}
          />
        }
      >
        <Route index element={<Navigate to="lista" replace />} />
        <Route path="lista" element={<CapacitacionesAdminPage />} />
      </Route>
      {/* La pestaña suelta de Suscripciones se sacó: quien tenga el link viejo aterriza adentro de Actividades. */}
      <Route
        path="suscripciones"
        element={<Navigate to="/admin/actividades/suscripciones" replace />}
      />
    </>
  );
}
