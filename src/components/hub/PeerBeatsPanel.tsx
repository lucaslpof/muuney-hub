/**
 * PeerBeatsPanel.tsx — "Fundos que estão batendo este" (P1-2)
 *
 * Compact, high-signal panel for FundLamina/FidcLamina/FiiLamina.
 * Filters a peer list to those outperforming the current fund on a metric
 * (rentab, DY, etc.), ranks them by delta, and renders a clickable list.
 *
 * Empty states are deliberate (not nothing): if no peer beats the fund,
 * show a positive "Este fundo é referência no peer group" line. If we don't
 * have enough peer data to compare, show a neutral disclosure instead of
 * silently rendering nothing.
 */

import { Link } from "react-router-dom";
import { Trophy, TrendingUp } from "lucide-react";

export interface PeerBeatsItem {
  name: string;
  slug: string | null;
  cnpjFallback?: string | null;
  /** Peer's metric value (e.g. 1.85 for 1.85%). */
  value: number;
  /** Delta vs the current fund (peer - base). Positive means peer beats. */
  delta: number;
  /** Optional secondary stat shown faint on the right. */
  secondary?: string;
}

interface Props {
  /** Class accent color (e.g. "#F97316" for FIDC). */
  accent: string;
  /** Lâmina base route, e.g. "/fundos/fidc". */
  basePath: string;
  /** Peers (already enriched). Component filters & sorts internally. */
  peers: PeerBeatsItem[];
  /** Reference value of the current fund — used in the disclosure copy. */
  baseValue: number | null;
  /** Metric label (singular noun). e.g. "Rentab" / "DY" */
  metricLabel: string;
  /** Unit suffix for displayed numbers (e.g. "%"). */
  unit?: string;
  /** Optional title override. Defaults to "Fundos que estão batendo este". */
  title?: string;
  /** Max items to show (default 5). */
  limit?: number;
  className?: string;
}

function fmtNum(v: number, unit: string, digits = 2): string {
  return `${v.toFixed(digits)}${unit}`;
}

export function PeerBeatsPanel({
  accent,
  basePath,
  peers,
  baseValue,
  metricLabel,
  unit = "%",
  title = "Fundos que estão batendo este",
  limit = 5,
  className = "",
}: Props) {
  // Filter & sort: only those with delta > 0, descending by delta
  const beats = peers
    .filter((p) => Number.isFinite(p.delta) && p.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, limit);

  const totalPeers = peers.filter((p) => Number.isFinite(p.delta)).length;
  const isReference = totalPeers > 0 && beats.length === 0;

  return (
    <section
      className={`bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-3 md:p-4 ${className}`}
      aria-label={title}
    >
      <div className="flex items-start justify-between gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Trophy className="w-3.5 h-3.5" style={{ color: accent }} />
          <h3
            className="text-[10px] font-mono uppercase tracking-[0.2em]"
            style={{ color: accent }}
          >
            {title}
          </h3>
        </div>
        <div className="text-[9px] font-mono text-zinc-600 uppercase tracking-wider">
          {totalPeers > 0
            ? `${beats.length} de ${totalPeers} peers`
            : "Sem peers para comparar"}
        </div>
      </div>

      {/* Empty state: no peer data at all */}
      {totalPeers === 0 && (
        <div className="text-[10px] font-mono text-zinc-600 italic">
          Sem dados comparáveis no peer group neste período.
        </div>
      )}

      {/* "This fund is the reference" state */}
      {isReference && (
        <div className="flex items-start gap-2 text-[10px] font-mono text-emerald-400">
          <TrendingUp className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <p className="leading-relaxed">
            Este fundo lidera o peer group em {metricLabel.toLowerCase()}
            {baseValue != null ? ` (${fmtNum(baseValue, unit)})` : ""} — nenhum
            par avaliado bate o desempenho atual.
          </p>
        </div>
      )}

      {/* Beats list */}
      {beats.length > 0 && (
        <ul className="space-y-1.5">
          {beats.map((p, idx) => {
            const target = p.slug
              ? `${basePath}/${p.slug}`
              : p.cnpjFallback
              ? `${basePath}/${p.cnpjFallback}`
              : null;
            const row = (
              <div className="flex items-center justify-between gap-3 text-[10px] font-mono py-1">
                <span className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-zinc-600 tabular-nums w-4 text-right">
                    {idx + 1}
                  </span>
                  <span className="text-zinc-200 truncate">{p.name}</span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  {p.secondary && (
                    <span className="text-zinc-600 hidden sm:inline">
                      {p.secondary}
                    </span>
                  )}
                  <span className="text-zinc-300 tabular-nums">
                    {fmtNum(p.value, unit)}
                  </span>
                  <span
                    className="text-emerald-400 tabular-nums w-14 text-right"
                    aria-label={`Delta de ${fmtNum(p.delta, unit, 2)}`}
                  >
                    +{p.delta.toFixed(2)}
                    {unit === "%" ? "pp" : unit}
                  </span>
                </span>
              </div>
            );
            return (
              <li
                key={`${p.slug ?? p.name}-${idx}`}
                className="border-b border-[#141414] last:border-b-0"
              >
                {target ? (
                  <Link
                    to={target}
                    className="block hover:bg-[#111111] rounded-sm transition-colors"
                  >
                    {row}
                  </Link>
                ) : (
                  row
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Footer note */}
      {beats.length > 0 && baseValue != null && (
        <div className="mt-3 pt-2 border-t border-[#141414] text-[9px] font-mono text-zinc-600">
          Referência: {fmtNum(baseValue, unit)} · ranking por delta{" "}
          {metricLabel.toLowerCase()}.
        </div>
      )}
    </section>
  );
}
