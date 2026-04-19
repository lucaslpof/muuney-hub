/**
 * FundsLandingHero — Entry landing block for the Fundos module.
 *
 * Exposes the 4 pillars of Fundos coverage (Catálogo, FIDC Deep, FII Deep,
 * Ofertas Públicas) as clickable cards with emphasis on the new Deep Modules
 * and the Ofertas Radar that used to be buried inside HubFundos.
 *
 * Designed to sit directly below the sticky header of HubFundos, before the
 * Visão Geral section, so every arriving beta tester immediately sees what
 * the module offers and where to go next.
 */

import { Link } from "react-router-dom";
import { ArrowUpRight, Coins, Building2, Radar, Library } from "lucide-react";
import type { ReactNode } from "react";

interface HeroPillar {
  to: string;
  label: string;
  title: string;
  description: string;
  icon: ReactNode;
  accent: string; // tailwind-compatible hex for border + icon
  badge?: string;
}

const PILLARS: HeroPillar[] = [
  {
    to: "/fundos",
    label: "Catálogo geral",
    title: "Fundos (29,4k classes)",
    description: "Lâminas, ranking, screening e comparador multi-classe RCVM 175.",
    icon: <Library className="w-4 h-4" />,
    accent: "#0B6C3E",
  },
  {
    to: "/fundos/fidc",
    label: "Deep module",
    title: "FIDC",
    description: "~4,3k FIDCs — subordinação, inadimplência, estrutura de capital.",
    icon: <Coins className="w-4 h-4" />,
    accent: "#F97316",
    badge: "PRO",
  },
  {
    to: "/fundos/fii",
    label: "Deep module",
    title: "FII",
    description: "1,2k FIIs — dividend yield, segmento, rentabilidade efetiva.",
    icon: <Building2 className="w-4 h-4" />,
    accent: "#EC4899",
    badge: "PRO",
  },
  {
    to: "/ofertas",
    label: "Pipeline",
    title: "Ofertas Públicas",
    description: "CVM 160/476/400 — debêntures, CRI, CRA, FIDC, FII, ações.",
    icon: <Radar className="w-4 h-4" />,
    accent: "#22C55E",
    badge: "PRO",
  },
];

interface FundsLandingHeroProps {
  /** Optional: highlight chip to the right of the headline (e.g. active filter). */
  highlight?: string;
}

export function FundsLandingHero({ highlight }: FundsLandingHeroProps) {
  return (
    <section
      className="mb-6 bg-gradient-to-br from-[#0f0f0f] via-[#0a0a0a] to-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-4 md:p-5"
      aria-label="Atalhos dos módulos de fundos"
    >
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-[0.2em]">
              Fundos · Inteligência regulada
            </span>
            {highlight && (
              <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                {highlight}
              </span>
            )}
          </div>
          <h2 className="text-lg md:text-xl font-semibold text-zinc-100 mt-1">
            Do screening inicial à lâmina final — em três cliques.
          </h2>
          <p className="text-[11px] text-zinc-500 mt-1 max-w-2xl">
            Catálogo RCVM 175 consolidado com dados estruturados CVM (FIDC, FII, FIP) e
            pipeline de ofertas primárias. Monte teses, compare pares e antecipe
            movimentos do mercado.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {PILLARS.map((p) => (
          <Link
            key={p.to}
            to={p.to}
            className="group relative bg-[#0a0a0a] border border-[#1a1a1a] hover:border-zinc-700 rounded-md p-3 transition-colors focus:outline-none focus:ring-2 focus:ring-[#0B6C3E]/40"
            aria-label={`Ir para ${p.title}: ${p.description}`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div
                className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider"
                style={{ color: p.accent }}
              >
                {p.icon}
                <span>{p.label}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {p.badge && (
                  <span className="text-[8px] font-mono bg-[#0B6C3E]/10 text-[#0B6C3E] border border-[#0B6C3E]/30 rounded px-1 py-0.5">
                    {p.badge}
                  </span>
                )}
                <ArrowUpRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-300 transition-colors" />
              </div>
            </div>
            <div className="text-sm font-semibold text-zinc-100 group-hover:text-white transition-colors">
              {p.title}
            </div>
            <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">{p.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default FundsLandingHero;
