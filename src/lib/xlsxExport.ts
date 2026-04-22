/**
 * xlsxExport.ts — V5-D2 (22/04/2026)
 *
 * Write-only XLSX export helpers with pt-BR formatting.
 *
 * WRITE-ONLY USAGE: we never parse user-provided XLSX. SheetJS CVEs
 * (prototype pollution / ReDoS) are parse-time only, so our surface is
 * zero-risk. xlsx@0.18.5 (npm Community Edition).
 *
 * Decimal separator + currency locale: format codes use Excel's locale
 * swap ("," decimal + "." thousand render in pt-BR Excel; ".", "," in
 * en-US Excel). We force pt-BR patterns (dd/mm/yyyy, R$) so the file
 * is semantically Brazilian regardless of the user's Excel locale.
 *
 * Bundle: xlsx imported via dynamic import (lazy-load) to keep the main
 * bundle lean. The first export click triggers a one-time chunk fetch.
 */

export type XlsxCellValue = string | number | Date | null | undefined;

export type XlsxCellFormat =
  | "text"
  | "int"
  | "decimal"
  | "percent"
  | "percent_lit"
  | "currency"
  | "date";

export interface XlsxColumn {
  /** Header label (row 1). */
  header: string;
  /** Row object key used to fetch cell value. */
  key: string;
  /** Cell format — controls numfmt applied to all body cells in the column. */
  format?: XlsxCellFormat;
  /** Column width in characters (XLSX "wch"). Default 16. */
  width?: number;
}

export interface XlsxSheet {
  /** Sheet name — sanitised to 31 chars, without `: \ / ? * [ ]`. */
  name: string;
  /** Column definitions. */
  columns: XlsxColumn[];
  /** Row data keyed by column.key. Nullish values render as blank. */
  rows: Record<string, XlsxCellValue>[];
  /** Optional free-form "merged title" written above the header (row 0). */
  title?: string;
}

/**
 * Generate and download an XLSX workbook. Lazy-loads SheetJS.
 */
export async function exportWorkbook(filename: string, sheets: XlsxSheet[]): Promise<void> {
  if (!sheets.length) return;
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  for (const s of sheets) {
    const headerRow = s.columns.map((c) => c.header);
    const bodyRows = s.rows.map((row) =>
      s.columns.map((c) => row[c.key] ?? null)
    );

    // AOA: optionally prepend a title row before the header.
    const aoa: XlsxCellValue[][] = s.title
      ? [[s.title], headerRow, ...bodyRows]
      : [headerRow, ...bodyRows];

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Column widths.
    ws["!cols"] = s.columns.map((c) => ({ wch: c.width ?? 16 }));

    // Header offset: 0 if no title, 1 if title.
    const headerRowIdx = s.title ? 1 : 0;
    const firstBodyRow = headerRowIdx + 1;

    // Apply per-column numfmt to body cells.
    for (let ci = 0; ci < s.columns.length; ci++) {
      const col = s.columns[ci];
      if (!col.format || col.format === "text") continue;
      const z = formatCodeFor(col.format);
      for (let ri = firstBodyRow; ri < firstBodyRow + s.rows.length; ri++) {
        const addr = XLSX.utils.encode_cell({ r: ri, c: ci });
        const cell = ws[addr];
        if (cell && cell.v != null && cell.v !== "") {
          cell.z = z;
          // Ensure numeric types remain numeric; dates stay dates.
          if (col.format === "date" && cell.v instanceof Date) {
            cell.t = "d";
          } else if (col.format !== "date" && typeof cell.v === "number") {
            cell.t = "n";
          }
        }
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, safeSheetName(s.name));
  }

  XLSX.writeFile(wb, `${safeFilename(filename)}.xlsx`);
}

/** Build a consistent filename: muuney_<module>[_<section>][_<id>]_<YYYY-MM-DD> */
export function xlsxFilename(
  module: string,
  section?: string,
  identifier?: string
): string {
  const date = new Date().toISOString().slice(0, 10);
  const parts = ["muuney", module];
  if (section) parts.push(section);
  if (identifier) parts.push(identifier);
  parts.push(date);
  return safeFilename(parts.join("_"));
}

/* ─── Internals ─── */

function formatCodeFor(f: XlsxCellFormat): string {
  // Excel numfmt strings. Separators (, and .) are locale-swapped by Excel
  // when rendering. We keep OOXML-standard form; Excel pt-BR shows as
  // "1.234,56" / "R$ 1.234,56" / "22/04/2026".
  switch (f) {
    case "int":
      return "#,##0";
    case "decimal":
      return "#,##0.00";
    case "percent":
      // Excel treats value as a fraction (0.05 → 5.00%).
      return "0.00%";
    case "percent_lit":
      // For values already in % scale (e.g., 5.23 meaning 5.23%).
      return '#,##0.00"%"';
    case "currency":
      return '"R$" #,##0.00';
    case "date":
      return "dd/mm/yyyy";
    default:
      return "@";
  }
}

function safeSheetName(n: string): string {
  // Excel sheet name: max 31 chars, no : \ / ? * [ ]
  return n.replace(/[:\\/?*[\]]/g, "-").slice(0, 31) || "Sheet";
}

function safeFilename(n: string): string {
  return n.replace(/[^\w.-]+/g, "_");
}

/** Convert an ISO date string (YYYY-MM-DD or full) to Date, or null. */
export function toDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isFinite(d.getTime()) ? d : null;
}

/** Round a number to N decimals (returns null if nullish or not finite). */
export function rnd(v: number | null | undefined, digits = 2): number | null {
  if (v == null || !isFinite(v)) return null;
  const f = Math.pow(10, digits);
  return Math.round(v * f) / f;
}
