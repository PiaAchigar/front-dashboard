import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./auth/AuthContext";
import { RequireAuth } from "./auth/RequireAuth";
import { AppShell } from "./components/AppShell";
import { LoginPage } from "./pages/LoginPage";
import { DashboardHome } from "./pages/DashboardHome";
import { AgendaPage } from "./pages/AgendaPage";
import { ServiciosWebPage } from "./pages/ServiciosWebPage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <AppShell />
                </RequireAuth>
              }
            >
              <Route index element={<Navigate to="/agenda" replace />} />
              <Route path="agenda" element={<AgendaPage />} />
              <Route
                path="facturacion"
                element={<DashboardHome section="Facturación" />}
              />
              <Route path="crm" element={<DashboardHome section="CRM" />} />
              <Route path="sitio-web" element={<ServiciosWebPage />} />
              <Route
                path="configuracion"
                element={<DashboardHome section="Configuración" />}
              />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
