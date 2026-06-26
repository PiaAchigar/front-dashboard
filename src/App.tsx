import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./auth/AuthContext";
import { RequireAuth } from "./auth/RequireAuth";
import { AppShell } from "./components/AppShell";
import { LoginPage } from "./pages/LoginPage";
import { DashboardHome } from "./pages/DashboardHome";
import { AyudaPage } from "./pages/AyudaPage";
import { AgendaFrame } from "./components/AgendaFrame";
import { ToastProvider } from "./components/ui/Toast";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { CategoriasAdminPage } from "./pages/admin/CategoriasAdminPage";
import { ServiciosAdminPage } from "./pages/admin/ServiciosAdminPage";
import { ProveedorasAdminPage } from "./pages/admin/ProveedorasAdminPage";
import { MaquinasAdminPage } from "./pages/admin/MaquinasAdminPage";
import { PromosAdminPage } from "./pages/admin/PromosAdminPage";
import { SitioWebLayout } from "./pages/web/SitioWebLayout";
import { VisiblesWebPage } from "./pages/web/VisiblesWebPage";
import { DestacadosWebPage } from "./pages/web/DestacadosWebPage";
import { TextosWebPage } from "./pages/web/TextosWebPage";
import { GaleriaWebPage } from "./pages/web/GaleriaWebPage";
import { TestimoniosWebPage } from "./pages/web/TestimoniosWebPage";
import { FaqWebPage } from "./pages/web/FaqWebPage";
import { ConfiguracionLayout } from "./pages/config/ConfiguracionLayout";
import { DatosEmpresaPage } from "./pages/config/DatosEmpresaPage";
import { UsuariosPage } from "./pages/config/UsuariosPage";

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
                  <Route path="promos" element={<PromosAdminPage />} />
                </Route>
                <Route
                  path="facturacion"
                  element={<DashboardHome section="Facturación" />}
                />
                <Route path="crm" element={<DashboardHome section="CRM" />} />
                <Route path="sitio-web" element={<SitioWebLayout />}>
                  <Route index element={<Navigate to="/sitio-web/visibles" replace />} />
                  <Route path="visibles" element={<VisiblesWebPage />} />
                  <Route path="destacados" element={<DestacadosWebPage />} />
                  <Route path="textos" element={<TextosWebPage />} />
                  <Route path="galeria" element={<GaleriaWebPage />} />
                  <Route path="testimonios" element={<TestimoniosWebPage />} />
                  <Route path="faq" element={<FaqWebPage />} />
                </Route>
                <Route path="configuracion" element={<ConfiguracionLayout />}>
                  <Route index element={<Navigate to="/configuracion/empresa" replace />} />
                  <Route path="empresa" element={<DatosEmpresaPage />} />
                  <Route path="usuarios" element={<UsuariosPage />} />
                </Route>
                <Route path="ayuda" element={<AyudaPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
