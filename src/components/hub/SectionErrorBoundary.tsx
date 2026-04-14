import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { logError } from "@/lib/errorTracking";

interface Props {
  children: ReactNode;
  sectionName?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
  retryCount: number;
  isRetrying: boolean;
}

export class SectionErrorBoundary extends Component<Props, State> {
  private retryTimer?: NodeJS.Timeout;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, retryCount: 0, isRetrying: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logError(error, {
      source: "SectionErrorBoundary",
      componentStack: info.componentStack ?? undefined,
      metadata: { section: this.props.sectionName },
    });
    console.error(`[SectionErrorBoundary] ${this.props.sectionName || "unknown"}:`, error, info);
  }

  componentWillUnmount() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }

  handleRetry = () => {
    const newRetryCount = this.state.retryCount + 1;
    if (newRetryCount >= 3) {
      // After 3 retries, offer feedback submission instead
      alert(
        "Múltiplas tentativas falharam. Envie um feedback detalhado para que possamos investigar."
      );
      return;
    }

    this.setState({ isRetrying: true, retryCount: newRetryCount });

    // Auto-retry network errors after 30 seconds
    if (this.state.error?.message.includes("Network") || this.state.error?.message.includes("fetch")) {
      this.retryTimer = setTimeout(() => {
        this.setState({ hasError: false, error: undefined, isRetrying: false });
      }, 3000);
    } else {
      this.setState({ hasError: false, error: undefined, isRetrying: false });
    }
  };

  getErrorMessage(): string {
    const msg = this.state.error?.message || "";
    if (msg.includes("Network") || msg.includes("fetch")) {
      return "Erro de conexão — verifique sua internet";
    }
    if (msg.includes("401") || msg.includes("Unauthorized")) {
      return "Sessão expirada — faça login novamente";
    }
    if (msg.includes("403") || msg.includes("Forbidden")) {
      return "Acesso negado — verifique seu plano";
    }
    if (msg.includes("429") || msg.includes("Too Many")) {
      return "Muitas requisições — aguarde alguns instantes";
    }
    if (msg.includes("500") || msg.includes("Internal Server")) {
      return "Erro no servidor — tente novamente em breve";
    }
    return msg || "Erro desconhecido";
  }

  render() {
    if (this.state.hasError) {
      const errorMsg = this.getErrorMessage();
      const isNetworkError = this.state.error?.message.includes("Network") || this.state.error?.message.includes("fetch");

      return (
        <div className="bg-zinc-900/50 border border-red-900/30 rounded-lg p-6 flex flex-col items-center justify-center gap-4 min-h-[140px]">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <div className="text-center">
            <p className="text-xs text-zinc-400 font-mono">
              Erro ao carregar{" "}
              <span className="text-zinc-300">{this.props.sectionName || "seção"}</span>
            </p>
            <p className="text-[11px] text-zinc-300 mt-2 font-medium">{errorMsg}</p>
            {this.state.retryCount > 0 && (
              <p className="text-[9px] text-zinc-600 mt-1">
                Tentativa {this.state.retryCount} de 3
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 w-full">
            <button
              onClick={this.handleRetry}
              disabled={this.state.isRetrying}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] font-mono text-zinc-300 bg-[#1a1a1a] border border-[#222] rounded hover:bg-[#222] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3 h-3 ${this.state.isRetrying ? "animate-spin" : ""}`} />
              {this.state.isRetrying ? "Tentando..." : "Tentar novamente"}
            </button>
            {isNetworkError && this.state.retryCount === 0 && (
              <p className="text-[9px] text-zinc-600 text-center">
                Irá tentar automaticamente em 30 segundos...
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
