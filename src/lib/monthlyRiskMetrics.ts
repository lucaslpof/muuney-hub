/**
 * monthlyRiskMetrics.ts — Risk metrics computed from MONTHLY return series.
 *
 * For funds that don't have daily quota data (FIDC, FII, FIP — CVM publishes
 * only monthly informes), we need parallel metrics to those in fundMetrics.ts.
 *
 * All inputs are monthly percentage returns (e.g. 1.25 for +1.25%/mês).
 * Risk-free rate defaults to current Selic meta (14.15% a.a.).
 *
 * NOTE on outliers: CVM publishes FIDC rentabilidade with severe corruptions
 * (e.g. −280bi% for funds in liquidation). Callers should pre-filter via
 * cleanRentab() with |value| ≤ 95% threshold before passing here.
 */

const MONTHS_YEAR = 12;
const DEFAULT_CDI_ANNUAL = 14.15;

/** Convert annual rate (%) to monthly rate (decimal) via compound formula. */
function annualToMonthly(annualPct: number): number {
  return Math.pow(1 + annualPct / 100, 1 / MONTHS_YEAR) - 1;
}

/** Compounded return (%) over the entire series. */
export function periodReturnMonthly(monthlyReturns: number[]): number | null {
  if (!monthlyReturns || monthlyReturns.length === 0) return null;
  let cum = 1;
  for (const r of monthlyReturns) {
    if (Number.isFinite(r)) cum *= 1 + r / 100;
  }
  return (cum - 1) * 100;
}

/** Annualized return (%) — compounds the series and scales to 12 months. */
export function annualizedReturnMonthly(monthlyReturns: number[]): number | null {
  if (!monthlyReturns || monthlyReturns.length < 2) return null;
  const total = periodReturnMonthly(monthlyReturns);
  if (total == null) return null;
  const n = monthlyReturns.length;
  return (Math.pow(1 + total / 100, MONTHS_YEAR / n) - 1) * 100;
}

/** Annualized volatility (%) from monthly series. */
export function annualizedVolatilityMonthly(monthlyReturns: number[]): number | null {
  const valid = monthlyReturns.filter((r) => Number.isFinite(r));
  if (valid.length < 3) return null;

  const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
  const variance = valid.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (valid.length - 1);
  const monthlyVol = Math.sqrt(variance); // in percent
  return monthlyVol * Math.sqrt(MONTHS_YEAR);
}

/** Sharpe ratio: (annualized return − CDI) / annualized vol. */
export function sharpeRatioMonthly(
  monthlyReturns: number[],
  riskFreeAnnual: number = DEFAULT_CDI_ANNUAL,
): number | null {
  const ret = annualizedReturnMonthly(monthlyReturns);
  const vol = annualizedVolatilityMonthly(monthlyReturns);
  if (ret == null || vol == null || vol === 0) return null;
  return (ret - riskFreeAnnual) / vol;
}

/** Downside deviation (annualized %) — only returns below the risk-free rate. */
function downsideDeviationMonthly(
  monthlyReturns: number[],
  riskFreeAnnual: number = DEFAULT_CDI_ANNUAL,
): number | null {
  const valid = monthlyReturns.filter((r) => Number.isFinite(r));
  if (valid.length < 3) return null;

  const rfMonthly = annualToMonthly(riskFreeAnnual) * 100; // percent
  const downside = valid.filter((r) => r < rfMonthly);
  if (downside.length === 0) return null;

  const variance =
    downside.reduce((sum, r) => sum + (r - rfMonthly) ** 2, 0) / downside.length;
  return Math.sqrt(variance) * Math.sqrt(MONTHS_YEAR);
}

/** Sortino ratio: (annualized return − CDI) / downside vol. */
export function sortinoRatioMonthly(
  monthlyReturns: number[],
  riskFreeAnnual: number = DEFAULT_CDI_ANNUAL,
): number | null {
  const ret = annualizedReturnMonthly(monthlyReturns);
  const dd = downsideDeviationMonthly(monthlyReturns, riskFreeAnnual);
  if (ret == null || dd == null || dd === 0) return null;
  return (ret - riskFreeAnnual) / dd;
}

export interface MonthlyDrawdownResult {
  maxDrawdown: number; // percentage, negative
  drawdownSeries: { idx: number; drawdown: number }[];
  peakIdx: number | null;
  troughIdx: number | null;
}

/** Max drawdown computed on the cumulative-return curve from monthly returns. */
export function maxDrawdownMonthly(monthlyReturns: number[]): MonthlyDrawdownResult {
  const result: MonthlyDrawdownResult = {
    maxDrawdown: 0,
    drawdownSeries: [],
    peakIdx: null,
    troughIdx: null,
  };
  if (!monthlyReturns || monthlyReturns.length < 2) return result;

  let cum = 1;
  let peak = 1;
  let peakIdx = 0;
  let troughIdx = 0;
  let maxDD = 0;

  for (let i = 0; i < monthlyReturns.length; i++) {
    const r = monthlyReturns[i];
    if (!Number.isFinite(r)) continue;
    cum *= 1 + r / 100;
    if (cum > peak) {
      peak = cum;
      peakIdx = i;
    }
    const dd = ((cum - peak) / peak) * 100;
    result.drawdownSeries.push({ idx: i, drawdown: dd });
    if (dd < maxDD) {
      maxDD = dd;
      troughIdx = i;
      result.peakIdx = peakIdx;
    }
  }

  result.maxDrawdown = maxDD;
  result.troughIdx = troughIdx;
  return result;
}

/** Calmar ratio: annualized return / |max drawdown|. */
export function calmarRatioMonthly(monthlyReturns: number[]): number | null {
  const ret = annualizedReturnMonthly(monthlyReturns);
  const dd = maxDrawdownMonthly(monthlyReturns).maxDrawdown;
  if (ret == null || dd === 0) return null;
  return ret / Math.abs(dd);
}

export interface MonthlyRiskMetricsResult {
  return_period: number | null;
  return_annualized: number | null;
  volatility: number | null;
  sharpe: number | null;
  sortino: number | null;
  max_drawdown: number | null;
  calmar: number | null;
  data_points: number;
  positive_months_pct: number | null;
}

/** Aggregate all metrics for a monthly return series. */
export function computeMonthlyRiskMetrics(
  monthlyReturns: number[],
  riskFreeAnnual: number = DEFAULT_CDI_ANNUAL,
): MonthlyRiskMetricsResult {
  const valid = monthlyReturns.filter((r) => Number.isFinite(r));
  const positive = valid.length > 0
    ? (valid.filter((r) => r > 0).length / valid.length) * 100
    : null;

  return {
    return_period: periodReturnMonthly(monthlyReturns),
    return_annualized: annualizedReturnMonthly(monthlyReturns),
    volatility: annualizedVolatilityMonthly(monthlyReturns),
    sharpe: sharpeRatioMonthly(monthlyReturns, riskFreeAnnual),
    sortino: sortinoRatioMonthly(monthlyReturns, riskFreeAnnual),
    max_drawdown: maxDrawdownMonthly(monthlyReturns).maxDrawdown,
    calmar: calmarRatioMonthly(monthlyReturns),
    data_points: valid.length,
    positive_months_pct: positive,
  };
}
