import React, { Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { HubLayout } from "@/components/hub/HubLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";

/* Lazy-loaded pages */
const HubLanding = React.lazy(() => import("./pages/HubLanding"));
const HubDashboard = React.lazy(() => import("./pages/HubDashboard"));
const HubMacro = React.lazy(() => import("./pages/HubMacro"));
const HubCredito = React.lazy(() => import("./pages/HubCredito"));
const HubRendaFixa = React.lazy(() => import("./pages/HubRendaFixa"));
const NotFound = React.lazy(() => import("./pages/NotFound"));

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

        {/* Dashboard + Modules — inside HubLayout (sidebar + header) */}
        <Route element={<HubLayout />}>
          <Route path="/dashboard" element={<HubDashboard />} />
          <Route path="/macro" element={<HubMacro />} />
          <Route path="/credito" element={<HubCredito />} />
          <Route path="/renda-fixa" element={<HubRendaFixa />} />
        </Route>

        {/* Backward compat: /hub/* redirects from old muuney-landing routes */}
        <Route path="/hub" element={<Navigate to="/" replace />} />
        <Route path="/hub/dashboard" element={<Navigate to="/dashboard" replace />} />
        <Route path="/hub/macro" element={<Navigate to="/macro" replace />} />
        <Route path="/hub/credito" element={<Navigate to="/credito" replace />} />
        <Route path="/hub/renda-fixa" element={<Navigate to="/renda-fixa" replace />} />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  </ErrorBoundary>
);

export default App;
