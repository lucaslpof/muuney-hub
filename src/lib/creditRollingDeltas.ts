/**
 * creditRollingDeltas.ts — P1-1 (19/04/2026)
 *
 * Trailing-window deltas for credit indicators (NOT returns). Credit series
 * (inadimplência, spread, taxa, concessões) are LEVELS — so we compare the
 * latest observation against the value from N months ago.
 *
 * Rates / spreads / inadimplência → delta in percentage points (p.p.).
 * Concessões (volume) → delta in % (compound implicit, just current/prev−1).
 *
 * Mirrors `src/lib/rollingReturns.ts` shape so `CreditRollingGrid` can render
 * a matching Tech-Noir table. `kind` flag drives unit + bad-direction tint
 * inside the grid (lower-is-better vs higher-is-better).
 */
import type { SeriesDataPoint } from "@/hooks/useHubData";

export type IndicatorKind = "rate" | "spread" | "default" | "volume";

export interface CreditRollingCell {
  /** Window in months. */
  months: number;
  /** Window label ("1m", "12m", ...). */
  label: string;
  /** Delta value — p.p. for rate/spread/default, % for volume. Null if no history. */
  delta: number | null;
  /** Reference value at window start. Null if missing. */
  referenceValue: number | null;
}

export interface CreditRollingRow {
  /** Indicator key (slug). */
  key: string;
  /** Display label for the indicator (e.g. "Inad. Total"). */
  label: string;
  /** Indicator kind drives unit + color logic. */
  kind: IndicatorKind;
  /**
   * If true, an INCREASE is unfavorable (paint deteriorations red).
   * Defaults: rate/spread/default → true; volume (concessões) → false.
   */
  lowerIsBetter: boolean;
  /** Latest observation value. Null if series empty. */
  latestValue: number | null;
  /** Latest observation date (YYYY-MM-DD). */
  latestDate: string | null;
  /** Cells per window (1m/3m/6m/12m/24m/36m by default). */
  cells: CreditRollingCell[];
}

/** Default trailing windows in months. */
export const CREDIT_DEFAULT_WINDOWS: Array<{ label: string; months: number }> = [
  { label: "1m", months: 1 },
  { label: "3m", months: 3 },
  { label: "6m", months: 6 },
  { label: "12m", months: 12 },
  { label: "24m", months: 24 },
  { label: "36m", months: 36 },
];

interface BuildArgs {
  key: string;
  label: string;
  data: SeriesDataPoint[];
  kind: IndicatorKind;
  /** Override default lowerIsBetter inferred from `kind`. */
  lowerIsBetter?: boolean;
  windows?: Array<{ label: string; months: number }>;
}

function defaultLowerIsBetter(kind: IndicatorKind): boolean {
  switch (kind) {
    case "volume":
      return false; // concessões: more is better
    case "rate":
    case "spread":
    case "default":
    default:
      return true; // taxas, spreads, inadimplência: less is better
  }
}

/**
 * Build a CreditRollingRow from a monthly series. Handles short histories
 * gracefully (windows beyond the series length return delta = null).
 *
 * The series is assumed chronological (oldest → newest). We sort defensively.
 */
export function buildCreditRollingRow({
  key,
  label,
  data,
  kind,
  lowerIsBetter,
  windows = CREDIT_DEFAULT_WINDOWS,
}: BuildArgs): CreditRollingRow {
  const lib = lowerIsBetter ?? defaultLowerIsBetter(kind);
  const sorted = [...(data || [])]
    .filter((p) => p && Number.isFinite(p.value))
    .sort((a, b) => a.date.localeCompare(b.date));

  const lastIdx = sorted.length - 1;
  const last = lastIdx >= 0 ? sorted[lastIdx] : null;

  const cells: CreditRollingCell[] = windows.map(({ label: wlabel, months }) => {
    if (!last || lastIdx - months < 0) {
      return { months, label: wlabel, delta: null, referenceValue: null };
    }
    const ref = sorted[lastIdx - months];
    if (!ref) return { months, label: wlabel, delta: null, referenceValue: null };

    if (kind === "volume") {
      // Δ% on volume series. Skip pathological zero references.
      if (!ref.value || !Number.isFinite(ref.value) || Math.abs(ref.value) < 1e-9) {
        return { months, label: wlabel, delta: null, referenceValue: ref.value };
      }
      const deltaPct = ((last.value - ref.value) / Math.abs(ref.value)) * 100;
      return { months, label: wlabel, delta: deltaPct, referenceValue: ref.value };
    }

    // p.p. delta on rate / spread / default series.
    return {
      months,
      label: wlabel,
      delta: last.value - ref.value,
      referenceValue: ref.value,
    };
  });

  return {
    key,
    label,
    kind,
    lowerIsBetter: lib,
    latestValue: last?.value ?? null,
    latestDate: last?.date ?? null,
    cells,
  };
}
