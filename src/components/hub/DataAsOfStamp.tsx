/**
 * DataAsOfStamp — Inline freshness indicator for data-driven pages.
 *
 * Shows the reference date for the underlying dataset with a colored dot
 * communicating freshness:
 *   • emerald: ≤ stale_days
 *   • amber:   ≤ 2× stale_days
 *   • red:     >  2× stale_days
 *
 * Different cadences accept different stale thresholds:
 *   • daily   → 7d
 *   • monthly → 45d (CVM informe mensal release ≈ M+30 a M+40)
 *   • quarterly → 120d (FIP quadrimestral)
 *   • weekly  → 14d
 *
 * Usage:
 *   <DataAsOfStamp date="2026-03-31" cadence="monthly" source="CVM Informe FIDC" />
 */

import { useMemo } from "react";
import { formatDate } from "@/lib/format";

type Cadence = "daily" | "weekly" | "monthly" | "quarterly";

const STALE_DAYS: Record<Cadence, number> = {
  daily: 7,
  weekly: 14,
  monthly: 45,
  quarterly: 120,
};

const CADENCE_LABELS: Record<Cadence, string> = {
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
  quarterly: "Quadrimestral",
};

interface DataAsOfStampProps {
  /** ISO date (YYYY-MM-DD) of the data reference period. */
  date: string | null | undefined;
  /** Update cadence — controls staleness thresholds. */
  cadence?: Cadence;
  /** Optional data source label (e.g. "CVM Informe FIDC"). */
  source?: string;
  /** Optional className override for outer wrapper. */
  className?: string;
  /** Compact mode hides cadence label. */
  compact?: boolean;
  /**
   * Optional methodological footnote rendered on a second line below the
   * stamp. Used to explain data-cleaning rules or series adjustments (e.g.
   * v_hub_fidc_clean outlier filter).
   */
  footnote?: string;
}

export function DataAsOfStamp({
  date,
  cadence = "monthly",
  source,
  className = "",
  compact = false,
  footnote,
}: DataAsOfStampProps) {
  const { dotColor, ageDays } = useMemo(() => {
    if (!date) return { dotColor: "bg-zinc-700", ageDays: null as number | null };
    try {
      const ref = new Date(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T12:00:00` : date);
      const now = new Date();
      const days = Math.max(0, Math.floor((now.getTime() - ref.getTime()) / 86_400_000));
      const threshold = STALE_DAYS[cadence];
      let color = "bg-emerald-400";
      if (days > threshold * 2) color = "bg-red-400";
      else if (days > threshold) color = "bg-amber-400";
      return { dotColor: color, ageDays: days };
    } catch {
      return { dotColor: "bg-zinc-700", ageDays: null };
    }
  }, [date, cadence]);

  if (!date) {
    return (
      <div
        className={`inline-flex flex-col gap-0.5 ${className}`}
        role="status"
        aria-label="Data de referência indisponível"
      >
        <div className="inline-flex items-center gap-1.5 text-[9px] font-mono text-zinc-600">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
          <span>Sem data de referência</span>
        </div>
        {footnote && (
          <p className="text-[9px] font-mono text-zinc-600 leading-snug max-w-[640px]">
            {footnote}
          </p>
        )}
      </div>
    );
  }

  const ageLabel =
    ageDays != null
      ? ageDays === 0
        ? "hoje"
        : ageDays === 1
          ? "há 1 dia"
          : ageDays < 30
            ? `há ${ageDays}d`
            : ageDays < 365
              ? `há ${Math.floor(ageDays / 30)}m`
              : `há ${Math.floor(ageDays / 365)}a`
      : null;

  return (
    <div
      className={`inline-flex flex-col gap-0.5 ${className}`}
      role="status"
      aria-label={`Dados atualizados em ${formatDate(date)}${source ? ` — fonte ${source}` : ""}${footnote ? `. ${footnote}` : ""}`}
    >
      <div className="inline-flex items-center gap-1.5 text-[9px] font-mono text-zinc-500">
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} aria-hidden />
        <span className="text-zinc-600 uppercase tracking-wider">Dados</span>
        <span className="text-zinc-400">{formatDate(date)}</span>
        {ageLabel && <span className="text-zinc-700">· {ageLabel}</span>}
        {!compact && (
          <span className="text-zinc-700">· {CADENCE_LABELS[cadence]}</span>
        )}
        {source && <span className="text-zinc-700 truncate max-w-[160px]">· {source}</span>}
      </div>
      {footnote && (
        <p className="text-[9px] font-mono text-zinc-600 leading-snug max-w-[640px]">
          {footnote}
        </p>
      )}
    </div>
  );
}

export default DataAsOfStamp;
