/**
 * InsightsFeed — Muuney.hub Módulo Fundos V3 Fase 4
 *
 * Feed de insights automáticos: "Últimas Movimentações"
 * Shows PL drops, drawdowns, taxa changes, flow anomalies, etc.
 */
import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, TrendingDown, Users, ArrowRight, Filter, Bell } from "lucide-react";
import { InlineEmpty } from "./EmptyState";
import {
  useInsightsFeed,
  INSIGHT_TYPE_LABELS,
  INSIGHT_SEVERITY_COLORS,
  type InsightType,
  type InsightSeverity,
  type FundInsight,
} from "@/hooks/useHubFundos";
import { ClasseBadge } from "@/lib/rcvm175";

interface InsightsFeedProps {
  /** Restrict to specific type */
  tipo?: InsightType;
  /** Max items to show (default 20) */
  limit?: number;
  /** Lookback window in days (default 30) */
  days?: number;
  /** Compact mode for sidebar/lamina */
  compact?: boolean;
  /** Title override */
  title?: string;
}

const TYPE_ICONS: Record<string, typeof TrendingDown> = {
  pl_drop: TrendingDown,
  drawdown: AlertTriangle,
  cotistas_drop: Users,
};

function InsightIcon({ tipo }: { tipo: string }) {
  const Icon = TYPE_ICONS[tipo] || Bell;
  return <Icon className="w-3.5 h-3.5 flex-shrink-0" />;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const dt = new Date(dateStr).getTime();
  const diffMs = now - dt;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${diffMin}m atrás`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h atrás`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "ontem";
  if (diffD < 7) return `${diffD}d atrás`;
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function InsightCard({ insight, compact }: { insight: FundInsight; compact?: boolean }) {
  const colors = INSIGHT_SEVERITY_COLORS[insight.severidade];
  const fundPath = `/fundos/${insight.slug || insight.cnpj_fundo_classe || insight.cnpj_fundo}`;

  if (compact) {
    return (
      <Link
        to={fundPath}
        className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-zinc-800 transition-colors group"
      >
        <div className="mt-0.5" style={{ color: colors.text }}>
          <InsightIcon tipo={insight.tipo} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] text-zinc-300 truncate group-hover:text-white transition-colors">
            {insight.titulo}
          </div>
          <div className="text-[8px] text-zinc-600 truncate">
            {insight.denom_social || insight.cnpj_fundo} · {timeAgo(insight.detectado_em)}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="border rounded-lg px-3 py-2.5 transition-colors hover:border-opacity-60"
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
      }}
    >
      <Link to={fundPath} className="hover:no-underline">
        <div className="flex items-start gap-2">
          <div className="mt-0.5" style={{ color: colors.text }}>
            <InsightIcon tipo={insight.tipo} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span
                className="text-[8px] font-bold font-mono px-1 py-0.5 rounded uppercase"
                style={{ backgroundColor: colors.border, color: colors.text }}
              >
                {INSIGHT_TYPE_LABELS[insight.tipo] || insight.tipo}
              </span>
              {insight.classe_rcvm175 && (
                <ClasseBadge classe={insight.classe_rcvm175} size="sm" />
              )}
              <span className="text-[8px] text-zinc-700 font-mono ml-auto flex-shrink-0">
                {timeAgo(insight.detectado_em)}
              </span>
            </div>
            <div className="text-[11px] text-zinc-200 font-mono leading-snug">
              {insight.titulo}
            </div>
            {insight.denom_social && (
              <div className="text-[9px] text-zinc-500 font-mono truncate mt-0.5">
                {insight.denom_social}
              </div>
            )}
            {insight.detalhe && (
              <div className="text-[9px] text-zinc-600 font-mono mt-1 leading-relaxed">
                {insight.detalhe}
              </div>
            )}
          </div>
          <ArrowRight className="w-3 h-3 text-zinc-800 mt-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </Link>
    </motion.div>
  );
}

const FILTER_OPTIONS: { value: InsightType | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "pl_drop", label: "Queda PL" },
  { value: "drawdown", label: "Drawdown" },
  { value: "cotistas_drop", label: "Cotistas" },
  { value: "flow_anomaly", label: "Fluxo" },
  { value: "taxa_change", label: "Taxa" },
  { value: "new_fund", label: "Novos" },
];

const SEVERITY_OPTIONS: { value: InsightSeverity | "all"; label: string; color: string }[] = [
  { value: "all", label: "Todos", color: "#71717a" },
  { value: "critical", label: "Crítico", color: "#EF4444" },
  { value: "warning", label: "Alerta", color: "#F59E0B" },
  { value: "info", label: "Info", color: "#3B82F6" },
];

export function InsightsFeed({
  tipo: fixedTipo,
  limit = 20,
  days = 30,
  compact = false,
  title,
}: InsightsFeedProps) {
  const [filterTipo, setFilterTipo] = useState<InsightType | "all">("all");
  const [filterSev, setFilterSev] = useState<InsightSeverity | "all">("all");
  const [showFilters, setShowFilters] = useState(false);

  const activeTipo = fixedTipo || (filterTipo === "all" ? undefined : filterTipo);
  const activeSev = filterSev === "all" ? undefined : filterSev;

  const { data, isLoading } = useInsightsFeed({
    tipo: activeTipo,
    severidade: activeSev,
    days,
    limit,
  });

  const insights = data?.insights || [];
  const summary = data?.summary;

  const totalCount = useMemo(() => {
    if (!summary?.by_type) return 0;
    return Object.values(summary.by_type).reduce((a, b) => a + b, 0);
  }, [summary]);

  if (isLoading) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4 animate-pulse">
        <div className="h-4 bg-[#1a1a1a] rounded w-1/3 mb-3" />
        {Array.from({ length: compact ? 3 : 5 }).map((_, i) => (
          <div key={i} className="h-12 bg-[#1a1a1a] rounded mb-2" />
        ))}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/50">
        <div className="flex items-center gap-2">
          <Bell className="w-3.5 h-3.5 text-[#F59E0B]" />
          <h3 className="text-[11px] text-zinc-400 uppercase tracking-wider font-mono">
            {title || "Últimas Movimentações"}
          </h3>
          {totalCount > 0 && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20">
              {totalCount}
            </span>
          )}
        </div>
        {!fixedTipo && !compact && (
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors ${
              showFilters ? "bg-[#0B6C3E]/10 text-[#0B6C3E]" : "text-zinc-600 hover:text-zinc-400"
            }`}
          >
            <Filter className="w-3 h-3" />
            Filtros
          </button>
        )}
      </div>

      {/* Filters */}
      <AnimatePresence>
        {showFilters && !compact && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-zinc-800/50"
          >
            <div className="px-3 py-2 space-y-1.5">
              {/* Type filter */}
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[8px] text-zinc-600 font-mono w-10">Tipo:</span>
                {FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFilterTipo(opt.value)}
                    className={`px-1.5 py-0.5 rounded text-[8px] font-mono transition-colors ${
                      filterTipo === opt.value
                        ? "bg-[#0B6C3E]/20 text-[#0B6C3E] border border-[#0B6C3E]/30"
                        : "text-zinc-600 hover:text-zinc-400 border border-transparent"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {/* Severity filter */}
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[8px] text-zinc-600 font-mono w-10">Nível:</span>
                {SEVERITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFilterSev(opt.value)}
                    className={`px-1.5 py-0.5 rounded text-[8px] font-mono transition-colors border ${
                      filterSev === opt.value
                        ? `border-opacity-30`
                        : "border-transparent text-zinc-600 hover:text-zinc-400"
                    }`}
                    style={
                      filterSev === opt.value
                        ? { backgroundColor: `${opt.color}15`, color: opt.color, borderColor: `${opt.color}30` }
                        : {}
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Insights list */}
      <div className={compact ? "px-1 py-1" : "px-3 py-2 space-y-2"}>
        {insights.length === 0 ? (
          <InlineEmpty icon={<Bell size={14} className="text-zinc-700" />} text="Nenhuma movimentação recente detectada. Insights são gerados automaticamente ao detectar variações relevantes." />
        ) : (
          insights.map((insight) => (
            <InsightCard key={insight.id} insight={insight} compact={compact} />
          ))
        )}
      </div>

      {/* Summary bar */}
      {!compact && summary && totalCount > 0 && (
        <div className="px-3 py-1.5 border-t border-zinc-800/50 flex items-center gap-3">
          {Object.entries(summary.by_severity || {}).map(([sev, count]) => {
            const colors = INSIGHT_SEVERITY_COLORS[sev as InsightSeverity];
            return colors ? (
              <span
                key={sev}
                className="text-[8px] font-mono flex items-center gap-1"
                style={{ color: colors.text }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: colors.text }}
                />
                {count} {sev}
              </span>
            ) : null;
          })}
          <span className="text-[8px] text-zinc-700 font-mono ml-auto">
            últimos {days}d
          </span>
        </div>
      )}
    </motion.div>
  );
}

/**
 * InsightsBadge — Small badge showing unread insight count for sidebar nav
 */
export function InsightsBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[8px] font-mono font-bold bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/30">
      {count > 99 ? "99+" : count}
    </span>
  );
}

/**
 * FundInsightsSection — Compact insight list for FundLamina page
 */
export function FundInsightsSection({ identifier }: { identifier: string | null }) {
  const { data, isLoading } = useInsightsFeed({
    limit: 10,
    days: 90,
    enabled: !!identifier,
  });

  // Client-side filter for this fund
  const fundInsights = useMemo(() => {
    if (!data?.insights || !identifier) return [];
    return data.insights.filter(
      (i) =>
        i.slug === identifier ||
        i.cnpj_fundo === identifier ||
        i.cnpj_fundo_classe === identifier
    );
  }, [data, identifier]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-8 bg-[#1a1a1a] rounded" />
        ))}
      </div>
    );
  }

  if (fundInsights.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <h4 className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono flex items-center gap-1.5">
        <Bell className="w-3 h-3 text-[#F59E0B]" />
        Alertas Recentes
      </h4>
      {fundInsights.map((insight) => (
        <InsightCard key={insight.id} insight={insight} compact />
      ))}
    </div>
  );
}
