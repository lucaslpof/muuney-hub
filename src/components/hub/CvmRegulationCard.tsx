/**
 * CvmRegulationCard.tsx — V5-D6 (22/04/2026)
 *
 * Reusable inline card summarising a CVM resolution (e.g. RCVM 175 for FIDCs,
 * RCVM 160 for public offerings). Used across FidcLamina (175), FidcHub (175),
 * and OfertasRadar (160) to give AAIs a quick regulatory anchor without
 * leaving the page.
 *
 * V5-D6 scope:
 *   - Ships with two presets: "cvm-175" (FIDC structural) and "cvm-160" (public
 *     offerings post-Jan/2023).
 *   - Consumers can pass `preset="cvm-175"` for the happy-path or supply
 *     custom {number, title, highlights, sourceUrl} for ad-hoc variants.
 *   - Stays visually aligned with the Tech-Noir aesthetic (#111111 card,
 *     accent-tinted border, font-mono eyebrow).
 *
 * D7 will add inline placements in OfertasRadar + more presets if needed.
 */

import { BookOpen, ExternalLink } from "lucide-react";

export type CvmRegulationPreset = "cvm-175" | "cvm-160";

export interface CvmRegulationCardProps {
  /** Choose a preset OR provide custom fields below. Preset wins when both set. */
  preset?: CvmRegulationPreset;
  /** Resolution number — e.g. "175" or "160". Overridden by preset. */
  number?: string;
  /** Short title — e.g. "Estrutura RCVM 175 (FIDCs)". Overridden by preset. */
  title?: string;
  /** 2–4 bullet highlights to show under the title. Overridden by preset. */
  highlights?: string[];
  /** Official CVM URL for "ler na íntegra". Overridden by preset. */
  sourceUrl?: string;
  /** Accent color — defaults to FIDC orange for 175, oferta emerald for 160. */
  accent?: string;
  /** Compact mode trims vertical padding for use inside narrow columns. */
  compact?: boolean;
  /** Extra className for layout tweaks in caller context. */
  className?: string;
}

const PRESETS: Record<
  CvmRegulationPreset,
  Required<Pick<CvmRegulationCardProps, "number" | "title" | "highlights" | "sourceUrl" | "accent">>
> = {
  "cvm-175": {
    number: "175",
    title: "RCVM 175 — Fundos de Investimento",
    highlights: [
      "Consolida as regras aplicáveis a todos os fundos de investimento no Brasil (substitui ICVM 555, 356, 578 entre outras).",
      "Introduz estrutura de Fundo → Classe → Subclasse, com segregação patrimonial e responsabilidade limitada dos cotistas.",
      "Para FIDCs, formaliza requisitos de lastro, subordinação, PDD e regime informacional mensal + trimestral.",
    ],
    sourceUrl:
      "https://conteudo.cvm.gov.br/legislacao/resolucoes/resol175.html",
    accent: "#F97316",
  },
  "cvm-160": {
    number: "160",
    title: "RCVM 160 — Ofertas Públicas",
    highlights: [
      "Novo regime de ofertas públicas de valores mobiliários em vigor desde jan/2023 (substitui ICVM 400 e 476).",
      "Unifica ofertas em dois ritos: automática (com pré-registro) e ordinária (com análise). Extingue a distinção por esforços restritos.",
      "Amplia transparência com Anexo A e B padronizados, DFPs periódicas e divulgação de documentos no sistema CVMWeb.",
    ],
    sourceUrl:
      "https://conteudo.cvm.gov.br/legislacao/resolucoes/resol160.html",
    accent: "#10B981",
  },
};

export function CvmRegulationCard({
  preset,
  number: rawNumber,
  title: rawTitle,
  highlights: rawHighlights,
  sourceUrl: rawSourceUrl,
  accent: rawAccent,
  compact = false,
  className = "",
}: CvmRegulationCardProps) {
  const defaults = preset ? PRESETS[preset] : null;

  const number = defaults?.number ?? rawNumber ?? "";
  const title = defaults?.title ?? rawTitle ?? "Resolução CVM";
  const highlights = defaults?.highlights ?? rawHighlights ?? [];
  const sourceUrl = defaults?.sourceUrl ?? rawSourceUrl;
  const accent = rawAccent ?? defaults?.accent ?? "#F97316";

  const pad = compact ? "p-3" : "p-4";
  const gap = compact ? "space-y-2" : "space-y-3";

  return (
    <section
      className={`bg-[#111111] border rounded-lg ${pad} ${className}`}
      style={{ borderColor: `${accent}33` }}
      aria-label={`Resumo da Resolução CVM ${number}`}
    >
      <header className="flex items-center gap-2 mb-2">
        <BookOpen className="w-3.5 h-3.5" style={{ color: accent }} aria-hidden="true" />
        <span
          className="text-[9px] font-mono uppercase tracking-wider"
          style={{ color: accent }}
        >
          RCVM {number}
        </span>
        <span className="text-zinc-700 text-[9px]">·</span>
        <span className="text-[10px] font-mono text-zinc-500 truncate">
          Base regulatória
        </span>
      </header>

      <h4 className="text-[12px] font-semibold text-zinc-200 mb-2 leading-snug">
        {title}
      </h4>

      {highlights.length > 0 ? (
        <ul className={`${gap} text-[11px] leading-relaxed text-zinc-400 pl-4 list-disc marker:text-zinc-600`}>
          {highlights.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
      ) : null}

      {sourceUrl ? (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-3 text-[10px] font-mono uppercase tracking-wider no-underline hover:underline"
          style={{ color: accent }}
          aria-label={`Ler Resolução CVM ${number} na íntegra (abre em nova aba)`}
        >
          <ExternalLink className="w-3 h-3" aria-hidden="true" />
          <span>Ler na íntegra</span>
        </a>
      ) : null}
    </section>
  );
}

export default CvmRegulationCard;
