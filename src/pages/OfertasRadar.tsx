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
  Eye,
  Brain,
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
import { ChartTooltip } from "@/components/hub/ChartTooltip";
import { Breadcrumbs } from "@/components/hub/Breadcrumbs";
import { HubSEO } from "@/lib/seo";
import { SkeletonKPI, SkeletonChart, SkeletonTableRow } from "@/components/hub/SkeletonLoader";
import { EmptyState } from "@/components/hub/EmptyState";
import { formatBRL, formatDate, formatMonthLabel, formatCount, fmtNum } from "@/lib/format";
import OfertasNarrativePanel from "@/components/hub/OfertasNarrativePanel";
import { exportCsv, csvFilename, type CsvColumn } from "@/lib/csvExport";
import { ExportButton } from "@/components/hub/ExportButton";

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
  { id: "analytics", label: "Analytics", icon: Brain },
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

  /* ─── Deep-linking sync ─── */
  useEffect(() => {
    const next: Record<string, string> = {};
    if (activeSection !== "overview") next.section = activeSection;
    setSearchParams(next, { replace: true });
  }, [activeSection, setSearchParams]);

  /* ─── Scroll to section on navigate ─── */
  const scrollTo = useCallback((id: string) => {
    setActiveSection(id);
    const el = sectionRefs.current[id] || document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  /* ─── IntersectionObserver: active section + lazy-load ─── */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            setActiveSection(id);
            setVisitedSections((prev) => {
              if (prev.has(id)) return prev;
              const next = new Set(prev);
              next.add(id);
              return next;
            });
          }
        }
      },
      { rootMargin: "-120px 0px -60% 0px", threshold: 0 }
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  /* ─── Scroll to initial section from URL on mount ─── */
  useEffect(() => {
    if (initialSection !== "overview") {
      const el = document.getElementById(initialSection);
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
        setVisitedSections((prev) => new Set([...prev, initialSection]));
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Timeline Filters (independent) ─── */
  const [tlTipoAtivo, setTlTipoAtivo] = useState<string>("");

  /* ─── Explorer Filters ─── */
  const [exTipoAtivo, setExTipoAtivo] = useState<string>("");
  const [exStatus, setExStatus] = useState<string>("");
  const [exModalidade, setExModalidade] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [orderBy, setOrderBy] = useState<string>("data_protocolo");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState<number>(0);

  /* ─── Detail drawer ─── */
  const [selectedOferta, setSelectedOferta] = useState<OfertaPublica | null>(null);

  /* ─── Data ─── */
  const { data: stats, isLoading: statsLoading } = useOfertasStats();
  const { data: filtersOpts } = useOfertasFilters();
  const { data: timelineData, isLoading: timelineLoading } = useOfertasTimeline(
    12,
    tlTipoAtivo || undefined,
    undefined
  );
  const { data: listData, isLoading: listLoading } = useOfertasList({
    tipo_ativo: exTipoAtivo || undefined,
    status: exStatus || undefined,
    modalidade: exModalidade || undefined,
    search: searchQuery || undefined,
    order_by: orderBy,
    order,
    limit: 50,
    offset: page * 50,
  });

  /* ─── CSV Export ─── */
  const handleExportExplorer = useCallback(() => {
    if (!listData?.ofertas.length) return;
    const columns: CsvColumn<OfertaPublica>[] = [
      { header: "Emissor", accessor: (o) => o.emissor_nome },
      { header: "CNPJ", accessor: (o) => o.emissor_cnpj || "" },
      { header: "Tipo Ativo", accessor: (o) => o.tipo_ativo },
      { header: "Tipo Oferta", accessor: (o) => o.tipo_oferta },
      { header: "Modalidade", accessor: (o) => o.modalidade || "" },
      { header: "Valor (R$)", accessor: (o) => o.valor_total || "" },
      { header: "Volume Final (R$)", accessor: (o) => o.volume_final || "" },
      { header: "Status", accessor: (o) => STATUS_COLORS[o.status]?.label || o.status },
      { header: "Data Protocolo", accessor: (o) => o.data_protocolo },
      { header: "Rating", accessor: (o) => o.rating || "" },
      { header: "Coordenador Líder", accessor: (o) => o.coordenador_lider || "" },
      { header: "Segmento", accessor: (o) => o.segmento || "" },
    ];
    exportCsv(listData.ofertas, columns, csvFilename("ofertas", "explorer"));
  }, [listData?.ofertas]);

  const handleExportTopEmissores = useCallback(() => {
    if (!listData?.ofertas.length) return;
    const emissorMap = new Map<string, { nome: string; valor: number; count: number }>();
    for (const o of listData.ofertas) {
      const key = o.emissor_cnpj || o.emissor_nome;
      const prev = emissorMap.get(key) ?? { nome: o.emissor_nome, valor: 0, count: 0 };
      emissorMap.set(key, { nome: prev.nome, valor: prev.valor + (o.valor_total ?? 0), count: prev.count + 1 });
    }
    const sorted = [...emissorMap.values()].sort((a, b) => b.valor - a.valor);
    type TopEmissor = { nome: string; valor: number; count: number };
    const columns: CsvColumn<TopEmissor>[] = [
      { header: "Emissor", accessor: (e) => e.nome },
      { header: "Volume Total (R$)", accessor: (e) => e.valor },
      { header: "Quantidade Ofertas", accessor: (e) => e.count },
    ];
    exportCsv(sorted, columns, csvFilename("ofertas", "top-emissores"));
  }, [listData?.ofertas]);

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

  /* ─── Narrative insights (computed from stats + timeline) ─── */
  const narrativeOverview = useMemo(() => {
    if (!stats) return null;
    const pct_analise = stats.total_ofertas > 0
      ? ((stats.em_analise / stats.total_ofertas) * 100)
      : 0;
    const topAtivo = stats.by_tipo_ativo?.[0];
    // Concentration: top class share
    const topClassShare = topAtivo && stats.total_valor > 0
      ? (topAtivo.valor / stats.total_valor) * 100 : 0;
    // HHI
    const hhi = stats.by_tipo_ativo.length > 0 && stats.total_valor > 0
      ? stats.by_tipo_ativo.reduce((s, t) => {
          const sh = (t.valor / stats.total_valor) * 100;
          return s + sh * sh;
        }, 0)
      : 0;
    // Cancellation rate
    const cancelSuspenso = stats.by_status
      .filter((s) => s.status === "cancelado" || s.status === "suspenso")
      .reduce((s, x) => s + x.count, 0);
    const cancelRate = stats.total_ofertas > 0 ? (cancelSuspenso / stats.total_ofertas) * 100 : 0;

    return {
      pct_analise,
      topAtivo,
      topClassShare,
      hhi,
      cancelRate,
      cancelSuspenso,
      total: stats.total_ofertas,
      distrib: stats.em_distribuicao,
      activeClasses: stats.by_tipo_ativo.filter((t) => t.count >= 2).length,
    };
  }, [stats]);

  const narrativeTimeline = useMemo(() => {
    if (!timelineData?.timeline?.length) return null;
    const tl = timelineData.timeline;
    const sorted = [...tl].sort((a, b) => b.valor_total - a.valor_total);
    const peakMonth = sorted[0];
    const recent = tl[0]; // most recent
    // MoM delta
    const momDelta = tl.length >= 2 && tl[1].valor_total > 0
      ? ((tl[0].valor_total - tl[1].valor_total) / tl[1].valor_total) * 100
      : null;
    // 3-month trend (average of recent 3 vs prior 3)
    const recent3 = tl.slice(0, 3);
    const prior3 = tl.slice(3, 6);
    const avgRecent = recent3.length > 0 ? recent3.reduce((s, b) => s + b.valor_total, 0) / recent3.length : 0;
    const avgPrior = prior3.length > 0 ? prior3.reduce((s, b) => s + b.valor_total, 0) / prior3.length : 0;
    const qoqDelta = avgPrior > 0 ? ((avgRecent - avgPrior) / avgPrior) * 100 : null;
    // Ticket médio
    const ticketRecent = recent.count > 0 ? recent.valor_total / recent.count : 0;
    const ticketAvg = tl.length > 0
      ? tl.reduce((s, b) => s + (b.count > 0 ? b.valor_total / b.count : 0), 0) / tl.length
      : 0;
    // YoY comparison (month 0 vs month 12 if available)
    let yoyVolumeDelta: number | null = null;
    let yoyCountDelta: number | null = null;
    if (tl.length >= 13 && tl[12].valor_total > 0 && tl[12].count > 0) {
      yoyVolumeDelta = ((tl[0].valor_total - tl[12].valor_total) / tl[12].valor_total) * 100;
      yoyCountDelta = ((tl[0].count - tl[12].count) / tl[12].count) * 100;
    }
    return { peakMonth, recent, total: tl.length, momDelta, qoqDelta, ticketRecent, ticketAvg, yoyVolumeDelta, yoyCountDelta };
  }, [timelineData]);

  /* ─── Pipeline analytics ─── */
  const pipelineAnalytics = useMemo(() => {
    if (!stats) return null;
    const distribRatio = stats.total_ofertas > 0
      ? (stats.em_distribuicao / stats.total_ofertas) * 100 : 0;
    const pipelineRatio = stats.total_ofertas > 0
      ? (stats.em_analise / stats.total_ofertas) * 100 : 0;
    // Top emissores from list data (if available)
    const topSegmentos = stats.by_segmento.slice(0, 5);
    const topAtivos = stats.by_tipo_ativo.slice(0, 5);
    // Score 0-100 (pipeline health heuristic)
    const healthScore = Math.min(100, Math.round(
      (pipelineRatio > 5 ? 30 : pipelineRatio * 6) +
      (distribRatio > 5 ? 30 : distribRatio * 6) +
      (topAtivos.length >= 3 ? 20 : topAtivos.length * 7) +
      (stats.total_ofertas > 50 ? 20 : (stats.total_ofertas / 50) * 20)
    ));
    return { distribRatio, pipelineRatio, healthScore, topSegmentos, topAtivos };
  }, [stats]);

  /* ─── Explorer summary (computed from filtered list) ─── */
  const explorerSummary = useMemo(() => {
    if (!listData?.ofertas?.length) return null;
    const totalValor = listData.ofertas.reduce((s, o) => s + (o.valor_total ?? 0), 0);
    const statusCounts: Record<string, number> = {};
    for (const o of listData.ofertas) {
      statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;
    }
    const topStatus = Object.entries(statusCounts).sort((a, b) => b[1] - a[1])[0];
    return { count: listData.count, totalValor, topStatus };
  }, [listData]);

  /* ─── Top emissores (memoized) ─── */
  const topEmissores = useMemo(() => {
    if (!listData?.ofertas?.length) return [];
    const emissorMap = new Map<string, { nome: string; valor: number; count: number }>();
    for (const o of listData.ofertas) {
      const key = o.emissor_cnpj || o.emissor_nome;
      const prev = emissorMap.get(key) ?? { nome: o.emissor_nome, valor: 0, count: 0 };
      emissorMap.set(key, { nome: prev.nome, valor: prev.valor + (o.valor_total ?? 0), count: prev.count + 1 });
    }
    const sorted = [...emissorMap.values()].sort((a, b) => b.valor - a.valor).slice(0, 8);
    const maxVal = sorted.length > 0 ? sorted[0].valor : 1;
    const totalVol = sorted.reduce((s, e) => s + e.valor, 0);
    return sorted.map((em) => ({ ...em, pct: totalVol > 0 ? (em.valor / totalVol) * 100 : 0, barW: (em.valor / maxVal) * 100 }));
  }, [listData]);

  /* ─── Coordenadores líderes (memoized) ─── */
  const topCoordenadores = useMemo(() => {
    if (!listData?.ofertas?.length) return [];
    const coordMap = new Map<string, { nome: string; valor: number; count: number; emissores: Set<string> }>();
    for (const o of listData.ofertas) {
      if (!o.coordenador_lider) continue;
      const nome = o.coordenador_lider;
      const prev = coordMap.get(nome) ?? { nome, valor: 0, count: 0, emissores: new Set<string>() };
      prev.valor += o.valor_total ?? 0;
      prev.count += 1;
      if (o.emissor_cnpj) prev.emissores.add(o.emissor_cnpj);
      coordMap.set(nome, prev);
    }
    const sorted = [...coordMap.values()].sort((a, b) => b.valor - a.valor).slice(0, 8);
    const maxVal = sorted.length > 0 ? sorted[0].valor : 1;
    const totalVol = sorted.reduce((s, c) => s + c.valor, 0);
    return sorted.map((c) => ({ ...c, emissorCount: c.emissores.size, pct: totalVol > 0 ? (c.valor / totalVol) * 100 : 0, barW: (c.valor / maxVal) * 100 }));
  }, [listData]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] w-full">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#0a0a0a]/95 backdrop-blur border-b border-[#1a1a1a] px-4 md:px-8 py-6">
        <HubSEO
          title="Ofertas Públicas"
          description="Radar de ofertas públicas CVM — pipeline, timeline e explorer de debêntures, CRI, CRA, FIDC, FII e ações."
          path="/ofertas"
        />
        <Breadcrumbs items={[{ label: "Ofertas Públicas" }]} className="mb-3" />
        <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
          <Radar className="w-5 h-5 text-[#0B6C3E]" />
          Ofertas Públicas Radar
        </h1>
        <p className="text-[9px] text-zinc-500 mt-2 font-mono">
          CVM 160 · 476 · 400 — Debêntures · CRI · CRA · FIDC · FII · Ações
        </p>
      </div>

      {/* Sidebar + Content flex layout */}
      <div className="flex gap-6 px-4 md:px-8 py-8">
        {/* Sidebar — hidden on mobile */}
        <div className="hidden md:block w-40 flex-shrink-0">
          <MacroSidebar
            items={SECTIONS}
            activeId={activeSection}
            onNavigate={scrollTo}
          />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-8">
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
              <div className="space-y-6">
                {/* Narrative insight */}
                {narrativeOverview && (
                  <div className="space-y-2">
                    <p className="text-[11px] text-zinc-400 font-mono leading-relaxed border-l-2 border-[#0B6C3E]/40 pl-3">
                      <span className="text-zinc-200">{formatCount(narrativeOverview.total)}</span> ofertas rastreadas nos últimos 12 meses,
                      com {fmtNum(narrativeOverview.pct_analise, 1)}% ainda em análise na CVM.
                      {narrativeOverview.topAtivo && (
                        <> A classe dominante é <span className="text-zinc-200">{narrativeOverview.topAtivo.tipo}</span> ({formatBRL(narrativeOverview.topAtivo.valor)}, {fmtNum(narrativeOverview.topClassShare, 1)}% do volume).
                        </>
                      )}
                      {narrativeOverview.distrib > 0 && (
                        <> {formatCount(narrativeOverview.distrib)} ofertas em distribuição ativa.</>
                      )}
                    </p>
                    {/* Mini-analytics cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-[#111111] border border-[#1a1a1a] rounded p-2.5">
                        <div className="text-[8px] text-zinc-600 uppercase tracking-wider font-mono">Diversificação (HHI)</div>
                        <div className={`text-sm font-mono font-semibold ${narrativeOverview.hhi > 5000 ? "text-red-400" : narrativeOverview.hhi > 2500 ? "text-amber-400" : "text-emerald-400"}`}>
                          {formatCount(Math.round(narrativeOverview.hhi))}
                        </div>
                        <div className="text-[8px] text-zinc-600 font-mono">
                          {narrativeOverview.hhi > 5000 ? "Concentrado" : narrativeOverview.hhi > 2500 ? "Moderado" : "Diversificado"}
                        </div>
                      </div>
                      <div className="bg-[#111111] border border-[#1a1a1a] rounded p-2.5">
                        <div className="text-[8px] text-zinc-600 uppercase tracking-wider font-mono">Classes Ativas</div>
                        <div className="text-sm font-mono font-semibold text-zinc-200">{narrativeOverview.activeClasses}</div>
                        <div className="text-[8px] text-zinc-600 font-mono">com ≥2 ofertas</div>
                      </div>
                      <div className="bg-[#111111] border border-[#1a1a1a] rounded p-2.5">
                        <div className="text-[8px] text-zinc-600 uppercase tracking-wider font-mono">Cancel./Suspenso</div>
                        <div className={`text-sm font-mono font-semibold ${narrativeOverview.cancelRate > 10 ? "text-red-400" : narrativeOverview.cancelRate > 5 ? "text-amber-400" : "text-emerald-400"}`}>
                          {fmtNum(narrativeOverview.cancelRate, 1)}%
                        </div>
                        <div className="text-[8px] text-zinc-600 font-mono">{formatCount(narrativeOverview.cancelSuspenso)} ofertas</div>
                      </div>
                    </div>
                  </div>
                )}

                {stats && !statsLoading ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <KPICard
                      label="Total de Ofertas"
                      value={formatCount(stats.total_ofertas)}
                      subtext="últimos 12 meses"
                      color="text-zinc-100"
                    />
                    <KPICard
                      label="Volume Protocolado"
                      value={formatBRL(stats.total_valor)}
                      color="text-[#0B6C3E]"
                    />
                    <KPICard
                      label="Em Distribuição"
                      value={formatCount(stats.em_distribuicao)}
                      subtext="registros ativos"
                      color="text-emerald-400"
                    />
                    <KPICard
                      label="Em Análise"
                      value={formatCount(stats.em_analise)}
                      subtext="pipeline CVM"
                      color="text-amber-400"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                      <SkeletonKPI key={i} />
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Pie: Tipo Ativo por valor — external legend to avoid label overlap */}
                  {pieDataByAtivo.length > 0 && (
                    <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-6">
                      <h3 className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-4">
                        Volume por Classe de Ativo
                      </h3>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={pieDataByAtivo}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={80}
                            dataKey="value"
                            stroke="#0a0a0a"
                            strokeWidth={2}
                          >
                            {pieDataByAtivo.map((_entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={<ChartTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      {/* External legend */}
                      <div className="mt-3 space-y-1.5">
                        {pieDataByAtivo.map((entry, index) => {
                          const total = pieDataByAtivo.reduce((s, e) => s + e.value, 0);
                          const pct = total > 0 ? (entry.value / total) * 100 : 0;
                          return (
                            <div key={entry.name} className="flex items-center justify-between text-[10px] font-mono">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                />
                                <span className="text-zinc-400 truncate">{entry.name}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-zinc-300">{formatBRL(entry.value)}</span>
                                <span className="text-zinc-600 w-10 text-right">{fmtNum(pct, 1)}%</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
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
                            <span className="text-[11px] font-mono text-zinc-300">{formatCount(s.count)}</span>
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
                            <span className="text-zinc-200">{formatCount(t.count)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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
              <div className="space-y-6">
                {/* Narrative insight */}
                {narrativeTimeline && (
                  <div className="space-y-2">
                    <p className="text-[11px] text-zinc-400 font-mono leading-relaxed border-l-2 border-[#0B6C3E]/40 pl-3">
                      {formatCount(narrativeTimeline.total)} meses rastreados.
                      {narrativeTimeline.peakMonth && (
                        <> Pico de volume em <span className="text-zinc-200">{formatMonthLabel(narrativeTimeline.peakMonth.month)}</span> ({formatBRL(narrativeTimeline.peakMonth.valor_total)}, {formatCount(narrativeTimeline.peakMonth.count)} ofertas).</>
                      )}
                      {narrativeTimeline.momDelta != null && (
                        <> Variação MoM: <span className={narrativeTimeline.momDelta >= 0 ? "text-emerald-400" : "text-red-400"}>{narrativeTimeline.momDelta >= 0 ? "+" : ""}{fmtNum(narrativeTimeline.momDelta, 1)}%</span>.</>
                      )}
                      {narrativeTimeline.qoqDelta != null && (
                        <> Tendência trimestral: <span className={narrativeTimeline.qoqDelta >= 0 ? "text-emerald-400" : "text-red-400"}>{narrativeTimeline.qoqDelta >= 0 ? "+" : ""}{fmtNum(narrativeTimeline.qoqDelta, 1)}%</span>.</>
                      )}
                    </p>
                    {/* Momentum + YoY cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {narrativeTimeline.momDelta != null && (
                        <div className="bg-[#111111] border border-[#1a1a1a] rounded p-2.5">
                          <div className="text-[8px] text-zinc-600 uppercase tracking-wider font-mono">MoM Volume</div>
                          <div className={`text-sm font-mono font-semibold ${narrativeTimeline.momDelta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {narrativeTimeline.momDelta >= 0 ? "+" : ""}{fmtNum(narrativeTimeline.momDelta, 1)}%
                          </div>
                        </div>
                      )}
                      {narrativeTimeline.qoqDelta != null && (
                        <div className="bg-[#111111] border border-[#1a1a1a] rounded p-2.5">
                          <div className="text-[8px] text-zinc-600 uppercase tracking-wider font-mono">Tendência 3M</div>
                          <div className={`text-sm font-mono font-semibold ${narrativeTimeline.qoqDelta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {narrativeTimeline.qoqDelta >= 0 ? "+" : ""}{fmtNum(narrativeTimeline.qoqDelta, 1)}%
                          </div>
                        </div>
                      )}
                      {narrativeTimeline.yoyVolumeDelta != null && (
                        <div className="bg-[#111111] border border-[#1a1a1a] rounded p-2.5">
                          <div className="text-[8px] text-zinc-600 uppercase tracking-wider font-mono">YoY Volume</div>
                          <div className={`text-sm font-mono font-semibold ${narrativeTimeline.yoyVolumeDelta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {narrativeTimeline.yoyVolumeDelta >= 0 ? "+" : ""}{fmtNum(narrativeTimeline.yoyVolumeDelta, 1)}%
                          </div>
                        </div>
                      )}
                      {narrativeTimeline.yoyCountDelta != null && (
                        <div className="bg-[#111111] border border-[#1a1a1a] rounded p-2.5">
                          <div className="text-[8px] text-zinc-600 uppercase tracking-wider font-mono">YoY Ofertas</div>
                          <div className={`text-sm font-mono font-semibold ${narrativeTimeline.yoyCountDelta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {narrativeTimeline.yoyCountDelta >= 0 ? "+" : ""}{fmtNum(narrativeTimeline.yoyCountDelta, 1)}%
                          </div>
                        </div>
                      )}
                      <div className="bg-[#111111] border border-[#1a1a1a] rounded p-2.5">
                        <div className="text-[8px] text-zinc-600 uppercase tracking-wider font-mono">Ticket Médio</div>
                        <div className="text-sm font-mono font-semibold text-zinc-200">
                          {formatBRL(narrativeTimeline.ticketRecent)}
                        </div>
                        <div className="text-[8px] text-zinc-600 font-mono">último mês</div>
                      </div>
                      <div className="bg-[#111111] border border-[#1a1a1a] rounded p-2.5">
                        <div className="text-[8px] text-zinc-600 uppercase tracking-wider font-mono">Ticket Média 12M</div>
                        <div className="text-sm font-mono font-semibold text-zinc-200">
                          {formatBRL(narrativeTimeline.ticketAvg)}
                        </div>
                        <div className="text-[8px] text-zinc-600 font-mono">referência</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Quick filter chips */}
                <div className="flex gap-2 flex-wrap items-center">
                  <Filter className="w-3 h-3 text-zinc-600" />
                  <button
                    onClick={() => setTlTipoAtivo("")}
                    className={`px-3 py-1.5 text-[9px] font-mono rounded border transition-all ${
                      !tlTipoAtivo
                        ? "bg-[#0B6C3E] text-white border-[#0B6C3E]"
                        : "bg-[#111111] text-zinc-400 border-[#1a1a1a] hover:border-[#0B6C3E]/30"
                    }`}
                  >
                    Todos
                  </button>
                  {filtersOpts?.tipos_ativo.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTlTipoAtivo(t)}
                      className={`px-3 py-1.5 text-[9px] font-mono rounded border transition-all ${
                        tlTipoAtivo === t
                          ? "bg-[#0B6C3E] text-white border-[#0B6C3E]"
                          : "bg-[#111111] text-zinc-400 border-[#1a1a1a] hover:border-[#0B6C3E]/30"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {timelineLoading && <SkeletonChart />}
                {!timelineLoading && timelineChartData.length === 0 && (
                  <EmptyState variant="no-data" />
                )}
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
                          tickFormatter={(v: number) => `R$ ${fmtNum(v, 1)}B`}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          stroke="#F59E0B"
                          style={{ fontSize: 10 }}
                          tickFormatter={(v: number) => formatCount(v)}
                        />
                        <Tooltip content={<ChartTooltip />} />
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
                          <span>{formatCount(bucket.count)} ofertas</span>
                          <span className="text-[#0B6C3E]">{formatBRL(bucket.valor_total)}</span>
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
                              <span className="text-zinc-300">{formatBRL(o.valor_total)}</span>
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
              </div>
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
              <div className="space-y-6">
                {/* Pipeline narrative */}
                {pipelineAnalytics && (
                  <div className="space-y-2">
                    <p className="text-[11px] text-zinc-400 font-mono leading-relaxed border-l-2 border-[#0B6C3E]/40 pl-3">
                      Pipeline com <span className="text-zinc-200">{fmtNum(pipelineAnalytics.pipelineRatio, 1)}%</span> em análise CVM
                      e <span className="text-zinc-200">{fmtNum(pipelineAnalytics.distribRatio, 1)}%</span> em distribuição ativa.
                      {pipelineAnalytics.topAtivos.length > 0 && (
                        <> {pipelineAnalytics.topAtivos.length} classes com ofertas ativas — lideradas por {pipelineAnalytics.topAtivos[0].tipo}.</>
                      )}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-[#111111] border border-[#1a1a1a] rounded p-2.5">
                        <div className="text-[8px] text-zinc-600 uppercase tracking-wider font-mono">Health Score</div>
                        <div className={`text-lg font-mono font-bold ${pipelineAnalytics.healthScore >= 70 ? "text-emerald-400" : pipelineAnalytics.healthScore >= 40 ? "text-amber-400" : "text-red-400"}`}>
                          {pipelineAnalytics.healthScore}
                          <span className="text-[9px] text-zinc-600 font-normal">/100</span>
                        </div>
                        <div className="text-[8px] text-zinc-600 font-mono">
                          {pipelineAnalytics.healthScore >= 70 ? "Saudável" : pipelineAnalytics.healthScore >= 40 ? "Moderado" : "Fraco"}
                        </div>
                      </div>
                      <div className="bg-[#111111] border border-[#1a1a1a] rounded p-2.5">
                        <div className="text-[8px] text-zinc-600 uppercase tracking-wider font-mono">Em Análise</div>
                        <div className="text-sm font-mono font-semibold text-amber-400">{fmtNum(pipelineAnalytics.pipelineRatio, 1)}%</div>
                        <div className="text-[8px] text-zinc-600 font-mono">pipeline CVM</div>
                      </div>
                      <div className="bg-[#111111] border border-[#1a1a1a] rounded p-2.5">
                        <div className="text-[8px] text-zinc-600 uppercase tracking-wider font-mono">Distribuindo</div>
                        <div className="text-sm font-mono font-semibold text-emerald-400">{fmtNum(pipelineAnalytics.distribRatio, 1)}%</div>
                        <div className="text-[8px] text-zinc-600 font-mono">colocação ativa</div>
                      </div>
                    </div>
                  </div>
                )}

                {sectionVisible("pipeline") && stats && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {stats.by_tipo_ativo.map((t, i) => (
                      <div
                        key={t.tipo}
                        className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4 hover:border-[#0B6C3E]/30 transition-colors cursor-pointer"
                        onClick={() => {
                          setExTipoAtivo(t.tipo);
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
                          {formatBRL(t.valor)}
                        </div>
                        <div className="text-[9px] font-mono text-zinc-500 mt-1">
                          {formatCount(t.count)} ofertas
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
                      {(() => {
                        const segValues = stats.by_segmento.map((x) => x.valor).filter((v) => Number.isFinite(v) && v > 0);
                        const max = segValues.length > 0 ? Math.max(...segValues) : 0;
                        return stats.by_segmento.slice(0, 10).map((s) => {
                          const pct = max > 0 ? (s.valor / max) * 100 : 0;
                          return (
                          <div key={s.segmento} className="space-y-0.5">
                            <div className="flex justify-between text-[10px] font-mono">
                              <span className="text-zinc-400 truncate max-w-[60%]">{s.segmento}</span>
                              <span className="text-zinc-300">
                                {formatBRL(s.valor)} · {formatCount(s.count)}
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
                        });
                      })()}
                    </div>
                  </div>
                )}
              </div>
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
              <div className="space-y-6">
                {/* Explorer summary card */}
                {explorerSummary && (
                  <div className="bg-[#111111] border border-[#0B6C3E]/20 rounded-lg p-4 flex flex-wrap gap-6 items-center">
                    <div>
                      <span className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono block">Resultados</span>
                      <span className="text-lg font-bold text-zinc-100 font-mono">{formatCount(explorerSummary.count)}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono block">Volume Total</span>
                      <span className="text-lg font-bold text-[#0B6C3E] font-mono">{formatBRL(explorerSummary.totalValor)}</span>
                    </div>
                    {explorerSummary.topStatus && (
                      <div>
                        <span className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono block">Status Dominante</span>
                        <span className="text-sm font-mono text-zinc-300">
                          {STATUS_COLORS[explorerSummary.topStatus[0]]?.label ?? explorerSummary.topStatus[0]} ({formatCount(explorerSummary.topStatus[1])})
                        </span>
                      </div>
                    )}
                  </div>
                )}

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
                      value={exTipoAtivo}
                      onChange={(e) => {
                        setExTipoAtivo(e.target.value);
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
                      value={exStatus}
                      onChange={(e) => {
                        setExStatus(e.target.value);
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
                      value={exModalidade}
                      onChange={(e) => {
                        setExModalidade(e.target.value);
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
                    <div className="flex-1 text-right text-[9px] font-mono text-zinc-600 flex items-center justify-end gap-3">
                      <span>{formatCount(listData?.count ?? 0)} ofertas encontradas</span>
                      <ExportButton onClick={handleExportExplorer} disabled={!listData?.ofertas.length} />
                    </div>
                  </div>
                </div>

                {/* Results table */}
                <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg overflow-x-auto">
                  <table className="w-full min-w-[800px]">
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
                        <th className="px-2 py-2 w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {listLoading ? (
                        Array.from({ length: 8 }).map((_, i) => (
                          <SkeletonTableRow key={i} cols={8} />
                        ))
                      ) : listData?.ofertas.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12">
                            <EmptyState variant="no-results" />
                          </td>
                        </tr>
                      ) : (
                        listData?.ofertas.map((o) => (
                          <tr
                            key={o.id}
                            className="border-b border-[#1a1a1a] hover:bg-[#0a0a0a] transition-colors cursor-pointer"
                            onClick={() => setSelectedOferta(o)}
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
                              {formatBRL(o.valor_total)}
                              {o.volume_final && (
                                <div className="text-[9px] text-zinc-500 mt-0.5">
                                  Final: {formatBRL(o.volume_final)}
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
                            <td className="px-2 py-2.5">
                              <Eye className="w-3 h-3 text-zinc-700 group-hover:text-zinc-400 transition-colors" />
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
                  Fonte: CVM (SRE — Ofertas Públicas) · Atualização semanal via pipeline automatizado
                  {stats && (
                    <span className="ml-2 text-zinc-700">
                      · {formatCount(stats.total_ofertas)} registros
                    </span>
                  )}
                </div>
              </div>
            </SectionErrorBoundary>
          </MacroSection>

          {/* === SECTION 5: Analytics === */}
          <MacroSection
            ref={(el) => {
              sectionRefs.current["analytics"] = el;
            }}
            id="analytics"
            title="Analytics"
            icon={Brain}
          >
            <SectionErrorBoundary sectionName="Analytics Ofertas">
              <div className="space-y-6">
                {/* Narrative Intelligence Panel */}
                {stats && timelineData?.timeline && (
                  <OfertasNarrativePanel
                    totalOfertas={stats.total_ofertas}
                    totalValor={stats.total_valor}
                    emAnalise={stats.em_analise}
                    emDistribuicao={stats.em_distribuicao}
                    timeline={timelineData.timeline}
                    byTipoAtivo={stats.by_tipo_ativo}
                    byStatus={stats.by_status}
                    bySegmento={stats.by_segmento}
                  />
                )}

                {/* Concentration Matrix: top emissores from Explorer data */}
                {listData && listData.ofertas.length > 0 && (
                  <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono flex items-center gap-2">
                        <Building2 className="w-3 h-3" />
                        Top Emissores por Volume
                      </h3>
                      <ExportButton onClick={handleExportTopEmissores} disabled={!listData?.ofertas.length} />
                    </div>
                    <div className="space-y-2">
                      {topEmissores.map((em, i) => (
                        <div key={em.nome + i} className="space-y-0.5">
                          <div className="flex justify-between text-[10px] font-mono">
                            <span className="text-zinc-400 truncate max-w-[50%]">{em.nome}</span>
                            <span className="text-zinc-300">
                              {formatBRL(em.valor)} · {formatCount(em.count)} ofertas · {fmtNum(em.pct, 1)}%
                            </span>
                          </div>
                          <div className="h-1.5 bg-[#0a0a0a] rounded overflow-hidden">
                            <div
                              className="h-full bg-[#0B6C3E]/70 rounded"
                              style={{ width: `${em.barW}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Coordenadores Líderes: leading coordinators by volume, count, and distinct emissores */}
                {listData && listData.ofertas.length > 0 && (
                  <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
                    <h3 className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-3 flex items-center gap-2">
                      <Building2 className="w-3 h-3" />
                      Coordenadores Líderes
                    </h3>
                    <div className="space-y-2">
                      {topCoordenadores.map((coord, i) => (
                        <div key={coord.nome + i} className="space-y-0.5">
                          <div className="flex justify-between text-[10px] font-mono">
                            <span className="text-zinc-400 truncate max-w-[50%]">{coord.nome}</span>
                            <span className="text-zinc-300">
                              {formatBRL(coord.valor)} · {formatCount(coord.count)} ofertas · {formatCount(coord.emissorCount)} emissores · {fmtNum(coord.pct, 1)}%
                            </span>
                          </div>
                          <div className="h-1.5 bg-[#0a0a0a] rounded overflow-hidden">
                            <div
                              className="h-full bg-[#0B6C3E]/70 rounded"
                              style={{ width: `${coord.barW}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Class evolution: mini sparklines per tipo_ativo from timeline */}
                {timelineData?.timeline && timelineData.timeline.length > 0 && stats && (
                  <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
                    <h3 className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-3 flex items-center gap-2">
                      <BarChart3 className="w-3 h-3" />
                      Composição do Volume por Classe
                    </h3>
                    <p className="text-[10px] text-zinc-500 font-mono mb-3">
                      Distribuição das {stats.by_tipo_ativo.length} classes ativas — proporção relativa do volume total.
                    </p>
                    <div className="space-y-3">
                      {stats.by_tipo_ativo.map((t, i) => {
                        const share = stats.total_valor > 0 ? (t.valor / stats.total_valor) * 100 : 0;
                        return (
                          <div key={t.tipo} className="space-y-1">
                            <div className="flex items-center justify-between text-[10px] font-mono">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                <span className="text-zinc-300">{t.tipo}</span>
                              </div>
                              <div className="flex items-center gap-3 text-zinc-400">
                                <span>{formatCount(t.count)} ofertas</span>
                                <span className="text-zinc-200">{formatBRL(t.valor)}</span>
                                <span className="w-12 text-right text-zinc-500">{fmtNum(share, 1)}%</span>
                              </div>
                            </div>
                            <div className="h-2 bg-[#0a0a0a] rounded overflow-hidden">
                              <div
                                className="h-full rounded transition-all"
                                style={{ width: `${share}%`, backgroundColor: COLORS[i % COLORS.length] + "CC" }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="text-[9px] text-zinc-600 font-mono flex items-center gap-1">
                  <Brain className="w-3 h-3" />
                  Analytics computados a partir dos dados ingeridos via pipeline CVM. Regime e sinais atualizados automaticamente.
                </div>
              </div>
            </SectionErrorBoundary>
          </MacroSection>
        </div>
      </div>

      {/* ─── Oferta Detail Drawer ─── */}
      {selectedOferta && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          onClick={() => setSelectedOferta(null)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="relative w-full max-w-lg bg-[#0a0a0a] border-l border-[#1a1a1a] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-[#0a0a0a]/95 backdrop-blur border-b border-[#1a1a1a] px-6 py-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-200 font-mono">Detalhe da Oferta</h2>
              <button
                onClick={() => setSelectedOferta(null)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors text-lg"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Emissor + Status */}
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Building2 className="w-5 h-5 text-[#0B6C3E]" />
                  <h3 className="text-base font-semibold text-zinc-100">{selectedOferta.emissor_nome}</h3>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <StatusBadge status={selectedOferta.status} />
                  <span className="text-[10px] font-mono text-zinc-500">{selectedOferta.tipo_oferta}</span>
                  {selectedOferta.modalidade && (
                    <span className="text-[10px] font-mono text-zinc-600">· {selectedOferta.modalidade}</span>
                  )}
                </div>
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-3">
                  <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-1">Classe</div>
                  <div className="text-sm font-mono text-zinc-200">{selectedOferta.tipo_ativo}</div>
                </div>
                <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-3">
                  <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-1">Valor Protocolado</div>
                  <div className="text-sm font-mono text-[#0B6C3E]">{formatBRL(selectedOferta.valor_total)}</div>
                </div>
                {selectedOferta.volume_final && (
                  <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-3">
                    <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-1">Volume Final</div>
                    <div className="text-sm font-mono text-emerald-400">{formatBRL(selectedOferta.volume_final)}</div>
                  </div>
                )}
                {selectedOferta.rating && (
                  <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-3">
                    <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-1">Rating</div>
                    <div className="text-sm font-mono text-cyan-400">{selectedOferta.rating}</div>
                  </div>
                )}
              </div>

              {/* Datas */}
              <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4 space-y-2">
                <h4 className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-2">Cronologia</h4>
                {[
                  { label: "Protocolo", date: selectedOferta.data_protocolo },
                  { label: "Registro", date: selectedOferta.data_registro },
                  { label: "Início distribuição", date: selectedOferta.data_inicio },
                  { label: "Encerramento", date: selectedOferta.data_encerramento },
                ].map(
                  (item) =>
                    item.date && (
                      <div key={item.label} className="flex justify-between text-[10px] font-mono">
                        <span className="text-zinc-500">{item.label}</span>
                        <span className="text-zinc-300">{formatDate(item.date)}</span>
                      </div>
                    )
                )}
              </div>

              {/* Info adicional */}
              <div className="space-y-3">
                {selectedOferta.coordenador_lider && (
                  <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-3">
                    <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-1">Coordenador Líder</div>
                    <div className="text-[11px] font-mono text-zinc-300">{selectedOferta.coordenador_lider}</div>
                  </div>
                )}
                {selectedOferta.serie && (
                  <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-3">
                    <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-1">Série</div>
                    <div className="text-[11px] font-mono text-zinc-300">{selectedOferta.serie}</div>
                  </div>
                )}
                {selectedOferta.segmento && (
                  <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-3">
                    <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-1">Segmento</div>
                    <div className="text-[11px] font-mono text-zinc-300">{selectedOferta.segmento}</div>
                  </div>
                )}
                {selectedOferta.observacoes && (
                  <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-3">
                    <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-1">Observações</div>
                    <div className="text-[10px] font-mono text-zinc-400 leading-relaxed">{selectedOferta.observacoes}</div>
                  </div>
                )}
              </div>

              {/* CNPJ + protocolo */}
              <div className="pt-2 border-t border-[#1a1a1a] space-y-1">
                <div className="flex justify-between text-[9px] font-mono text-zinc-600">
                  <span>CNPJ Emissor</span>
                  <span className="text-zinc-500">{selectedOferta.emissor_cnpj}</span>
                </div>
                <div className="flex justify-between text-[9px] font-mono text-zinc-600">
                  <span>Protocolo</span>
                  <span className="text-zinc-500">{selectedOferta.protocolo}</span>
                </div>
                {selectedOferta.numero_oferta && (
                  <div className="flex justify-between text-[9px] font-mono text-zinc-600">
                    <span>Nº Oferta</span>
                    <span className="text-zinc-500">{selectedOferta.numero_oferta}</span>
                  </div>
                )}
                {selectedOferta.source_url && (
                  <a
                    href={selectedOferta.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[9px] font-mono text-[#0B6C3E] hover:text-emerald-400 transition-colors mt-2"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Ver no site da CVM
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
