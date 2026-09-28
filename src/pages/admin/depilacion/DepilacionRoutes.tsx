import { Navigate, Route, Routes } from "react-router-dom";
import { UltimaSolapa } from "../../../components/UltimaSolapa";
import { DepilacionLayout } from "./DepilacionLayout";
import { ConfiguracionDepilacionLayout } from "./ConfiguracionDepilacionLayout";
import { ComisionPage } from "./ComisionPage";
import { ZonasPage } from "./ZonasPage";
import { PreciosPage } from "./PreciosPage";
import { PacksPage } from "./PacksPage";
import { CombosDepilacionPage } from "./CombosDepilacionPage";

/**
 * Las rutas de Depilación, separadas de `App.tsx` para poder montarlas solas
 * en un test.
 *
 * La única de todo el árbol de administración con una ruta de compatibilidad
 * (`precios` → `configuracion/precios`) es esta: `UltimaSolapa` graba en
 * localStorage la última pestaña abierta, así que a quien tenía "Precios"
 * abierta cuando la pestaña se mudó adentro de "Configuración" sólo lo salva
 * esa ruta vieja. Que ese comportamiento se pueda romper sin que ningún test
 * se entere era justamente el riesgo — de ahí que viva en su propio archivo
 * en vez de quedar como JSX suelto dentro de `App.tsx`: así
 * `DepilacionRoutes.test.tsx` monta exactamente esto, no una copia.
 */
export function DepilacionRoutes() {
  return (
    <Routes>
      <Route element={<DepilacionLayout />}>
        <Route
          index
          element={
            <UltimaSolapa
              seccion="/admin/depilacion"
              porDefecto="/admin/depilacion/zonas"
            />
          }
        />
        <Route path="configuracion" element={<ConfiguracionDepilacionLayout />}>
          <Route index element={<Navigate to="comision" replace />} />
          <Route path="comision" element={<ComisionPage />} />
          <Route path="precios" element={<PreciosPage />} />
        </Route>
        <Route path="zonas" element={<ZonasPage />} />
        <Route path="packs" element={<PacksPage />} />
        <Route path="combos" element={<CombosDepilacionPage />} />
        {/* La ruta vieja. Ver el comentario de arriba: no es prolijidad
            eliminable, es lo único que evita la pantalla en blanco de quien
            la tenía guardada en `UltimaSolapa`.
            No se puede borrar mientras exista una entrada vieja en
            `sessionStorage` apuntando acá: `destinoDeSeccion`
            (`lib/ultima-solapa.ts`) sólo valida que lo guardado siga
            colgando del prefijo `/admin/depilacion`, no que la ruta exacta
            siga existiendo — así que una entrada `/admin/depilacion/precios`
            de hace un mes sigue pasando esa validación igual. Si esta ruta
            desaparece, `UltimaSolapa` navega directo a una URL sin match:
            pantalla en blanco, sin error en consola, para quien la tenía
            guardada. Borrarla de verdad requeriría antes limpiar/migrar las
            claves guardadas, no sólo la ruta. */}
        <Route
          path="precios"
          element={<Navigate to="/admin/depilacion/configuracion/precios" replace />}
        />
      </Route>
    </Routes>
  );
}
