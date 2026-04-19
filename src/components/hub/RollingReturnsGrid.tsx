/**
 * RollingReturnsGrid — Tight performance table for trailing return windows.
 *
 * Takes a RollingReturnRow[] (produced by src/lib/rollingReturns.ts) and
 * renders a Tech-Noir styled table with columns:
 *   Janela · Retorno · Anualizado · CDI · vs CDI
 *
 * Positive / negative cells are color-coded. Insufficient history shows an
 * em dash. Safe to pass an empty array — the component renders a compact
 * placeholder row instead of breaking the layout.
 */

import type { RollingReturnRow } from "@/lib/rollingReturns";

interface RollingReturnsGridProps {
  rows: RollingReturnRow[];
  /** Optional section title. Defaults to "Janelas de retorno". */
  title?: string;
  /** Optional helper text rendered under the title. */
  subtitle?: string;
  /** Accent color for the header chip (defaults to Muuney green). */
  accent?: string;
  className?: string;
}

function fmtPct(v: number | null, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

function fmtPP(v: number | null, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)} p.p.`;
}

function colorClass(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "text-zinc-500";
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-red-400";
  return "text-zinc-400";
}

export function RollingReturnsGrid({
  rows,
  title = "Janelas de retorno",
  subtitle,
  accent = "#0B6C3E",
  className = "",
}: RollingReturnsGridProps) {
  const hasData = rows.some((r) => r.returnPct != null);

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
        <div className="text-[9px] font-mono text-zinc-600">
          vs CDI 14.15% a.a.
        </div>
      </div>

      <div className="overflow-x-auto -mx-1">
        <table
          className="w-full text-[10px] font-mono"
          role="table"
          aria-label="Tabela de retornos por janela temporal"
        >
          <thead>
            <tr className="text-zinc-500 border-b border-[#1a1a1a]">
              <th className="text-left py-1.5 px-2 font-normal w-[14%]">Janela</th>
              <th className="text-right py-1.5 px-2 font-normal w-[22%]">Retorno</th>
              <th className="text-right py-1.5 px-2 font-normal w-[22%]">Anualizado</th>
              <th className="text-right py-1.5 px-2 font-normal w-[20%]">CDI</th>
              <th className="text-right py-1.5 px-2 font-normal w-[22%]">vs CDI</th>
            </tr>
          </thead>
          <tbody>
            {!hasData && (
              <tr>
                <td
                  colSpan={5}
                  className="py-4 text-center text-zinc-600 text-[10px]"
                >
                  Histórico insuficiente para calcular janelas rolantes.
                </td>
              </tr>
            )}
            {hasData &&
              rows.map((row) => {
                const isEmpty = row.returnPct == null;
                return (
                  <tr
                    key={row.label}
                    className={`border-b border-[#141414] last:border-b-0 ${
                      isEmpty ? "opacity-50" : "hover:bg-[#0f0f0f]"
                    } transition-colors`}
                  >
                    <td className="py-1.5 px-2 text-zinc-300 uppercase">
                      {row.label}
                    </td>
                    <td
                      className={`py-1.5 px-2 text-right tabular-nums ${colorClass(
                        row.returnPct,
                      )}`}
                    >
                      {fmtPct(row.returnPct)}
                    </td>
                    <td
                      className={`py-1.5 px-2 text-right tabular-nums ${colorClass(
                        row.annualizedPct,
                      )}`}
                    >
                      {row.months >= 12 ? fmtPct(row.annualizedPct) : "—"}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums text-zinc-400">
                      {fmtPct(row.cdiPct)}
                    </td>
                    <td
                      className={`py-1.5 px-2 text-right tabular-nums ${colorClass(
                        row.vsCdiPct,
                      )}`}
                    >
                      {fmtPP(row.vsCdiPct)}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <div className="text-[9px] text-zinc-600 mt-2 leading-relaxed">
        Janelas &lt; 12m exibem retorno acumulado (não anualizado). CDI estimado
        a partir da Selic meta composta no período.
      </div>
    </section>
  );
}

export default RollingReturnsGrid;
