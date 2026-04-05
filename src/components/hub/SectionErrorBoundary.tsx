import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  sectionName?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[SectionErrorBoundary] ${this.props.sectionName || "unknown"}:`, error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-[#111111] border border-red-900/30 rounded-lg p-6 flex flex-col items-center justify-center gap-3 min-h-[120px]">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <p className="text-xs text-zinc-400 font-mono text-center">
            Erro ao carregar{" "}
            <span className="text-zinc-300">{this.props.sectionName || "seção"}</span>
          </p>
          {this.state.error && (
            <p className="text-[10px] text-zinc-600 font-mono max-w-md text-center truncate">
              {this.state.error.message}
            </p>
          )}
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono text-zinc-300 bg-[#1a1a1a] border border-[#222] rounded hover:bg-[#222] transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Tentar novamente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
