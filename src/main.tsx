import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider, QueryCache } from "@tanstack/react-query";
import { Analytics } from "@vercel/analytics/react";
import { toast } from "@/hooks/use-toast";
import { initErrorTracking } from "@/lib/errorTracking";
import { AuthProvider } from "@/hooks/useAuth";
import App from "./App";
import "./index.css";
import "./styles/mobile-fixes.css";

// Initialize global error tracking
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
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <App />
            <Analytics />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </HelmetProvider>
  </React.StrictMode>
);
