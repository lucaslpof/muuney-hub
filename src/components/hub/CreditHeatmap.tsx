import { useMemo } from "react";
import { Grid3X3 } from "lucide-react";

interface HeatmapRow {
  label: string;
  values: { date: string; value: number }[];
}

interface CreditHeatmapProps {
  title: string;
  rows: HeatmapRow[];
  unit?: string;
  colorScale?: "diverging" | "sequential";
  /** For sequential: green = low, red = high (NPL). For diverging: green = positive growth */
  invertColors?: boolean;
}

function getColor(value: number, min: number, max: number, colorScale: "diverging" | "sequential", invert: boolean): string {
  if (colorScale === "diverging") {
    // Center on 0: negative = red, positive = green
    if (value > 0) {
      const intensity = Math.min(value / Math.max(max, 1), 1);
      if (invert) return `rgba(239, 68, 68, ${0.15 + intensity * 0.65})`;
      return `rgba(16, 185, 129, ${0.15 + intensity * 0.65})`;
    }
    const intensity = Math.min(Math.abs(value) / Math.max(Math.abs(min), 1), 1);
    if (invert) return `rgba(16, 185, 129, ${0.15 + intensity * 0.65})`;
    return `rgba(239, 68, 68, ${0.15 + intensity * 0.65})`;
  }
  // Sequential: low = green, high = red (for NPL rates)
  const range = max - min || 1;
  const norm = (value - min) / range;
  if (invert) {
    // High = bad (red)
    if (norm > 0.7) return `rgba(239, 68, 68, ${0.3 + norm * 0.5})`;
    if (norm > 0.4) return `rgba(245, 158, 11, ${0.2 + norm * 0.4})`;
    return `rgba(16, 185, 129, ${0.15 + (1 - norm) * 0.4})`;
  }
  if (norm > 0.7) return `rgba(16, 185, 129, ${0.3 + norm * 0.5})`;
  if (norm > 0.4) return `rgba(245, 158, 11, ${0.2 + norm * 0.4})`;
  return `rgba(239, 68, 68, ${0.15 + (1 - norm) * 0.4})`;
}

export const CreditHeatmap = ({
  title,
  rows,
  unit = "%",
  colorScale = "diverging",
  invertColors = false,
}: CreditHeatmapProps) => {
  // Get unique dates (last 12 months)
  const dates = useMemo(() => {
    const allDates = new Set<string>();
    rows.forEach((r) => r.values.forEach((v) => allDates.add(v.date)));
    return Array.from(allDates)
      .sort()
      .slice(-12);
  }, [rows]);

  // Compute global min/max
  const { min, max } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    rows.forEach((r) =>
      r.values.forEach((v) => {
        if (v.value < min) min = v.value;
        if (v.value > max) max = v.value;
      })
    );
    return { min: min === Infinity ? 0 : min, max: max === -Infinity ? 1 : max };
  }, [rows]);

  // Format month label
  const fmtMonth = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
  };

  if (rows.length === 0 || dates.length === 0) return null;

  return (
    <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Grid3X3 className="w-4 h-4 text-[#10B981]" />
        <h3 className="text-sm font-bold text-zinc-100">{title}</h3>
        <span className="text-[9px] text-zinc-600 font-mono ml-auto">Últimos 12 meses · {unit}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[9px] font-mono border-collapse">
          <thead>
            <tr>
              <th className="text-left py-1.5 px-2 text-zinc-600 sticky left-0 bg-[#0f0f0f] z-10 min-w-[120px]">
                Modalidade
              </th>
              {dates.map((d) => (
                <th key={d} className="text-center py-1.5 px-1.5 text-zinc-600 min-w-[48px]">
                  {fmtMonth(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const valueMap = new Map(row.values.map((v) => [v.date, v.value]));
              return (
                <tr key={row.label} className="border-t border-[#111]">
                  <td className="py-1.5 px-2 text-zinc-300 whitespace-nowrap sticky left-0 bg-[#0f0f0f] z-10">
                    {row.label}
                  </td>
                  {dates.map((d) => {
                    const val = valueMap.get(d);
                    if (val === undefined) {
                      return (
                        <td key={d} className="py-1 px-1 text-center">
                          <span className="inline-block w-full px-1 py-0.5 rounded bg-zinc-900 text-zinc-700">—</span>
                        </td>
                      );
                    }
                    const bg = getColor(val, min, max, colorScale, invertColors);
                    return (
                      <td key={d} className="py-1 px-1 text-center">
                        <span
                          className="inline-block w-full px-1 py-0.5 rounded text-[9px] font-bold"
                          style={{ backgroundColor: bg, color: "#e4e4e7" }}
                        >
                          {val.toFixed(1)}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex items-center gap-3 text-[8px] text-zinc-700 font-mono">
        <span>Escala:</span>
        <div className="flex items-center gap-1">
          <span className="w-3 h-2 rounded" style={{ backgroundColor: invertColors ? "rgba(16,185,129,0.5)" : "rgba(239,68,68,0.5)" }} />
          <span>{colorScale === "diverging" ? "Negativo" : "Baixo"}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-2 rounded" style={{ backgroundColor: "rgba(245,158,11,0.4)" }} />
          <span>Médio</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-2 rounded" style={{ backgroundColor: invertColors ? "rgba(239,68,68,0.5)" : "rgba(16,185,129,0.5)" }} />
          <span>{colorScale === "diverging" ? "Positivo" : "Alto"}</span>
        </div>
      </div>
    </div>
  );
};
