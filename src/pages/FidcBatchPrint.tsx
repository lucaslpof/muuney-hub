/**
 * FidcBatchPrint.tsx — V5-D5 (22/04/2026)
 *
 * Standalone page (outside HubLayout) that renders N FidcBatchCard instances
 * in sequence — one per FIDC slug passed via `?slugs=slug1,slug2,...`. Each
 * card is separated by a `.print-page-break` divider so the generated PDF
 * starts a new page per FIDC.
 *
 * URL: `/fundos/fidc/batch-print?slugs=slug1,slug2,slug3[&autoprint=1]`
 *
 * V5-D5 upgrades:
 *   - onReady callback from FidcBatchCard → readyMap tracking completion per slug
 *   - Progress indicator in toolbar (aria-live polite) shows "X / N prontas"
 *   - Print button disabled until all cards ready (prevents half-rendered PDFs)
 *   - Opt-in auto-print via `?autoprint=1` — fires window.print() 600ms after
 *     all cards settle, so deep-link from FidcHub "Imprimir (N)" is one-click.
 *   - autoprintFiredRef guarantees the auto-fire runs exactly once per mount.
 *
 * Why standalone (not inside HubLayout): no sidebar/top-bar chrome to strip,
 * cleaner print, faster render (fewer nested contexts). The `.no-print` tags
 * on the toolbar keep the page controls out of the printed PDF.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Printer, ArrowLeft, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { FidcBatchCard, type FidcBatchCardOutcome } from "@/components/hub/FidcBatchCard";
import { PrintFooter } from "@/components/hub/PrintFooter";
import { HubSEO } from "@/lib/seo";

const MAX_SLUGS = 10;
const FIDC_ACCENT = "#F97316";
/** Delay after all cards report ready before auto-printing — lets Recharts
 *  finalize SVG layout inside the print media query before the print dialog
 *  captures the viewport. */
const AUTO_PRINT_SETTLE_MS = 600;

function parseSlugs(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, MAX_SLUGS);
}

export default function FidcBatchPrint() {
  const [searchParams] = useSearchParams();
  const slugs = useMemo(() => parseSlugs(searchParams.get("slugs")), [searchParams]);
  const autoprint = searchParams.get("autoprint") === "1";

  // Map<slug, outcome> — populated as each FidcBatchCard reports ready.
  const [readyMap, setReadyMap] = useState<Record<string, FidcBatchCardOutcome>>({});
  const autoprintFiredRef = useRef(false);

  const handleReady = useCallback((slug: string, outcome: FidcBatchCardOutcome) => {
    setReadyMap((prev) => {
      if (prev[slug]) return prev; // already reported — fire-once per slug
      return { ...prev, [slug]: outcome };
    });
  }, []);

  const readyCount = useMemo(
    () => slugs.filter((s) => readyMap[s] !== undefined).length,
    [slugs, readyMap],
  );
  const allReady = slugs.length > 0 && readyCount === slugs.length;

  const handlePrint = useCallback(() => {
    const previous = document.title;
    document.title = `muuney.hub — Lâminas FIDC (${slugs.length} fundos)`;
    try {
      window.print();
    } finally {
      setTimeout(() => {
        document.title = previous;
      }, 250);
    }
  }, [slugs.length]);

  // Auto-print — opt-in via `?autoprint=1`. Fires exactly once per mount
  // after all cards settle + a short delay for print-media SVG layout.
  useEffect(() => {
    if (!autoprint) return;
    if (!allReady) return;
    if (autoprintFiredRef.current) return;
    autoprintFiredRef.current = true;
    const id = window.setTimeout(() => {
      handlePrint();
    }, AUTO_PRINT_SETTLE_MS);
    return () => window.clearTimeout(id);
  }, [autoprint, allReady, handlePrint]);

  const generatedAt = new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (slugs.length === 0) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 flex items-center justify-center p-6">
        <HubSEO
          title="Lâminas FIDC em lote"
          description="Impressão em lote de lâminas FIDC do muuney.hub"
          path="/fundos/fidc/batch-print"
          isProtected
        />
        <div className="max-w-md border border-red-500/30 bg-red-500/5 rounded-lg p-6 space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <h1 className="text-sm font-semibold text-red-300">Nenhum FIDC selecionado</h1>
          </div>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            Este link de impressão em lote espera um parâmetro{" "}
            <code className="bg-zinc-900 px-1 py-0.5 rounded text-zinc-300">?slugs=</code>{" "}
            com slugs separados por vírgula. Volte ao módulo FIDC, selecione até{" "}
            {MAX_SLUGS} fundos na aba Explorar e clique em "Imprimir Selecionados".
          </p>
          <Link
            to="/fundos/fidc?section=explorar"
            className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-[#F97316] hover:text-[#fb923c] no-underline"
          >
            <ArrowLeft className="w-3 h-3" />
            Voltar ao FIDC Hub
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
      <HubSEO
        title={`Lâminas FIDC em lote (${slugs.length})`}
        description="Impressão em lote de lâminas FIDC do muuney.hub"
        path="/fundos/fidc/batch-print"
        isProtected
      />

      {/* Toolbar — hidden in the printed output */}
      <div className="no-print sticky top-0 z-10 bg-[#0a0a0a] border-b border-[#1a1a1a]">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/fundos/fidc?section=explorar"
              className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
              Voltar
            </Link>
            <span className="text-zinc-700">·</span>
            <div className="text-[10px] font-mono text-zinc-400 truncate">
              <span className="text-zinc-300 font-semibold">{slugs.length}</span> lâmina
              {slugs.length === 1 ? "" : "s"} FIDC · gerado em {generatedAt}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Progress indicator — aria-live polite announces ready count */}
            <div
              className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {allReady ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                  <span className="text-emerald-400">
                    {readyCount} / {slugs.length} prontas
                  </span>
                </>
              ) : (
                <>
                  <Loader2 className="w-3 h-3 text-zinc-400 animate-spin" aria-hidden="true" />
                  <span className="text-zinc-400">
                    {readyCount} / {slugs.length} prontas
                  </span>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={handlePrint}
              disabled={!allReady}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-[10px] font-mono uppercase tracking-wider transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                borderColor: `${FIDC_ACCENT}55`,
                color: FIDC_ACCENT,
                backgroundColor: `${FIDC_ACCENT}12`,
              }}
              aria-label="Imprimir lâminas em lote"
              title={
                allReady
                  ? "Imprimir / Salvar como PDF (Ctrl+P)"
                  : "Aguarde todas as lâminas carregarem antes de imprimir"
              }
            >
              <Printer className="w-3 h-3" aria-hidden="true" />
              <span>Imprimir PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cover banner — only visible on screen (not in print) */}
      <div className="no-print max-w-5xl mx-auto px-6 py-4 border-b border-[#1a1a1a]">
        <h1 className="text-sm font-semibold text-zinc-200">
          Lâminas FIDC selecionadas
        </h1>
        <p className="text-[10px] text-zinc-500 font-mono mt-1">
          Cada lâmina começa numa nova página ao imprimir. Revise o conteúdo abaixo
          antes de salvar em PDF.
        </p>
        {autoprint ? (
          <p className="text-[10px] text-[#F97316]/80 font-mono mt-1">
            {allReady
              ? "Abrindo diálogo de impressão automaticamente…"
              : `Aguardando ${slugs.length - readyCount} lâmina${
                  slugs.length - readyCount === 1 ? "" : "s"
                } carregar para abrir impressão automática.`}
          </p>
        ) : null}
      </div>

      {/* Batch content — one card per slug, with page-break dividers */}
      <main className="max-w-5xl mx-auto px-6 py-6 space-y-8">
        {slugs.map((slug, i) => (
          <div key={slug}>
            {i > 0 ? <div className="print-page-break" aria-hidden="true" /> : null}
            <FidcBatchCard
              slug={slug}
              index={i}
              total={slugs.length}
              onReady={handleReady}
            />
          </div>
        ))}
      </main>

      {/* Print-only footer (appears on every page via @media print CSS) */}
      <PrintFooter
        fundName={`Lâminas FIDC em lote — ${slugs.length} fundos`}
        source="CVM Informe Mensal FIDC · RCVM 175"
      />
    </div>
  );
}
