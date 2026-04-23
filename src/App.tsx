import React, { Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { HubLayout } from "@/components/hub/HubLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RequireTier } from "@/components/hub/RequireTier";
import { ErrorBoundary } from "@/components/ErrorBoundary";

/* Lazy-loaded pages */
const HubLanding = React.lazy(() => import("./pages/HubLanding"));
const HubLogin = React.lazy(() => import("./pages/HubLogin"));
const HubForgotPassword = React.lazy(() => import("./pages/HubForgotPassword"));
const HubResetPassword = React.lazy(() => import("./pages/HubResetPassword"));
const HubFirstAccess = React.lazy(() => import("./pages/HubFirstAccess"));
const HubUpgrade = React.lazy(() => import("./pages/HubUpgrade"));
const HubSettings = React.lazy(() => import("./pages/HubSettings"));
const HubDashboard = React.lazy(() => import("./pages/HubDashboard"));
const HubMacro = React.lazy(() => import("./pages/HubMacro"));
const HubCredito = React.lazy(() => import("./pages/HubCredito"));
const HubRendaFixa = React.lazy(() => import("./pages/HubRendaFixa"));
const HubFundos = React.lazy(() => import("./pages/HubFundos"));
const FundLamina = React.lazy(() => import("./pages/FundLamina"));
const FidcHub = React.lazy(() => import("./pages/FidcHub"));
const FidcLamina = React.lazy(() => import("./pages/FidcLamina"));
const FiiHub = React.lazy(() => import("./pages/FiiHub"));
const FiiLamina = React.lazy(() => import("./pages/FiiLamina"));
const OfertasRadar = React.lazy(() => import("./pages/OfertasRadar"));
const AlternativosHub = React.lazy(() => import("./pages/AlternativosHub"));
const AlternativosDetail = React.lazy(() => import("./pages/AlternativosDetail"));
const HubPortfolio = React.lazy(() => import("./pages/HubPortfolio"));
const NotFound = React.lazy(() => import("./pages/NotFound"));

/* Preload critical routes for faster navigation */
const preloadDashboard = () => import("./pages/HubDashboard");
const preloadMacro = () => import("./pages/HubMacro");

// Trigger preload after initial render
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    setTimeout(() => {
      preloadDashboard();
      preloadMacro();
    }, 2000);
  }, { once: true });
}

/* Gate wrapper for Pro-only routes */
const ProRoute = ({ children, feature }: { children: React.ReactNode; feature?: string }) => (
  <RequireTier tier="pro" feature={feature}>
    {children}
  </RequireTier>
);

const Loading = () => (
  <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
    <div className="w-8 h-8 rounded-full border-2 border-[#0B6C3E] border-t-transparent animate-spin" />
  </div>
);

const App = () => (
  <ErrorBoundary>
    <Suspense fallback={<Loading />}>
      <Routes>
        {/* Landing page — public */}
        <Route path="/" element={<HubLanding />} />

        {/* Login & password recovery — public */}
        <Route path="/login" element={<HubLogin />} />
        <Route path="/forgot-password" element={<HubForgotPassword />} />
        <Route path="/reset-password" element={<HubResetPassword />} />
        <Route path="/primeiro-acesso" element={<HubFirstAccess />} />

        {/* Dashboard + Modules — protected, inside HubLayout (sidebar + header) */}
        <Route
          element={
            <ProtectedRoute>
              <HubLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<HubDashboard />} />
          <Route path="/macro" element={<HubMacro />} />
          <Route path="/credito" element={<HubCredito />} />
          <Route path="/renda-fixa" element={<HubRendaFixa />} />
          {/* FIDC Deep Module — Pro only */}
          <Route
            path="/fundos/fidc/:slug"
            element={<ProRoute feature="a lâmina completa de FIDC"><FidcLamina /></ProRoute>}
          />
          <Route
            path="/fundos/fidc"
            element={<ProRoute feature="o módulo FIDC completo"><FidcHub /></ProRoute>}
          />
          {/* FII Deep Module — Pro only */}
          <Route
            path="/fundos/fii/:slug"
            element={<ProRoute feature="a lâmina completa de FII"><FiiLamina /></ProRoute>}
          />
          <Route
            path="/fundos/fii"
            element={<ProRoute feature="o módulo FII completo"><FiiHub /></ProRoute>}
          />
          {/* Ofertas Públicas — standalone module, Pro only */}
          <Route
            path="/ofertas"
            element={<ProRoute feature="o módulo Ofertas Públicas"><OfertasRadar /></ProRoute>}
          />
          {/* Ativos Alternativos — Pro only, specific before generic */}
          <Route
            path="/alternativos/:slug"
            element={<ProRoute feature="a lâmina de Ativos Alternativos"><AlternativosDetail /></ProRoute>}
          />
          <Route
            path="/alternativos"
            element={<ProRoute feature="o módulo Ativos Alternativos"><AlternativosHub /></ProRoute>}
          />
          <Route path="/fundos/:slug" element={<FundLamina />} />
          <Route path="/fundos" element={<HubFundos />} />
          <Route path="/portfolio" element={<HubPortfolio />} />
          <Route path="/upgrade" element={<HubUpgrade />} />
          <Route path="/configuracoes" element={<HubSettings />} />
        </Route>

        {/* Backward compat: /hub/* redirects from old muuney-landing routes */}
        <Route path="/hub" element={<Navigate to="/" replace />} />
        <Route path="/hub/dashboard" element={<Navigate to="/dashboard" replace />} />
        <Route path="/hub/macro" element={<Navigate to="/macro" replace />} />
        <Route path="/hub/credito" element={<Navigate to="/credito" replace />} />
        <Route path="/hub/renda-fixa" element={<Navigate to="/renda-fixa" replace />} />
        <Route path="/hub/fundos" element={<Navigate to="/fundos" replace />} />
        <Route path="/fundos/ofertas" element={<Navigate to="/ofertas" replace />} />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  </ErrorBoundary>
);

export default App;
