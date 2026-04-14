import { useMemo } from "react";
import { pearsonCorrelation } from "@/lib/statistics";

interface SeriesInput {
  label: string;
  data: { date: string; value: number }[];
}

interface CorrelationPanelProps {
  series: SeriesInput[];
}

function colorForR(r: number): string {
  if (r >= 0.7) return "bg-emerald-500/40 text-emerald-300";
  if (r >= 0.3) return "bg-emerald-500/20 text-emerald-400";
  if (r > -0.3) return "bg-zinc-800 text-zinc-500";
  if (r > -0.7) return "bg-red-500/20 text-red-400";
  return "bg-red-500/40 text-red-300";
}

export const CorrelationPanel = ({ series }: CorrelationPanelProps) => {
  const matrix = useMemo(() => {
    const n = series.length;
    const grid: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      grid[i][i] = 1;
      for (let j = i + 1; j < n; j++) {
        const valsA = series[i].data.map((d) => d.value);
        const valsB = series[j].data.map((d) => d.value);
        const r = pearsonCorrelation(valsA, valsB);
        grid[i][j] = r;
        grid[j][i] = r;
      }
    }
    return grid;
  }, [series]);

  if (series.length < 2) return null;

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4">
      <h3 className="text-xs font-medium text-zinc-400 font-mono mb-3">
        Matriz de Correlação (Pearson)
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-[9px] text-zinc-600 font-mono p-1" />
              {series.map((s, i) => (
                <th key={i} className="text-[9px] text-zinc-500 font-mono p-1 text-center whitespace-nowrap">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {series.map((s, i) => (
              <tr key={i}>
                <td className="text-[9px] text-zinc-500 font-mono p-1 whitespace-nowrap">{s.label}</td>
                {matrix[i].map((r, j) => (
                  <td key={j} className="p-0.5">
                    <div
                      className={`text-center text-[10px] font-mono font-bold rounded px-1.5 py-1 ${
                        i === j ? "bg-[#0B6C3E]/20 text-[#0B6C3E]" : colorForR(r)
                      }`}
                    >
                      {r.toFixed(2)}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3 mt-2 text-[9px] text-zinc-600 font-mono">
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-emerald-500/40 inline-block" /> Forte +</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-zinc-800 inline-block" /> Fraca</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-red-500/40 inline-block" /> Forte −</span>
      </div>
    </div>
  );
};
