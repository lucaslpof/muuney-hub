/**
 * fundMetrics.ts — Fund analytics utilities for muuney.hub Fundos module (H2.1-6)
 * Provides: daily returns, annualized return/vol, Sharpe, Sortino, drawdown, Calmar, tracking error
 */

import type { FundDaily } from "@/hooks/useHubFundos";

/* ─── Configuration ─── */
const TRADING_DAYS_YEAR = 252;
const DEFAULT_CDI_ANNUAL = 14.15; // Selic meta vigente (proxy CDI)

/* ─── Core: Daily Returns from Quotas ─── */
export function dailyReturns(daily: FundDaily[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < daily.length; i++) {
    const prev = daily[i - 1].vl_quota;
    const curr = daily[i].vl_quota;
    if (prev && curr && prev > 0) {
      returns.push((curr / prev) - 1);
    }
  }
  return returns;
}

/* ─── Annualized Return ─── */
export function annualizedReturn(daily: FundDaily[]): number | null {
  if (daily.length < 2) return null;
  const first = daily[0].vl_quota;
  const last = daily[daily.length - 1].vl_quota;
  if (!first || !last || first <= 0) return null;

  const totalReturn = last / first - 1;
  const days = daily.length;
  if (days <= 1) return null;

  // Annualize: (1 + total)^(252/days) - 1
  const annualized = Math.pow(1 + totalReturn, TRADING_DAYS_YEAR / days) - 1;
  return annualized * 100; // percentage
}

/* ─── Period Return (%) ─── */
export function periodReturn(daily: FundDaily[]): number | null {
  if (daily.length < 2) return null;
  const first = daily[0].vl_quota;
  const last = daily[daily.length - 1].vl_quota;
  if (!first || !last || first <= 0) return null;
  return ((last / first) - 1) * 100;
}

/* ─── Annualized Volatility (std dev of daily returns × √252) ─── */
export function annualizedVolatility(daily: FundDaily[]): number | null {
  const rets = dailyReturns(daily);
  if (rets.length < 5) return null;

  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (rets.length - 1);
  const dailyVol = Math.sqrt(variance);
  return dailyVol * Math.sqrt(TRADING_DAYS_YEAR) * 100; // percentage
}

/* ─── Sharpe Ratio: (return_annualized - CDI) / volatility ─── */
export function sharpeRatio(
  daily: FundDaily[],
  riskFreeAnnual: number = DEFAULT_CDI_ANNUAL
): number | null {
  const ret = annualizedReturn(daily);
  const vol = annualizedVolatility(daily);
  if (ret == null || vol == null || vol === 0) return null;
  return (ret - riskFreeAnnual) / vol;
}

/* ─── Downside Deviation (only negative returns) ─── */
function downsideDeviation(daily: FundDaily[], riskFreeAnnual: number = DEFAULT_CDI_ANNUAL): number | null {
  const rets = dailyReturns(daily);
  if (rets.length < 5) return null;

  const dailyRf = Math.pow(1 + riskFreeAnnual / 100, 1 / TRADING_DAYS_YEAR) - 1;
  const downside = rets.filter((r) => r < dailyRf);
  if (downside.length === 0) return null;

  const variance = downside.reduce((sum, r) => sum + (r - dailyRf) ** 2, 0) / downside.length;
  return Math.sqrt(variance) * Math.sqrt(TRADING_DAYS_YEAR) * 100;
}

/* ─── Sortino Ratio: (return_annualized - CDI) / downside_vol ─── */
export function sortinoRatio(
  daily: FundDaily[],
  riskFreeAnnual: number = DEFAULT_CDI_ANNUAL
): number | null {
  const ret = annualizedReturn(daily);
  const dd = downsideDeviation(daily, riskFreeAnnual);
  if (ret == null || dd == null || dd === 0) return null;
  return (ret - riskFreeAnnual) / dd;
}

/* ─── Maximum Drawdown ─── */
export interface DrawdownResult {
  maxDrawdown: number; // percentage (negative)
  drawdownSeries: { date: string; drawdown: number }[];
  peakDate: string | null;
  troughDate: string | null;
}

export function maxDrawdown(daily: FundDaily[]): DrawdownResult {
  const result: DrawdownResult = {
    maxDrawdown: 0,
    drawdownSeries: [],
    peakDate: null,
    troughDate: null,
  };

  if (daily.length < 2) return result;

  let peak = -Infinity;
  let peakDate = daily[0].dt_comptc;
  let maxDD = 0;
  let troughDate = daily[0].dt_comptc;

  for (const d of daily) {
    if (!d.vl_quota) continue;
    if (d.vl_quota > peak) {
      peak = d.vl_quota;
      peakDate = d.dt_comptc;
    }
    const dd = ((d.vl_quota - peak) / peak) * 100;
    result.drawdownSeries.push({ date: d.dt_comptc, drawdown: dd });

    if (dd < maxDD) {
      maxDD = dd;
      troughDate = d.dt_comptc;
      result.peakDate = peakDate;
    }
  }

  result.maxDrawdown = maxDD;
  result.troughDate = troughDate;
  return result;
}

/* ─── Calmar Ratio: annualized_return / |max_drawdown| ─── */
export function calmarRatio(daily: FundDaily[]): number | null {
  const ret = annualizedReturn(daily);
  const dd = maxDrawdown(daily);
  if (ret == null || dd.maxDrawdown === 0) return null;
  return ret / Math.abs(dd.maxDrawdown);
}

/* ─── Tracking Error vs benchmark series ─── */
export function trackingError(
  fundDaily: FundDaily[],
  benchmarkReturns: number[]
): number | null {
  const fundRets = dailyReturns(fundDaily);
  const n = Math.min(fundRets.length, benchmarkReturns.length);
  if (n < 5) return null;

  const diffs = fundRets.slice(0, n).map((r, i) => r - benchmarkReturns[i]);
  const mean = diffs.reduce((a, b) => a + b, 0) / n;
  const variance = diffs.reduce((sum, d) => sum + (d - mean) ** 2, 0) / (n - 1);
  return Math.sqrt(variance) * Math.sqrt(TRADING_DAYS_YEAR) * 100;
}

/* ─── Rolling Volatility (annualized, window days) ─── */
export function rollingVolatility(
  daily: FundDaily[],
  window: number = 21
): { date: string; volatility: number }[] {
  const rets = dailyReturns(daily);
  if (rets.length < window) return [];

  const result: { date: string; volatility: number }[] = [];
  for (let i = window - 1; i < rets.length; i++) {
    const slice = rets.slice(i - window + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / window;
    const variance = slice.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (window - 1);
    const vol = Math.sqrt(variance) * Math.sqrt(TRADING_DAYS_YEAR) * 100;
    // +1 because daily returns start from index 1
    result.push({ date: daily[i + 1].dt_comptc, volatility: vol });
  }
  return result;
}

/* ─── Capture Ratio (upside/downside) ─── */
export function captureRatio(
  fundDaily: FundDaily[],
  benchmarkReturns: number[]
): { upside: number | null; downside: number | null } {
  const fundRets = dailyReturns(fundDaily);
  const n = Math.min(fundRets.length, benchmarkReturns.length);
  if (n < 10) return { upside: null, downside: null };

  let upFund = 0, upBench = 0, upCount = 0;
  let downFund = 0, downBench = 0, downCount = 0;

  for (let i = 0; i < n; i++) {
    if (benchmarkReturns[i] > 0) {
      upFund += fundRets[i];
      upBench += benchmarkReturns[i];
      upCount++;
    } else if (benchmarkReturns[i] < 0) {
      downFund += fundRets[i];
      downBench += benchmarkReturns[i];
      downCount++;
    }
  }

  return {
    upside: upCount > 0 && upBench !== 0 ? (upFund / upBench) * 100 : null,
    downside: downCount > 0 && downBench !== 0 ? (downFund / downBench) * 100 : null,
  };
}

/* ─── Aggregate all metrics for a fund ─── */
export interface FundMetricsResult {
  return_period: number | null;
  return_annualized: number | null;
  volatility: number | null;
  sharpe: number | null;
  sortino: number | null;
  max_drawdown: number | null;
  calmar: number | null;
  data_points: number;
  positive_days_pct: number | null;
}

export function computeFundMetrics(
  daily: FundDaily[],
  riskFreeAnnual: number = DEFAULT_CDI_ANNUAL
): FundMetricsResult {
  const rets = dailyReturns(daily);
  const positiveDays = rets.length > 0
    ? (rets.filter((r) => r > 0).length / rets.length) * 100
    : null;

  return {
    return_period: periodReturn(daily),
    return_annualized: annualizedReturn(daily),
    volatility: annualizedVolatility(daily),
    sharpe: sharpeRatio(daily, riskFreeAnnual),
    sortino: sortinoRatio(daily, riskFreeAnnual),
    max_drawdown: maxDrawdown(daily).maxDrawdown,
    calmar: calmarRatio(daily),
    data_points: daily.length,
    positive_days_pct: positiveDays,
  };
}

/* ─── Format helpers ─── */
export function fmtMetric(value: number | null, decimals: number = 2): string {
  if (value == null) return "—";
  return value.toFixed(decimals);
}

export function fmtMetricSigned(value: number | null, decimals: number = 2): string {
  if (value == null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}`;
}

export function metricColor(value: number | null, higherIsBetter: boolean = true): string {
  if (value == null) return "text-zinc-500";
  if (higherIsBetter) return value >= 0 ? "text-emerald-400" : "text-red-400";
  return value <= 0 ? "text-emerald-400" : "text-red-400";
}

export function sharpeLabel(value: number | null): { label: string; color: string } {
  if (value == null) return { label: "—", color: "text-zinc-500" };
  if (value >= 1.5) return { label: "Excelente", color: "text-emerald-400" };
  if (value >= 1.0) return { label: "Bom", color: "text-green-400" };
  if (value >= 0.5) return { label: "Adequado", color: "text-yellow-400" };
  if (value >= 0) return { label: "Baixo", color: "text-orange-400" };
  return { label: "Negativo", color: "text-red-400" };
}
