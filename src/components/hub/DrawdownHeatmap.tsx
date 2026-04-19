/**
 * DrawdownHeatmap — Year × Month calendar heatmap of monthly returns / drawdowns.
 *
 * Pairs with src/lib/drawdown.ts: consumes a DrawdownCell[] (one cell per
 * month observed) and an optional DrawdownSummary, and renders a compact
 * Tech-Noir card with:
 *   • One row per year (descending), one column per month (Jan → Dez).
 *   • Each cell colored by monthly return intensity (emerald positive,
 *     red negative), with the drawdown exposed on hover via tooltip.
 *   • Footer summary strip showing max DD, prior peak → trough recovery,
 *     and months underwater / total months.
 *
 * Defensive behavior:
 *   • Empty cells array → placeholder copy, no layout break.
 *   • Missing months within a year render as "—" (zinc/idle cells).
 */
import type { DrawdownCell, DrawdownSummary } from "@/lib/drawdown";

interface DrawdownHeatmapProps {
  cells: DrawdownCell[];
  summary?: DrawdownSummary;
  /** Title rendered in the uppercase chip. */
  title?: string;
  /** Optional helper text under the title. */
  subtitle?: string;
  /** Accent color for the header chip (defaults to Muuney green). */
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

/** Map a monthly return → tailwind bg class + text class, given max absolute scale. */
function cellColor(
  returnPct: number | null,
  maxAbs: number,
): { bg: string; fg: string; border: string } {
  if (returnPct == null || !Number.isFinite(returnPct) || maxAbs <= 0) {
    return { bg: "bg-[#0f0f0f]", fg: "text-zinc-600", border: "border-[#1a1a1a]" };
  }
  const intensity = Math.min(1, Math.abs(returnPct) / maxAbs);
  // 4-step diverging gradient
  if (returnPct >= 0) {
    if (intensity < 0.25) return { bg: "bg-emerald-950/40", fg: "text-emerald-300", border: "border-emerald-950" };
    if (intensity < 0.5) return { bg: "bg-emerald-900/60", fg: "text-emerald-200", border: "border-emerald-900" };
    if (intensity < 0.75) return { bg: "bg-emerald-800/70", fg: "text-emerald-100", border: "border-emerald-800" };
    return { bg: "bg-emerald-600/80", fg: "text-white", border: "border-emerald-500" };
  } else {
    if (intensity < 0.25) return { bg: "bg-red-950/40", fg: "text-red-300", border: "border-red-950" };
    if (intensity < 0.5) return { bg: "bg-red-900/60", fg: "text-red-200", border: "border-red-900" };
    if (intensity < 0.75) return { bg: "bg-red-800/70", fg: "text-red-100", border: "border-red-800" };
    return { bg: "bg-red-600/80", fg: "text-white", border: "border-red-500" };
  }
}

function fmtPct(v: number | null, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

function fmtMonthLabel(ym: string | null): string {
  if (!ym) return "—";
  const m = ym.match(/^(\d{4})-(\d{2})$/);
  if (!m) return ym;
  const year = m[1];
  const idx = Number(m[2]) - 1;
  if (idx < 0 || idx > 11) return ym;
  return `${MONTH_LABELS[idx]}/${year.slice(2)}`;
}

export function DrawdownHeatmap({
  cells,
  summary,
  title = "Drawdown mensal",
  subtitle,
  accent = "#0B6C3E",
  className = "",
}: DrawdownHeatmapProps) {
  const hasData = cells && cells.length > 0;

  // Build { year: { month: cell } } pivot
  const pivot = new Map<number, Map<number, DrawdownCell>>();
  let maxAbsReturn = 0;

  if (hasData) {
    for (const c of cells) {
      if (!pivot.has(c.year)) pivot.set(c.year, new Map());
      pivot.get(c.year)!.set(c.month, c);
      if (c.returnPct != null && Number.isFinite(c.returnPct)) {
        maxAbsReturn = Math.max(maxAbsReturn, Math.abs(c.returnPct));
      }
    }
  }

  // Year rows sorted descending (latest year first).
  const years = Array.from(pivot.keys()).sort((a, b) => b - a);

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
          Retorno mensal · cor = intensidade
        </div>
      </div>

      {!hasData && (
        <div className="py-6 text-center text-zinc-600 text-[10px] font-mono">
          Histórico insuficiente para calcular drawdowns mensais.
        </div>
      )}

      {hasData && (
        <>
          <div className="overflow-x-auto -mx-1">
            <table
              className="w-full text-[10px] font-mono border-separate border-spacing-[2px]"
              role="table"
              aria-label="Heatmap de retornos mensais"
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
                    Ano
                  </th>
                </tr>
              </thead>
              <tbody>
                {years.map((year) => {
                  const row = pivot.get(year)!;
                  // Compound year return from available months.
                  let yearEquity = 1;
                  let yearHas = false;
                  for (let m = 1; m <= 12; m++) {
                    const c = row.get(m);
                    if (c?.returnPct != null && Number.isFinite(c.returnPct)) {
                      yearEquity *= 1 + c.returnPct / 100;
                      yearHas = true;
                    }
                  }
                  const yearRet = yearHas ? (yearEquity - 1) * 100 : null;
                  const yearCls = yearRet == null
                    ? "text-zinc-600"
                    : yearRet > 0
                      ? "text-emerald-400"
                      : yearRet < 0
                        ? "text-red-400"
                        : "text-zinc-400";

                  return (
                    <tr key={year}>
                      <td className="py-0.5 px-2 text-zinc-300 tabular-nums">
                        {year}
                      </td>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                        const c = row.get(m);
                        const { bg, fg, border } = cellColor(
                          c?.returnPct ?? null,
                          maxAbsReturn,
                        );
                        const isEmpty = !c || c.returnPct == null;
                        const tip = c
                          ? `${MONTH_LABELS[m - 1]}/${year} · Ret ${fmtPct(c.returnPct)} · DD ${fmtPct(c.drawdownPct)}`
                          : `${MONTH_LABELS[m - 1]}/${year} · sem dados`;
                        return (
                          <td
                            key={m}
                            className={`relative p-0 align-middle`}
                            title={tip}
                          >
                            <div
                              className={`${bg} ${fg} ${border} border rounded-sm h-6 flex items-center justify-center tabular-nums text-[9px] cursor-default`}
                              aria-label={tip}
                            >
                              {isEmpty ? "—" : fmtPct(c.returnPct, 1)}
                            </div>
                          </td>
                        );
                      })}
                      <td
                        className={`py-0.5 px-2 text-right tabular-nums ${yearCls}`}
                      >
                        {fmtPct(yearRet)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {summary && (
            <div className="mt-3 pt-3 border-t border-[#141414] grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] font-mono">
              <div>
                <div className="text-zinc-600 text-[9px] uppercase tracking-wider">
                  Max DD
                </div>
                <div className="text-red-400 tabular-nums">
                  {fmtPct(summary.maxDrawdownPct, 2)}
                </div>
              </div>
              <div>
                <div className="text-zinc-600 text-[9px] uppercase tracking-wider">
                  Pico anterior
                </div>
                <div className="text-zinc-300 tabular-nums">
                  {fmtMonthLabel(summary.peakMonth)}
                </div>
              </div>
              <div>
                <div className="text-zinc-600 text-[9px] uppercase tracking-wider">
                  Vale
                </div>
                <div className="text-zinc-300 tabular-nums">
                  {fmtMonthLabel(summary.troughMonth)}
                </div>
              </div>
              <div>
                <div className="text-zinc-600 text-[9px] uppercase tracking-wider">
                  Underwater
                </div>
                <div className="text-zinc-300 tabular-nums">
                  {summary.monthsUnderwater}/{summary.totalMonths} meses
                </div>
              </div>
            </div>
          )}

          <div className="text-[9px] text-zinc-600 mt-2 leading-relaxed">
            Cores escalam pelo maior retorno absoluto do período. Passe o cursor
            para ver retorno + drawdown acumulado do mês.
          </div>
        </>
      )}
    </section>
  );
}

export default DrawdownHeatmap;
