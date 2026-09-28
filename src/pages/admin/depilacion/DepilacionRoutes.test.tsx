import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { DepilacionRoutes } from "./DepilacionRoutes";

// Sin sesión, los hooks de datos de las pantallas reales (`enabled: !!token`
// en `useDepilacion.ts`) ni intentan pegarle a la red — así que no hace
// falta mockear fetch para este test, sólo importa a qué URL se aterriza.
vi.mock("../../../auth/AuthContext", () => ({
  useAuth: () => ({
    role: "admin",
    session: null,
    user: null,
    loading: false,
    signOut: vi.fn(),
  }),
}));

/** Expone la URL final donde quedó el router, para no depender de qué pinta
 *  cada pantalla adentro (eso ya lo prueba el test de cada pantalla). */
function UbicacionActual() {
  const location = useLocation();
  return <div data-testid="ubicacion">{location.pathname}</div>;
}

function montar(entrada: string) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[entrada]}>
        <UbicacionActual />
        {/* La misma forma en que `App.tsx` monta esta área: un `path="*"`
            delegando en `DepilacionRoutes`, no una copia de sus rutas. */}
        <Routes>
          <Route path="/admin/depilacion/*" element={<DepilacionRoutes />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("DepilacionRoutes", () => {
  it("la ruta vieja /precios redirige a configuracion/precios", () => {
    montar("/admin/depilacion/precios");
    // Es la garantía que pedía el riesgo #5 del plan: si alguien borra la
    // ruta de compatibilidad de `DepilacionRoutes.tsx` (la que usa `App.tsx`
    // de verdad, no una copia declarada en este test), la URL se queda en
    // "/admin/depilacion/precios" y esta aserción se pone roja.
    expect(screen.getByTestId("ubicacion")).toHaveTextContent(
      "/admin/depilacion/configuracion/precios",
    );
  });
});
