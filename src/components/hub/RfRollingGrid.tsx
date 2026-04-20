/**
 * RfRollingGrid.tsx — P0-7 Renda Fixa audit (20/04/2026)
 *
 * Tech-Noir styled trailing-window grid for fixed-income indicators. Mirrors
 * `CreditRollingGrid` but uses `RfRollingRow` with RF-specific kinds (rate,
 * spread, real, breakeven, curve).
 *
 * Color logic respects `lowerIsBetter` per row:
 *   • lowerIsBetter = true  → delta > 0 paints RED (deterioration for holder)
 *   • lowerIsBetter = false → delta > 0 paints GREEN (carry or real yield up)
 *
 * All RF deltas render in p.p. (no % branch — RF is level-based here).
 */
import type { RfRollingRow } from "@/lib/rfRollingDeltas";

interface Props {
  rows: RfRollingRow[];
  title?: string;
  subtitle?: string;
  accent?: string;
  className?: string;
}

function formatCell(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)} p.p.`;
}

function cellColor(value: number | null, lowerIsBetter: boolean): string {
  if (value == null || !Number.isFinite(value)) return "text-zinc-600";
  if (Math.abs(value) < 0.01) return "text-zinc-400";
  const deteriorating = lowerIsBetter ? value > 0 : value < 0;
  return deteriorating ? "text-red-400" : "text-emerald-400";
}

function formatLatest(row: RfRollingRow): string {
  if (row.latestValue == null) return "—";
  const suffix = row.kind === "curve" ? " pp" : "%";
  return `${row.latestValue.toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}${suffix}`;
}

export function RfRollingGrid({
  rows,
  title = "Indicadores RF rolantes",
  subtitle,
  accent = "#10B981",
  className = "",
}: Props) {
  const hasData = rows.some((r) => r.cells.some((c) => c.delta != null));

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
          Δ vs janela · p.p. · cor depende do ângulo (carry vs MaM)
        </div>
      </div>

      <div className="overflow-x-auto -mx-1">
        <table
          className="w-full text-[10px] font-mono"
          role="table"
          aria-label="Tabela de deltas RF por janela temporal"
        >
          <thead>
            <tr className="text-zinc-500 border-b border-[#1a1a1a]">
              <th className="text-left py-1.5 px-2 font-normal w-[28%]">Indicador</th>
              <th className="text-right py-1.5 px-2 font-normal w-[14%]">Atual</th>
              {(rows[0]?.cells ?? []).map((c) => (
                <th
                  key={c.label}
                  className="text-right py-1.5 px-2 font-normal w-[10%] uppercase"
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!hasData && (
              <tr>
                <td
                  colSpan={2 + (rows[0]?.cells?.length ?? 6)}
                  className="py-4 text-center text-zinc-600 text-[10px]"
                >
                  Histórico insuficiente para calcular janelas rolantes.
                </td>
              </tr>
            )}
            {hasData &&
              rows.map((row) => (
                <tr
                  key={row.key}
                  className="border-b border-[#141414] last:border-b-0 hover:bg-[#0f0f0f] transition-colors"
                >
                  <td className="py-1.5 px-2 text-zinc-300">
                    <div className="flex flex-col">
                      <span className="text-zinc-200">{row.label}</span>
                      {row.latestDate && (
                        <span className="text-[8px] text-zinc-600">
                          {new Date(row.latestDate).toLocaleDateString("pt-BR", {
                            month: "short",
                            year: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-1.5 px-2 text-right tabular-nums text-zinc-200">
                    {formatLatest(row)}
                  </td>
                  {row.cells.map((c) => (
                    <td
                      key={c.label}
                      className={`py-1.5 px-2 text-right tabular-nums ${cellColor(
                        c.delta,
                        row.lowerIsBetter,
                      )}`}
                      title={
                        c.referenceValue != null
                          ? `Referência ${c.label}: ${c.referenceValue.toLocaleString(
                              "pt-BR",
                              { maximumFractionDigits: 2 },
                            )}`
                          : "Sem dado de referência"
                      }
                    >
                      {formatCell(c.delta)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="text-[9px] text-zinc-600 mt-2 leading-relaxed">
        Para taxas RF a interpretação da cor depende do ângulo: investidor pós-fixado
        vê queda de taxa como perda de carry; holder pré-fixado vê queda como ganho
        MaM. Cada linha carrega sua própria direção favorável.
      </div>
    </section>
  );
}

export default RfRollingGrid;
