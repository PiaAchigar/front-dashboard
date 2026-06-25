import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./auth/AuthContext";
import { RequireAuth } from "./auth/RequireAuth";
import { AppShell } from "./components/AppShell";
import { LoginPage } from "./pages/LoginPage";
import { DashboardHome } from "./pages/DashboardHome";
import { AgendaFrame } from "./components/AgendaFrame";
import { ServiciosWebPage } from "./pages/ServiciosWebPage";
import { ToastProvider } from "./components/ui/Toast";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { CategoriasAdminPage } from "./pages/admin/CategoriasAdminPage";
import { ServiciosAdminPage } from "./pages/admin/ServiciosAdminPage";
import { ProveedorasAdminPage } from "./pages/admin/ProveedorasAdminPage";
import { MaquinasAdminPage } from "./pages/admin/MaquinasAdminPage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
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
                <Route path="agenda" element={<AgendaFrame />} />
                <Route path="admin" element={<AdminLayout />}>
                  <Route index element={<Navigate to="/admin/servicios" replace />} />
                  <Route path="servicios" element={<ServiciosAdminPage />} />
                  <Route path="proveedoras" element={<ProveedorasAdminPage />} />
                  <Route path="categorias" element={<CategoriasAdminPage />} />
                  <Route path="maquinas" element={<MaquinasAdminPage />} />
                </Route>
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
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
