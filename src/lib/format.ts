/**
 * Centralized pt-BR number formatting for the entire Hub.
 *
 * Rules:
 *   • Thousands separator: "." (ponto)
 *   • Decimal separator: "," (vírgula)
 *   • Currency prefix: "R$" with non-breaking space
 *   • Large numbers: suffix B / M / k with scale indicator
 *   • Percentages: always show sign (+/−) except zero
 */

// ────────────────────────────────────────────────────────
//  Core helpers
// ────────────────────────────────────────────────────────

const ptBR = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const ptBR0 = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const ptBR1 = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const ptBR2 = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format a number in pt-BR locale with a given number of decimal places. */
export function fmtNum(value: number, decimals = 2): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

// ────────────────────────────────────────────────────────
//  Money / PL  (R$ with scale suffix)
// ────────────────────────────────────────────────────────

/**
 * Format a monetary value with automatic scale suffix.
 *
 * Examples:
 *   formatBRL(249_794_170_000_000)  → "R$ 249,79T"
 *   formatBRL(1_500_000_000)        → "R$ 1,50B"
 *   formatBRL(32_450_000)           → "R$ 32,5M"
 *   formatBRL(8_500)                → "R$ 8.500"
 *   formatBRL(null)                 → "—"
 */
export function formatBRL(value: number | null | undefined): string {
  if (value == null || isNaN(Number(value))) return "—";
  const n = Number(value);
  if (Math.abs(n) >= 1e12) return `R$ ${ptBR2.format(n / 1e12)}T`;
  if (Math.abs(n) >= 1e9) return `R$ ${ptBR2.format(n / 1e9)}B`;
  if (Math.abs(n) >= 1e6) return `R$ ${ptBR1.format(n / 1e6)}M`;
  if (Math.abs(n) >= 1e3) return `R$ ${ptBR0.format(n)}`;
  return `R$ ${ptBR.format(n)}`;
}

/**
 * Compact monetary formatting for chart tooltips (no "R$" prefix).
 *
 * Examples:
 *   formatBRLCompact(1_500_000_000)  → "1,50B"
 *   formatBRLCompact(32_450_000)     → "32,5M"
 */
export function formatBRLCompact(value: number | null | undefined): string {
  if (value == null || isNaN(Number(value))) return "—";
  const n = Number(value);
  if (Math.abs(n) >= 1e12) return `${ptBR2.format(n / 1e12)}T`;
  if (Math.abs(n) >= 1e9) return `${ptBR2.format(n / 1e9)}B`;
  if (Math.abs(n) >= 1e6) return `${ptBR1.format(n / 1e6)}M`;
  if (Math.abs(n) >= 1e3) return `${ptBR0.format(n / 1e3)}k`;
  return ptBR.format(n);
}

// ────────────────────────────────────────────────────────
//  Percentages
// ────────────────────────────────────────────────────────

/**
 * Format a percentage with pt-BR decimal separator.
 *
 * Examples:
 *   formatPct(12.345)    → "+12,35%"
 *   formatPct(-3.2, 1)   → "−3,2%"
 *   formatPct(0)          → "0,00%"
 *   formatPct(null)       → "—"
 */
export function formatPct(
  value: number | null | undefined,
  decimals = 2,
): string {
  if (value == null || isNaN(Number(value))) return "—";
  const n = Number(value);
  const formatted = fmtNum(Math.abs(n), decimals);
  if (n > 0) return `+${formatted}%`;
  if (n < 0) return `−${formatted}%`;
  return `${formatted}%`;
}

/**
 * Format a percentage without sign prefix.
 *
 * Examples:
 *   formatPctUnsigned(12.345)  → "12,35%"
 *   formatPctUnsigned(null)    → "—"
 */
export function formatPctUnsigned(
  value: number | null | undefined,
  decimals = 2,
): string {
  if (value == null || isNaN(Number(value))) return "—";
  return `${fmtNum(Number(value), decimals)}%`;
}

// ────────────────────────────────────────────────────────
//  Counts / integers
// ────────────────────────────────────────────────────────

/**
 * Format an integer count with pt-BR thousands separator.
 *
 * Examples:
 *   formatCount(31667)  → "31.667"
 *   formatCount(8)      → "8"
 */
export function formatCount(value: number | null | undefined): string {
  if (value == null || isNaN(Number(value))) return "—";
  return ptBR0.format(Number(value));
}

// ────────────────────────────────────────────────────────
//  CNPJ
// ────────────────────────────────────────────────────────

/** Format a 14-digit CNPJ string. */
export function formatCnpj(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length !== 14) return raw;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Truncate CNPJ to first 8 digits: XX.XXX.XXX */
export function formatCnpjShort(raw: string): string {
  return raw.replace(/^(\d{2})\.(\d{3})\.(\d{3}).*/, "$1.$2.$3");
}

// ────────────────────────────────────────────────────────
//  Chart-specific helpers
// ────────────────────────────────────────────────────────

/**
 * Smart format for chart Y-axis ticks — adaptive precision based on range.
 * Uses pt-BR formatting with scale suffixes.
 */
export function smartFormatAxis(v: number, range: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e12) {
    const d = range / 1e12 < 5 ? 1 : 0;
    return `${fmtNum(v / 1e12, d)}T`;
  }
  if (abs >= 1e9) {
    const d = range / 1e9 < 5 ? 1 : 0;
    return `${fmtNum(v / 1e9, d)}B`;
  }
  if (abs >= 1e6) {
    const d = range / 1e6 < 5 ? 1 : 0;
    return `${fmtNum(v / 1e6, d)}M`;
  }
  if (abs >= 1e3) {
    const d = range / 1e3 < 5 ? 1 : 0;
    return `${fmtNum(v / 1e3, d)}k`;
  }
  if (range < 1) return fmtNum(v, 3);
  if (range < 10) return fmtNum(v, 2);
  if (range < 100) return fmtNum(v, 1);
  return fmtNum(v, 0);
}

// ────────────────────────────────────────────────────────
//  Dates
// ────────────────────────────────────────────────────────

/** Format an ISO date string to dd/mm/yyyy. */
export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  try {
    return new Date(isoDate).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return isoDate;
  }
}

const MONTH_ABBR = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

/** Format "YYYY-MM" to "Mar/26" style. */
export function formatMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  return `${MONTH_ABBR[Number(month) - 1] ?? month}/${year?.slice(2) ?? ""}`;
}
