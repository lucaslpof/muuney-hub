/**
 * rollingReturns.ts — Compute trailing return windows for fund lâminas.
 *
 * Two flavors:
 *   • computeRollingReturnsFromDaily: built for daily quota series
 *     (FundLamina), uses business-day approximations (~21 BD/month).
 *   • computeRollingReturnsFromMonthly: built for monthly informe series
 *     (FIDC/FII), aggregates the trailing N monthly returns.
 *
 * Both return a uniform RollingReturnRow[] that the RollingReturnsGrid
 * component can render.
 */

const MONTH_BD = 21; // approximate business days per month
const DEFAULT_CDI_ANNUAL = 14.15;

export interface RollingReturnRow {
  /** Window label (e.g. "1m", "12m", "36m"). */
  label: string;
  /** Window length in months (for sorting / display). */
  months: number;
  /** Cumulative return for the window in %. Null if insufficient data. */
  returnPct: number | null;
  /** Annualized return in %. For windows < 12m falls back to total return. */
  annualizedPct: number | null;
  /** CDI return for the same window in % (benchmark). */
  cdiPct: number | null;
  /** Delta vs CDI (returnPct − cdiPct), in %. */
  vsCdiPct: number | null;
  /** Number of underlying observations used (BD or months). */
  observations: number;
}

/** Default windows for fund lâminas (months). */
export const DEFAULT_WINDOWS: Array<{ label: string; months: number }> = [
  { label: "1m", months: 1 },
  { label: "3m", months: 3 },
  { label: "6m", months: 6 },
  { label: "12m", months: 12 },
  { label: "24m", months: 24 },
  { label: "36m", months: 36 },
];

/** Compound annual rate → monthly rate (decimal). */
function annualToMonthlyDec(annualPct: number): number {
  return Math.pow(1 + annualPct / 100, 1 / 12) - 1;
}

/** Compound annual rate → daily (252 BD) rate (decimal). */
function annualToDailyDec(annualPct: number): number {
  return Math.pow(1 + annualPct / 100, 1 / 252) - 1;
}

/** Compound a window of business days at a constant CDI annual rate. */
function compoundCdiOverDays(annualPct: number, days: number): number {
  const dailyDec = annualToDailyDec(annualPct);
  return (Math.pow(1 + dailyDec, days) - 1) * 100;
}

/** Compound a window of months at a constant CDI annual rate. */
function compoundCdiOverMonths(annualPct: number, months: number): number {
  const monthlyDec = annualToMonthlyDec(annualPct);
  return (Math.pow(1 + monthlyDec, months) - 1) * 100;
}

interface DailyPoint {
  dt_comptc: string;
  vl_quota?: number | null;
}

/**
 * Rolling returns from daily quota series.
 * Computes trailing windows ending at the LATEST observation.
 */
export function computeRollingReturnsFromDaily(
  daily: DailyPoint[],
  cdiAnnual: number = DEFAULT_CDI_ANNUAL,
  windows: Array<{ label: string; months: number }> = DEFAULT_WINDOWS,
): RollingReturnRow[] {
  if (!daily || daily.length < 2) {
    return windows.map((w) => emptyRow(w));
  }

  // Sort defensively — assume daily already chronological but be safe.
  const sorted = [...daily]
    .filter((d) => d && d.vl_quota != null && Number.isFinite(Number(d.vl_quota)))
    .sort((a, b) => a.dt_comptc.localeCompare(b.dt_comptc));

  if (sorted.length < 2) return windows.map((w) => emptyRow(w));

  const lastQuota = Number(sorted[sorted.length - 1].vl_quota);
  const lastIdx = sorted.length - 1;

  return windows.map(({ label, months }) => {
    const targetDays = months * MONTH_BD;
    if (lastIdx + 1 < targetDays + 1) {
      // Not enough history — fallback to whatever we have if at least 5 points.
      if (sorted.length < 5) return emptyRow({ label, months });
      const firstQuota = Number(sorted[0].vl_quota);
      const obs = sorted.length;
      const totalRet = ((lastQuota / firstQuota) - 1) * 100;
      const yearsCovered = obs / 252;
      const annualized = yearsCovered > 0
        ? (Math.pow(1 + totalRet / 100, 1 / yearsCovered) - 1) * 100
        : null;
      const cdi = compoundCdiOverDays(cdiAnnual, obs);
      return {
        label,
        months,
        returnPct: totalRet,
        annualizedPct: annualized,
        cdiPct: cdi,
        vsCdiPct: totalRet - cdi,
        observations: obs,
      };
    }

    const startQuota = Number(sorted[lastIdx - targetDays].vl_quota);
    if (!startQuota || !Number.isFinite(startQuota)) return emptyRow({ label, months });

    const totalRet = ((lastQuota / startQuota) - 1) * 100;
    const annualized =
      months >= 12
        ? (Math.pow(1 + totalRet / 100, 12 / months) - 1) * 100
        : totalRet;
    const cdi = compoundCdiOverDays(cdiAnnual, targetDays);

    return {
      label,
      months,
      returnPct: totalRet,
      annualizedPct: annualized,
      cdiPct: cdi,
      vsCdiPct: totalRet - cdi,
      observations: targetDays,
    };
  });
}

/**
 * Rolling returns from monthly returns (already in % per month).
 * Caller is responsible for providing CLEANED returns (no CVM outliers).
 */
export function computeRollingReturnsFromMonthly(
  monthlyReturns: number[],
  cdiAnnual: number = DEFAULT_CDI_ANNUAL,
  windows: Array<{ label: string; months: number }> = DEFAULT_WINDOWS,
): RollingReturnRow[] {
  if (!monthlyReturns || monthlyReturns.length === 0) {
    return windows.map((w) => emptyRow(w));
  }

  const valid = monthlyReturns.filter((r) => Number.isFinite(r));
  if (valid.length === 0) return windows.map((w) => emptyRow(w));

  const total = valid.length;

  return windows.map(({ label, months }) => {
    const useMonths = Math.min(months, total);
    if (useMonths < 1) return emptyRow({ label, months });

    // Take the last N monthly observations.
    const slice = valid.slice(-useMonths);
    let cum = 1;
    for (const r of slice) cum *= 1 + r / 100;
    const totalRet = (cum - 1) * 100;

    // Annualize only when the requested window covers ≥12 months of data.
    const annualized =
      useMonths >= 12
        ? (Math.pow(1 + totalRet / 100, 12 / useMonths) - 1) * 100
        : totalRet;

    const cdi = compoundCdiOverMonths(cdiAnnual, useMonths);

    return {
      label,
      months,
      returnPct: totalRet,
      annualizedPct: annualized,
      cdiPct: cdi,
      vsCdiPct: totalRet - cdi,
      observations: useMonths,
    };
  });
}

function emptyRow(w: { label: string; months: number }): RollingReturnRow {
  return {
    label: w.label,
    months: w.months,
    returnPct: null,
    annualizedPct: null,
    cdiPct: null,
    vsCdiPct: null,
    observations: 0,
  };
}
