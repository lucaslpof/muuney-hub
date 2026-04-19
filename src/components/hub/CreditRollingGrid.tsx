/**
 * CreditRollingGrid.tsx — P1-1 (19/04/2026)
 *
 * Tech-Noir styled trailing-window grid for credit indicators. Mirrors the
 * RollingReturnsGrid pattern used in fund lâminas, but columns are windows
 * (1m/3m/…/36m) and rows are indicators (Inad. Total, Spread PF, Taxa PF,
 * Concessões PF), with cells showing delta p.p. (rate/spread/default) or
 * delta % (volume).
 *
 * Color logic respects `lowerIsBetter` per row:
 *   • lowerIsBetter = true  → delta > 0 is RED (deterioration)
 *   • lowerIsBetter = false → delta > 0 is GREEN (improvement)
 *
 * Safe with short histories — cells beyond the available series show an em
 * dash and a muted tint.
 */
import type { CreditRollingRow } from "@/lib/creditRollingDeltas";

interface Props {
  rows: CreditRollingRow[];
  /** Section title — defaults to "Indicadores rolantes". */
  title?: string;
  /** Helper text under the title. */
  subtitle?: string;
  /** Accent color for the title chip (defaults to crédito green #10B981). */
  accent?: string;
  className?: string;
}

function formatCell(value: number | null, kind: CreditRollingRow["kind"]): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const suffix = kind === "volume" ? "%" : " p.p.";
  const digits = kind === "volume" ? 1 : 2;
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}${suffix}`;
}

function cellColor(value: number | null, lowerIsBetter: boolean): string {
  if (value == null || !Number.isFinite(value)) return "text-zinc-600";
  if (value === 0) return "text-zinc-400";
  const deteriorating = lowerIsBetter ? value > 0 : value < 0;
  return deteriorating ? "text-red-400" : "text-emerald-400";
}

function formatLatest(row: CreditRollingRow): string {
  if (row.latestValue == null) return "—";
  const suffix = row.kind === "volume" ? "" : "%";
  const digits = row.kind === "volume" ? 0 : 2;
  return `${row.latestValue.toLocaleString("pt-BR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })}${suffix}`;
}

export function CreditRollingGrid({
  rows,
  title = "Indicadores rolantes",
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
          Δ vs janela · p.p. para taxas · % para volumes
        </div>
      </div>

      <div className="overflow-x-auto -mx-1">
        <table
          className="w-full text-[10px] font-mono"
          role="table"
          aria-label="Tabela de deltas por janela temporal"
        >
          <thead>
            <tr className="text-zinc-500 border-b border-[#1a1a1a]">
              <th className="text-left py-1.5 px-2 font-normal w-[26%]">
                Indicador
              </th>
              <th className="text-right py-1.5 px-2 font-normal w-[14%]">
                Atual
              </th>
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
                              {
                                maximumFractionDigits: 2,
                              },
                            )}`
                          : "Sem dado de referência"
                      }
                    >
                      {formatCell(c.delta, row.kind)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="text-[9px] text-zinc-600 mt-2 leading-relaxed">
        Sinal de cor respeita direção favorável do indicador (vermelho = piora,
        verde = melhora). Janelas além do histórico disponível aparecem como
        em-dash.
      </div>
    </section>
  );
}

export default CreditRollingGrid;
