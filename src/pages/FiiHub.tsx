import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useDebouncedValue } from "@/hooks/useDebounce";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { LayoutGrid, Zap, Search, TrendingUp, Building2 } from "lucide-react";
import { Breadcrumbs } from "@/components/hub/Breadcrumbs";
import { PercentTooltip } from "@/components/hub/ChartTooltip";
import { motion } from "framer-motion";
import { exportCsv, csvFilename } from "@/lib/csvExport";
import { ExportButton } from "@/components/hub/ExportButton";

import {
  useFiiV4Overview, useFiiV4Rankings, useFiiSegmentsV4, useFiiSearchV4,
  formatPL,
} from "@/hooks/useHubFundos";
import { MacroSection, MacroSidebar } from "@/components/hub/MacroSection";
import { SectionErrorBoundary } from "@/components/hub/SectionErrorBoundary";
import { SkeletonKPI, SkeletonTableRow } from "@/components/hub/SkeletonLoader";
import { EmptyState } from "@/components/hub/EmptyState";
import { SimpleKPICard as KPICard } from "@/components/hub/KPICard";

const SECTIONS = [
  { id: "overview", label: "Visão Geral", icon: LayoutGrid },
  { id: "rankings", label: "Rankings", icon: TrendingUp },
  { id: "screener", label: "Screener", icon: Search },
  { id: "segmentos", label: "Segmentos", icon: Zap },
];

/** FiiHub Component */
export default function FiiHub() {
  /* ─── Deep-linking: section from URL ─── */
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSection = searchParams.get("section") || "overview";

  const [activeSection, setActiveSection] = useState<string>(initialSection);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  /* ─── Lazy-load: track which sections have been visible ─── */
  const [visitedSections, setVisitedSections] = useState<Set<string>>(
    () => new Set(["overview"])
  );

  const sectionVisible = useCallback((id: string) => visitedSections.has(id), [visitedSections]);

  /* ─── Sync section to URL ─── */
  useEffect(() => {
    const next: Record<string, string> = {};
    if (activeSection !== "overview") next.section = activeSection;
    setSearchParams(next, { replace: true });
  }, [activeSection, setSearchParams]);

  /* ─── Screener Filters ─── */
  const [selectedSegmento, setSelectedSegmento] = useState<string | null>(null);
  const [selectedTipoGestao, setSelectedTipoGestao] = useState<string | null>(null);
  const [minPl, setMinPl] = useState<number>(0);
  const [minDy, setMinDy] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  /* ─── Rankings Sorting ─── */
  const [rankingOrderBy, setRankingOrderBy] = useState<string>("patrimonio_liquido");
  const [rankingOrder, setRankingOrder] = useState<string>("desc");
  const [rankingPage, setRankingPage] = useState<number>(0);

  /* ─── Data: Overview ─── */
  const { data: overviewData, isLoading: overviewLoading } = useFiiV4Overview();

  /* ─── Data: Segments ─── */
  const { data: segmentsData } = useFiiSegmentsV4();
  const segments = segmentsData?.segments || [];

  /* ─── Data: Rankings (lazy) ─── */
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
      enabled: sectionVisible("rankings") || sectionVisible("screener"),
    }
  );
  const rankingsFunds = rankingsData?.funds || [];

  /* ─── Data: Search ─── */
  const { data: searchData } = useFiiSearchV4(debouncedSearch, {
    limit: 10,
    enabled: debouncedSearch.length >= 2 && sectionVisible("screener"),
  });
  const searchResults = searchData?.results || [];

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

  /* ─── Benchmark vs CDI Narrative ─── */
  const benchmarkNarrative = useMemo(() => {
    if (overviewData?.avg_rentabilidade == null) return null;

    const avgRentab = overviewData.avg_rentabilidade; // monthly %
    // Compound monthly CDI from annual Selic (accurate vs naive 1.1%)
    const SELIC_ANNUAL = 14.15;
    const cdiMonthly = (Math.pow(1 + SELIC_ANNUAL / 100, 1 / 12) - 1) * 100;
    const spreadNum = avgRentab - cdiMonthly;

    return {
      avgRentab: avgRentab.toFixed(2),
      cdiMonthly: cdiMonthly.toFixed(2),
      spread: spreadNum.toFixed(2),
      color: spreadNum > 0 ? "text-emerald-400" : "text-red-400",
      sentiment: spreadNum > 0.5 ? "acima" : spreadNum > 0 ? "alinhada" : "abaixo",
    };
  }, [overviewData]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] w-full">
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

      <div className="flex-1 flex flex-col min-h-screen">
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
          <p className="text-[9px] text-zinc-500 mt-2 font-mono">Fundos Imobiliários. Renda passiva. Inteligência.</p>
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
                {/* KPI Cards */}
                {overviewData && !overviewLoading ? (
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
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                      <SkeletonKPI key={i} />
                    ))}
                  </div>
                )}

                {/* Benchmark vs CDI Narrative */}
                {benchmarkNarrative && (
                  <div className="bg-[#0a0a0a] border-l-2 border-[#EC4899]/40 pl-4 py-3 text-[9px] text-zinc-400 leading-relaxed">
                    <p>
                      Rentabilidade média dos FIIs no mês: <span className="font-semibold text-zinc-300">{benchmarkNarrative.avgRentab}%</span>. CDI acumulado no período: <span className="font-semibold text-zinc-300">~{benchmarkNarrative.cdiMonthly}%</span>. Spread médio vs CDI: <span className={`font-semibold ${benchmarkNarrative.color}`}>{parseFloat(benchmarkNarrative.spread) > 0 ? '+' : ''}{benchmarkNarrative.spread}pp</span> — rentabilidade {benchmarkNarrative.sentiment} do benchmark.
                    </p>
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

          {/* === SECTION 2: Rankings === */}
          <MacroSection ref={(el) => { sectionRefs.current["rankings"] = el; }} id="rankings" title="Rankings" icon={TrendingUp}>
            <SectionErrorBoundary sectionName="Rankings FII">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                onViewportEnter={() => setVisitedSections((s) => new Set(s).add("rankings"))}
                className="space-y-6"
              >
                {/* Export */}
                <div className="flex justify-end mb-2">
                  <ExportButton onClick={handleExportRankings} label="CSV" disabled={rankingsFunds.length === 0} />
                </div>

                {/* Segment Filter */}
                <div className="flex gap-3 flex-wrap">
                  <button
                    onClick={() => setSelectedSegmento(null)}
                    className={`px-4 py-2 text-[9px] font-mono rounded border transition-all ${
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
                      onClick={() => setSelectedSegmento(seg.segmento)}
                      className={`px-4 py-2 text-[9px] font-mono rounded border transition-all ${
                        selectedSegmento === seg.segmento
                          ? "bg-[#EC4899] text-white border-[#EC4899]"
                          : "bg-[#111111] text-zinc-400 border-[#1a1a1a] hover:border-[#EC4899]/30"
                      }`}
                    >
                      {seg.segmento} ({seg.count})
                    </button>
                  ))}
                </div>

                {/* Sorting Controls */}
                <div className="flex gap-3 items-center">
                  <select
                    value={rankingOrderBy}
                    onChange={(e) => {
                      setRankingOrderBy(e.target.value);
                      setRankingPage(0);
                    }}
                    className="px-3 py-2 text-[9px] font-mono bg-[#111111] border border-[#1a1a1a] rounded text-zinc-300 hover:border-[#EC4899]/30 focus:outline-none focus:border-[#EC4899]"
                  >
                    <option value="patrimonio_liquido">PL Total</option>
                    <option value="dividend_yield_mes">Dividend Yield</option>
                    <option value="rentabilidade_efetiva_mes">Rentab. Efetiva</option>
                    <option value="nr_cotistas">Nº Cotistas</option>
                    <option value="valor_patrimonial_cota">VP/Cota</option>
                  </select>
                  <button
                    onClick={() => setRankingOrder(rankingOrder === "desc" ? "asc" : "desc")}
                    className="px-3 py-2 text-[9px] font-mono bg-[#111111] border border-[#1a1a1a] rounded text-zinc-300 hover:border-[#EC4899]/30 transition-colors"
                  >
                    {rankingOrder === "desc" ? "↓ DESC" : "↑ ASC"}
                  </button>
                </div>

                {/* Rankings Table */}
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

          {/* === SECTION 3: Screener === */}
          <MacroSection ref={(el) => { sectionRefs.current["screener"] = el; }} id="screener" title="Screener" icon={Search}>
            <SectionErrorBoundary sectionName="Screener FII">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                onViewportEnter={() => setVisitedSections((s) => new Set(s).add("screener"))}
                className="space-y-6"
              >
                {/* Filters */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Search */}
                  <div className="col-span-2">
                    <label className="block text-[9px] text-zinc-600 uppercase tracking-wider mb-2 font-mono">
                      Buscar por Nome
                    </label>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setRankingPage(0);
                      }}
                      placeholder="Digite o nome do FII..."
                      className="w-full px-3 py-2 text-[9px] font-mono bg-[#111111] border border-[#1a1a1a] rounded text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-[#EC4899]"
                    />
                  </div>

                  {/* Tipo Gestão */}
                  <div>
                    <label className="block text-[9px] text-zinc-600 uppercase tracking-wider mb-2 font-mono">
                      Tipo de Gestão
                    </label>
                    <select
                      value={selectedTipoGestao || ""}
                      onChange={(e) => {
                        setSelectedTipoGestao(e.target.value || null);
                        setRankingPage(0);
                      }}
                      className="w-full px-3 py-2 text-[9px] font-mono bg-[#111111] border border-[#1a1a1a] rounded text-zinc-300 focus:outline-none focus:border-[#EC4899]"
                    >
                      <option value="">Todos</option>
                      <option value="Passiva">Passiva</option>
                      <option value="Ativa">Ativa</option>
                    </select>
                  </div>

                  {/* Min PL */}
                  <div>
                    <label className="block text-[9px] text-zinc-600 uppercase tracking-wider mb-2 font-mono">
                      PL Mínimo
                    </label>
                    <input
                      type="number"
                      value={minPl}
                      onChange={(e) => {
                        setMinPl(Number(e.target.value));
                        setRankingPage(0);
                      }}
                      placeholder="em milhões"
                      className="w-full px-3 py-2 text-[9px] font-mono bg-[#111111] border border-[#1a1a1a] rounded text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-[#EC4899]"
                    />
                  </div>

                  {/* Min DY */}
                  <div>
                    <label className="block text-[9px] text-zinc-600 uppercase tracking-wider mb-2 font-mono">
                      DY Mínimo %
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={minDy}
                      onChange={(e) => {
                        setMinDy(Number(e.target.value));
                        setRankingPage(0);
                      }}
                      min={0}
                      className="w-full px-3 py-2 text-[9px] font-mono bg-[#111111] border border-[#1a1a1a] rounded text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-[#EC4899]"
                    />
                  </div>
                </div>

                {/* Search Results */}
                {searchQuery.length >= 2 && searchResults.length > 0 && (
                  <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4 space-y-2">
                    <h3 className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-3">Resultados da Busca</h3>
                    {searchResults.map((result) => (
                      <Link
                        key={result.cnpj_fundo_classe}
                        to={`/fundos/fii/${result.slug || result.cnpj_fundo_classe}`}
                        className="block px-3 py-2 bg-[#0a0a0a] rounded border border-[#1a1a1a] hover:border-[#EC4899]/30 transition-all group"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-[9px] font-semibold text-[#EC4899] group-hover:underline truncate">
                              {result.denom_social}
                            </div>
                            <div className="text-[8px] text-zinc-600 mt-0.5">
                              Gestor: {result.gestor_nome?.split(" ")[0] || "—"}
                            </div>
                          </div>
                          <div className="text-[9px] font-mono text-zinc-500">{formatPL(result.vl_patrim_liq)}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
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

                {/* Segment Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {segments.length > 0 ? (
                    segments.map((seg, idx) => (
                      <motion.div
                        key={seg.segmento}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4 hover:border-[#EC4899]/30 transition-all cursor-pointer"
                        onClick={() => {
                          setSelectedSegmento(seg.segmento);
                          setActiveSection("rankings");
                          sectionRefs.current["rankings"]?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-semibold text-zinc-300 truncate">{seg.segmento}</h3>
                          </div>
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: COLORS[segments.indexOf(seg) % COLORS.length] }}
                          />
                        </div>

                        <div className="space-y-2 text-[9px] font-mono">
                          <div className="flex justify-between">
                            <span className="text-zinc-600">Fundos</span>
                            <span className="text-zinc-300 font-semibold">{seg.count}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-zinc-600">PL Agregado</span>
                            <span className="text-zinc-300 font-semibold">{formatPL(seg.pl)}</span>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="col-span-3 text-center text-zinc-600 py-8">
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
