import { useMemo } from "react";
import { GitCompare } from "lucide-react";
import { pearsonCorrelation } from "@/lib/statistics";

interface CreditSeries {
  label: string;
  data: { date: string; value: number }[];
  /**
   * Optional category tag. "focus" = BACEN Focus expectation (forward-looking,
   * different cadence); used to visually separate from spot credit indicators
   * and to enrich correlation insights.
   */
  kind?: "credit" | "focus";
}

interface CreditCorrelationPanelProps {
  series: CreditSeries[];
}

function colorForCorr(r: number): string {
  if (r >= 0.7) return "bg-emerald-500/80 text-white";
  if (r >= 0.4) return "bg-emerald-500/30 text-emerald-300";
  if (r > -0.4) return "bg-zinc-800 text-zinc-500";
  if (r > -0.7) return "bg-red-500/30 text-red-300";
  return "bg-red-500/80 text-white";
}

interface Insight {
  label: string;
  description: string;
  severity: "info" | "warning" | "critical";
}

export const CreditCorrelationPanel = ({ series }: CreditCorrelationPanelProps) => {
  const matrix = useMemo(() => {
    const n = series.length;
    const result: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

    // Build O(1) date → value lookup per series so we can date-align two
    // series even when they have different cadences (BACEN credit = monthly,
    // Focus = weekly). Index-aligned correlation was producing nonsense for
    // mixed cadences.
    const maps = series.map((s) => {
      const m = new Map<string, number>();
      for (const p of s.data) {
        if (Number.isFinite(p.value)) m.set(p.date, p.value);
      }
      return m;
    });

    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        if (i === j) {
          result[i][j] = 1;
          continue;
        }
        // Build date-matched arrays
        const a: number[] = [];
        const b: number[] = [];
        const aMap = maps[i];
        const bMap = maps[j];
        // Iterate the smaller map for efficiency
        const [smallMap, otherMap, swap] =
          aMap.size <= bMap.size ? [aMap, bMap, false] : [bMap, aMap, true];
        for (const [date, v] of smallMap) {
          const w = otherMap.get(date);
          if (w !== undefined) {
            if (swap) {
              a.push(w);
              b.push(v);
            } else {
              a.push(v);
              b.push(w);
            }
          }
        }
        if (a.length < 3) {
          result[i][j] = 0;
          result[j][i] = 0;
          continue;
        }
        const r = pearsonCorrelation(a, b);
        result[i][j] = r;
        result[j][i] = r;
      }
    }
    return result;
  }, [series]);

  // Generate insights from correlation patterns. Focus × Credit crossings
  // get bespoke narrative — forward-looking consensus shifting alongside a
  // spot credit indicator is a richer signal than two spot indicators moving
  // together.
  const insights: Insight[] = useMemo(() => {
    const out: Insight[] = [];
    const labels = series.map((s) => s.label);
    const kinds = series.map((s) => s.kind ?? "credit");

    for (let i = 0; i < matrix.length; i++) {
      for (let j = i + 1; j < matrix[i].length; j++) {
        const r = matrix[i][j];
        const kindA = kinds[i];
        const kindB = kinds[j];
        const isFocusCross =
          (kindA === "focus" && kindB === "credit") ||
          (kindA === "credit" && kindB === "focus");

        if (isFocusCross && Math.abs(r) >= 0.6) {
          const sign = r > 0 ? "+" : "−";
          const severity: Insight["severity"] = Math.abs(r) >= 0.8 ? "warning" : "info";
          out.push({
            label: `${labels[i]} ↔ ${labels[j]}`,
            description: `Consenso Focus co-move ${sign} com indicador spot (r=${r.toFixed(2)}). Mudanças de expectativa antecipam pressão sobre crédito.`,
            severity,
          });
          continue;
        }

        if (r >= 0.8) {
          out.push({
            label: `${labels[i]} ↔ ${labels[j]}`,
            description: `Correlação forte positiva (r=${r.toFixed(2)}). Movimentos alinhados — risco sistêmico se ambos deteriorarem.`,
            severity: "warning",
          });
        } else if (r <= -0.7) {
          out.push({
            label: `${labels[i]} ↔ ${labels[j]}`,
            description: `Correlação forte negativa (r=${r.toFixed(2)}). Potencial hedge natural entre segmentos.`,
            severity: "info",
          });
        }
      }
    }

    if (out.length === 0) {
      out.push({
        label: "Diversificação adequada",
        description: "Nenhuma correlação extrema detectada entre segmentos — baixo risco de contágio sistêmico.",
        severity: "info",
      });
    }
    return out;
  }, [matrix, series]);

  if (series.length < 2) return null;

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <GitCompare className="w-4 h-4 text-[#10B981]" />
        <h3 className="text-sm font-bold text-zinc-100">Correlação Crédito × Macro</h3>
      </div>

      {/* Matrix */}
      <div className="overflow-x-auto mb-4">
        <table className="text-[9px] font-mono">
          <thead>
            <tr>
              <th className="px-1.5 py-1 text-left text-zinc-600" />
              {series.map((s) => (
                <th
                  key={s.label}
                  className={`px-1.5 py-1 text-center max-w-[60px] truncate ${
                    s.kind === "focus" ? "text-indigo-400" : "text-zinc-500"
                  }`}
                  title={s.kind === "focus" ? "Focus — expectativa forward-looking" : undefined}
                >
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {series.map((row, i) => (
              <tr key={row.label}>
                <td
                  className={`px-1.5 py-1 whitespace-nowrap ${
                    row.kind === "focus" ? "text-indigo-400" : "text-zinc-400"
                  }`}
                >
                  {row.label}
                  {row.kind === "focus" && (
                    <span className="ml-1 text-[8px] text-indigo-500/80">FWD</span>
                  )}
                </td>
                {matrix[i].map((r, j) => (
                  <td key={j} className="px-1 py-1 text-center">
                    <span className={`inline-block w-full px-1 py-0.5 rounded text-[9px] font-bold ${
                      i === j ? "bg-zinc-900 text-zinc-600" : colorForCorr(r)
                    }`}>
                      {i === j ? "—" : r.toFixed(2)}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Insights */}
      <div className="space-y-1.5">
        {insights.map((insight, idx) => (
          <div
            key={idx}
            className={`px-3 py-2 rounded border ${
              insight.severity === "critical"
                ? "border-red-500/20 bg-red-500/5"
                : insight.severity === "warning"
                ? "border-amber-500/20 bg-amber-500/5"
                : "border-emerald-500/20 bg-emerald-500/5"
            }`}
          >
            <div className={`text-[10px] font-mono font-bold ${
              insight.severity === "critical" ? "text-red-400" : insight.severity === "warning" ? "text-amber-400" : "text-emerald-400"
            }`}>
              {insight.label}
            </div>
            <div className="text-[9px] text-zinc-500 mt-0.5">{insight.description}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 text-[9px] text-zinc-700 font-mono">
        Pearson r · Verde ≥0.7 (forte+) · Vermelho ≤−0.7 (forte−) · Cinza: correlação fraca
      </div>
    </div>
  );
};
