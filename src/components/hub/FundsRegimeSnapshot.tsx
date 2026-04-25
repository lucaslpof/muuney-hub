/**
 * FundsRegimeSnapshot.tsx — Compact regime badge for HubFundos hero (P1-8)
 *
 * Mirrors the regime detection logic of FundNarrativePanel (scope=market)
 * in a single-line strip that loads above the KPI grid. The full
 * FundNarrativePanel is still rendered in the Analytics section — this
 * snapshot is meant to give AAIs an at-a-glance read without scrolling.
 */

import { motion } from "framer-motion";
import {
  detectFundMarketRegime,
  type MarketScopeProps,
} from "./FundNarrativePanel";
import { fmtNum } from "@/lib/format";

interface Props extends MarketScopeProps {
  /** Optional click handler that scrolls to the analytics section. */
  onJumpToAnalytics?: () => void;
}

export function FundsRegimeSnapshot({ onJumpToAnalytics, ...marketProps }: Props) {
  const regime = detectFundMarketRegime(marketProps);
  const Icon = regime.icon;

  // Build a compact 3-metric strip
  const chips: { label: string; value: string; tone: string }[] = [];
  if (marketProps.fidcInadim != null) {
    // Thresholds calibrados com o universo real (média ~16% no DB).
    const v = marketProps.fidcInadim;
    chips.push({
      label: "FIDC Inadim",
      value: `${fmtNum(v, 1)}%`,
      tone:
        v > 10
          ? "text-red-400"
          : v > 5
          ? "text-amber-400"
          : "text-emerald-400",
    });
  }
  if (marketProps.fiiAvgDY != null) {
    // Caller passa em %/mês (já multiplicado por 100 em narrativeProps).
    const v = marketProps.fiiAvgDY;
    chips.push({
      label: "FII DY",
      value: `${fmtNum(v, 2)}%/m`,
      tone: v > 0.8 ? "text-emerald-400" : "text-zinc-400",
    });
  }
  if (marketProps.selicMeta != null) {
    chips.push({
      label: "Selic Meta",
      value: `${fmtNum(marketProps.selicMeta, 2)}%`,
      tone: marketProps.selicMeta > 12 ? "text-amber-400" : "text-zinc-400",
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-4 py-3 flex flex-col md:flex-row md:items-center gap-3"
      role="status"
      aria-label={`Regime de mercado de fundos: ${regime.regime}`}
    >
      {/* Regime pill */}
      <div className="flex items-center gap-2 shrink-0">
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border"
          style={{
            backgroundColor: `${regime.color}12`,
            borderColor: `${regime.color}50`,
            color: regime.color,
          }}
        >
          <Icon className="w-3.5 h-3.5" />
          <span className="text-[11px] font-mono font-semibold uppercase tracking-wider">
            {regime.regime}
          </span>
        </div>
        <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-wider">
          Regime
        </span>
      </div>

      {/* Description */}
      <div className="text-[11px] text-zinc-400 leading-snug flex-1 min-w-0">
        {regime.description}
      </div>

      {/* Compact metrics chips */}
      {chips.length > 0 && (
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          {chips.map((c) => (
            <div key={c.label} className="text-[10px] font-mono">
              <span className="text-zinc-600 uppercase tracking-wider">{c.label} </span>
              <span className={`font-semibold ${c.tone}`}>{c.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Jump CTA */}
      {onJumpToAnalytics && (
        <button
          type="button"
          onClick={onJumpToAnalytics}
          className="text-[10px] font-mono text-zinc-500 hover:text-[#0B6C3E] transition-colors uppercase tracking-wider shrink-0"
          aria-label="Ir para a seção de analytics"
        >
          Ver analytics →
        </button>
      )}
    </motion.div>
  );
}
