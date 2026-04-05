/**
 * RCVM 175 — Resolução CVM 175 Badge System
 * Muuney.hub Módulo Fundos V3
 *
 * Provides color-coded badges for RCVM 175 fund classification hierarchy:
 * Classe → Subclasse → Público Alvo → Tributação
 */
import React from "react";

/* ─── Color definitions per RCVM 175 class ─── */
export const RCVM175_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  "Renda Fixa":   { bg: "#3B82F615", text: "#3B82F6", label: "RF" },
  "Ações":        { bg: "#22C55E15", text: "#22C55E", label: "AÇÕES" },
  "Multimercado": { bg: "#8B5CF615", text: "#8B5CF6", label: "MULTI" },
  "Cambial":      { bg: "#F59E0B15", text: "#F59E0B", label: "CÂMBIO" },
  // Structured fund types (detected from tp_fundo or classe)
  "FII":  { bg: "#EC489915", text: "#EC4899", label: "FII" },
  "FIDC": { bg: "#F9731615", text: "#F97316", label: "FIDC" },
  "FIP":  { bg: "#06B6D415", text: "#06B6D4", label: "FIP" },
  // Legacy CVM class names (fallback)
  "Fundo de Ações":          { bg: "#22C55E15", text: "#22C55E", label: "AÇÕES" },
  "Fundo de Renda Fixa":     { bg: "#3B82F615", text: "#3B82F6", label: "RF" },
  "Fundo Multimercado":      { bg: "#8B5CF615", text: "#8B5CF6", label: "MULTI" },
  "Fundo Cambial":           { bg: "#F59E0B15", text: "#F59E0B", label: "CÂMBIO" },
  "FMP-FGTS":                { bg: "#71717a15", text: "#71717a", label: "FMP" },
};

/* ─── Default color for unknown classes ─── */
const DEFAULT_COLOR = { bg: "#71717a15", text: "#71717a", label: "?" };

/**
 * Get color config for a RCVM 175 class.
 * Checks both classe_rcvm175 and tp_fundo for structured funds.
 */
export function getClasseConfig(classe: string | null | undefined): { bg: string; text: string; label: string } | null {
  if (!classe) return null;
  const trimmed = classe.trim();

  // Direct match
  if (RCVM175_COLORS[trimmed]) return RCVM175_COLORS[trimmed];

  // Case-insensitive partial match for structured funds
  const upper = trimmed.toUpperCase();
  if (upper.includes("FIDC") || upper.includes("DIREITOS CREDIT")) return RCVM175_COLORS["FIDC"];
  if (upper.includes("FII") || upper.includes("IMOBILI")) return RCVM175_COLORS["FII"];
  if (upper.includes("FIP") || upper.includes("PARTICIPA")) return RCVM175_COLORS["FIP"];
  if (upper.includes("RENDA FIXA") || upper === "RF") return RCVM175_COLORS["Renda Fixa"];
  if (upper.includes("AÇÕES") || upper.includes("ACOES")) return RCVM175_COLORS["Ações"];
  if (upper.includes("MULTIMERCADO") || upper.includes("MULTI")) return RCVM175_COLORS["Multimercado"];
  if (upper.includes("CAMBIAL")) return RCVM175_COLORS["Cambial"];

  return DEFAULT_COLOR;
}

/* ─── Size presets ─── */
const SIZE_CLASSES = {
  sm: "text-[7px] px-1 py-0.5",
  md: "text-[9px] px-1.5 py-0.5",
} as const;

/**
 * ClasseBadge — Renders a small colored badge for the RCVM 175 class.
 * Returns null if classe is null/undefined.
 */
export function ClasseBadge({ classe, size = "sm" }: { classe: string | null | undefined; size?: "sm" | "md" }) {
  const config = getClasseConfig(classe);
  if (!config) return null;

  return React.createElement("span", {
    className: `${SIZE_CLASSES[size]} font-bold font-mono rounded inline-flex items-center`,
    style: { backgroundColor: config.bg, color: config.text },
  }, config.label);
}

/**
 * HierarquiaBadges — Renders the full RCVM 175 hierarchy.
 * [RF] Crédito Livre · Geral · LP
 */
export function HierarquiaBadges({
  classe_rcvm175,
  subclasse_rcvm175,
  publico_alvo,
  tributacao,
  size = "sm",
}: {
  classe_rcvm175: string | null | undefined;
  subclasse_rcvm175?: string | null;
  publico_alvo?: string | null;
  tributacao?: string | null;
  size?: "sm" | "md";
}) {
  const textSize = size === "sm" ? "text-[8px]" : "text-[10px]";
  const parts: React.ReactNode[] = [];

  // Class badge
  if (classe_rcvm175) {
    parts.push(React.createElement(ClasseBadge, { key: "classe", classe: classe_rcvm175, size }));
  }

  // Subclasse text
  if (subclasse_rcvm175) {
    parts.push(
      React.createElement("span", {
        key: "sub",
        className: `${textSize} text-zinc-400 font-mono`,
      }, subclasse_rcvm175)
    );
  }

  // Público alvo
  if (publico_alvo) {
    parts.push(
      React.createElement("span", {
        key: "pub",
        className: `${textSize} text-zinc-600 font-mono`,
      }, publico_alvo)
    );
  }

  // Tributação (LP = Longo Prazo, CP = Curto Prazo)
  if (tributacao) {
    const trib = tributacao.toLowerCase().includes("longo") ? "LP" :
                 tributacao.toLowerCase().includes("curto") ? "CP" : tributacao;
    parts.push(
      React.createElement("span", {
        key: "trib",
        className: `${textSize} text-zinc-700 font-mono`,
      }, trib)
    );
  }

  if (parts.length === 0) return null;

  // Join with dot separators
  const elements: React.ReactNode[] = [];
  parts.forEach((part, i) => {
    elements.push(part);
    if (i < parts.length - 1) {
      elements.push(
        React.createElement("span", {
          key: `sep-${i}`,
          className: `${textSize} text-zinc-800`,
        }, " · ")
      );
    }
  });

  return React.createElement("div", {
    className: "flex items-center gap-0 flex-wrap",
  }, ...elements);
}

/**
 * RcvmAdaptadoBadge — Small "✓ RCVM 175" trust signal badge.
 * Only shows when the fund has cnpj_fundo_classe filled.
 */
export function RcvmAdaptadoBadge({ hasCnpjClasse }: { hasCnpjClasse: boolean }) {
  if (!hasCnpjClasse) return null;

  return React.createElement("span", {
    className: "inline-flex items-center gap-0.5 text-[7px] font-mono px-1 py-0.5 rounded bg-[#0B6C3E]/10 text-[#0B6C3E] border border-[#0B6C3E]/20",
  },
    React.createElement("span", null, "✓"),
    " RCVM 175"
  );
}

/**
 * ModoAssessorToggle — Toggle switch between "Investidor" and "Assessor" views.
 */
export function ModoAssessorToggle({
  isAssessor,
  onToggle,
}: {
  isAssessor: boolean;
  onToggle: () => void;
}) {
  return React.createElement("button", {
    onClick: onToggle,
    className: `flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono transition-all border ${
      isAssessor
        ? "bg-[#06B6D4]/10 text-[#06B6D4] border-[#06B6D4]/30"
        : "bg-[#0B6C3E]/10 text-[#0B6C3E] border-[#0B6C3E]/30"
    }`,
  },
    // Toggle dot
    React.createElement("div", {
      className: `w-5 h-2.5 rounded-full relative transition-all ${
        isAssessor ? "bg-[#06B6D4]/30" : "bg-[#0B6C3E]/30"
      }`,
    },
      React.createElement("div", {
        className: `absolute top-0.5 w-1.5 h-1.5 rounded-full transition-all ${
          isAssessor ? "right-0.5 bg-[#06B6D4]" : "left-0.5 bg-[#0B6C3E]"
        }`,
      })
    ),
    React.createElement("span", null, isAssessor ? "Assessor" : "Investidor")
  );
}
