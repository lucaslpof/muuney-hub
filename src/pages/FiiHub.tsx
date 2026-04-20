import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useDebouncedValue } from "@/hooks/useDebounce";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { LayoutGrid, Zap, Search, Building2 } from "lucide-react";
import { Breadcrumbs } from "@/components/hub/Breadcrumbs";
import { DataAsOfStamp } from "@/components/hub/DataAsOfStamp";
import { HubSEO } from "@/lib/seo";
import { PercentTooltip } from "@/components/hub/ChartTooltip";
import { motion } from "framer-motion";
import { exportCsv, csvFilename } from "@/lib/csvExport";
import { ExportButton } from "@/components/hub/ExportButton";

import {
  useFiiV4Overview, useFiiV4Rankings, useFiiSegmentsV4,
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
  { id: "segmentos", label: "Segmentos", icon: Zap },
];

const SECTION_IDS = SECTIONS.map((s) => s.id);
const ORDER_BY_FIELDS = [
  "patrimonio_liquido",
  "dividend_yield_mes",
  "rentabilidade_efetiva_mes",
  "rentabilidade_patrimonial_mes",
  "nr_cotistas",
  "valor_patrimonial_cota",
  "pct_despesas_adm",
] as const;

/** FiiHub Component */
export default function FiiHub() {
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
  const [selectedSegmento, setSelectedSegmento] = useState<string | null>(
    () => {
      const raw = toSearchQuery(searchParams.get("segmento"), 80);
      return raw || null;
    }
  );
  const [selectedTipoGestao, setSelectedTipoGestao] = useState<string | null>(
    () => {
      const raw = toSearchQuery(searchParams.get("tipo_gestao"), 40);
      return raw || null;
    }
  );
  const [minPl, setMinPl] = useState<number>(
    () => toInt(searchParams.get("min_pl"), { min: 0, max: 1_000_000_000, fallback: 0 })
  );
  const [minDy, setMinDy] = useState<number>(
    () => toInt(searchParams.get("min_dy"), { min: 0, max: 100, fallback: 0 })
  );
  const [searchQuery, setSearchQuery] = useState<string>(
    () => toSearchQuery(searchParams.get("q"), 100)
  );
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  /* ─── Rankings Sorting (hydrated from URL, sanitized) ─── */
  const [rankingOrderBy, setRankingOrderBy] = useState<string>(
    () => pickFromList(searchParams.get("orderBy"), ORDER_BY_FIELDS, "patrimonio_liquido")
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
    if (rankingOrderBy !== "patrimonio_liquido") next.orderBy = rankingOrderBy;
    if (rankingOrder !== "desc") next.order = rankingOrder;
    if (rankingPage !== 0) next.page = String(rankingPage);
    if (selectedSegmento) next.segmento = selectedSegmento;
    if (selectedTipoGestao) next.tipo_gestao = selectedTipoGestao;
    if (minPl > 0) next.min_pl = String(minPl);
    if (minDy > 0) next.min_dy = String(minDy);
    if (debouncedSearch) next.q = debouncedSearch;
    setSearchParams(next, { replace: true });
  }, [
    activeSection,
    rankingOrderBy,
    rankingOrder,
    rankingPage,
    selectedSegmento,
    selectedTipoGestao,
    minPl,
    minDy,
    debouncedSearch,
    setSearchParams,
  ]);

  /* ─── Data: Overview ─── */
  const { data: overviewData, isLoading: overviewLoading } = useFiiV4Overview();

  /* ─── Data: Segments ─── */
  const { data: segmentsData } = useFiiSegmentsV4();
  const segments = segmentsData?.segments || [];

  /* ─── Data: Rankings (lazy) — unified for Explorar section ─── */
  const { data: rankingsData, isLoading: rankingsLoading } = useFiiV4Rankings(
    {
      orderBy: rankingOrderBy,
      order: rankingOrder,
      limit: 50,
      offset: rankingPage * 50,
      segmento: selectedSegmento || undefined,
      tipoGestao: selectedTipoGestao || undefined,
      minPl: minPl > 0 ? minPl : undefined,
      minDy: minDy > 0 ? minDy : undefined,
      search: debouncedSearch || undefined,
      enabled: sectionVisible("explorar"),
    }
  );
  const rankingsFunds = rankingsData?.funds || [];

  /* ─── Pie Chart Data ─── */
  const pieData = useMemo(() => {
    if (!overviewData?.by_segmento) return [];
    return overviewData.by_segmento.map((item) => ({
      name: item.segmento,
      value: parseFloat(item.pct_pl.toFixed(1)),
      pl: item.pl,
    }));
  }, [overviewData]);

  const COLORS = ["#EC4899", "#0B6C3E", "#F59E0B", "#8B5CF6", "#3B82F6", "#F97316", "#06B6D4", "#10B981"];

  /* ─── CSV Export Handler ─── */
  const handleExportRankings = useCallback(() => {
    const csvData = rankingsFunds.map((fund) => ({
      nome: fund.denom_social || fund.nome_fundo || `FII ${fund.cnpj_fundo}`,
      cnpj: fund.cnpj_fundo_classe || fund.cnpj_fundo || "—",
      segmento: fund.segmento || "—",
      pl: fund.patrimonio_liquido || 0,
      dy_mes: fund.dividend_yield_mes != null ? fund.dividend_yield_mes : 0,
      rentab_efetiva: fund.rentabilidade_efetiva_mes != null ? fund.rentabilidade_efetiva_mes : 0,
      cotistas: fund.nr_cotistas || 0,
      tipo_gestao: fund.tipo_gestao || "—",
    }));

    exportCsv(
      csvData,
      [
        { header: "Nome", accessor: (r) => r.nome },
        { header: "CNPJ", accessor: (r) => r.cnpj },
        { header: "Segmento", accessor: (r) => r.segmento },
        { header: "PL (R$ Milhões)", accessor: (r) => (r.pl / 1_000_000).toFixed(2) },
        { header: "DY Mês %", accessor: (r) => r.dy_mes.toFixed(2) },
        { header: "Rentab. Efetiva %", accessor: (r) => r.rentab_efetiva.toFixed(2) },
        { header: "Cotistas", accessor: (r) => r.cotistas.toLocaleString("pt-BR") },
        { header: "Tipo Gestão", accessor: (r) => r.tipo_gestao },
      ],
      csvFilename("fii", "rankings")
    );
  }, [rankingsFunds]);

  /* ─── Narrative Analytics (regime + derived KPIs) ─── */
  const narrativeOverview = useMemo(() => {
    if (!overviewData) return null;

    const SELIC_ANNUAL = 14.15;
    const cdiMonthly = (Math.pow(1 + SELIC_ANNUAL / 100, 1 / 12) - 1) * 100;
    const avgRentab = overviewData.avg_rentabilidade ?? 0;
    const avgDy = overviewData.avg_dividend_yield ?? 0;
    const spread = avgRentab - cdiMonthly;

    // DY annualized (~ × 12)
    const dyAnnualized = avgDy * 12;
    // DY Spread vs CDI annualized
    const cdiAnnual = SELIC_ANNUAL;
    const dySpread = dyAnnualized - cdiAnnual;

    // Concentration HHI on PL by segmento
    const bySeg = overviewData.by_segmento ?? [];
    const totalPl = overviewData.total_pl ?? 0;
    const shares = bySeg
      .map((s) => (totalPl > 0 ? s.pl / totalPl : 0))
      .filter((x) => x > 0);
    const hhi = shares.reduce((acc, s) => acc + s * s, 0);
    const hhiPct = (hhi * 10000).toFixed(0);
    const topSegment = bySeg.length
      ? [...bySeg].sort((a, b) => b.pl - a.pl)[0]
      : null;
    const topShare = topSegment && totalPl > 0 ? (topSegment.pl / totalPl) * 100 : 0;

    // Regime (DY × Rentab)
    const regime =
      avgRentab > 0 && dySpread > 2
        ? { label: "Prêmio Atrativo", color: "text-emerald-400" }
        : avgRentab > 0 && dySpread > 0
        ? { label: "Alinhado CDI", color: "text-zinc-300" }
        : avgRentab < 0 && dySpread > 0
        ? { label: "Reprecificação DY+", color: "text-amber-400" }
        : { label: "Stress Imobiliário", color: "text-red-400" };

    return {
      avgRentab,
      avgDy,
      cdiMonthly,
      cdiAnnual,
      spread,
      dyAnnualized,
      dySpread,
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
      topSegment: topSegment?.segmento ?? "—",
      topShare,
      regime,
    };
  }, [overviewData]);

  const overviewMiniStats = useMemo<MiniStat[]>(() => {
    if (!narrativeOverview || !overviewData) return [];
    return [
      {
        label: "Regime FII",
        value: narrativeOverview.regime.label,
        sublabel: `${narrativeOverview.avgRentab.toFixed(2)}% rentab mês`,
        color: narrativeOverview.regime.color,
        tooltip: "Regime inferido de DY anualizado × rentabilidade mensal",
      },
      {
        label: "DY Anualizado",
        value: `${narrativeOverview.dyAnnualized.toFixed(2)}%`,
        sublabel: `DY mês ${narrativeOverview.avgDy.toFixed(2)}%`,
        color: narrativeOverview.dySpread > 0 ? "text-emerald-400" : "text-red-400",
      },
      {
        label: "Prêmio DY vs CDI",
        value: `${narrativeOverview.dySpread > 0 ? "+" : ""}${narrativeOverview.dySpread.toFixed(2)}pp`,
        sublabel: `CDI ${narrativeOverview.cdiAnnual.toFixed(2)}% a.a.`,
        color:
          narrativeOverview.dySpread > 2
            ? "text-emerald-400"
            : narrativeOverview.dySpread > 0
            ? "text-zinc-300"
            : "text-red-400",
      },
      {
        label: "Spread Rentab vs CDI",
        value: `${narrativeOverview.spread > 0 ? "+" : ""}${narrativeOverview.spread.toFixed(2)}pp`,
        sublabel: `CDI mês ${narrativeOverview.cdiMonthly.toFixed(2)}%`,
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
        tooltip: "HHI sobre PL por segmento (0-10000)",
      },
      {
        label: "Segmento Líder",
        value: narrativeOverview.topSegment,
        sublabel: `${narrativeOverview.topShare.toFixed(1)}% do PL`,
        color: "text-zinc-200",
      },
    ];
  }, [narrativeOverview, overviewData]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] w-full">
      <HubSEO
        title="FII Deep Module"
        description="Inteligência completa de FIIs: rankings sortable, screener multi-filtro, dividend yield, breakdown por segmento. 1.250+ fundos imobiliários monitorados."
        path="/fundos/fii"
        keywords="FII, fundos imobiliários, dividend yield, segmento FII, lajes corporativas, logística, shoppings, CRI, ranking FII"
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
              { label: "FII" },
            ]}
            className="mb-2"
          />
          <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#EC4899]" />
            Módulo FII
          </h1>
          <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
            <p className="text-[9px] text-zinc-500 font-mono">Fundos Imobiliários. Renda passiva. Inteligência.</p>
            <DataAsOfStamp
              date={overviewData?.date}
              cadence="monthly"
              source="CVM Informe FII"
            />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 px-4 md:px-8 py-8 space-y-8">
          {/* === SECTION 1: Visão Geral === */}
          <MacroSection ref={(el) => { sectionRefs.current["overview"] = el; }} id="overview" title="Visão Geral" icon={LayoutGrid}>
            <SectionErrorBoundary sectionName="Visão Geral FII">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                onViewportEnter={() => setVisitedSections((s) => new Set(s).add("overview"))}
                className="space-y-6"
              >
                {narrativeOverview && overviewData && !overviewLoading ? (
                  <NarrativeSection
                    accent="#EC4899"
                    prose={
                      <>
                        Mercado de FIIs em regime{" "}
                        <span className={narrativeOverview.regime.color}>
                          {narrativeOverview.regime.label.toLowerCase()}
                        </span>
                        : DY anualizado médio{" "}
                        <span className="text-zinc-200">
                          {narrativeOverview.dyAnnualized.toFixed(2)}%
                        </span>{" "}
                        vs CDI{" "}
                        <span className="text-zinc-200">
                          {narrativeOverview.cdiAnnual.toFixed(2)}%
                        </span>{" "}
                        (<span
                          className={
                            narrativeOverview.dySpread > 0
                              ? "text-emerald-400"
                              : "text-red-400"
                          }
                        >
                          prêmio de {narrativeOverview.dySpread > 0 ? "+" : ""}
                          {narrativeOverview.dySpread.toFixed(2)}pp
                        </span>). Rentabilidade efetiva mensal{" "}
                        <span className={narrativeOverview.spreadColor}>
                          {narrativeOverview.avgRentab.toFixed(2)}%
                        </span>{" "}
                        ({narrativeOverview.spreadSentiment} do CDI). Concentração por
                        segmento <span className={narrativeOverview.hhiColor}>HHI {narrativeOverview.hhiPct}</span> —
                        líder <span className="text-zinc-200">{narrativeOverview.topSegment}</span> com{" "}
                        <span className="text-zinc-200">{narrativeOverview.topShare.toFixed(1)}%</span>.
                      </>
                    }
                    miniStats={overviewMiniStats}
                  >
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <KPICard
                        label="Total FIIs"
                        value={String(overviewData.total_fiis)}
                        color="text-zinc-300"
                      />
                      <KPICard
                        label="PL Agregado"
                        value={formatPL(overviewData.total_pl)}
                        color="text-[#EC4899]"
                      />
                      <KPICard
                        label="DY Médio (mês)"
                        value={overviewData.avg_dividend_yield != null ? overviewData.avg_dividend_yield.toFixed(2) : "—"}
                        unit="%"
                        color={overviewData.avg_dividend_yield && overviewData.avg_dividend_yield > 0.8 ? "text-emerald-400" : "text-zinc-300"}
                      />
                      <KPICard
                        label="Rentab. Média (mês)"
                        value={overviewData.avg_rentabilidade != null ? overviewData.avg_rentabilidade.toFixed(2) : "—"}
                        unit="%"
                        color={overviewData.avg_rentabilidade && overviewData.avg_rentabilidade > 0 ? "text-emerald-400" : "text-red-400"}
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

                {/* Pie Chart: Distribuição por Segmento — external legend */}
                {pieData.length > 0 && (
                  <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-6">
                    <h3 className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-4">Distribuição de PL por Segmento</h3>
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

                {/* Breakdown tables: Mandato + Tipo Gestão */}
                {overviewData && (overviewData.by_mandato.length > 0 || overviewData.by_tipo_gestao.length > 0) && (
                  <div className="grid grid-cols-2 gap-4">
                    {overviewData.by_mandato.length > 0 && (
                      <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
                        <h3 className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-3">Por Mandato</h3>
                        <div className="space-y-1.5">
                          {overviewData.by_mandato.slice(0, 6).map((m) => (
                            <div key={m.mandato} className="flex justify-between text-[10px] font-mono">
                              <span className="text-zinc-400 truncate max-w-[60%]">{m.mandato}</span>
                              <span className="text-zinc-300">{m.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {overviewData.by_tipo_gestao.length > 0 && (
                      <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
                        <h3 className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-3">Por Tipo de Gestão</h3>
                        <div className="space-y-1.5">
                          {overviewData.by_tipo_gestao.slice(0, 6).map((t) => (
                            <div key={t.tipo} className="flex justify-between text-[10px] font-mono">
                              <span className="text-zinc-400 truncate max-w-[60%]">{t.tipo}</span>
                              <span className="text-zinc-300">{t.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </SectionErrorBoundary>
          </MacroSection>

          {/* === SECTION 2: Explorar (Rankings + Screener unificados) === */}
          <MacroSection ref={(el) => { sectionRefs.current["explorar"] = el; }} id="explorar" title="Explorar" icon={Search}>
            <SectionErrorBoundary sectionName="Explorar FII">
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
                        {rankingsData.count === 1 ? "FII encontrado" : "FIIs encontrados"}
                      </>
                    ) : rankingsFunds.length > 0 ? (
                      <>
                        <span className="text-zinc-300 font-semibold">{rankingsFunds.length}</span> resultados nesta página
                      </>
                    ) : (
                      "—"
                    )}
                  </div>
                  <ExportButton onClick={handleExportRankings} label="CSV" disabled={rankingsFunds.length === 0} />
                </div>

                {/* Segment chips (segmento filter) */}
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => { setSelectedSegmento(null); setRankingPage(0); }}
                    className={`px-3 py-1.5 text-[9px] font-mono rounded border transition-all ${
                      selectedSegmento === null
                        ? "bg-[#EC4899] text-white border-[#EC4899]"
                        : "bg-[#111111] text-zinc-400 border-[#1a1a1a] hover:border-[#EC4899]/30"
                    }`}
                  >
                    Todos
                  </button>
                  {segments.map((seg) => (
                    <button
                      key={seg.segmento}
                      onClick={() => { setSelectedSegmento(seg.segmento); setRankingPage(0); }}
                      className={`px-3 py-1.5 text-[9px] font-mono rounded border transition-all ${
                        selectedSegmento === seg.segmento
                          ? "bg-[#EC4899] text-white border-[#EC4899]"
                          : "bg-[#111111] text-zinc-400 border-[#1a1a1a] hover:border-[#EC4899]/30"
                      }`}
                    >
                      {seg.segmento} ({seg.count})
                    </button>
                  ))}
                </div>

                {/* Unified filter grid: search + tipo gestão + numeric filters + sort */}
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
                      placeholder="Digite o nome do FII..."
                      className="w-full px-3 py-2 text-[9px] font-mono bg-[#111111] border border-[#1a1a1a] rounded text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-[#EC4899]"
                    />
                  </div>

                  {/* Tipo Gestão */}
                  <div>
                    <label className="block text-[9px] text-zinc-600 uppercase tracking-wider mb-1.5 font-mono">
                      Tipo Gestão
                    </label>
                    <select
                      value={selectedTipoGestao || ""}
                      onChange={(e) => { setSelectedTipoGestao(e.target.value || null); setRankingPage(0); }}
                      className="w-full px-3 py-2 text-[9px] font-mono bg-[#111111] border border-[#1a1a1a] rounded text-zinc-300 focus:outline-none focus:border-[#EC4899]"
                    >
                      <option value="">Todos</option>
                      <option value="Passiva">Passiva</option>
                      <option value="Ativa">Ativa</option>
                    </select>
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
                      className="w-full px-3 py-2 text-[9px] font-mono bg-[#111111] border border-[#1a1a1a] rounded text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-[#EC4899]"
                    />
                  </div>

                  {/* Min DY */}
                  <div>
                    <label className="block text-[9px] text-zinc-600 uppercase tracking-wider mb-1.5 font-mono">
                      DY Mín %
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={minDy}
                      onChange={(e) => { setMinDy(Number(e.target.value)); setRankingPage(0); }}
                      min={0}
                      className="w-full px-3 py-2 text-[9px] font-mono bg-[#111111] border border-[#1a1a1a] rounded text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-[#EC4899]"
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
                        className="flex-1 px-2 py-2 text-[9px] font-mono bg-[#111111] border border-[#1a1a1a] rounded text-zinc-300 hover:border-[#EC4899]/30 focus:outline-none focus:border-[#EC4899]"
                      >
                        <option value="patrimonio_liquido">PL</option>
                        <option value="dividend_yield_mes">DY Mês</option>
                        <option value="rentabilidade_efetiva_mes">Rentab. Efetiva</option>
                        <option value="rentabilidade_patrimonial_mes">Rentab. Patrim.</option>
                        <option value="nr_cotistas">Cotistas</option>
                        <option value="valor_patrimonial_cota">VP/Cota</option>
                        <option value="pct_despesas_adm">Despesas Adm.</option>
                      </select>
                      <button
                        onClick={() => setRankingOrder(rankingOrder === "desc" ? "asc" : "desc")}
                        className="px-2 py-2 text-[9px] font-mono bg-[#111111] border border-[#1a1a1a] rounded text-zinc-300 hover:border-[#EC4899]/30 transition-colors"
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
                          <th className="px-4 py-2 text-right text-zinc-600">DY (mês)</th>
                          <th className="px-4 py-2 text-right text-zinc-600">Rentab. Efetiva</th>
                          <th className="px-4 py-2 text-right text-zinc-600">Cotistas</th>
                          <th className="px-4 py-2 text-center text-zinc-600">Segmento</th>
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
                              <EmptyState variant="no-funds" description="Nenhum FII encontrado com os filtros selecionados." />
                            </td>
                          </tr>
                        ) : (
                          rankingsFunds.map((fund, idx) => (
                            <tr
                              key={`${fund.cnpj_fundo}-${idx}`}
                              className="border-t border-[#1a1a1a] hover:bg-[#0a0a0a]/50 transition-colors"
                            >
                              <td className="px-4 py-2 text-zinc-600">{rankingPage * 50 + idx + 1}</td>
                              <td className="px-4 py-2">
                                <Link
                                  to={`/fundos/fii/${fund.slug || fund.cnpj_fundo_classe || fund.cnpj_fundo}`}
                                  className="text-[#EC4899] hover:underline truncate max-w-xs"
                                >
                                  {fund.denom_social || fund.nome_fundo || `FII ${fund.cnpj_fundo}`}
                                </Link>
                              </td>
                              <td className="px-4 py-2 text-right text-zinc-300">{formatPL(fund.patrimonio_liquido)}</td>
                              <td className="px-4 py-2 text-right">
                                <span className={fund.dividend_yield_mes && fund.dividend_yield_mes > 0.8 ? "text-emerald-400" : "text-zinc-300"}>
                                  {fund.dividend_yield_mes != null ? fund.dividend_yield_mes.toFixed(2) : "—"}%
                                </span>
                              </td>
                              <td className="px-4 py-2 text-right">
                                <span className={fund.rentabilidade_efetiva_mes && fund.rentabilidade_efetiva_mes > 0 ? "text-emerald-400" : "text-red-400"}>
                                  {fund.rentabilidade_efetiva_mes != null ? fund.rentabilidade_efetiva_mes.toFixed(2) : "—"}%
                                </span>
                              </td>
                              <td className="px-4 py-2 text-right text-zinc-300">
                                {fund.nr_cotistas != null ? fund.nr_cotistas.toLocaleString("pt-BR") : "—"}
                              </td>
                              <td className="px-4 py-2 text-center text-zinc-500 text-[7px] truncate max-w-[120px]">
                                {fund.segmento || "—"}
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
                        Página {rankingPage + 1} · {rankingsFunds.length} resultados
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setRankingPage(Math.max(0, rankingPage - 1))}
                          disabled={rankingPage === 0}
                          className="px-2 py-1 bg-[#EC4899]/20 text-[#EC4899] rounded disabled:opacity-50"
                        >
                          Anterior
                        </button>
                        <button
                          onClick={() => setRankingPage(rankingPage + 1)}
                          disabled={rankingsFunds.length < 50}
                          className="px-2 py-1 bg-[#EC4899]/20 text-[#EC4899] rounded disabled:opacity-50"
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
            <SectionErrorBoundary sectionName="Segmentos FII">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                onViewportEnter={() => setVisitedSections((s) => new Set(s).add("segmentos"))}
                className="space-y-6"
              >

                {/* Segment Story Cards (P1-7) */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {overviewData?.by_segmento && overviewData.by_segmento.length > 0 ? (
                    overviewData.by_segmento.map((seg, idx) => (
                      <SegmentStoryCard
                        key={seg.segmento}
                        variant="fii"
                        segmentKey={seg.segmento}
                        count={seg.count}
                        pl={seg.pl}
                        avgMetric={seg.avg_dy ?? null}
                        color={COLORS[idx % COLORS.length]}
                        accent="#EC4899"
                        delayMs={idx * 50}
                        onDrillDown={() => {
                          setSelectedSegmento(seg.segmento);
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
