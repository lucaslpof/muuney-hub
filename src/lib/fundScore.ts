/**
 * fundScore.ts — Muuney Fund Score™ composite scoring system (H1.4 Fase C)
 *
 * Composite score (0–100) based on 4 pillars:
 *   1. Rentabilidade (35%) — period return, annualized return, consistency
 *   2. Risco (30%) — volatility, max drawdown, Sharpe, Sortino
 *   3. Liquidez (20%) — condomínio (aberto/fechado), cotistas, captação líquida
 *   4. Custos (15%) — taxa_adm, taxa_perfm relative to class peers
 *
 * Each pillar is scored 0–100. Final score is weighted average.
 * Scoring uses percentile-based normalization within peer group.
 */

import type { FundDaily, FundMeta } from "@/hooks/useHubFundos";
import { computeFundMetrics, type FundMetricsResult } from "./fundMetrics";

/* ─── Score weights ─── */
const WEIGHTS = {
  rentabilidade: 0.35,
  risco: 0.30,
  liquidez: 0.20,
  custos: 0.15,
} as const;

/* ─── Score result ─── */
export interface FundScoreResult {
  score: number; // 0–100 composite
  pilares: {
    rentabilidade: number;
    risco: number;
    liquidez: number;
    custos: number;
  };
  label: string; // "Excelente" | "Bom" | "Regular" | "Fraco" | "Insuficiente"
  color: string; // hex color for display
  metrics?: FundMetricsResult;
}

/* ─── Percentile normalization (higher is better) ─── */
function percentileScore(value: number | null, values: (number | null)[], higherIsBetter = true): number {
  if (value == null) return 50; // neutral if no data
  const valid = values.filter((v): v is number => v != null);
  if (valid.length < 2) return 50;
  const sorted = [...valid].sort((a, b) => a - b);
  const idx = sorted.findIndex((v) => v >= value);
  const pct = idx < 0 ? 100 : (idx / sorted.length) * 100;
  return higherIsBetter ? pct : 100 - pct;
}

/* ─── Clamp 0–100 ─── */
function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}

/* ─── Score label & color ─── */
function scoreLabel(score: number): { label: string; color: string } {
  if (score >= 85) return { label: "Excelente", color: "#0B6C3E" };
  if (score >= 70) return { label: "Bom", color: "#22C55E" };
  if (score >= 50) return { label: "Regular", color: "#F59E0B" };
  if (score >= 30) return { label: "Fraco", color: "#F97316" };
  return { label: "Insuficiente", color: "#EF4444" };
}

/* ─── Compute Muuney Fund Score™ ─── */
export function computeFundScore(
  meta: FundMeta,
  daily: FundDaily[],
  peerMetrics?: {
    returns: (number | null)[];
    volatilities: (number | null)[];
    sharpes: (number | null)[];
    drawdowns: (number | null)[];
    taxasAdm: (number | null)[];
    taxasPerfm: (number | null)[];
    plValues: (number | null)[];
    cotistas: (number | null)[];
  }
): FundScoreResult {
  // Compute fund-level metrics
  const metrics = daily.length > 5 ? computeFundMetrics(daily) : null;

  // Default peer data (use neutral percentiles if no peers)
  const peers = peerMetrics || {
    returns: [], volatilities: [], sharpes: [], drawdowns: [],
    taxasAdm: [], taxasPerfm: [], plValues: [], cotistas: [],
  };

  /* ─── 1. Rentabilidade (35%) ─── */
  const returnPct = metrics?.return_annualized ?? null;
  const positiveDaysPct = metrics?.positive_days_pct ?? null;

  const returnScore = percentileScore(returnPct, peers.returns, true);
  // Consistency bonus: >55% positive days = +10, <45% = -10
  const consistencyBonus = positiveDaysPct != null
    ? positiveDaysPct > 55 ? 10 : positiveDaysPct < 45 ? -10 : 0
    : 0;
  const rentabilidadeScore = clamp(returnScore + consistencyBonus);

  /* ─── 2. Risco (30%) ─── */
  const volatility = metrics?.volatility ?? null;
  const maxDD = metrics?.max_drawdown ?? null;
  const sharpe = metrics?.sharpe ?? null;
  const sortino = metrics?.sortino ?? null;

  const volScore = percentileScore(volatility, peers.volatilities, false); // lower vol = better
  const ddScore = percentileScore(maxDD, peers.drawdowns, false); // less negative DD = better (note: DD is negative)
  const sharpeScore = percentileScore(sharpe, peers.sharpes, true);

  // Sortino bonus: > 2.0 = +10, < 0 = -10
  const sortinoBonus = sortino != null
    ? sortino > 2.0 ? 10 : sortino < 0 ? -10 : 0
    : 0;

  const riscoScore = clamp(
    volScore * 0.3 + ddScore * 0.3 + sharpeScore * 0.3 + (50 + sortinoBonus) * 0.1
  );

  /* ─── 3. Liquidez (20%) ─── */
  // Aberto vs Fechado: +20 for Aberto
  const condomScore = meta.condom === "Aberto" ? 80 : meta.condom === "Fechado" ? 40 : 60;
  // Cotistas (more = more liquid)
  const cotistasScore = percentileScore(meta.nr_cotistas, peers.cotistas, true);
  // PL (larger = more liquid)
  const plScore = percentileScore(meta.vl_patrim_liq, peers.plValues, true);
  // Not exclusive fund = bonus
  const exclusiveBonus = meta.fundo_exclusivo === "S" ? -15 : 0;

  const liquidezScore = clamp(
    condomScore * 0.3 + cotistasScore * 0.3 + plScore * 0.3 + (50 + exclusiveBonus) * 0.1
  );

  /* ─── 4. Custos (15%) ─── */
  const taxaAdmScore = percentileScore(meta.taxa_adm, peers.taxasAdm, false); // lower = better
  const taxaPerfmScore = meta.taxa_perfm != null && meta.taxa_perfm > 0
    ? percentileScore(meta.taxa_perfm, peers.taxasPerfm, false)
    : 80; // no perf fee = good

  const custosScore = clamp(taxaAdmScore * 0.6 + taxaPerfmScore * 0.4);

  /* ─── Composite Score ─── */
  const composite = clamp(
    rentabilidadeScore * WEIGHTS.rentabilidade +
    riscoScore * WEIGHTS.risco +
    liquidezScore * WEIGHTS.liquidez +
    custosScore * WEIGHTS.custos
  );

  const { label, color } = scoreLabel(composite);

  return {
    score: Math.round(composite * 10) / 10,
    pilares: {
      rentabilidade: Math.round(rentabilidadeScore),
      risco: Math.round(riscoScore),
      liquidez: Math.round(liquidezScore),
      custos: Math.round(custosScore),
    },
    label,
    color,
    metrics: metrics ?? undefined,
  };
}

/* ─── Score badge text helper ─── */
export function scoreBadge(score: number): string {
  return `${score.toFixed(0)}/100`;
}
