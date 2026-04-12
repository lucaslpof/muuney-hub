/**
 * CSV Export utility for Hub tables.
 * Generates and downloads a CSV file from structured data.
 */

export interface CsvColumn<T> {
  header: string;
  accessor: (row: T) => string | number | null | undefined;
}

/**
 * Export data to CSV and trigger browser download.
 */
export function exportCsv<T>(
  rows: T[],
  columns: CsvColumn<T>[],
  filename: string
): void {
  if (!rows.length) return;

  const sep = ";"; // pt-BR convention (Excel BR default)
  const BOM = "\uFEFF"; // UTF-8 BOM for Excel encoding

  const header = columns.map((c) => quote(c.header)).join(sep);

  const body = rows
    .map((row) =>
      columns
        .map((col) => {
          const val = col.accessor(row);
          if (val == null) return "";
          return quote(String(val));
        })
        .join(sep)
    )
    .join("\n");

  const csv = BOM + header + "\n" + body;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function quote(val: string): string {
  if (val.includes(";") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

/**
 * Reusable CSV export button component props helper.
 */
export function csvFilename(module: string, section?: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const parts = ["muuney", module];
  if (section) parts.push(section);
  parts.push(date);
  return parts.join("_");
}
