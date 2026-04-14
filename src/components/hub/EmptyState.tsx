/**
 * Contextual empty state component for Hub pages.
 * Shows relevant message + optional CTA based on context.
 */
import {
  BarChart3, Briefcase, TrendingUp, PieChart,
  AlertTriangle, Database, Inbox, Search
} from "lucide-react";
import { Link } from "react-router-dom";

type EmptyStateVariant =
  | "portfolio-empty"
  | "no-insights"
  | "no-data"
  | "no-results"
  | "no-funds"
  | "section-error"
  | "coming-soon";

interface EmptyStateProps {
  variant: EmptyStateVariant;
  title?: string;
  description?: string;
  ctaLabel?: string;
  ctaTo?: string;
  className?: string;
}

const VARIANTS: Record<EmptyStateVariant, {
  icon: React.ReactNode;
  defaultTitle: string;
  defaultDescription: string;
  defaultCta?: { label: string; to: string };
}> = {
  "portfolio-empty": {
    icon: <Briefcase size={32} className="text-zinc-600" />,
    defaultTitle: "Nenhuma carteira criada",
    defaultDescription: "Crie sua primeira carteira para acompanhar seus investimentos e comparar com benchmarks.",
    defaultCta: { label: "Criar carteira", to: "/portfolio" },
  },
  "no-insights": {
    icon: <TrendingUp size={32} className="text-zinc-600" />,
    defaultTitle: "Nenhum insight disponível",
    defaultDescription: "Os insights são gerados automaticamente quando detectamos movimentações relevantes no mercado de fundos.",
  },
  "no-data": {
    icon: <Database size={32} className="text-zinc-600" />,
    defaultTitle: "Dados indisponíveis",
    defaultDescription: "Os dados estão sendo atualizados. Tente novamente em alguns minutos.",
  },
  "no-results": {
    icon: <Search size={32} className="text-zinc-600" />,
    defaultTitle: "Nenhum resultado encontrado",
    defaultDescription: "Tente ajustar os filtros ou buscar por outros termos.",
  },
  "no-funds": {
    icon: <PieChart size={32} className="text-zinc-600" />,
    defaultTitle: "Nenhum fundo encontrado",
    defaultDescription: "Não encontramos fundos com os critérios selecionados. Ajuste os filtros para ampliar a busca.",
  },
  "section-error": {
    icon: <AlertTriangle size={32} className="text-amber-500/60" />,
    defaultTitle: "Erro ao carregar seção",
    defaultDescription: "Não foi possível carregar esta seção. Recarregue a página ou tente novamente mais tarde.",
  },
  "coming-soon": {
    icon: <BarChart3 size={32} className="text-zinc-600" />,
    defaultTitle: "Em breve",
    defaultDescription: "Este módulo está em desenvolvimento e estará disponível em breve.",
  },
};

export function EmptyState({ variant, title, description, ctaLabel, ctaTo, className = "" }: EmptyStateProps) {
  const config = VARIANTS[variant];
  const finalTitle = title ?? config.defaultTitle;
  const finalDescription = description ?? config.defaultDescription;
  const cta = ctaLabel && ctaTo
    ? { label: ctaLabel, to: ctaTo }
    : config.defaultCta;

  return (
    <div className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`}>
      <div className="w-16 h-16 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 flex items-center justify-center mb-4">
        {config.icon}
      </div>
      <h3 className="text-sm font-medium text-zinc-300 mb-1.5">{finalTitle}</h3>
      <p className="text-[12px] text-zinc-600 max-w-sm leading-relaxed">{finalDescription}</p>
      {cta && (
        <Link
          to={cta.to}
          className="mt-4 px-4 py-2 rounded-lg bg-[#0B6C3E]/20 border border-[#0B6C3E]/30 text-[#0B6C3E] text-xs font-medium hover:bg-[#0B6C3E]/30 transition-colors"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}

/** Inline variant for smaller spaces (inside cards/panels) */
export function InlineEmpty({ icon, text }: { icon?: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 py-4 px-3 text-zinc-600">
      {icon ?? <Inbox size={16} />}
      <span className="text-[11px]">{text}</span>
    </div>
  );
}
