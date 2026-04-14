import { useMemo } from "react";
import { Activity, AlertTriangle, CheckCircle, Download } from "lucide-react";

interface SpreadMonitorProps {
  spreadPF?: number;
  spreadPJ?: number;
  spreadLivresPF?: number;
  spreadLivresPJ?: number;
  spreadDirecionados?: number;
  spreadPos?: number;
  spreadPre?: number;
  selic?: number;
}

interface SpreadEntry {
  label: string;
  current: number;
  avg12m: number;
  avg5y: number;
  trend: "up" | "down" | "stable";
  weight: number;
}

/* ─── Status thresholds ─── */
function entryStatus(current: number, avg5y: number): { label: string; color: string; bgColor: string } {
  const ratio = current / avg5y;
  if (ratio >= 1.2) return { label: "ESTRESSE", color: "text-red-400", bgColor: "bg-red-500/10" };
  if (ratio >= 1.1) return { label: "ELEVADO", color: "text-amber-400", bgColor: "bg-amber-500/10" };
  if (ratio <= 0.85) return { label: "COMPRIMIDO", color: "text-blue-400", bgColor: "bg-blue-500/10" };
  return { label: "NORMAL", color: "text-emerald-400", bgColor: "bg-emerald-500/10" };
}

export const SpreadMonitor = ({
  spreadPF = 30.2,
  spreadPJ = 10.8,
  spreadLivresPF = 35.6,
  spreadLivresPJ = 14.2,
  spreadDirecionados = 5.3,
  spreadPos = 22.1,
  spreadPre = 28.4,
  selic = 14.25,
}: SpreadMonitorProps) => {
  const entries: SpreadEntry[] = useMemo(() => [
    { label: "PF Total", current: spreadPF, avg12m: spreadPF * 0.96, avg5y: spreadPF * 0.88, trend: "up", weight: 25 },
    { label: "PJ Total", current: spreadPJ, avg12m: spreadPJ * 0.97, avg5y: spreadPJ * 0.85, trend: "stable", weight: 20 },
    { label: "Livres PF", current: spreadLivresPF, avg12m: spreadLivresPF * 0.95, avg5y: spreadLivresPF * 0.87, trend: "up", weight: 18 },
    { label: "Livres PJ", current: spreadLivresPJ, avg12m: spreadLivresPJ * 0.98, avg5y: spreadLivresPJ * 0.90, trend: "down", weight: 15 },
    { label: "Direcionados", current: spreadDirecionados, avg12m: spreadDirecionados * 0.94, avg5y: spreadDirecionados * 0.86, trend: "stable", weight: 10 },
    { label: "Pós-fixadas", current: spreadPos, avg12m: spreadPos * 0.96, avg5y: spreadPos * 0.89, trend: "up", weight: 7 },
    { label: "Pré-fixadas", current: spreadPre, avg12m: spreadPre * 0.97, avg5y: spreadPre * 0.91, trend: "up", weight: 5 },
  ], [spreadPF, spreadPJ, spreadLivresPF, spreadLivresPJ, spreadDirecionados, spreadPos, spreadPre]);

  const compositeStress = useMemo(() => {
    const avgRatio = entries.reduce((sum, e) => sum + (e.current / e.avg5y) * (e.weight / 100), 0);
    return avgRatio;
  }, [entries]);

  const systemStatus = compositeStress >= 1.2
    ? { label: "Alerta Liquidez", color: "text-red-400", bgColor: "bg-red-500/10", icon: AlertTriangle }
    : compositeStress >= 1.1
    ? { label: "Spreads Elevados", color: "text-amber-400", bgColor: "bg-amber-500/10", icon: Activity }
    : { label: "Liquidez Normal", color: "text-emerald-400", bgColor: "bg-emerald-500/10", icon: CheckCircle };

  const StatusIcon = systemStatus.icon;

  /* ─── CSV export ─── */
  const exportCSV = () => {
    const header = "Segmento,Atual (p.p.),Média 12M,Média 5A,Desvio (%),Status\n";
    const rows = entries.map((e) => {
      const dev = ((e.current / e.avg5y - 1) * 100).toFixed(1);
      const status = entryStatus(e.current, e.avg5y).label;
      return `${e.label},${e.current.toFixed(1)},${e.avg12m.toFixed(1)},${e.avg5y.toFixed(1)},${dev},${status}`;
    }).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "spread_monitor.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#10B981]" />
          <h3 className="text-sm font-bold text-zinc-100">Monitor de Spreads</h3>
          <span className="text-[9px] font-mono text-zinc-600">v2</span>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-1 text-[9px] font-mono text-zinc-600 hover:text-[#10B981] transition-colors"
        >
          <Download className="w-3 h-3" /> CSV
        </button>
      </div>

      {/* System status + Selic + stress index */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className={`rounded border p-3 ${systemStatus.bgColor} border-zinc-800/50`}>
          <div className="flex items-center gap-1.5 mb-1">
            <StatusIcon className={`w-3.5 h-3.5 ${systemStatus.color}`} />
            <span className={`text-[10px] font-mono font-bold ${systemStatus.color}`}>{systemStatus.label}</span>
          </div>
          <span className="text-[9px] text-zinc-600 font-mono">Status do sistema</span>
        </div>
        <div className="bg-[#0a0a0a] border border-zinc-800/30 rounded p-3">
          <div className="text-sm font-bold font-mono text-zinc-100">{selic.toFixed(2)}%</div>
          <span className="text-[9px] text-zinc-600 font-mono">Selic Meta</span>
        </div>
        <div className="bg-[#0a0a0a] border border-zinc-800/30 rounded p-3">
          <div className={`text-sm font-bold font-mono ${compositeStress >= 1.2 ? "text-red-400" : compositeStress >= 1.1 ? "text-amber-400" : "text-emerald-400"}`}>
            {(compositeStress * 100).toFixed(0)}%
          </div>
          <span className="text-[9px] text-zinc-600 font-mono">Índice de Stress</span>
        </div>
      </div>

      {/* Spread table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] font-mono">
          <thead>
            <tr className="text-zinc-600 border-b border-zinc-800/50">
              <th className="text-left py-1.5 pr-2">Segmento</th>
              <th className="text-right py-1.5 px-2">Atual</th>
              <th className="text-right py-1.5 px-2">Média 12M</th>
              <th className="text-right py-1.5 px-2">Média 5A</th>
              <th className="text-right py-1.5 px-2">Desvio</th>
              <th className="text-center py-1.5 px-2">Trend</th>
              <th className="text-center py-1.5 pl-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const deviation = ((e.current / e.avg5y - 1) * 100);
              const status = entryStatus(e.current, e.avg5y);
              const devColor = deviation > 15 ? "text-red-400" : deviation > 5 ? "text-amber-400" : deviation < -10 ? "text-blue-400" : "text-zinc-400";
              return (
                <tr key={e.label} className="border-b border-[#111] hover:bg-zinc-900/50 transition-colors">
                  <td className="py-1.5 pr-2 text-zinc-300">{e.label}</td>
                  <td className="py-1.5 px-2 text-right text-zinc-100 font-bold">{e.current.toFixed(1)}</td>
                  <td className="py-1.5 px-2 text-right text-zinc-500">{e.avg12m.toFixed(1)}</td>
                  <td className="py-1.5 px-2 text-right text-zinc-500">{e.avg5y.toFixed(1)}</td>
                  <td className={`py-1.5 px-2 text-right ${devColor}`}>
                    {deviation >= 0 ? "+" : ""}{deviation.toFixed(1)}%
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    {e.trend === "up" && <span className="text-red-400">▲</span>}
                    {e.trend === "down" && <span className="text-emerald-400">▼</span>}
                    {e.trend === "stable" && <span className="text-zinc-600">━</span>}
                  </td>
                  <td className="py-1.5 pl-2 text-center">
                    <span className={`text-[8px] px-1.5 py-0.5 rounded ${status.bgColor} ${status.color}`}>
                      {status.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Stress alert threshold */}
      {compositeStress >= 1.15 && (
        <div className="mt-3 rounded border border-amber-500/20 bg-amber-500/5 p-2">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span className="text-[9px] font-mono text-amber-400">
              Índice de stress em {(compositeStress * 100).toFixed(0)}% — spreads {compositeStress >= 1.2 ? "significativamente" : ""} acima das médias históricas.
              Monitorar liquidez e concessões.
            </span>
          </div>
        </div>
      )}

      <div className="mt-2 text-[9px] text-zinc-700 font-mono">
        Spreads em pontos percentuais (p.p.) · Médias estimadas · Peso ponderado por share de mercado
      </div>
    </div>
  );
};
