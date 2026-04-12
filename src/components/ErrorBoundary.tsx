import { Component, type ReactNode, type ErrorInfo } from "react";
import { logError } from "@/lib/errorTracking";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Detect whether an error is a chunk/dynamic-import failure
 * (stale browser cache after a new Vercel deploy).
 */
function isChunkLoadError(error: Error): boolean {
  const msg = error.message || "";
  return (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Loading chunk") ||
    msg.includes("Loading CSS chunk") ||
    msg.includes("Importing a module script failed") ||
    (error.name === "TypeError" && msg.includes("dynamically imported module"))
  );
}

const CHUNK_RELOAD_KEY = "muuney_chunk_reload";

/**
 * Error Boundary — catches rendering errors in lazy-loaded pages
 * and logs them to the observability layer.
 *
 * For chunk-load failures (stale deploy), it auto-reloads once.
 * If the reload already happened, it shows a user-friendly message
 * asking them to hard-refresh.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Auto-reload once on chunk load failure (stale deploy)
    if (isChunkLoadError(error) && !sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
      window.location.reload();
      return;
    }

    logError(error, {
      componentStack: errorInfo.componentStack ?? undefined,
      source: "ErrorBoundary",
    });
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  private handleHardReload = (): void => {
    // Clear the reload guard so the next attempt is fresh
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const chunkError = this.state.error && isChunkLoadError(this.state.error);

      return (
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
          <div className="text-center max-w-md px-6">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-red-400 text-xl font-bold">!</span>
            </div>
            <h2 className="text-lg font-semibold text-zinc-200 mb-2">
              {chunkError ? "Atualização disponível" : "Algo deu errado"}
            </h2>
            <p className="text-sm text-zinc-500 mb-1">
              {chunkError
                ? "Uma nova versão do hub foi publicada. Recarregue a página para continuar."
                : "Ocorreu um erro ao carregar esta página."}
            </p>
            {this.state.error && !chunkError && (
              <p className="text-xs text-zinc-700 font-mono mb-4 break-all">
                {this.state.error.message}
              </p>
            )}
            <div className="flex items-center justify-center gap-3 mt-4">
              {chunkError ? (
                <button
                  onClick={this.handleHardReload}
                  className="px-4 py-2 bg-[#0B6C3E] text-white text-sm rounded-md hover:bg-[#0B6C3E]/80 transition-colors"
                >
                  Recarregar página
                </button>
              ) : (
                <>
                  <button
                    onClick={this.handleRetry}
                    className="px-4 py-2 bg-[#0B6C3E] text-white text-sm rounded-md hover:bg-[#0B6C3E]/80 transition-colors"
                  >
                    Tentar novamente
                  </button>
                  <a
                    href="/"
                    className="px-4 py-2 border border-zinc-700 text-zinc-300 text-sm rounded-md hover:bg-zinc-800 transition-colors"
                  >
                    Voltar ao Hub
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
