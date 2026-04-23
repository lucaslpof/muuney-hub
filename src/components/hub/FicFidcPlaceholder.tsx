/**
 * FicFidcPlaceholder.tsx — V5-D6 (22/04/2026)
 *
 * Transparency placeholder for FIC-FIDCs (Fundos de Investimento em Cotas de
 * FIDCs). Path A (real composition via Tab_IX + CDA CNPJ_FUNDO_COTA) is
 * deferred to a post-beta sprint because:
 *   1. CVM Informe Trimestral FIDC Tab_IX isn't ingested yet.
 *   2. The current CDA parser doesn't capture CNPJ_FUNDO_COTA — fix required
 *      in ingest-cvm-data before Path A is viable.
 *
 * Path B (this component) — ships for beta 30/04:
 *   - Badge "FIC-FIDC" rendered near ClasseBadge in FidcLamina header.
 *   - Card section inside the lâmina with an honest placeholder message
 *     explaining what's missing and when it's coming.
 *
 * Detection heuristic (validated via SQL 22/04/2026):
 *   - denom_social pattern matching `/\bFIC[\s-]*FIDC\b/i` → 57/4319 FIDCs.
 *   - subclasse_rcvm175 column is 100% NULL for FIDCs — cannot be used.
 *
 * Exports:
 *   - isFicFidc(denom?) — boolean helper for conditional rendering.
 *   - <FicFidcPlaceholder/> — standalone section card (drop into FidcLamina).
 */

import { Info, FileSearch } from "lucide-react";

/**
 * Detect whether a FIDC is a FIC-FIDC based on its denomination.
 * Accepts null/undefined for convenience — returns false when input is falsy.
 *
 * Matches:
 *   - "FIC FIDC"
 *   - "FIC-FIDC"
 *   - "FIC  FIDC" (multiple spaces)
 *   - "fic fidc" (case-insensitive)
 *
 * Does NOT match:
 *   - "FIDC" alone
 *   - "FICTÍCIO FIDC" (word-boundary guarded)
 */
export function isFicFidc(denom?: string | null): boolean {
  if (!denom) return false;
  return /\bFIC[\s-]*FIDC\b/i.test(denom);
}

export interface FicFidcPlaceholderProps {
  /** Denomination of the fund — used for the "Fundo investido:" hint line. */
  fundName?: string;
  /** Accent color for the icon + border — defaults to FIDC orange. */
  accent?: string;
}

export function FicFidcPlaceholder({
  fundName,
  accent = "#F97316",
}: FicFidcPlaceholderProps) {
  return (
    <section
      className="bg-[#111111] border rounded-lg p-5"
      style={{ borderColor: `${accent}33` }}
      aria-labelledby="fic-fidc-placeholder-heading"
    >
      <header className="flex items-center gap-2 mb-3">
        <FileSearch className="w-4 h-4" style={{ color: accent }} aria-hidden="true" />
        <h3
          id="fic-fidc-placeholder-heading"
          className="text-sm font-semibold text-zinc-200"
        >
          Carteira Investida (FIDCs)
        </h3>
        <span
          className="ml-auto text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border"
          style={{
            borderColor: `${accent}55`,
            color: accent,
            backgroundColor: `${accent}12`,
          }}
        >
          Em desenvolvimento
        </span>
      </header>

      <div className="space-y-3 text-[11px] leading-relaxed text-zinc-400">
        <p>
          Este é um <span className="text-zinc-200 font-semibold">FIC-FIDC</span>{" "}
          (Fundo de Investimento em Cotas de FIDCs). A carteira detalhada dos
          FIDCs investidos — com CNPJ, denominação, % do PL e lastro de cada
          FIDC subjacente — ainda não está disponível nesta lâmina.
        </p>

        <p>
          <span className="text-zinc-300">Por quê?</span> A transparência
          completa depende de duas ingestões que estão na fila pós-beta:
        </p>

        <ul className="pl-4 space-y-1 list-disc marker:text-zinc-600">
          <li>
            <span className="text-zinc-300">CVM Informe Trimestral FIDC Tab_IX</span>{" "}
            — detalha a composição do portfólio investido quando o fundo aplica
            em cotas de outros FIDCs.
          </li>
          <li>
            <span className="text-zinc-300">Parser CDA · CNPJ_FUNDO_COTA</span>{" "}
            — atualmente não captura o CNPJ do fundo subjacente na composição
            da carteira, o que impede o cruzamento com o catálogo de FIDCs.
          </li>
        </ul>

        <p>
          <span className="text-zinc-300">Previsão:</span> sprint pós-beta
          (maio/26). Enquanto isso, consulte o{" "}
          <span className="text-zinc-300">regulamento do fundo</span> e o{" "}
          <span className="text-zinc-300">informe trimestral</span> publicados
          pela CVM para obter a composição agregada.
        </p>

        {fundName ? (
          <div className="pt-3 mt-2 border-t border-[#1a1a1a] flex items-start gap-2 text-[10px] font-mono">
            <Info className="w-3 h-3 mt-0.5 text-zinc-600 flex-shrink-0" aria-hidden="true" />
            <div className="text-zinc-600">
              Fundo: <span className="text-zinc-400">{fundName}</span>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default FicFidcPlaceholder;
