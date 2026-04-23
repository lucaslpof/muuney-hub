import { Link } from "react-router-dom";
import { Sparkles, Lock, TrendingUp, Clock, Target } from "lucide-react";
import {
  CLASSE_LABELS,
  CLASSE_COLORS,
  STATUS_LABELS,
  STATUS_COLORS,
  PUBLICO_ALVO_LABELS,
  formatMoney,
  formatHorizonte,
  type AltOpportunityListItem,
} from "@/hooks/useAlternativos";

interface OpportunityCardProps {
  opportunity: AltOpportunityListItem;
  compact?: boolean;
}

/**
 * Card usado na grade de oportunidades alternativas. Clicável inteira — navega
 * para /oportunidades/:slug. Tech-Noir aesthetic: fundo #0f0f0f, border zinc-800,
 * accent color dinâmico por classe (RCVM175-inspired palette).
 */
export function OpportunityCard({ opportunity: o, compact = false }: OpportunityCardProps) {
  const accent = CLASSE_COLORS[o.classe] ?? "#0B6C3E";
  const statusColor = STATUS_COLORS[o.status] ?? "#6B7280";

  return (
    <Link
      to={`/oportunidades/${o.slug}`}
      className="group relative flex flex-col rounded-lg border border-zinc-800/70 bg-[#0f0f0f] p-4 transition-all hover:border-zinc-700 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/40"
      style={{ minHeight: compact ? 180 : 220 }}
    >
      {/* Accent line top */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] rounded-t-lg opacity-80"
        style={{ background: accent }}
        aria-hidden
      />

      {/* Header: classe badge + status */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <span
          className="text-[9px] font-mono uppercase tracking-wider rounded px-1.5 py-0.5"
          style={{
            background: `${accent}20`,
            color: accent,
            border: `1px solid ${accent}40`,
          }}
        >
          {CLASSE_LABELS[o.classe]}
        </span>
        <div className="flex items-center gap-1.5">
          {o.destaque && (
            <span className="flex items-center gap-0.5 rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-amber-400 border border-amber-500/30">
              <Sparkles className="w-2.5 h-2.5" />
              Destaque
            </span>
          )}
          <span
            className="rounded px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider"
            style={{
              background: `${statusColor}15`,
              color: statusColor,
              border: `1px solid ${statusColor}35`,
            }}
          >
            {STATUS_LABELS[o.status]}
          </span>
        </div>
      </div>

      {/* Title + subtitle */}
      <h3 className="text-sm font-semibold text-zinc-100 leading-snug line-clamp-2 group-hover:text-white">
        {o.titulo}
      </h3>
      {o.subtitulo && (
        <p className="mt-1 text-[11px] text-zinc-500 line-clamp-1">{o.subtitulo}</p>
      )}

      {/* Partner */}
      {o.partner?.nome && (
        <p className="mt-2 text-[10px] font-mono uppercase tracking-wider text-zinc-600">
          {o.partner.nome}
        </p>
      )}

      {/* Resumo */}
      {!compact && o.resumo && (
        <p className="mt-2 text-[11px] text-zinc-400 leading-relaxed line-clamp-2">
          {o.resumo}
        </p>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Metrics strip */}
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-zinc-800/60 pt-3">
        <Metric
          icon={<Target className="w-3 h-3 text-zinc-500" />}
          label="Ticket mín."
          value={formatMoney(o.ticket_minimo, o.moeda)}
        />
        <Metric
          icon={<TrendingUp className="w-3 h-3 text-zinc-500" />}
          label="Alvo"
          value={o.rentabilidade_alvo ?? "—"}
        />
        <Metric
          icon={<Clock className="w-3 h-3 text-zinc-500" />}
          label="Horizonte"
          value={formatHorizonte(o.horizonte_meses)}
        />
      </div>

      {/* Footer: publico alvo */}
      <div className="mt-2 flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-zinc-600">
          <Lock className="w-2.5 h-2.5" />
          {PUBLICO_ALVO_LABELS[o.publico_alvo]}
        </span>
        {o.volume_captacao != null && o.volume_captacao > 0 && (
          <span className="text-[9px] font-mono text-zinc-600">
            Captação: {formatMoney(o.volume_captacao, o.moeda)}
          </span>
        )}
      </div>
    </Link>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-zinc-600">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-[11px] font-semibold text-zinc-200">{value}</div>
    </div>
  );
}
