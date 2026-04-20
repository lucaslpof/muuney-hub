/**
 * rfRollingDeltas.ts — P0-7 Renda Fixa audit (20/04/2026)
 *
 * Trailing-window deltas for fixed-income indicators (rates, spreads, real
 * yields). Similar to `creditRollingDeltas.ts` but tuned for RF semantics:
 *
 *   • "rate"      → higher usually means worse for holders of pre-fixados,
 *                   better for carry pós-fixado. We let the caller set
 *                   `lowerIsBetter` explicitly per row.
 *   • "spread"    → higher = worse (risk premium rising = price compression).
 *   • "real"      → juro real ex-ante. Higher can be restrictive; lower can
 *                   indicate repression. Default lowerIsBetter=false (saver
 *                   view — alto juro real beneficia fixed income holder).
 *   • "breakeven" → higher = more inflation expected. Default no direction
 *                   (neutral gray).
 *
 * Re-uses the same cell/row shape as the credit version so that
 * `CreditRollingGrid` can render an RF table identically.
 */
import type { SeriesDataPoint } from "@/hooks/useHubData";

export type RfIndicatorKind = "rate" | "spread" | "real" | "breakeven" | "curve";

export interface RfRollingCell {
  months: number;
  label: string;
  /** Delta value — p.p. for rate/spread/real/breakeven/curve. Null if no history. */
  delta: number | null;
  /** Reference value at window start. Null if missing. */
  referenceValue: number | null;
}

export interface RfRollingRow {
  key: string;
  label: string;
  kind: RfIndicatorKind;
  lowerIsBetter: boolean;
  latestValue: number | null;
  latestDate: string | null;
  cells: RfRollingCell[];
}

/** Default trailing windows (same as credit for consistency). */
export const RF_DEFAULT_WINDOWS: Array<{ label: string; months: number }> = [
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
  kind: RfIndicatorKind;
  /** Required — RF semantics depend on holder perspective (investor vs hedger). */
  lowerIsBetter: boolean;
  windows?: Array<{ label: string; months: number }>;
}

/**
 * Builds an RfRollingRow from a series (monthly, weekly or daily). Assumes
 * chronological order — sorts defensively. Returns null-deltas for windows
 * longer than the available history, so a short series just dims cells.
 */
export function buildRfRollingRow({
  key,
  label,
  data,
  kind,
  lowerIsBetter,
  windows = RF_DEFAULT_WINDOWS,
}: BuildArgs): RfRollingRow {
  const sorted = [...(data || [])]
    .filter((p) => p && Number.isFinite(p.value))
    .sort((a, b) => a.date.localeCompare(b.date));

  const lastIdx = sorted.length - 1;
  const last = lastIdx >= 0 ? sorted[lastIdx] : null;

  const cells: RfRollingCell[] = windows.map(({ label: wlabel, months }) => {
    if (!last || lastIdx - months < 0) {
      return { months, label: wlabel, delta: null, referenceValue: null };
    }
    const ref = sorted[lastIdx - months];
    if (!ref) return { months, label: wlabel, delta: null, referenceValue: null };

    // All RF indicators in this module are level-based → p.p. delta.
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
    lowerIsBetter,
    latestValue: last?.value ?? null,
    latestDate: last?.date ?? null,
    cells,
  };
}
