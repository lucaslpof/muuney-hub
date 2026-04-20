/**
 * URL query-parameter sanitization helpers.
 *
 * All helpers are pure and never throw. They defend deep-linked Hub pages
 * (?section, ?period, ?sort, ?order, filters, pagination) against malformed
 * or adversarial values by coercing back to a known-safe default.
 *
 * Rationale: `useSearchParams` accepts any string the URL contains — a user
 * (or a stale link, or a typo) can pass `?section=xyz` and break scroll-spy
 * or cast a type that does not actually exist. We keep the surface tiny so
 * call-sites stay readable:
 *
 *   const section = pickFromList(raw, SECTION_IDS, "overview");
 *   const page    = toInt(raw, { min: 0, max: 9999, fallback: 0 });
 *   const order   = toSortOrder(raw); // "asc" | "desc"
 */

/**
 * Return `value` if it is a member of `allowed`, otherwise `fallback`.
 * Works for any string union / literal-list, including readonly tuples.
 */
export function pickFromList<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  if (!value) return fallback;
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/**
 * Coerce query-string number (possibly invalid) to a bounded integer.
 * Returns `fallback` for null/empty/NaN/Infinity, clamps to [min, max].
 */
export function toInt(
  value: string | null | undefined,
  opts: { min?: number; max?: number; fallback: number },
): number {
  if (value == null || value === "") return opts.fallback;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return opts.fallback;
  const min = opts.min ?? Number.NEGATIVE_INFINITY;
  const max = opts.max ?? Number.POSITIVE_INFINITY;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

/**
 * Coerce query-string number to a bounded float (accepts decimals).
 * Returns `fallback` for null/empty/NaN/Infinity, clamps to [min, max].
 */
export function toNum(
  value: string | null | undefined,
  opts: { min?: number; max?: number; fallback: number },
): number {
  if (value == null || value === "") return opts.fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return opts.fallback;
  const min = opts.min ?? Number.NEGATIVE_INFINITY;
  const max = opts.max ?? Number.POSITIVE_INFINITY;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

/** Canonicalize an `asc`/`desc` value; anything else → "desc". */
export function toSortOrder(value: string | null | undefined, fallback: "asc" | "desc" = "desc"): "asc" | "desc" {
  if (value === "asc" || value === "desc") return value;
  return fallback;
}

/**
 * Sanitize a non-empty string (trims + caps length) or returns fallback.
 * Useful for free-text search params where you want to neutralize
 * pathological long inputs (e.g. `?q=` with 10 KB of junk).
 */
export function toSearchQuery(value: string | null | undefined, maxLen = 100): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.slice(0, maxLen);
}

/**
 * Parse a comma-separated list, keep only members of `allowed`, cap count.
 * Empty / malformed values → empty array.
 */
export function pickListFromCsv<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
  opts: { max?: number } = {},
): T[] {
  if (!value) return [];
  const allowedSet = new Set<string>(allowed);
  const seen = new Set<string>();
  const out: T[] = [];
  const max = opts.max ?? 20;
  for (const raw of value.split(",")) {
    const token = raw.trim();
    if (!token || seen.has(token)) continue;
    if (!allowedSet.has(token)) continue;
    seen.add(token);
    out.push(token as T);
    if (out.length >= max) break;
  }
  return out;
}

/** Nullable pickFromList — returns null when value is missing or invalid. */
export function pickFromListOrNull<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
): T | null {
  if (!value) return null;
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}
