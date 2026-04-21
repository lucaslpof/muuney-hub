import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider, QueryCache } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { initErrorTracking } from "@/lib/errorTracking";
import { initSentry, Sentry } from "@/lib/sentry";
import { AuthProvider } from "@/hooks/useAuth";
import App from "./App";
import "./index.css";
import "./styles/mobile-fixes.css";

// Initialize Sentry first so subsequent errors are captured
initSentry();

// Initialize global error tracking (forwards to Sentry when configured)
initErrorTracking();

// Auto-reload on stale chunk errors (Vite content-hashed chunks after deploy)
// When a new deploy changes chunk hashes, users with a cached index.html will
// request old filenames that no longer exist → 404 → this listener reloads once.
window.addEventListener("vite:preloadError", (event) => {
  const reloadedKey = "muuney_chunk_reload";
  if (!sessionStorage.getItem(reloadedKey)) {
    sessionStorage.setItem(reloadedKey, "1");
    window.location.reload();
  }
  // If we already reloaded once and still failing, let ErrorBoundary handle it
  event.preventDefault();
});

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error: Error, query) => {
      // Only show toast if query has been cached before (avoid flooding on first load)
      if (query.state.data !== undefined) {
        const message = error.message || "Não foi possível atualizar os dados. Usando cache.";
        toast({
          title: "Atualização falhou",
          description: message,
          variant: "destructive",
        });
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30 * 60 * 1000,    // 30 min — market data refreshes infrequently
      gcTime: 60 * 60 * 1000,        // 1 hour — keep cached data longer for navigation
      retry: 2,
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',   // refetch after network recovery
    },
    mutations: {
      onError: (error: Error) => {
        const message = error.message || "Algo deu errado. Tente novamente.";
        toast({
          title: "Erro",
          description: message,
          variant: "destructive",
        });
      },
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#fafafa",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "2rem",
        }}>
          <div style={{ maxWidth: 480, textAlign: "center" }}>
            <h1 style={{ fontSize: 24, marginBottom: 12, color: "#0B6C3E" }}>
              Algo deu errado
            </h1>
            <p style={{ color: "#a1a1aa", marginBottom: 20, fontSize: 14 }}>
              Registramos o erro e já estamos olhando. Tenta recarregar em alguns segundos.
            </p>
            <details style={{ color: "#52525b", fontSize: 12, marginBottom: 20, textAlign: "left" }}>
              <summary style={{ cursor: "pointer" }}>Detalhes técnicos</summary>
              <pre style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>
                {error instanceof Error ? error.message : String(error)}
              </pre>
            </details>
            <button
              onClick={() => { resetError(); window.location.reload(); }}
              style={{
                background: "#0B6C3E",
                color: "#fafafa",
                border: "none",
                padding: "10px 24px",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Recarregar
            </button>
          </div>
        </div>
      )}
    >
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <App />
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </HelmetProvider>
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
