/**
 * drawdown.ts — Compute monthly returns + running drawdowns for fund lâminas.
 *
 * Used by the DrawdownHeatmap component to render a year × month
 * calendar grid showing monthly performance and drawdown intensity.
 *
 * Two flavors:
 *   • computeMonthlyGridFromDaily: aggregates a daily quota series into
 *     month-end equity points and derives monthly return + running peak DD.
 *   • computeMonthlyGridFromMonthly: takes pre-computed monthly returns
 *     (FIDC/FII style) and pairs each with the corresponding date.
 *
 * Both return DrawdownCell[] sorted chronologically.
 */

export interface DrawdownCell {
  /** Calendar year (e.g. 2026). */
  year: number;
  /** 1-indexed month (1=Jan, 12=Dec). */
  month: number;
  /** Monthly return for this cell, in % (null if missing). */
  returnPct: number | null;
  /** Drawdown from running peak at end of this month, in % (≤ 0). */
  drawdownPct: number | null;
  /** True when this month closed at a new equity peak (DD = 0). */
  atPeak: boolean;
}

export interface DrawdownSummary {
  /** Worst drawdown observed across the period (most negative %). */
  maxDrawdownPct: number | null;
  /** Date string YYYY-MM of the trough month. */
  troughMonth: string | null;
  /** Date string YYYY-MM of the prior peak. */
  peakMonth: string | null;
  /** Number of months the fund spent underwater (DD < 0). */
  monthsUnderwater: number;
  /** Number of months observed. */
  totalMonths: number;
}

interface DailyPoint {
  dt_comptc: string;
  vl_quota?: number | null;
}

interface DatedReturn {
  dt_comptc: string;
  returnPct: number | null;
}

/* ──────────────────────────────────────────────────────────── */
/* Helpers                                                      */
/* ──────────────────────────────────────────────────────────── */

function parseYearMonth(dt: string): { year: number; month: number } | null {
  // Accept YYYY-MM-DD or YYYY-MM.
  if (!dt || typeof dt !== "string") return null;
  const m = dt.match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  if (month < 1 || month > 12) return null;
  return { year, month };
}

function ymKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/* ──────────────────────────────────────────────────────────── */
/* Daily-series flavor (FundLamina)                              */
/* ──────────────────────────────────────────────────────────── */

/**
 * Group daily quota points by month-end and compute monthly returns
 * + running drawdown from peak equity.
 */
export function computeMonthlyGridFromDaily(daily: DailyPoint[]): DrawdownCell[] {
  if (!daily || daily.length === 0) return [];

  // Sort chronologically and pick last quote of each month.
  const monthly = new Map<string, { year: number; month: number; lastQuota: number; dt: string }>();
  const sorted = [...daily]
    .filter((d) => d && d.vl_quota != null && Number.isFinite(Number(d.vl_quota)))
    .sort((a, b) => a.dt_comptc.localeCompare(b.dt_comptc));

  for (const d of sorted) {
    const ym = parseYearMonth(d.dt_comptc);
    if (!ym) continue;
    const key = ymKey(ym.year, ym.month);
    monthly.set(key, {
      year: ym.year,
      month: ym.month,
      lastQuota: Number(d.vl_quota),
      dt: d.dt_comptc,
    });
  }

  if (monthly.size === 0) return [];

  // Iterate in chronological order to compute return + DD.
  const ordered = Array.from(monthly.values()).sort((a, b) => a.dt.localeCompare(b.dt));

  const cells: DrawdownCell[] = [];
  let prevQuota: number | null = null;
  let runningPeak = ordered[0].lastQuota;

  for (const m of ordered) {
    const curQuota = m.lastQuota;
    const returnPct = prevQuota != null && prevQuota > 0
      ? ((curQuota / prevQuota) - 1) * 100
      : null;

    if (curQuota > runningPeak) runningPeak = curQuota;
    const drawdownPct = runningPeak > 0
      ? ((curQuota / runningPeak) - 1) * 100
      : null;

    cells.push({
      year: m.year,
      month: m.month,
      returnPct,
      drawdownPct,
      atPeak: drawdownPct != null && drawdownPct >= -0.001,
    });

    prevQuota = curQuota;
  }

  return cells;
}

/* ──────────────────────────────────────────────────────────── */
/* Monthly-series flavor (FIDC / FII)                           */
/* ──────────────────────────────────────────────────────────── */

/**
 * Build a drawdown grid from pre-computed monthly returns.
 * Caller passes (date, returnPct) pairs — already CVM-cleaned.
 */
export function computeMonthlyGridFromMonthly(
  monthlyReturns: DatedReturn[],
): DrawdownCell[] {
  if (!monthlyReturns || monthlyReturns.length === 0) return [];

  const valid = monthlyReturns
    .map((r) => {
      const ym = parseYearMonth(r.dt_comptc);
      if (!ym) return null;
      const ret = r.returnPct != null && Number.isFinite(r.returnPct) ? r.returnPct : null;
      return { ...ym, returnPct: ret, dt: r.dt_comptc };
    })
    .filter((r): r is { year: number; month: number; returnPct: number | null; dt: string } => r !== null)
    .sort((a, b) => a.dt.localeCompare(b.dt));

  if (valid.length === 0) return [];

  const cells: DrawdownCell[] = [];
  let equity = 1;
  let runningPeak = 1;

  for (const m of valid) {
    if (m.returnPct != null) {
      equity = equity * (1 + m.returnPct / 100);
    }
    if (equity > runningPeak) runningPeak = equity;
    const drawdownPct = runningPeak > 0
      ? ((equity / runningPeak) - 1) * 100
      : null;

    cells.push({
      year: m.year,
      month: m.month,
      returnPct: m.returnPct,
      drawdownPct,
      atPeak: drawdownPct != null && drawdownPct >= -0.001,
    });
  }

  return cells;
}

/* ──────────────────────────────────────────────────────────── */
/* Summary                                                      */
/* ──────────────────────────────────────────────────────────── */

export function summarizeDrawdown(cells: DrawdownCell[]): DrawdownSummary {
  if (!cells || cells.length === 0) {
    return {
      maxDrawdownPct: null,
      troughMonth: null,
      peakMonth: null,
      monthsUnderwater: 0,
      totalMonths: 0,
    };
  }

  let worst = 0;
  let troughIdx = -1;
  let underwater = 0;

  for (let i = 0; i < cells.length; i++) {
    const dd = cells[i].drawdownPct;
    if (dd == null) continue;
    if (dd < -0.001) underwater++;
    if (dd < worst) {
      worst = dd;
      troughIdx = i;
    }
  }

  let peakIdx = -1;
  if (troughIdx > 0) {
    // Walk back from trough to find the prior peak (DD ≈ 0).
    for (let i = troughIdx - 1; i >= 0; i--) {
      const dd = cells[i].drawdownPct;
      if (dd != null && dd >= -0.001) {
        peakIdx = i;
        break;
      }
    }
  }

  const fmt = (idx: number) =>
    idx >= 0 ? ymKey(cells[idx].year, cells[idx].month) : null;

  return {
    maxDrawdownPct: troughIdx >= 0 ? worst : null,
    troughMonth: fmt(troughIdx),
    peakMonth: fmt(peakIdx),
    monthsUnderwater: underwater,
    totalMonths: cells.length,
  };
}
