/**
 * ExportPdfButton.tsx — P1-1 (19/04/2026)
 *
 * Single button that triggers the browser's native print-to-PDF flow.
 * No bundle cost (no jsPDF / html2canvas): relies on `window.print()` +
 * the @media print rules defined in src/index.css. The CSS:
 *   - hides elements tagged `.no-print` (sidebar, top bar, feedback widget)
 *   - reveals `.print-only` elements (PrintFooter)
 *   - flips the Tech-Noir dark theme to a light, ink-friendly palette
 *   - avoids ugly page cuts inside charts/cards
 *
 * Use inside lâmina headers. The button itself carries `no-print` so it
 * never appears in the generated PDF. Accepts an optional `title` (defaults
 * to the browser document.title) which is restored after printing — lets
 * the filename suggested by browsers match the fund's name.
 */

import { Printer } from "lucide-react";
import { useCallback } from "react";

interface Props {
  /** Filename title used in the browser Print dialog (restored after print). */
  title?: string;
  /** Accent color (hex). Defaults to Tech-Noir green. */
  accent?: string;
  className?: string;
}

export function ExportPdfButton({ title, accent = "#0B6C3E", className = "" }: Props) {
  const handlePrint = useCallback(() => {
    // Swap document title so the browser's "Save as PDF" suggests a useful
    // filename. We restore it right after the print dialog resolves.
    const previous = document.title;
    if (title) {
      document.title = `${title} — lâmina muuney.hub`;
    }
    try {
      window.print();
    } finally {
      // Restore on next tick (Chrome keeps print dialog modal until user
      // confirms/cancels; restoring immediately is still safe because the
      // print job already has a snapshot of the title).
      setTimeout(() => {
        document.title = previous;
      }, 250);
    }
  }, [title]);

  return (
    <button
      type="button"
      onClick={handlePrint}
      className={`no-print inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-mono uppercase tracking-wider transition-colors ${className}`}
      style={{
        borderColor: `${accent}55`,
        color: accent,
        backgroundColor: `${accent}12`,
      }}
      aria-label="Exportar lâmina em PDF"
      title="Exportar lâmina em PDF (Ctrl+P)"
    >
      <Printer className="w-3 h-3" aria-hidden="true" />
      <span>Exportar PDF</span>
    </button>
  );
}
