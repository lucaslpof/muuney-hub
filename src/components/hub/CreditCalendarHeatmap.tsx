/**
 * CreditCalendarHeatmap — Year × Month calendar heatmap for credit indicators.
 *
 * Mirrors the pattern of DrawdownHeatmap but for level-based series (rates,
 * spreads, default ratios, volumes). Each cell shows the indicator level for
 * that month, colored by its deviation from the series median.
 *
 * Kind semantics:
 *   • "rate" / "spread" / "default"  → higher = bad (red), lower = good (emerald)
 *   • "volume"                        → higher = good (emerald), lower = bad (red)
 *
 * Defensive behavior:
 *   • Empty series → placeholder copy, no layout break.
 *   • Missing months within a year render as "—" (zinc/idle cells).
 */

type IndicatorKind = "rate" | "spread" | "default" | "volume";

export interface CreditCalendarSeriesPoint {
  date: string; // ISO date string (YYYY-MM-DD or YYYY-MM)
  value: number | null | undefined;
}

interface CreditCalendarHeatmapProps {
  data: CreditCalendarSeriesPoint[];
  kind: IndicatorKind;
  /** Card title chip. */
  title?: string;
  /** Helper text beneath the title. */
  subtitle?: string;
  /** Unit suffix displayed in cells (default auto-selected from kind). */
  unit?: string;
  /** Accent color for the header chip. */
  accent?: string;
  className?: string;
}

const MONTH_LABELS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

function defaultUnit(kind: IndicatorKind): string {
  if (kind === "rate") return "%";
  if (kind === "spread") return "pp";
  if (kind === "default") return "%";
  return ""; // volume — caller may pass custom unit
}

function fmtCell(v: number | null, digits: number, unit: string): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(digits)}${unit}`;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Map a deviation from median → Tailwind cell classes. For "higher is bad"
 * kinds we invert the sign before bucketing so red always means worse.
 */
function cellColor(
  diff: number | null,
  maxAbs: number,
  kind: IndicatorKind,
): { bg: string; fg: string; border: string } {
  if (diff == null || !Number.isFinite(diff) || maxAbs <= 0) {
    return { bg: "bg-[#0f0f0f]", fg: "text-zinc-600", border: "border-[#1a1a1a]" };
  }
  const isGood = kind === "volume" ? diff >= 0 : diff <= 0;
  const intensity = Math.min(1, Math.abs(diff) / maxAbs);
  if (isGood) {
    if (intensity < 0.25) return { bg: "bg-emerald-950/40", fg: "text-emerald-300", border: "border-emerald-950" };
    if (intensity < 0.5) return { bg: "bg-emerald-900/60", fg: "text-emerald-200", border: "border-emerald-900" };
    if (intensity < 0.75) return { bg: "bg-emerald-800/70", fg: "text-emerald-100", border: "border-emerald-800" };
    return { bg: "bg-emerald-600/80", fg: "text-white", border: "border-emerald-500" };
  }
  if (intensity < 0.25) return { bg: "bg-red-950/40", fg: "text-red-300", border: "border-red-950" };
  if (intensity < 0.5) return { bg: "bg-red-900/60", fg: "text-red-200", border: "border-red-900" };
  if (intensity < 0.75) return { bg: "bg-red-800/70", fg: "text-red-100", border: "border-red-800" };
  return { bg: "bg-red-600/80", fg: "text-white", border: "border-red-500" };
}

export function CreditCalendarHeatmap({
  data,
  kind,
  title = "Heatmap calendário",
  subtitle,
  unit,
  accent = "#0B6C3E",
  className = "",
}: CreditCalendarHeatmapProps) {
  const effectiveUnit = unit ?? defaultUnit(kind);
  const hasData = Array.isArray(data) && data.length > 0;

  // Pivot: year → month → value
  const pivot = new Map<number, Map<number, number>>();
  const validValues: number[] = [];

  if (hasData) {
    for (const point of data) {
      if (!point?.date) continue;
      const v = point.value;
      if (v == null || !Number.isFinite(v)) continue;
      const match = point.date.match(/^(\d{4})-(\d{2})/);
      if (!match) continue;
      const y = Number(match[1]);
      const mo = Number(match[2]);
      if (!Number.isFinite(y) || mo < 1 || mo > 12) continue;
      if (!pivot.has(y)) pivot.set(y, new Map());
      pivot.get(y)!.set(mo, v);
      validValues.push(v);
    }
  }

  const hasAny = pivot.size > 0;
  const med = hasAny ? median(validValues) : 0;
  const maxAbsDiff = hasAny
    ? Math.max(...validValues.map((v) => Math.abs(v - med)), 0.0001)
    : 0;

  const years = hasAny ? Array.from(pivot.keys()).sort((a, b) => b - a) : [];

  // Footer summary
  const latest = hasData
    ? [...data].reverse().find((p) => p.value != null && Number.isFinite(p.value as number))
    : null;
  const latestVal = latest?.value ?? null;
  const highest = hasAny ? Math.max(...validValues) : null;
  const lowest = hasAny ? Math.min(...validValues) : null;

  const directionLabel =
    kind === "volume" ? "vol. maior = melhor (emerald)" : "maior = pior (red)";

  return (
    <section
      className={`bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-3 md:p-4 ${className}`}
      aria-label={title}
    >
      <div className="flex items-start justify-between mb-3 gap-2 flex-wrap">
        <div>
          <div
            className="text-[9px] font-mono uppercase tracking-[0.2em]"
            style={{ color: accent }}
          >
            {title}
          </div>
          {subtitle && (
            <div className="text-[10px] text-zinc-500 mt-0.5">{subtitle}</div>
          )}
        </div>
        <div className="text-[9px] font-mono text-zinc-600 uppercase tracking-wider">
          Desvio vs mediana · {directionLabel}
        </div>
      </div>

      {!hasAny && (
        <div className="py-6 text-center text-zinc-600 text-[10px] font-mono">
          Sem histórico suficiente para calcular calendário mensal.
        </div>
      )}

      {hasAny && (
        <>
          <div className="overflow-x-auto -mx-1">
            <table
              className="w-full text-[10px] font-mono border-separate border-spacing-[2px]"
              role="table"
              aria-label={`Heatmap de ${title}`}
            >
              <thead>
                <tr className="text-zinc-500">
                  <th className="text-left py-1 px-2 font-normal w-[48px]">Ano</th>
                  {MONTH_LABELS.map((m) => (
                    <th
                      key={m}
                      className="text-center py-1 px-1 font-normal text-[9px] tracking-wider"
                    >
                      {m}
                    </th>
                  ))}
                  <th className="text-right py-1 px-2 font-normal text-[9px] tracking-wider">
                    Média
                  </th>
                </tr>
              </thead>
              <tbody>
                {years.map((year) => {
                  const row = pivot.get(year)!;
                  const yearVals: number[] = [];
                  for (let m = 1; m <= 12; m++) {
                    const v = row.get(m);
                    if (v != null && Number.isFinite(v)) yearVals.push(v);
                  }
                  const yearAvg = yearVals.length ? mean(yearVals) : null;

                  return (
                    <tr key={year}>
                      <td className="py-0.5 px-2 text-zinc-300 tabular-nums">{year}</td>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                        const v = row.get(m);
                        const diff = v != null && Number.isFinite(v) ? v - med : null;
                        const { bg, fg, border } = cellColor(diff, maxAbsDiff, kind);
                        const isEmpty = v == null;
                        const deltaFmt =
                          diff != null
                            ? `${diff >= 0 ? "+" : ""}${diff.toFixed(2)} vs mediana`
                            : "sem dados";
                        const tip = `${MONTH_LABELS[m - 1]}/${year} · ${
                          v != null ? `${v.toFixed(2)}${effectiveUnit}` : "—"
                        } · ${deltaFmt}`;
                        return (
                          <td key={m} className="relative p-0 align-middle" title={tip}>
                            <div
                              className={`${bg} ${fg} ${border} border rounded-sm h-6 flex items-center justify-center tabular-nums text-[9px] cursor-default`}
                              aria-label={tip}
                            >
                              {isEmpty ? "—" : fmtCell(v, 1, "")}
                            </div>
                          </td>
                        );
                      })}
                      <td className="py-0.5 px-2 text-right text-zinc-300 tabular-nums">
                        {fmtCell(yearAvg, 2, effectiveUnit)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 pt-3 border-t border-[#141414] grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] font-mono">
            <div>
              <div className="text-zinc-600 text-[9px] uppercase tracking-wider">Último</div>
              <div className="text-zinc-200 tabular-nums">
                {fmtCell(latestVal, 2, effectiveUnit)}
              </div>
            </div>
            <div>
              <div className="text-zinc-600 text-[9px] uppercase tracking-wider">Mediana</div>
              <div className="text-zinc-300 tabular-nums">
                {fmtCell(med, 2, effectiveUnit)}
              </div>
            </div>
            <div>
              <div className="text-zinc-600 text-[9px] uppercase tracking-wider">Máx</div>
              <div
                className={
                  kind === "volume"
                    ? "text-emerald-400 tabular-nums"
                    : "text-red-400 tabular-nums"
                }
              >
                {fmtCell(highest, 2, effectiveUnit)}
              </div>
            </div>
            <div>
              <div className="text-zinc-600 text-[9px] uppercase tracking-wider">Mín</div>
              <div
                className={
                  kind === "volume"
                    ? "text-red-400 tabular-nums"
                    : "text-emerald-400 tabular-nums"
                }
              >
                {fmtCell(lowest, 2, effectiveUnit)}
              </div>
            </div>
          </div>

          <div className="text-[9px] text-zinc-600 mt-2 leading-relaxed">
            Escala diverging pelo maior desvio absoluto vs mediana do período. Cada célula exibe
            o nível do mês; passe o cursor para ver o gap vs mediana.
          </div>
        </>
      )}
    </section>
  );
}

export default CreditCalendarHeatmap;
