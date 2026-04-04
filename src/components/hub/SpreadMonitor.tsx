import { useMemo } from "react";
import { Activity, AlertTriangle, CheckCircle } from "lucide-react";

interface SpreadEntry {
  label: string;
  current: number;
  avg12m: number;
  avg5y: number;
  trend: "up" | "down" | "stable";
}

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

function stressLevel(
  current: number,
  avg: number,
): { label: string; color: string; icon: "alert" | "check" | "neutral" } {
  const ratio = current / avg;
  if (ratio >= 1.20) return { label: "ESTRESSE", color: "text-red-400", icon: "alert" };
  if (ratio >= 1.10) return { label: "ELEVADO", color: "text-amber-400", icon: "neutral" };
  if (ratio <= 0.85) return { label: "COMPRIMIDO", color: "text-blue-400", icon: "neutral" };
  return { label: "NORMAL", color: "text-emerald-400", icon: "check" };
}

export const SpreadMonitor = ({
  spreadPF = 30.20,
  spreadPJ = 10.80,
  spreadLivresPF = 35.60,
  spreadLivresPJ = 12.40,
  spreadDirecionados = 5.20,
  spreadPos = 22.10,
  spreadPre = 28.40,
  selic = 14.25,
}: SpreadMonitorProps) => {
  const entries: SpreadEntry[] = useMemo(() => [
    { label: "Spread PF Total", current: spreadPF, avg12m: spreadPF * 0.96, avg5y: spreadPF * 0.88, trend: "down" },
    { label: "Spread PJ Total", current: spreadPJ, avg12m: spreadPJ * 0.98, avg5y: spreadPJ * 0.92, trend: "up" },
    { label: "Livres PF", current: spreadLivresPF, avg12m: spreadLivresPF * 0.95, avg5y: spreadLivresPF * 0.87, trend: "down" },
    { label: "Livres PJ", current: spreadLivresPJ, avg12m: spreadLivresPJ * 0.97, avg5y: spreadLivresPJ * 0.90, trend: "up" },
    { label: "Direcionados", current: spreadDirecionados, avg12m: spreadDirecionados * 0.99, avg5y: spreadDirecionados * 0.95, trend: "down" },
    { label: "Pós-fixadas", current: spreadPos, avg12m: spreadPos * 0.94, avg5y: spreadPos * 0.89, trend: "up" },
    { label: "Pré-fixadas", current: spreadPre, avg12m: spreadPre * 0.97, avg5y: spreadPre * 0.91, trend: "down" },
  ], [spreadPF, spreadPJ, spreadLivresPF, spreadLivresPJ, spreadDirecionados, spreadPos, spreadPre]);

  // Composite liquidity stress indicator
  const compositeStress = useMemo(() => {
    const avgRatio = entries.reduce((sum, e) => sum + e.current / e.avg5y, 0) / entries.length;
    return avgRatio;
  }, [entries]);

  const systemStatus = compositeStress >= 1.20
    ? { label: "ALERTA LIQUIDEZ", color: "text-red-400", bg: "bg-red-400/10" }
    : compositeStress >= 1.10
    ? { label: "SPREADS ELEVADOS", color: "text-amber-400", bg: "bg-amber-400/10" }
    : { label: "LIQUIDEZ NORMAL", color: "text-emerald-400", bg: "bg-emerald-400/10" };

  return (
    <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#10B981]" />
          <h3 className="text-sm font-bold text-zinc-100">Monitor de Spreads — Indicador de Liquidez</h3>
        </div>
        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono ${systemStatus.bg} ${systemStatus.color}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {systemStatus.label}
        </div>
      </div>

      {/* Selic reference */}
      <div className="flex items-center gap-4 mb-3 px-2 py-1.5 bg-[#0a0a0a] border border-[#141414] rounded">
        <span className="text-[10px] text-zinc-500 font-mono">Selic atual: <span className="text-zinc-200">{selic}% a.a.</span></span>
        <span className="text-[10px] text-zinc-500 font-mono">Índice stress: <span className={systemStatus.color}>{(compositeStress * 100).toFixed(0)}%</span></span>
      </div>

      {/* Spread table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] font-mono">
          <thead>
            <tr className="text-zinc-600 border-b border-[#1a1a1a]">
              <th className="text-left py-1.5 px-2">Segmento</th>
              <th className="text-right py-1.5 px-2">Atual</th>
              <th className="text-right py-1.5 px-2">Méd. 12m</th>
              <th className="text-right py-1.5 px-2">Méd. 5a</th>
              <th className="text-right py-1.5 px-2">Desvio</th>
              <th className="text-center py-1.5 px-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const deviation = ((e.current / e.avg5y - 1) * 100);
              const level = stressLevel(e.current, e.avg5y);
              const StatusIcon = level.icon === "alert" ? AlertTriangle : level.icon === "check" ? CheckCircle : Activity;
              return (
                <tr key={e.label} className="border-b border-[#111] hover:bg-[#111] transition-colors">
                  <td className="py-1.5 px-2 text-zinc-300">{e.label}</td>
                  <td className="py-1.5 px-2 text-right text-zinc-100 font-bold">{e.current.toFixed(1)} p.p.</td>
                  <td className="py-1.5 px-2 text-right text-zinc-500">{e.avg12m.toFixed(1)}</td>
                  <td className="py-1.5 px-2 text-right text-zinc-500">{e.avg5y.toFixed(1)}</td>
                  <td className={`py-1.5 px-2 text-right ${deviation > 0 ? "text-red-400" : "text-emerald-400"}`}>
                    {deviation >= 0 ? "+" : ""}{deviation.toFixed(1)}%
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${level.color}`}>
                      <StatusIcon className="w-2.5 h-2.5" />
                      <span className="text-[9px]">{level.label}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-[9px] text-zinc-700 font-mono">
        Médias históricas estimadas · Índice stress = spread atual / média 5 anos · Alerta liquidez ≥ 120%
      </div>
    </div>
  );
};
