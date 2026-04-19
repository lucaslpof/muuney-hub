/**
 * DYCalendarFII.tsx — Year × Month dividend yield heatmap for FIIs (P1-4)
 *
 * Consumes FiiMonthlyItem[] (dt_comptc + dividend_yield_mes) and renders a
 * Tech-Noir calendar with:
 *   • One row per year, one column per month (Jan → Dez)
 *   • Sequential magenta scale (DY% is almost always ≥ 0; rare negatives
 *     rendered zinc/neutral)
 *   • Year total column (sum of DYs ≈ annual yield)
 *   • Footer strip with mean / median / last 12m / max month
 *
 * Pairs visually with DrawdownHeatmap; same table layout + sizing so both
 * components align in the Performance section of FiiLamina.
 */

import { useMemo } from "react";
import type { FiiMonthlyItem } from "@/hooks/useHubFundos";

interface Props {
  monthly: FiiMonthlyItem[];
  title?: string;
  subtitle?: string;
  /** Accent color for the header chip + high-intensity cells. */
  accent?: string;
  className?: string;
}

const MONTH_LABELS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

interface DYCell {
  year: number;
  month: number;
  dy: number | null;
}

/** Sequential magenta scale (dark → bright). Negatives render neutral red-ish. */
function dyCellColor(
  dy: number | null,
  maxDy: number,
): { bg: string; fg: string; border: string } {
  if (dy == null || !Number.isFinite(dy)) {
    return { bg: "bg-[#0f0f0f]", fg: "text-zinc-600", border: "border-[#1a1a1a]" };
  }
  if (dy < 0) {
    // Rare — treat as warning
    return { bg: "bg-red-900/40", fg: "text-red-300", border: "border-red-950" };
  }
  if (maxDy <= 0) {
    return { bg: "bg-[#0f0f0f]", fg: "text-zinc-500", border: "border-[#1a1a1a]" };
  }
  const intensity = Math.min(1, dy / maxDy);
  // 4-step sequential magenta (matches #EC4899 accent)
  if (intensity < 0.25) return { bg: "bg-pink-950/40", fg: "text-pink-300", border: "border-pink-950" };
  if (intensity < 0.5) return { bg: "bg-pink-900/60", fg: "text-pink-200", border: "border-pink-900" };
  if (intensity < 0.75) return { bg: "bg-pink-800/70", fg: "text-pink-100", border: "border-pink-800" };
  return { bg: "bg-pink-600/80", fg: "text-white", border: "border-pink-500" };
}

function fmtDY(v: number | null, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(digits)}%`;
}

function median(arr: number[]): number | null {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function DYCalendarFII({
  monthly,
  title = "Calendário de Dividend Yield",
  subtitle,
  accent = "#EC4899",
  className = "",
}: Props) {
  const { pivot, years, maxDy, summary } = useMemo(() => {
    const p = new Map<number, Map<number, DYCell>>();
    let maxVal = 0;
    const allDY: number[] = [];

    for (const m of monthly) {
      if (!m.dt_comptc) continue;
      const match = m.dt_comptc.match(/^(\d{4})-(\d{2})/);
      if (!match) continue;
      const y = Number(match[1]);
      const mo = Number(match[2]);
      const dyRaw = m.dividend_yield_mes;
      const dy = typeof dyRaw === "number" && Number.isFinite(dyRaw) ? dyRaw : null;
      if (!p.has(y)) p.set(y, new Map());
      p.get(y)!.set(mo, { year: y, month: mo, dy });
      if (dy != null && dy > maxVal) maxVal = dy;
      if (dy != null && dy >= 0) allDY.push(dy);
    }

    const yrs = Array.from(p.keys()).sort((a, b) => b - a);

    // Summary stats
    const mean = allDY.length
      ? allDY.reduce((s, v) => s + v, 0) / allDY.length
      : null;
    const med = median(allDY);

    // Last 12 months cumulative (latest year + wrap-back)
    let last12 = 0;
    let last12Count = 0;
    const sortedChrono = [...monthly]
      .filter((m) => m.dividend_yield_mes != null)
      .sort((a, b) => (a.dt_comptc || "").localeCompare(b.dt_comptc || ""));
    const lastSlice = sortedChrono.slice(-12);
    for (const m of lastSlice) {
      if (m.dividend_yield_mes != null && Number.isFinite(m.dividend_yield_mes)) {
        last12 += m.dividend_yield_mes;
        last12Count++;
      }
    }

    // Max month (best single DY)
    let bestMonth: { value: number; label: string } | null = null;
    for (const m of monthly) {
      if (
        m.dividend_yield_mes != null &&
        Number.isFinite(m.dividend_yield_mes) &&
        (!bestMonth || m.dividend_yield_mes > bestMonth.value)
      ) {
        const match = m.dt_comptc?.match(/^(\d{4})-(\d{2})/);
        if (match) {
          bestMonth = {
            value: m.dividend_yield_mes,
            label: `${MONTH_LABELS[Number(match[2]) - 1]}/${match[1].slice(2)}`,
          };
        }
      }
    }

    return {
      pivot: p,
      years: yrs,
      maxDy: maxVal,
      summary: {
        mean,
        median: med,
        last12: last12Count > 0 ? last12 : null,
        last12Count,
        bestMonth,
      },
    };
  }, [monthly]);

  const hasData = years.length > 0;

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
          DY mensal · intensidade ∝ cor
        </div>
      </div>

      {!hasData && (
        <div className="py-6 text-center text-zinc-600 text-[10px] font-mono">
          Histórico de dividend yield indisponível.
        </div>
      )}

      {hasData && (
        <>
          <div className="overflow-x-auto -mx-1">
            <table
              className="w-full text-[10px] font-mono border-separate border-spacing-[2px]"
              role="table"
              aria-label="Calendário de dividend yield por mês"
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
                  let yearSum = 0;
                  let yearCount = 0;
                  for (let m = 1; m <= 12; m++) {
                    const c = row.get(m);
                    if (c?.dy != null && Number.isFinite(c.dy)) {
                      yearSum += c.dy;
                      yearCount++;
                    }
                  }
                  const yearTot = yearCount > 0 ? yearSum : null;
                  return (
                    <tr key={year}>
                      <td className="py-0.5 px-2 text-zinc-300 tabular-nums">
                        {year}
                      </td>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                        const c = row.get(m);
                        const { bg, fg, border } = dyCellColor(c?.dy ?? null, maxDy);
                        const isEmpty = !c || c.dy == null;
                        const tip = c?.dy != null
                          ? `${MONTH_LABELS[m - 1]}/${year} · DY ${fmtDY(c.dy)}`
                          : `${MONTH_LABELS[m - 1]}/${year} · sem dados`;
                        return (
                          <td
                            key={m}
                            className="relative p-0 align-middle"
                            title={tip}
                          >
                            <div
                              className={`${bg} ${fg} ${border} border rounded-sm h-6 flex items-center justify-center tabular-nums text-[9px] cursor-default`}
                              aria-label={tip}
                            >
                              {isEmpty ? "—" : fmtDY(c.dy, 2)}
                            </div>
                          </td>
                        );
                      })}
                      <td className="py-0.5 px-2 text-right tabular-nums text-pink-300">
                        {fmtDY(yearTot, 2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 pt-3 border-t border-[#141414] grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] font-mono">
            <div>
              <div className="text-zinc-600 text-[9px] uppercase tracking-wider">
                DY médio (mês)
              </div>
              <div className="text-zinc-300 tabular-nums">
                {fmtDY(summary.mean, 2)}
              </div>
            </div>
            <div>
              <div className="text-zinc-600 text-[9px] uppercase tracking-wider">
                Mediana (mês)
              </div>
              <div className="text-zinc-300 tabular-nums">
                {fmtDY(summary.median, 2)}
              </div>
            </div>
            <div>
              <div className="text-zinc-600 text-[9px] uppercase tracking-wider">
                Últimos {summary.last12Count}m (soma)
              </div>
              <div className="text-pink-300 tabular-nums">
                {fmtDY(summary.last12, 2)}
              </div>
            </div>
            <div>
              <div className="text-zinc-600 text-[9px] uppercase tracking-wider">
                Melhor mês
              </div>
              <div className="text-zinc-300 tabular-nums">
                {summary.bestMonth
                  ? `${fmtDY(summary.bestMonth.value, 2)} · ${summary.bestMonth.label}`
                  : "—"}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
