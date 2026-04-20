import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { useDebouncedValue } from "@/hooks/useDebounce";
import { LayoutGrid, Zap, Search, BarChart3 } from "lucide-react";
import { Breadcrumbs } from "@/components/hub/Breadcrumbs";
import { DataAsOfStamp } from "@/components/hub/DataAsOfStamp";
import { HubSEO } from "@/lib/seo";
import { PercentTooltip } from "@/components/hub/ChartTooltip";
import { motion } from "framer-motion";
import { exportCsv, csvFilename } from "@/lib/csvExport";
import { ExportButton } from "@/components/hub/ExportButton";

import {
  useFidcV4Overview, useFidcV4Rankings, useFidcSegments,
  formatPL,
} from "@/hooks/useHubFundos";
import { MacroSection, MacroSidebar } from "@/components/hub/MacroSection";
import { SectionErrorBoundary } from "@/components/hub/SectionErrorBoundary";
import { SkeletonKPI, SkeletonTableRow } from "@/components/hub/SkeletonLoader";
import { EmptyState } from "@/components/hub/EmptyState";
import { SimpleKPICard as KPICard } from "@/components/hub/KPICard";
import { SegmentStoryCard } from "@/components/hub/SegmentStoryCard";
import { NarrativeSection, type MiniStat } from "@/components/hub/NarrativeSection";
import { pickFromList, toInt, toSortOrder, toSearchQuery } from "@/lib/queryParams";

const SECTIONS = [
  { id: "overview", label: "Visão Geral", icon: LayoutGrid },
  { id: "explorar", label: "Explorar", icon: Search },
  { id: "segmentos", label: "Segmentos", icon: BarChart3 },
];

const SECTION_IDS = SECTIONS.map((s) => s.id);
const ORDER_BY_FIELDS = [
  "vl_pl_total",
  "indice_subordinacao",
  "taxa_inadimplencia",
  "rentab_senior",
  "rentab_fundo",
  "indice_pdd_cobertura",
  "nr_cedentes",
] as const;

/** FidcHub Component */
export default function FidcHub() {
  /* ─── Deep-linking: section + filters/sort from URL (P2-8 URL persistence, sanitized) ─── */
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeSection, setActiveSection] = useState<string>(
    () => pickFromList(searchParams.get("section"), SECTION_IDS, "overview")
  );
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  /* ─── Lazy-load: track which sections have been visible ─── */
  const [visitedSections, setVisitedSections] = useState<Set<string>>(
    () => new Set(["overview"])
  );

  const sectionVisible = useCallback((id: string) => visitedSections.has(id), [visitedSections]);

  /* ─── Screener Filters (hydrated from URL, sanitized) ─── */
  const [selectedLastro, setSelectedLastro] = useState<string | null>(
    () => {
      const raw = toSearchQuery(searchParams.get("lastro"), 80);
      return raw || null;
    }
  );
  const [minPl, setMinPl] = useState<number>(
    () => toInt(searchParams.get("min_pl"), { min: 0, max: 1_000_000_000, fallback: 0 })
  );
  const [maxInadim, setMaxInadim] = useState<number>(
    () => toInt(searchParams.get("max_inadim"), { min: 0, max: 100, fallback: 100 })
  );
  const [minSubord, setMinSubord] = useState<number>(
    () => toInt(searchParams.get("min_subord"), { min: 0, max: 100, fallback: 0 })
  );
  const [searchQuery, setSearchQuery] = useState<string>(
    () => toSearchQuery(searchParams.get("q"), 100)
  );
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  /* ─── Rankings Sorting (hydrated from URL, sanitized) ─── */
  const [rankingOrderBy, setRankingOrderBy] = useState<string>(
    () => pickFromList(searchParams.get("orderBy"), ORDER_BY_FIELDS, "vl_pl_total")
  );
  const [rankingOrder, setRankingOrder] = useState<string>(
    () => toSortOrder(searchParams.get("order"), "desc")
  );
  const [rankingPage, setRankingPage] = useState<number>(
    () => toInt(searchParams.get("page"), { min: 0, max: 9999, fallback: 0 })
  );

  /* ─── Sync state → URL (replace, no-op for defaults) ─── */
  useEffect(() => {
    const next: Record<string, string> = {};
    if (activeSection !== "overview") next.section = activeSection;
    if (rankingOrderBy !== "vl_pl_total") next.orderBy = rankingOrderBy;
    if (rankingOrder !== "desc") next.order = rankingOrder;
    if (rankingPage !== 0) next.page = String(rankingPage);
    if (selectedLastro) next.lastro = selectedLastro;
    if (minPl > 0) next.min_pl = String(minPl);
    if (maxInadim < 100) next.max_inadim = String(maxInadim);
    if (minSubord > 0) next.min_subord = String(minSubord);
    if (debouncedSearch) next.q = debouncedSearch;
    setSearchParams(next, { replace: true });
  }, [
    activeSection,
    rankingOrderBy,
    rankingOrder,
    rankingPage,
    selectedLastro,
    minPl,
    maxInadim,
    minSubord,
    debouncedSearch,
    setSearchParams,
  ]);

  /* ─── Data: Overview ─── */
  const { data: overviewData } = useFidcV4Overview();

  /* ─── Data: Segments ─── */
  const { data: segmentsData } = useFidcSegments();
  const segments = segmentsData?.segments || [];

  /* ─── Data: Rankings (lazy) — unified for Explorar section ─── */
  const { data: rankingsData, isLoading: rankingsLoading } = useFidcV4Rankings(
    {
      orderBy: rankingOrderBy,
      order: rankingOrder,
      limit: 50,
      offset: rankingPage * 50,
      lastro: selectedLastro || undefined,
      minPl: minPl > 0 ? minPl : undefined,
      maxInadim: maxInadim < 100 ? maxInadim : undefined,
      minSubord: minSubord > 0 ? minSubord : undefined,
      search: debouncedSearch || undefined,
      enabled: sectionVisible("explorar"),
    }
  );
  const rankingsFunds = rankingsData?.funds || [];

  /* ─── Pie Chart Data ─── */
  const pieData = useMemo(() => {
    if (!overviewData?.by_lastro) return [];
    return overviewData.by_lastro.map((item) => ({
      name: item.lastro,
      value: parseFloat((item.pct_pl * 100).toFixed(1)),
      pl: item.pl,
    }));
  }, [overviewData]);

  const COLORS = ["#0B6C3E", "#F59E0B", "#8B5CF6", "#3B82F6", "#EC4899", "#F97316", "#06B6D4", "#10B981"];

  /* ─── CSV Export Handler ─── */
  const handleExportRankings = useCallback(() => {
    const csvData = rankingsFunds.map((fund) => ({
      nome: fund.denom_social || `FIDC ${fund.cnpj_fundo_classe}`,
      cnpj: fund.cnpj_fundo_classe || "—",
      lastro: fund.tp_lastro_principal || "—",
      pl: fund.vl_pl_total || 0,
      subordinacao: fund.indice_subordinacao != null ? fund.indice_subordinacao : 0,
      inadimplencia: fund.taxa_inadimplencia != null ? fund.taxa_inadimplencia : 0,
      rentab_senior: fund.rentab_senior != null && Math.abs(fund.rentab_senior) <= 95 ? fund.rentab_senior : 0,
    }));

    exportCsv(
      csvData,
      [
        { header: "Nome", accessor: (r) => r.nome },
        { header: "CNPJ", accessor: (r) => r.cnpj },
        { header: "Lastro", accessor: (r) => r.lastro },
        { header: "PL (R$ Milhões)", accessor: (r) => (r.pl / 1_000_000).toFixed(2) },
        { header: "Subordinação %", accessor: (r) => r.subordinacao.toFixed(2) },
        { header: "Inadimplência %", accessor: (r) => r.inadimplencia.toFixed(2) },
        { header: "Rentab. Senior %", accessor: (r) => r.rentab_senior.toFixed(2) },
      ],
      csvFilename("fidc", "rankings")
    );
  }, [rankingsFunds]);

  /* ─── Narrative Analytics (regime + derived KPIs) ─── */
  const narrativeOverview = useMemo(() => {
    if (!overviewData) return null;

    // Benchmark CDI (compound monthly from Selic)
    const SELIC_ANNUAL = 14.15;
    const cdiMonthly = (Math.pow(1 + SELIC_ANNUAL / 100, 1 / 12) - 1) * 100;
    const avgRentab = overviewData.avg_rentab_senior ?? 0;
    const spread = avgRentab - cdiMonthly;

    // Concentration: HHI on PL share by lastro
    const byLastro = overviewData.by_lastro ?? [];
    const totalPl = overviewData.total_pl ?? 0;
    const shares = byLastro
      .map((s) => (totalPl > 0 ? s.pl / totalPl : 0))
      .filter((x) => x > 0);
    const hhi = shares.reduce((acc, s) => acc + s * s, 0);
    const hhiPct = (hhi * 10000).toFixed(0); // 0-10000 scale
    const topSegment = byLastro.length
      ? [...byLastro].sort((a, b) => b.pl - a.pl)[0]
      : null;
    const topShare = topSegment && totalPl > 0 ? (topSegment.pl / totalPl) * 100 : 0;

    // Risk regime (subordinação vs inadimplência)
    const subordAvg = overviewData.avg_subordinacao ?? 0;
    const inadimAvg = overviewData.avg_inadimplencia ?? 0;
    const regime =
      inadimAvg > 5 && subordAvg < 10
        ? { label: "Stress Sistêmico", color: "text-red-400" }
        : inadimAvg > 5
        ? { label: "Risco Elevado", color: "text-red-400" }
        : subordAvg < 10
        ? { label: "Subordinação Baixa", color: "text-amber-400" }
        : { label: "Equilibrado", color: "text-emerald-400" };

    // Cushion ratio (subord vs inadim) — margin de segurança
    const cushion = inadimAvg > 0 ? subordAvg / inadimAvg : null;

    return {
      avgRentab,
      cdiMonthly,
      spread,
      spreadColor:
        spread > 0.5
          ? "text-emerald-400"
          : spread > 0
          ? "text-zinc-300"
          : "text-red-400",
      spreadSentiment:
        spread > 0.5 ? "acima" : spread > 0 ? "alinhada" : "abaixo",
      hhi,
      hhiPct,
      hhiColor:
        hhi > 0.25
          ? "text-red-400"
          : hhi > 0.15
          ? "text-amber-400"
          : "text-emerald-400",
      topSegment: topSegment?.lastro ?? "—",
      topShare,
      regime,
      cushion,
    };
  }, [overviewData]);

  const overviewMiniStats = useMemo<MiniStat[]>(() => {
    if (!narrativeOverview || !overviewData) return [];
    return [
      {
        label: "Regime FIDC",
        value: narrativeOverview.regime.label,
        sublabel: `${narrativeOverview.avgRentab.toFixed(2)}% rentab senior`,
        color: narrativeOverview.regime.color,
        tooltip: "Regime inferido de subordinação × inadimplência média do mercado",
      },
      {
        label: "Spread vs CDI",
        value: `${narrativeOverview.spread > 0 ? "+" : ""}${narrativeOverview.spread.toFixed(2)}pp`,
        sublabel: `CDI ~${narrativeOverview.cdiMonthly.toFixed(2)}%`,
        color: narrativeOverview.spreadColor,
      },
      {
        label: "Concentração (HHI)",
        value: narrativeOverview.hhiPct,
        sublabel:
          narrativeOverview.hhi > 0.25
            ? "Alta"
            : narrativeOverview.hhi > 0.15
            ? "Moderada"
            : "Dispersa",
        color: narrativeOverview.hhiColor,
        tooltip: "Herfindahl-Hirschman Index sobre PL por lastro (0-10000)",
      },
      {
        label: "Lastro Líder",
        value: narrativeOverview.topSegment,
        sublabel: `${narrativeOverview.topShare.toFixed(1)}% do PL agregado`,
        color: "text-zinc-200",
      },
      {
        label: "Cushion Subord/Inadim",
        value:
          narrativeOverview.cushion != null
            ? `${narrativeOverview.cushion.toFixed(1)}×`
            : "—",
        sublabel:
          narrativeOverview.cushion != null && narrativeOverview.cushion < 2
            ? "Colchão curto"
            : "Colchão confortável",
        color:
          narrativeOverview.cushion != null && narrativeOverview.cushion < 2
            ? "text-red-400"
            : "text-emerald-400",
        tooltip: "Subordinação média ÷ Inadimplência média (quanto maior, melhor)",
      },
      {
        label: "Segmentos Ativos",
        value: String(overviewData.by_lastro?.length ?? 0),
        sublabel: `${overviewData.total_fidcs} FIDCs mapeados`,
        color: "text-zinc-200",
      },
    ];
  }, [narrativeOverview, overviewData]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] w-full">
      <HubSEO
        title="FIDC Deep Module"
        description="Inteligência completa de FIDCs: rankings sortable, screener multi-filtro, análise de subordinação e inadimplência, breakdown por lastro. Dados CVM RCVM 175."
        path="/fundos/fidc"
        keywords="FIDC, fundos de direitos creditórios, subordinação, inadimplência, lastro, CVM RCVM 175, ranking FIDC"
        isProtected={true}
      />
      {/* Sidebar Navigation */}
      <MacroSidebar
        items={SECTIONS}
        activeId={activeSection}
        onNavigate={(id: string) => {
          setActiveSection(id);
          const ref = sectionRefs.current[id];
          if (ref) ref.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />

      <div className="flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-[#0a0a0a]/95 backdrop-blur border-b border-[#1a1a1a] px-4 md:px-8 py-4">
          <Breadcrumbs
            items={[
              { label: "Fundos", to: "/fundos" },
              { label: "FIDC" },
            ]}
            className="mb-2"
          />
          <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#0B6C3E]" />
            Módulo FIDC
          </h1>
          <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
            <p className="text-[9px] text-zinc-500 font-mono">Crédito. Inovação. Inteligência.</p>
            <DataAsOfStamp
              date={overviewData?.date}
              cadence="monthly"
              source="CVM Informe FIDC"
            />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 px-4 md:px-8 py-8 space-y-8">
          {/* === SECTION 1: Visão Geral === */}
          <MacroSection ref={(el) => { sectionRefs.current["overview"] = el; }} id="overview" title="Visão Geral" icon={LayoutGrid}>
            <SectionErrorBoundary sectionName="Visão Geral FIDC">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                onViewportEnter={() => setVisitedSections((s) => new Set(s).add("overview"))}
                className="space-y-6"
              >
                {narrativeOverview && overviewData ? (
                  <NarrativeSection
                    accent="#F97316"
                    prose={
                      <>
                        Mercado de FIDCs em regime{" "}
                        <span className={narrativeOverview.regime.color}>
                          {narrativeOverview.regime.label.toLowerCase()}
                        </span>
                        : rentabilidade média senior de{" "}
                        <span className="text-zinc-200">
                          {narrativeOverview.avgRentab.toFixed(2)}%
                        </span>{" "}
                        no mês, spread{" "}
                        <span className={narrativeOverview.spreadColor}>
                          {narrativeOverview.spread > 0 ? "+" : ""}
                          {narrativeOverview.spread.toFixed(2)}pp vs CDI
                        </span>{" "}
                        ({narrativeOverview.spreadSentiment} do benchmark). Concentração por
                        lastro <span className={narrativeOverview.hhiColor}>HHI {narrativeOverview.hhiPct}</span> —
                        lastro líder <span className="text-zinc-200">{narrativeOverview.topSegment}</span> com{" "}
                        <span className="text-zinc-200">{narrativeOverview.topShare.toFixed(1)}%</span> do PL agregado.
                      </>
                    }
                    miniStats={overviewMiniStats}
                  >
                    {/* KPIs principais */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <KPICard
                        label="Total FIDCs"
                        value={String(overviewData.total_fidcs)}
                        color="text-zinc-300"
                      />
                      <KPICard
                        label="PL Agregado"
                        value={formatPL(overviewData.total_pl)}
                        color="text-[#F97316]"
                      />
                      <KPICard
                        label="Subordinação Média"
                        value={overviewData.avg_subordinacao?.toFixed(2) || "—"}
                        unit="%"
                        color={overviewData.avg_subordinacao && overviewData.avg_subordinacao < 10 ? "text-red-400" : "text-emerald-400"}
                      />
                      <KPICard
                        label="Inadimplência Média"
                        value={overviewData.avg_inadimplencia?.toFixed(2) || "—"}
                        unit="%"
                        color={overviewData.avg_inadimplencia && overviewData.avg_inadimplencia > 5 ? "text-red-400" : "text-emerald-400"}
                      />
                    </div>
                  </NarrativeSection>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                      <SkeletonKPI key={i} />
                    ))}
                  </div>
                )}

                {/* Pie Chart: Distribuição por Lastro — external legend */}
                {pieData.length > 0 && (
                  <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-6">
                    <h3 className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-4">Distribuição de PL por Lastro</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={80}
                          dataKey="value"
                          stroke="#0a0a0a"
                          strokeWidth={2}
                        >
                          {pieData.map((_entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<PercentTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-3 space-y-1.5">
                      {pieData.map((entry, index) => (
                        <div key={entry.name} className="flex items-center justify-between text-[10px] font-mono">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                            <span className="text-zinc-400 truncate">{entry.name}</span>
                          </div>
                          <span className="text-zinc-300">{entry.value}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </SectionErrorBoundary>
          </MacroSection>

          {/* === SECTION 2: Explorar (Rankings + Screener unificados) === */}
          <MacroSection ref={(el) => { sectionRefs.current["explorar"] = el; }} id="explorar" title="Explorar" icon={Search}>
            <SectionErrorBoundary sectionName="Explorar FIDC">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                onViewportEnter={() => setVisitedSections((s) => new Set(s).add("explorar"))}
                className="space-y-6"
              >
                {/* Top bar: result count + export */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-[9px] text-zinc-500 font-mono">
                    {rankingsData?.count != null ? (
                      <>
                        <span className="text-zinc-300 font-semibold">{rankingsData.count}</span>{" "}
                        {rankingsData.count === 1 ? "FIDC encontrado" : "FIDCs encontrados"}
                      </>
                    ) : (
                      "—"
                    )}
                  </div>
                  <ExportButton onClick={handleExportRankings} label="CSV" disabled={rankingsFunds.length === 0} />
                </div>

                {/* Segment chips (lastro filter) */}
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => { setSelectedLastro(null); setRankingPage(0); }}
                    className={`px-3 py-1.5 text-[9px] font-mono rounded border transition-all ${
                      selectedLastro === null
                        ? "bg-[#0B6C3E] text-white border-[#0B6C3E]"
                        : "bg-[#111111] text-zinc-400 border-[#1a1a1a] hover:border-[#0B6C3E]/30"
                    }`}
                  >
                    Todos
                  </button>
                  {segments.map((seg) => (
                    <button
                      key={seg.lastro}
                      onClick={() => { setSelectedLastro(seg.lastro); setRankingPage(0); }}
                      className={`px-3 py-1.5 text-[9px] font-mono rounded border transition-all ${
                        selectedLastro === seg.lastro
                          ? "bg-[#0B6C3E] text-white border-[#0B6C3E]"
                          : "bg-[#111111] text-zinc-400 border-[#1a1a1a] hover:border-[#0B6C3E]/30"
                      }`}
                    >
                      {seg.lastro} ({seg.count})
                    </button>
                  ))}
                </div>

                {/* Unified filter grid: search + numeric filters + sort */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                  {/* Search (2 cols) */}
                  <div className="col-span-2">
                    <label className="block text-[9px] text-zinc-600 uppercase tracking-wider mb-1.5 font-mono">
                      Buscar por Nome
                    </label>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setRankingPage(0); }}
                      placeholder="Digite o nome do FIDC..."
                      className="w-full px-3 py-2 text-[9px] font-mono bg-[#111111] border border-[#1a1a1a] rounded text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-[#0B6C3E]"
                    />
                  </div>

                  {/* Min PL */}
                  <div>
                    <label className="block text-[9px] text-zinc-600 uppercase tracking-wider mb-1.5 font-mono">
                      PL Mín.
                    </label>
                    <input
                      type="number"
                      value={minPl}
                      onChange={(e) => { setMinPl(Number(e.target.value)); setRankingPage(0); }}
                      placeholder="mi"
                      className="w-full px-3 py-2 text-[9px] font-mono bg-[#111111] border border-[#1a1a1a] rounded text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-[#0B6C3E]"
                    />
                  </div>

                  {/* Max Inadimplência */}
                  <div>
                    <label className="block text-[9px] text-zinc-600 uppercase tracking-wider mb-1.5 font-mono">
                      Max Inadim %
                    </label>
                    <input
                      type="number"
                      value={maxInadim}
                      onChange={(e) => { setMaxInadim(Number(e.target.value)); setRankingPage(0); }}
                      min={0}
                      max={100}
                      className="w-full px-3 py-2 text-[9px] font-mono bg-[#111111] border border-[#1a1a1a] rounded text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-[#0B6C3E]"
                    />
                  </div>

                  {/* Min Subordinação */}
                  <div>
                    <label className="block text-[9px] text-zinc-600 uppercase tracking-wider mb-1.5 font-mono">
                      Min Subord %
                    </label>
                    <input
                      type="number"
                      value={minSubord}
                      onChange={(e) => { setMinSubord(Number(e.target.value)); setRankingPage(0); }}
                      min={0}
                      className="w-full px-3 py-2 text-[9px] font-mono bg-[#111111] border border-[#1a1a1a] rounded text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-[#0B6C3E]"
                    />
                  </div>

                  {/* Sort */}
                  <div>
                    <label className="block text-[9px] text-zinc-600 uppercase tracking-wider mb-1.5 font-mono">
                      Ordenar
                    </label>
                    <div className="flex gap-1">
                      <select
                        value={rankingOrderBy}
                        onChange={(e) => { setRankingOrderBy(e.target.value); setRankingPage(0); }}
                        className="flex-1 px-2 py-2 text-[9px] font-mono bg-[#111111] border border-[#1a1a1a] rounded text-zinc-300 hover:border-[#0B6C3E]/30 focus:outline-none focus:border-[#0B6C3E]"
                      >
                        <option value="vl_pl_total">PL</option>
                        <option value="indice_subordinacao">Subord.</option>
                        <option value="taxa_inadimplencia">Inadim.</option>
                        <option value="rentab_senior">Rentab. Senior</option>
                        <option value="rentab_fundo">Rentab. Fundo</option>
                        <option value="indice_pdd_cobertura">PDD Cobertura</option>
                        <option value="nr_cedentes">Cedentes</option>
                      </select>
                      <button
                        onClick={() => setRankingOrder(rankingOrder === "desc" ? "asc" : "desc")}
                        className="px-2 py-2 text-[9px] font-mono bg-[#111111] border border-[#1a1a1a] rounded text-zinc-300 hover:border-[#0B6C3E]/30 transition-colors"
                        title={rankingOrder === "desc" ? "Descendente" : "Ascendente"}
                      >
                        {rankingOrder === "desc" ? "↓" : "↑"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Unified results table */}
                <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-[9px] font-mono">
                      <thead className="border-b border-[#1a1a1a] bg-[#0a0a0a]">
                        <tr>
                          <th className="px-4 py-2 text-left text-zinc-600">#</th>
                          <th className="px-4 py-2 text-left text-zinc-600">Nome</th>
                          <th className="px-4 py-2 text-right text-zinc-600">PL</th>
                          <th className="px-4 py-2 text-right text-zinc-600">Subordinação</th>
                          <th className="px-4 py-2 text-right text-zinc-600">Inadimplência</th>
                          <th className="px-4 py-2 text-right text-zinc-600">Rentab. Senior</th>
                          <th className="px-4 py-2 text-center text-zinc-600">Lastro</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rankingsLoading ? (
                          <>
                            {Array.from({ length: 5 }).map((_, i) => (
                              <tr key={i}><td colSpan={7}><SkeletonTableRow cols={7} /></td></tr>
                            ))}
                          </>
                        ) : rankingsFunds.length === 0 ? (
                          <tr>
                            <td colSpan={7}>
                              <EmptyState variant="no-funds" description="Nenhum FIDC encontrado com os filtros selecionados." />
                            </td>
                          </tr>
                        ) : (
                          rankingsFunds.map((fund, idx) => (
                            <tr
                              key={`${fund.cnpj_fundo_classe}-${idx}`}
                              className="border-t border-[#1a1a1a] hover:bg-[#0a0a0a]/50 transition-colors"
                            >
                              <td className="px-4 py-2 text-zinc-600">{rankingPage * 50 + idx + 1}</td>
                              <td className="px-4 py-2">
                                <Link
                                  to={`/fundos/fidc/${fund.slug || fund.cnpj_fundo_classe}`}
                                  className="text-[#0B6C3E] hover:underline truncate max-w-xs"
                                >
                                  {fund.denom_social || `FIDC ${fund.cnpj_fundo_classe}`}
                                </Link>
                              </td>
                              <td className="px-4 py-2 text-right text-zinc-300">{formatPL(fund.vl_pl_total)}</td>
                              <td className="px-4 py-2 text-right">
                                <span className={fund.indice_subordinacao && fund.indice_subordinacao < 10 ? "text-red-400" : "text-emerald-400"}>
                                  {fund.indice_subordinacao?.toFixed(2) || "—"}%
                                </span>
                              </td>
                              <td className="px-4 py-2 text-right">
                                <span className={fund.taxa_inadimplencia && fund.taxa_inadimplencia > 5 ? "text-red-400" : "text-emerald-400"}>
                                  {fund.taxa_inadimplencia?.toFixed(2) || "—"}%
                                </span>
                              </td>
                              <td className="px-4 py-2 text-right text-zinc-300">
                                {fund.rentab_senior != null && Math.abs(fund.rentab_senior) <= 95
                                  ? `${fund.rentab_senior.toFixed(2)}%`
                                  : "—"}
                              </td>
                              <td className="px-4 py-2 text-center text-zinc-400 text-[8px] truncate max-w-[120px]">
                                {fund.tp_lastro_principal || "—"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {rankingsFunds.length > 0 && (
                    <div className="border-t border-[#1a1a1a] px-4 py-3 flex justify-between items-center text-[8px]">
                      <span className="text-zinc-600">
                        Exibindo {rankingPage * 50 + 1}-{Math.min((rankingPage + 1) * 50, (rankingsData?.count || 0))} de {rankingsData?.count || 0}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setRankingPage(Math.max(0, rankingPage - 1))}
                          disabled={rankingPage === 0}
                          className="px-2 py-1 bg-[#0B6C3E]/20 text-[#0B6C3E] rounded disabled:opacity-50"
                        >
                          Anterior
                        </button>
                        <button
                          onClick={() => setRankingPage(rankingPage + 1)}
                          disabled={(rankingPage + 1) * 50 >= (rankingsData?.count || 0)}
                          className="px-2 py-1 bg-[#0B6C3E]/20 text-[#0B6C3E] rounded disabled:opacity-50"
                        >
                          Próximo
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </SectionErrorBoundary>
          </MacroSection>

          {/* === SECTION 4: Segmentos === */}
          <MacroSection ref={(el) => { sectionRefs.current["segmentos"] = el; }} id="segmentos" title="Segmentos" icon={Zap}>
            <SectionErrorBoundary sectionName="Segmentos">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                onViewportEnter={() => setVisitedSections((s) => new Set(s).add("segmentos"))}
                className="space-y-6"
              >

                {/* Segment Story Cards (P1-7) */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {overviewData?.by_lastro && overviewData.by_lastro.length > 0 ? (
                    overviewData.by_lastro.map((seg, idx) => (
                      <SegmentStoryCard
                        key={seg.lastro}
                        variant="fidc"
                        segmentKey={seg.lastro}
                        count={seg.count}
                        pl={seg.pl}
                        avgMetric={seg.avg_inadim ?? null}
                        color={COLORS[idx % COLORS.length]}
                        accent="#0B6C3E"
                        delayMs={idx * 50}
                        onDrillDown={() => {
                          setSelectedLastro(seg.lastro);
                          setActiveSection("explorar");
                          setVisitedSections((s) => new Set(s).add("explorar"));
                          sectionRefs.current["explorar"]?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                      />
                    ))
                  ) : (
                    <div className="col-span-full text-center text-zinc-600 py-8">
                      Sem dados de segmentos
                    </div>
                  )}
                </div>
              </motion.div>
            </SectionErrorBoundary>
          </MacroSection>
        </div>
      </div>
    </div>
  );
}
