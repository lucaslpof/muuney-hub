import { useMemo } from "react";
import { Target, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface FocusEntry {
  label: string;
  expected: number;
  actual: number;
  unit: string;
  prevExpected?: number;
}

interface FocusConsensusPanelProps {
  entries: FocusEntry[];
}

export const FocusConsensusPanel = ({ entries }: FocusConsensusPanelProps) => {
  const enriched = useMemo(
    () =>
      entries.map((e) => {
        const gap = e.expected - e.actual;
        const delta = e.prevExpected != null ? e.expected - e.prevExpected : 0;
        return { ...e, gap, delta };
      }),
    [entries]
  );

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-[#0B6C3E]" />
        <h3 className="text-xs font-medium text-zinc-400 font-mono">
          Painel de Consenso — Real vs Esperado
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {enriched.map((e) => {
          const gapColor = e.gap > 0.1 ? "text-red-400" : e.gap < -0.1 ? "text-emerald-400" : "text-zinc-500";
          const DeltaIcon = e.delta > 0.01 ? TrendingUp : e.delta < -0.01 ? TrendingDown : Minus;
          const deltaColor = e.delta > 0.01 ? "text-red-400" : e.delta < -0.01 ? "text-emerald-400" : "text-zinc-600";

          return (
            <div key={e.label} className="bg-[#0a0a0a] border border-zinc-800/50 rounded-md p-3">
              <div className="text-[9px] text-zinc-600 font-mono uppercase mb-2">{e.label}</div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <span className="text-[9px] text-zinc-700 font-mono block">Realizado</span>
                  <span className="text-sm font-bold text-zinc-200 font-mono">
                    {e.actual.toFixed(2)}{e.unit}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-zinc-700 font-mono block">Esperado</span>
                  <span className="text-sm font-bold text-[#0B6C3E] font-mono">
                    {e.expected.toFixed(2)}{e.unit}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-mono ${gapColor}`}>
                  Gap: {e.gap > 0 ? "+" : ""}{e.gap.toFixed(2)}
                </span>
                <div className={`flex items-center gap-0.5 ${deltaColor}`}>
                  <DeltaIcon className="w-3 h-3" />
                  <span className="text-[10px] font-mono">
                    {e.delta > 0 ? "+" : ""}{e.delta.toFixed(2)}/sem
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
