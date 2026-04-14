import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { initErrorTracking } from "@/lib/errorTracking";
import { AuthProvider } from "@/hooks/useAuth";
import App from "./App";
import "./index.css";

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
  defaultOptions: {
    queries: {
      staleTime: 30 * 60 * 1000,    // 30 min — market data refreshes infrequently
      gcTime: 60 * 60 * 1000,        // 1 hour — keep cached data longer for navigation
      retry: 2,
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',   // refetch after network recovery
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
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </HelmetProvider>
  </React.StrictMode>
);
