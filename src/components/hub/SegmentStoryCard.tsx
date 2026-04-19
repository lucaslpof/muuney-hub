/**
 * SegmentStoryCard.tsx — Per-segment storytelling for FidcHub/FiiHub (P1-7)
 *
 * Replaces the bare count+PL card with a richer narrative view:
 *   • Header (segment label + colored dot + class badge)
 *   • Primary KPIs (count, PL, avg metric contextual to class)
 *   • Top 3 performers (name + metric, linked to lâmina)
 *   • Narrative line (threshold-based interpretation)
 *   • Drill-down: whole card navigates to Explorar filtered by this segment
 *
 * Two variants:
 *   - variant="fidc" — uses useFidcV4Rankings by lastro, shows avg_inadim
 *   - variant="fii"  — uses useFiiV4Rankings by segmento, shows avg_dy
 *
 * Kept lightweight: fetches only top 3 for a given filter. With ≤10 segments
 * per page that's <10 small paginated queries (limit=3), which React Query
 * caches at STALE_FREQUENT so later navigation is instant.
 */

import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, TrendingUp } from "lucide-react";
import {
  useFidcV4Rankings,
  useFiiV4Rankings,
  formatPL,
  type FidcV4RankingItem,
  type FiiV4RankingItem,
} from "@/hooks/useHubFundos";

type Variant = "fidc" | "fii";

interface CommonProps {
  variant: Variant;
  /** Segment key (lastro for FIDC, segmento for FII). */
  segmentKey: string;
  count: number;
  pl: number;
  /** Dot / accent color picked by the parent. */
  color: string;
  /** Accent hex for CTAs. */
  accent: string;
  /** Contextual average (avg_inadim for FIDC, avg_dy for FII). May be null. */
  avgMetric: number | null;
  onDrillDown: () => void;
  /** Optional stagger delay (ms). */
  delayMs?: number;
}

function fmtPct(v: number | null, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(digits)}%`;
}

function truncate(name: string, max = 38): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

/* ─── FIDC narrative (by lastro, signal = avg_inadim) ─── */
function narrativeFidc(avgInadim: number | null, count: number): { tone: "warn" | "neutral" | "positive"; text: string } {
  if (avgInadim == null) {
    return {
      tone: "neutral",
      text: `${count} FIDCs nessa classe de lastro. Inadimplência média indisponível — CVM não reporta consistentemente para todos os fundos.`,
    };
  }
  if (avgInadim >= 8) {
    return {
      tone: "warn",
      text: `Inadimplência média elevada (${fmtPct(avgInadim)}). Classe em stress — exige verificar subordinação e safra da carteira antes de recomendar.`,
    };
  }
  if (avgInadim >= 4) {
    return {
      tone: "neutral",
      text: `Inadimplência média em patamar intermediário (${fmtPct(avgInadim)}). Dispersão alta dentro da classe — comparar fundo-a-fundo é essencial.`,
    };
  }
  return {
    tone: "positive",
    text: `Inadimplência média contida (${fmtPct(avgInadim)}). Classe de lastro relativamente saudável no momento.`,
  };
}

/* ─── FII narrative (by segmento, signal = avg_dy) ─── */
function narrativeFii(avgDy: number | null, count: number): { tone: "warn" | "neutral" | "positive"; text: string } {
  if (avgDy == null) {
    return {
      tone: "neutral",
      text: `${count} FIIs no segmento. DY médio indisponível neste informe CVM.`,
    };
  }
  // Rule of thumb: DY mensal < 0.5% ≈ sub-CDI, ≥ 1.0% ≈ competitivo
  if (avgDy >= 1.0) {
    return {
      tone: "positive",
      text: `DY médio mensal de ${fmtPct(avgDy)} — segmento distribuindo acima da média. Checar sustentabilidade via vacância e inadimplência locatícia.`,
    };
  }
  if (avgDy >= 0.5) {
    return {
      tone: "neutral",
      text: `DY médio mensal de ${fmtPct(avgDy)} — em linha com padrão setorial. Diferencial vem da qualidade do ativo, não da média.`,
    };
  }
  return {
    tone: "warn",
    text: `DY médio mensal de ${fmtPct(avgDy)} — abaixo de segmentos comparáveis. Pode refletir ativos em desenvolvimento ou stress de distribuição.`,
  };
}

const TONE_COLORS: Record<"warn" | "neutral" | "positive", string> = {
  warn: "text-amber-400",
  neutral: "text-zinc-400",
  positive: "text-emerald-400",
};

/* ─── Main component ─── */
export function SegmentStoryCard({
  variant,
  segmentKey,
  count,
  pl,
  color,
  accent,
  avgMetric,
  onDrillDown,
  delayMs = 0,
}: CommonProps) {
  // Fetch top 3 performers for this segment.
  // FIDC: order by rentab_fundo desc; FII: order by dividend_yield_mes desc.
  const fidcQ = useFidcV4Rankings(
    variant === "fidc"
      ? { lastro: segmentKey, orderBy: "rentab_fundo", order: "desc", limit: 3, enabled: true }
      : { enabled: false },
  );
  const fiiQ = useFiiV4Rankings(
    variant === "fii"
      ? { segmento: segmentKey, orderBy: "dividend_yield_mes", order: "desc", limit: 3, enabled: true }
      : { enabled: false },
  );

  const loading = variant === "fidc" ? fidcQ.isLoading : fiiQ.isLoading;
  const topFunds: Array<{ name: string; slug: string | null; metric: number | null; metricLabel: string }> =
    variant === "fidc"
      ? (fidcQ.data?.funds ?? []).slice(0, 3).map((f: FidcV4RankingItem) => ({
          name: f.denom_social || f.cnpj_fundo,
          slug: f.slug ?? null,
          metric: typeof f.rentab_fundo === "number" ? f.rentab_fundo : null,
          metricLabel: "Rentab.",
        }))
      : (fiiQ.data?.funds ?? []).slice(0, 3).map((f: FiiV4RankingItem) => ({
          name: f.denom_social || f.cnpj_fundo || "—",
          slug: f.slug ?? null,
          metric: typeof f.dividend_yield_mes === "number" ? f.dividend_yield_mes : null,
          metricLabel: "DY",
        }));

  const narrative =
    variant === "fidc" ? narrativeFidc(avgMetric, count) : narrativeFii(avgMetric, count);
  const avgLabel = variant === "fidc" ? "Inadim. média" : "DY médio";

  const baseRoute = variant === "fidc" ? "/fundos/fidc" : "/fundos/fii";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delayMs / 1000 }}
      className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4 flex flex-col gap-3 hover:border-[#2a2a2a] transition-all"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-zinc-200 truncate">{segmentKey}</h3>
          <div className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider mt-0.5">
            {variant === "fidc" ? "Lastro" : "Segmento"} · {count} fundo{count !== 1 ? "s" : ""}
          </div>
        </div>
        <div
          className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
        <div>
          <div className="text-zinc-600 text-[9px] uppercase tracking-wider">PL Agregado</div>
          <div className="text-zinc-300 tabular-nums">{formatPL(pl)}</div>
        </div>
        <div>
          <div className="text-zinc-600 text-[9px] uppercase tracking-wider">{avgLabel}</div>
          <div className="text-zinc-300 tabular-nums">{fmtPct(avgMetric)}</div>
        </div>
      </div>

      {/* Top 3 performers */}
      <div className="pt-2 border-t border-[#1a1a1a]">
        <div className="flex items-center gap-1.5 text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-2">
          <TrendingUp className="w-3 h-3" />
          Top 3 por {variant === "fidc" ? "rentabilidade" : "DY mensal"}
        </div>
        {loading ? (
          <div className="space-y-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-3 bg-[#0a0a0a] border border-[#1a1a1a] rounded animate-pulse" />
            ))}
          </div>
        ) : topFunds.length === 0 ? (
          <div className="text-[10px] text-zinc-600 italic">Sem dados de ranking para este segmento.</div>
        ) : (
          <ul className="space-y-1">
            {topFunds.map((f, idx) => {
              const href = f.slug ? `${baseRoute}/${f.slug}` : null;
              const row = (
                <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                  <span className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="text-zinc-600 tabular-nums w-3 text-right">{idx + 1}</span>
                    <span className="text-zinc-300 truncate">{truncate(f.name, 32)}</span>
                  </span>
                  <span className="text-zinc-400 tabular-nums shrink-0">{fmtPct(f.metric)}</span>
                </div>
              );
              return (
                <li key={`${f.slug ?? f.name}-${idx}`}>
                  {href ? (
                    <Link
                      to={href}
                      onClick={(e) => e.stopPropagation()}
                      className="block py-0.5 rounded hover:bg-[#0a0a0a] transition-colors"
                      aria-label={`Ver lâmina de ${f.name}`}
                    >
                      {row}
                    </Link>
                  ) : (
                    row
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Narrative line */}
      <p className={`text-[10px] leading-relaxed font-mono ${TONE_COLORS[narrative.tone]}`}>
        {narrative.text}
      </p>

      {/* Drill-down CTA */}
      <button
        type="button"
        onClick={onDrillDown}
        className="flex items-center justify-between gap-2 text-[10px] font-mono pt-2 border-t border-[#1a1a1a] transition-colors group"
        style={{ color: accent }}
        aria-label={`Filtrar rankings pelo segmento ${segmentKey}`}
      >
        <span className="uppercase tracking-wider">Explorar ranking desta classe</span>
        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
      </button>
    </motion.div>
  );
}
