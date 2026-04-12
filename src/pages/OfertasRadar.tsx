import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  LayoutGrid,
  TrendingUp,
  Search,
  Radar,
  BarChart3,
  Filter,
  ExternalLink,
  Calendar,
  Building2,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import {
  useOfertasStats,
  useOfertasTimeline,
  useOfertasList,
  useOfertasFilters,
  type OfertaPublica,
} from "@/hooks/useHubFundos";
import { MacroSection, MacroSidebar } from "@/components/hub/MacroSection";
import { SectionErrorBoundary } from "@/components/hub/SectionErrorBoundary";

/* ─── Formatters ─── */
const formatMoney = (v: number | null | undefined): string => {
  if (v == null || isNaN(Number(v))) return "—";
  const num = Number(v);
  if (num >= 1_000_000_000) return `R$ ${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `R$ ${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `R$ ${(num / 1_000).toFixed(0)}k`;
  return `R$ ${num.toFixed(0)}`;
};

const formatDate = (d: string | null | undefined): string => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return d;
  }
};

const formatMonthLabel = (month: string): string => {
  const [year, mo] = month.split("-");
  const mesNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${mesNames[Number(mo) - 1] ?? mo}/${year?.slice(2) ?? ""}`;
};

/* ─── Status badges ─── */
const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  em_analise: { bg: "bg-amber-500/10 border-amber-500/30", text: "text-amber-400", label: "Em análise" },
  concedido: { bg: "bg-cyan-500/10 border-cyan-500/30", text: "text-cyan-400", label: "Concedido" },
  em_distribuicao: { bg: "bg-emerald-500/10 border-emerald-500/30", text: "text-emerald-400", label: "Em distribuição" },
  encerrado: { bg: "bg-zinc-500/10 border-zinc-500/30", text: "text-zinc-400", label: "Encerrado" },
  cancelado: { bg: "bg-red-500/10 border-red-500/30", text: "text-red-400", label: "Cancelado" },
  arquivado: { bg: "bg-zinc-500/10 border-zinc-500/30", text: "text-zinc-500", label: "Arquivado" },
  suspenso: { bg: "bg-orange-500/10 border-orange-500/30", text: "text-orange-400", label: "Suspenso" },
};

const StatusBadge = ({ status }: { status: OfertaPublica["status"] }) => {
  const cfg = STATUS_COLORS[status] || STATUS_COLORS.arquivado;
  return (
    <span className={`px-2 py-0.5 text-[9px] font-mono border rounded ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
};

/* ─── KPI Card ─── */
const KPICard = ({
  label,
  value,
  subtext,
  color = "text-zinc-300",
}: {
  label: string;
  value: string;
  subtext?: string;
  color?: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4"
  >
    <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-1.5">
      {label}
    </div>
    <div className={`text-xl font-semibold font-mono ${color}`}>{value}</div>
    {subtext && (
      <div className="text-[9px] text-zinc-500 font-mono mt-1">{subtext}</div>
    )}
  </motion.div>
);

const SECTIONS = [
  { id: "overview", label: "Visão Geral", icon: LayoutGrid },
  { id: "timeline", label: "Timeline", icon: Calendar },
  { id: "pipeline", label: "Pipeline", icon: TrendingUp },
  { id: "explorer", label: "Explorer", icon: Search },
];

const COLORS = ["#0B6C3E", "#F59E0B", "#8B5CF6", "#EC4899", "#3B82F6", "#F97316", "#06B6D4", "#10B981"];

/** Ofertas Públicas Radar — V4 Fase 3 */
export default function OfertasRadar() {
  /* ─── Deep-linking ─── */
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSection = searchParams.get("section") || "overview";

  const [activeSection, setActiveSection] = useState<string>(initialSection);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  /* ─── Lazy-load ─── */
  const [visitedSections, setVisitedSections] = useState<Set<string>>(
    () => new Set([initialSection])
  );
  const sectionVisible = useCallback(
    (id: string) => visitedSections.has(id),
    [visitedSections]
  );

  useEffect(() => {
    const next: Record<string, string> = {};
    if (activeSection !== "overview") next.section = activeSection;
    setSearchParams(next, { replace: true });
  }, [activeSection, setSearchParams]);

  /* ─── Filters ─── */
  const [filterTipoAtivo, setFilterTipoAtivo] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterModalidade, setFilterModalidade] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [orderBy, setOrderBy] = useState<string>("data_protocolo");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState<number>(0);

  /* ─── Data ─── */
  const { data: stats, isLoading: statsLoading } = useOfertasStats();
  const { data: filtersOpts } = useOfertasFilters();
  const { data: timelineData } = useOfertasTimeline(
    12,
    filterTipoAtivo || undefined,
    filterStatus || undefined
  );
  const { data: listData, isLoading: listLoading } = useOfertasList({
    tipo_ativo: filterTipoAtivo || undefined,
    status: filterStatus || undefined,
    modalidade: filterModalidade || undefined,
    search: searchQuery || undefined,
    order_by: orderBy,
    order,
    limit: 50,
    offset: page * 50,
  });

  /* ─── Pie data ─── */
  const pieDataByAtivo = useMemo(() => {
    if (!stats?.by_tipo_ativo) return [];
    return stats.by_tipo_ativo.map((item) => ({
      name: item.tipo,
      value: item.valor,
      count: item.count,
    }));
  }, [stats]);

  const timelineChartData = useMemo(() => {
    if (!timelineData?.timeline) return [];
    return [...timelineData.timeline]
      .reverse()
      .map((b) => ({
        month: formatMonthLabel(b.month),
        count: b.count,
        valor: b.valor_total / 1_000_000_000, // em bilhões
      }));
  }, [timelineData]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] w-full">
      <MacroSidebar
        items={SECTIONS}
        activeId={activeSection}
        onNavigate={(id: string) => {
          setActiveSection(id);
          const ref = sectionRefs.current[id];
          if (ref) ref.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />

      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-[#0a0a0a]/95 backdrop-blur border-b border-[#1a1a1a] px-4 md:px-8 py-6">
          <h1 className="text-2xl font-semibold text-zinc-100 flex items-center gap-2">
            <Radar className="w-6 h-6 text-[#0B6C3E]" />
            Ofertas Públicas Radar
          </h1>
          <p className="text-[9px] text-zinc-500 mt-2 font-mono">
            CVM 160 · 476 · 400 — Debêntures · CRI · CRA · FIDC · FII · Ações
          </p>
        </div>

        <div className="flex-1 px-4 md:px-8 py-8 space-y-8">
          {/* === SECTION 1: Visão Geral === */}
          <MacroSection
            ref={(el) => {
              sectionRefs.current["overview"] = el;
            }}
            id="overview"
            title="Visão Geral"
            icon={LayoutGrid}
          >
            <SectionErrorBoundary sectionName="Visão Geral Ofertas">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                onViewportEnter={() =>
                  setVisitedSections((s) => new Set(s).add("overview"))
                }
                className="space-y-6"
              >
                <div className="flex items-center gap-3 border-b border-[#1a1a1a] pb-4">
                  <LayoutGrid className="w-5 h-5 text-[#0B6C3E]" />
                  <h2 className="text-lg font-semibold text-zinc-300">Visão Geral</h2>
                </div>

                {stats && !statsLoading ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <KPICard
                      label="Total de Ofertas"
                      value={String(stats.total_ofertas)}
                      subtext="últimos 12 meses"
                      color="text-zinc-100"
                    />
                    <KPICard
                      label="Volume Protocolado"
                      value={formatMoney(stats.total_valor)}
                      color="text-[#0B6C3E]"
                    />
                    <KPICard
                      label="Em Distribuição"
                      value={String(stats.em_distribuicao)}
                      subtext="registros ativos"
                      color="text-emerald-400"
                    />
                    <KPICard
                      label="Em Análise"
                      value={String(stats.em_analise)}
                      subtext="pipeline CVM"
                      color="text-amber-400"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-24 bg-[#111111] rounded-lg animate-pulse" />
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {/* Pie: Tipo Ativo por valor */}
                  {pieDataByAtivo.length > 0 && (
                    <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-6">
                      <h3 className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-4">
                        Volume por Classe de Ativo
                      </h3>
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                          <Pie
                            data={pieDataByAtivo}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }: { name: string; percent: number }) =>
                              `${name} ${(percent * 100).toFixed(0)}%`
                            }
                            outerRadius={80}
                            dataKey="value"
                          >
                            {pieDataByAtivo.map((_entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#0a0a0a",
                              border: "1px solid #1a1a1a",
                              borderRadius: 4,
                              fontSize: 11,
                            }}
                            formatter={(v: number | string) => formatMoney(Number(v))}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Breakdown Status + Modalidade */}
                  <div className="space-y-4">
                    <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
                      <h3 className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-3">
                        Por Status
                      </h3>
                      <div className="space-y-1.5">
                        {stats?.by_status.map((s) => (
                          <div key={s.status} className="flex items-center justify-between">
                            <StatusBadge status={s.status as OfertaPublica["status"]} />
                            <span className="text-[11px] font-mono text-zinc-300">{s.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
                      <h3 className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-3">
                        Por Tipo de Oferta
                      </h3>
                      <div className="space-y-1.5">
                        {stats?.by_tipo_oferta.map((t) => (
                          <div key={t.tipo} className="flex justify-between text-[10px] font-mono">
                            <span className="text-zinc-400">{t.tipo}</span>
                            <span className="text-zinc-200">{t.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </SectionErrorBoundary>
          </MacroSection>

          {/* === SECTION 2: Timeline === */}
          <MacroSection
            ref={(el) => {
              sectionRefs.current["timeline"] = el;
            }}
            id="timeline"
            title="Timeline"
            icon={Calendar}
          >
            <SectionErrorBoundary sectionName="Timeline Ofertas">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                onViewportEnter={() =>
                  setVisitedSections((s) => new Set(s).add("timeline"))
                }
                className="space-y-6"
              >
                <div className="flex items-center gap-3 border-b border-[#1a1a1a] pb-4">
                  <Calendar className="w-5 h-5 text-[#0B6C3E]" />
                  <h2 className="text-lg font-semibold text-zinc-300">Timeline Mensal</h2>
                </div>

                {/* Quick filter chips */}
                <div className="flex gap-2 flex-wrap items-center">
                  <Filter className="w-3 h-3 text-zinc-600" />
                  <button
                    onClick={() => setFilterTipoAtivo("")}
                    className={`px-3 py-1.5 text-[9px] font-mono rounded border transition-all ${
                      !filterTipoAtivo
                        ? "bg-[#0B6C3E] text-white border-[#0B6C3E]"
                        : "bg-[#111111] text-zinc-400 border-[#1a1a1a] hover:border-[#0B6C3E]/30"
                    }`}
                  >
                    Todos
                  </button>
                  {filtersOpts?.tipos_ativo.map((t) => (
                    <button
                      key={t}
                      onClick={() => setFilterTipoAtivo(t)}
                      className={`px-3 py-1.5 text-[9px] font-mono rounded border transition-all ${
                        filterTipoAtivo === t
                          ? "bg-[#0B6C3E] text-white border-[#0B6C3E]"
                          : "bg-[#111111] text-zinc-400 border-[#1a1a1a] hover:border-[#0B6C3E]/30"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {timelineChartData.length > 0 && (
                  <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
                    <h3 className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-3">
                      Volume Protocolado (R$ bilhões) · Nº Ofertas
                    </h3>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={timelineChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                        <XAxis dataKey="month" stroke="#52525b" style={{ fontSize: 10 }} />
                        <YAxis
                          yAxisId="left"
                          stroke="#0B6C3E"
                          style={{ fontSize: 10 }}
                          tickFormatter={(v) => `R$ ${v.toFixed(1)}B`}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          stroke="#F59E0B"
                          style={{ fontSize: 10 }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#0a0a0a",
                            border: "1px solid #1a1a1a",
                            borderRadius: 4,
                            fontSize: 11,
                          }}
                        />
                        <Bar yAxisId="left" dataKey="valor" fill="#0B6C3E" name="Volume (R$B)" />
                        <Bar yAxisId="right" dataKey="count" fill="#F59E0B" name="Nº Ofertas" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Timeline cards by month */}
                <div className="space-y-4">
                  {(timelineData?.timeline ?? []).slice(0, 6).map((bucket) => (
                    <div
                      key={bucket.month}
                      className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-[10px] font-mono text-zinc-300 uppercase tracking-wider">
                          {formatMonthLabel(bucket.month)}
                        </h4>
                        <div className="flex gap-3 text-[9px] font-mono text-zinc-500">
                          <span>{bucket.count} ofertas</span>
                          <span className="text-[#0B6C3E]">{formatMoney(bucket.valor_total)}</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {bucket.ofertas.slice(0, 4).map((o) => (
                          <div
                            key={o.id}
                            className="flex items-center justify-between py-1.5 border-t border-[#1a1a1a] text-[10px] font-mono"
                          >
                            <div className="flex items-center gap-2 flex-1 truncate">
                              <span className="text-zinc-400 truncate max-w-[40%]">
                                {o.emissor_nome}
                              </span>
                              <span className="text-zinc-600">·</span>
                              <span className="text-zinc-500">{o.tipo_ativo}</span>
                              <span className="text-zinc-600">·</span>
                              <span className="text-zinc-500">{o.tipo_oferta}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-zinc-300">{formatMoney(o.valor_total)}</span>
                              <StatusBadge status={o.status} />
                            </div>
                          </div>
                        ))}
                        {bucket.ofertas.length > 4 && (
                          <div className="pt-1.5 text-[9px] text-zinc-600 font-mono">
                            + {bucket.ofertas.length - 4} outras ofertas
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </SectionErrorBoundary>
          </MacroSection>

          {/* === SECTION 3: Pipeline === */}
          <MacroSection
            ref={(el) => {
              sectionRefs.current["pipeline"] = el;
            }}
            id="pipeline"
            title="Pipeline"
            icon={TrendingUp}
          >
            <SectionErrorBoundary sectionName="Pipeline Ofertas">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                onViewportEnter={() =>
                  setVisitedSections((s) => new Set(s).add("pipeline"))
                }
                className="space-y-6"
              >
                <div className="flex items-center gap-3 border-b border-[#1a1a1a] pb-4">
                  <TrendingUp className="w-5 h-5 text-[#0B6C3E]" />
                  <h2 className="text-lg font-semibold text-zinc-300">Pipeline por Classe</h2>
                </div>

                {sectionVisible("pipeline") && stats && (
                  <div className="grid grid-cols-3 gap-4">
                    {stats.by_tipo_ativo.map((t, i) => (
                      <div
                        key={t.tipo}
                        className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4 hover:border-[#0B6C3E]/30 transition-colors cursor-pointer"
                        onClick={() => {
                          setFilterTipoAtivo(t.tipo);
                          setActiveSection("explorer");
                          sectionRefs.current["explorer"]?.scrollIntoView({
                            behavior: "smooth",
                          });
                        }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: COLORS[i % COLORS.length] }}
                          />
                          <div className="text-[10px] font-mono text-zinc-300 uppercase tracking-wider">
                            {t.tipo}
                          </div>
                        </div>
                        <div className="text-xl font-semibold font-mono text-[#0B6C3E]">
                          {formatMoney(t.valor)}
                        </div>
                        <div className="text-[9px] font-mono text-zinc-500 mt-1">
                          {t.count} ofertas
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Segmentos */}
                {stats && stats.by_segmento.length > 0 && (
                  <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
                    <h3 className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-3 flex items-center gap-2">
                      <BarChart3 className="w-3 h-3" />
                      Volume por Segmento
                    </h3>
                    <div className="space-y-2">
                      {stats.by_segmento.slice(0, 10).map((s) => {
                        const max = Math.max(...stats.by_segmento.map((x) => x.valor));
                        const pct = max > 0 ? (s.valor / max) * 100 : 0;
                        return (
                          <div key={s.segmento} className="space-y-0.5">
                            <div className="flex justify-between text-[10px] font-mono">
                              <span className="text-zinc-400 truncate max-w-[60%]">{s.segmento}</span>
                              <span className="text-zinc-300">
                                {formatMoney(s.valor)} · {s.count}
                              </span>
                            </div>
                            <div className="h-1 bg-[#0a0a0a] rounded overflow-hidden">
                              <div
                                className="h-full bg-[#0B6C3E]/60"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </motion.div>
            </SectionErrorBoundary>
          </MacroSection>

          {/* === SECTION 4: Explorer === */}
          <MacroSection
            ref={(el) => {
              sectionRefs.current["explorer"] = el;
            }}
            id="explorer"
            title="Explorer"
            icon={Search}
          >
            <SectionErrorBoundary sectionName="Explorer Ofertas">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                onViewportEnter={() =>
                  setVisitedSections((s) => new Set(s).add("explorer"))
                }
                className="space-y-6"
              >
                <div className="flex items-center gap-3 border-b border-[#1a1a1a] pb-4">
                  <Search className="w-5 h-5 text-[#0B6C3E]" />
                  <h2 className="text-lg font-semibold text-zinc-300">Explorer</h2>
                </div>

                {/* Filters bar */}
                <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4 space-y-3">
                  <div className="flex gap-3 flex-wrap items-center">
                    <input
                      type="text"
                      placeholder="Buscar emissor ou coordenador..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setPage(0);
                      }}
                      className="flex-1 min-w-[240px] px-3 py-2 text-[10px] font-mono bg-[#0a0a0a] border border-[#1a1a1a] rounded text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-[#0B6C3E]"
                    />
                    <select
                      value={filterTipoAtivo}
                      onChange={(e) => {
                        setFilterTipoAtivo(e.target.value);
                        setPage(0);
                      }}
                      className="px-3 py-2 text-[10px] font-mono bg-[#0a0a0a] border border-[#1a1a1a] rounded text-zinc-300 focus:outline-none focus:border-[#0B6C3E]"
                    >
                      <option value="">Todas classes</option>
                      {filtersOpts?.tipos_ativo.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <select
                      value={filterStatus}
                      onChange={(e) => {
                        setFilterStatus(e.target.value);
                        setPage(0);
                      }}
                      className="px-3 py-2 text-[10px] font-mono bg-[#0a0a0a] border border-[#1a1a1a] rounded text-zinc-300 focus:outline-none focus:border-[#0B6C3E]"
                    >
                      <option value="">Todos status</option>
                      {filtersOpts?.statuses.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_COLORS[s]?.label ?? s}
                        </option>
                      ))}
                    </select>
                    <select
                      value={filterModalidade}
                      onChange={(e) => {
                        setFilterModalidade(e.target.value);
                        setPage(0);
                      }}
                      className="px-3 py-2 text-[10px] font-mono bg-[#0a0a0a] border border-[#1a1a1a] rounded text-zinc-300 focus:outline-none focus:border-[#0B6C3E]"
                    >
                      <option value="">Todas modalidades</option>
                      {filtersOpts?.modalidades.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-3 items-center">
                    <select
                      value={orderBy}
                      onChange={(e) => {
                        setOrderBy(e.target.value);
                        setPage(0);
                      }}
                      className="px-3 py-2 text-[9px] font-mono bg-[#0a0a0a] border border-[#1a1a1a] rounded text-zinc-300 focus:outline-none focus:border-[#0B6C3E]"
                    >
                      <option value="data_protocolo">Ordenar por Data</option>
                      <option value="valor_total">Ordenar por Valor</option>
                      <option value="volume_final">Ordenar por Volume Final</option>
                      <option value="emissor_nome">Ordenar por Emissor</option>
                    </select>
                    <button
                      onClick={() => setOrder(order === "desc" ? "asc" : "desc")}
                      className="px-3 py-2 text-[9px] font-mono bg-[#0a0a0a] border border-[#1a1a1a] rounded text-zinc-300 hover:border-[#0B6C3E]/30 transition-colors"
                    >
                      {order === "desc" ? "↓ DESC" : "↑ ASC"}
                    </button>
                    <div className="flex-1 text-right text-[9px] font-mono text-zinc-600">
                      {listData?.count ?? 0} ofertas encontradas
                    </div>
                  </div>
                </div>

                {/* Results table */}
                <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#0a0a0a] border-b border-[#1a1a1a]">
                        <th className="px-4 py-2 text-left text-[9px] font-mono text-zinc-500 uppercase tracking-wider">
                          Emissor
                        </th>
                        <th className="px-4 py-2 text-left text-[9px] font-mono text-zinc-500 uppercase tracking-wider">
                          Classe
                        </th>
                        <th className="px-4 py-2 text-left text-[9px] font-mono text-zinc-500 uppercase tracking-wider">
                          Tipo
                        </th>
                        <th className="px-4 py-2 text-right text-[9px] font-mono text-zinc-500 uppercase tracking-wider">
                          Valor
                        </th>
                        <th className="px-4 py-2 text-left text-[9px] font-mono text-zinc-500 uppercase tracking-wider">
                          Data
                        </th>
                        <th className="px-4 py-2 text-left text-[9px] font-mono text-zinc-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-2 text-left text-[9px] font-mono text-zinc-500 uppercase tracking-wider">
                          Rating
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {listLoading ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-[10px] font-mono text-zinc-600">
                            Carregando ofertas...
                          </td>
                        </tr>
                      ) : listData?.ofertas.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-[10px] font-mono text-zinc-600">
                            Nenhuma oferta encontrada com os filtros selecionados.
                          </td>
                        </tr>
                      ) : (
                        listData?.ofertas.map((o) => (
                          <tr
                            key={o.id}
                            className="border-b border-[#1a1a1a] hover:bg-[#0a0a0a] transition-colors"
                          >
                            <td className="px-4 py-2.5 text-[10px] font-mono text-zinc-300">
                              <div className="flex items-center gap-2">
                                <Building2 className="w-3 h-3 text-zinc-600" />
                                <span className="truncate max-w-[200px]">{o.emissor_nome}</span>
                              </div>
                              {o.coordenador_lider && (
                                <div className="text-[9px] text-zinc-600 mt-0.5 pl-5">
                                  Líder: {o.coordenador_lider}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-[10px] font-mono text-zinc-400">
                              {o.tipo_ativo}
                            </td>
                            <td className="px-4 py-2.5 text-[10px] font-mono text-zinc-500">
                              {o.tipo_oferta}
                              {o.modalidade && (
                                <div className="text-[9px] text-zinc-600 mt-0.5">{o.modalidade}</div>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right text-[10px] font-mono text-[#0B6C3E]">
                              {formatMoney(o.valor_total)}
                              {o.volume_final && (
                                <div className="text-[9px] text-zinc-500 mt-0.5">
                                  Final: {formatMoney(o.volume_final)}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-[10px] font-mono text-zinc-500">
                              {formatDate(o.data_protocolo)}
                            </td>
                            <td className="px-4 py-2.5">
                              <StatusBadge status={o.status} />
                            </td>
                            <td className="px-4 py-2.5 text-[10px] font-mono">
                              {o.rating ? (
                                <span className="px-1.5 py-0.5 bg-cyan-500/10 border border-cyan-500/30 rounded text-cyan-400 text-[9px]">
                                  {o.rating}
                                </span>
                              ) : (
                                <span className="text-zinc-700">—</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {listData && listData.count > 50 && (
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => setPage(Math.max(0, page - 1))}
                      disabled={page === 0}
                      className="px-3 py-1.5 text-[9px] font-mono bg-[#111111] border border-[#1a1a1a] rounded text-zinc-400 disabled:opacity-30 hover:border-[#0B6C3E]/30 transition-colors"
                    >
                      ← Anterior
                    </button>
                    <div className="px-3 py-1.5 text-[9px] font-mono text-zinc-500">
                      Página {page + 1} de {Math.ceil(listData.count / 50)}
                    </div>
                    <button
                      onClick={() => setPage(page + 1)}
                      disabled={(page + 1) * 50 >= listData.count}
                      className="px-3 py-1.5 text-[9px] font-mono bg-[#111111] border border-[#1a1a1a] rounded text-zinc-400 disabled:opacity-30 hover:border-[#0B6C3E]/30 transition-colors"
                    >
                      Próxima →
                    </button>
                  </div>
                )}

                <div className="text-[9px] text-zinc-600 font-mono flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" />
                  Fonte: CVM (SRE — Ofertas Públicas). Dados atualizados via ingest semanal.
                </div>
              </motion.div>
            </SectionErrorBoundary>
          </MacroSection>
        </div>
      </div>
    </div>
  );
}
