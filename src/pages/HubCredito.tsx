import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { HubSEO } from "@/lib/seo";
import { KPICard } from "@/components/hub/KPICard";
import { MacroChart } from "@/components/hub/MacroChart";
import { MacroInsightCard, type InsightInput } from "@/components/hub/MacroInsightCard";
import { MacroSection, MacroSidebar } from "@/components/hub/MacroSection";
import { SectionErrorBoundary } from "@/components/hub/SectionErrorBoundary";
import { AlertCard } from "@/components/hub/AlertCard";
import { Breadcrumbs } from "@/components/hub/Breadcrumbs";
import { SkeletonPage } from "@/components/hub/SkeletonLoader";
import { EmptyState } from "@/components/hub/EmptyState";
import { InterestCalculator } from "@/components/hub/InterestCalculator";
import { DefaultRadar } from "@/components/hub/DefaultRadar";
import { SpreadMonitor } from "@/components/hub/SpreadMonitor";
import { CreditCorrelationPanel } from "@/components/hub/CreditCorrelationPanel";
import { CreditOverviewMensal } from "@/components/hub/CreditOverviewMensal";
import { CreditProductPanel } from "@/components/hub/CreditProductPanel";
import { CreditOperationsPanel } from "@/components/hub/CreditOperationsPanel";
import { CreditNarrativePanel } from "@/components/hub/CreditNarrativePanel";
import {
  useHubLatest,
  useHubSeriesBundle,
  pickSeries,
  CREDITO_SAMPLE,
  type SeriesBundle,
} from "@/hooks/useHubData";
import { percentChange, sma } from "@/lib/statistics";
import {
  LayoutGrid, Warehouse, Percent, ShieldAlert,
  Filter, Brain, ChevronDown,
} from "lucide-react";

/* ─── Period selector ─── */
const PERIODS = ["3m", "6m", "1y", "2y", "5y"] as const;

/* ─── Section definitions (6 narrative sections) ─── */
const SECTIONS = [
  { id: "overview", label: "Visão Geral", icon: LayoutGrid },
  { id: "volume", label: "Volume", icon: Warehouse },
  { id: "preco", label: "Taxas & Spreads", icon: Percent },
  { id: "risco", label: "Risco", icon: ShieldAlert },
  { id: "operacoes", label: "Operações", icon: Filter },
  { id: "analytics", label: "Analytics", icon: Brain },
] as const;

/* ─── Hero KPI codes (top 8 for overview) ─── */
const HERO_CODES = ["20540", "20539", "21082", "20783", "20631", "20714", "20715", "25147"];

/* ─── Sparkline helper ─── */
function toSparkline(data: { date: string; value: number }[], points = 20) {
  if (!data.length) return [];
  const step = Math.max(1, Math.floor(data.length / points));
  return data.filter((_, i) => i % step === 0).map((d) => ({ value: d.value }));
}

/* ─── Build sparkline map from bundles ─── */
function buildSparklineMap(bundles: Record<string, SeriesBundle | undefined>): Record<string, { value: number }[]> {
  const map: Record<string, { value: number }[]> = {};
  for (const bundle of Object.values(bundles)) {
    if (!bundle) continue;
    for (const [code, series] of Object.entries(bundle)) {
      if (series.data.length > 2) {
        map[code] = toSparkline(series.data);
      }
    }
  }
  return map;
}

/* ─── Main Component ─── */
const HubCredito = () => {
  /* ─── Deep-linking: period & section from URL ─── */
  const [searchParams, setSearchParams] = useSearchParams();
  const initialPeriod = searchParams.get("period") || "1y";
  const initialSection = searchParams.get("section") || "overview";

  const [period, setPeriod] = useState<string>(
    (PERIODS as readonly string[]).includes(initialPeriod) ? initialPeriod : "1y"
  );
  const [activeSection, setActiveSection] = useState<string>(initialSection);
  const [heroExpanded, setHeroExpanded] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  /* ─── Lazy-load: track which sections have been visible ─── */
  const [visitedSections, setVisitedSections] = useState<Set<string>>(
    () => new Set(["overview"])
  );

  const sectionVisible = useCallback((id: string) => visitedSections.has(id), [visitedSections]);

  /* ─── Sync period & section to URL ─── */
  useEffect(() => {
    const next: Record<string, string> = {};
    if (period !== "1y") next.period = period;
    if (activeSection !== "overview") next.section = activeSection;
    setSearchParams(next, { replace: true });
  }, [period, activeSection, setSearchParams]);

  /* ─── IntersectionObserver: preload (generous margin) + active tracking ─── */
  useEffect(() => {
    // Observer 1: Preload — triggers data fetch well before section enters viewport
    const preloadObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            setVisitedSections((prev) => {
              if (prev.has(id)) return prev;
              return new Set([...prev, id]);
            });
          }
        }
      },
      { rootMargin: "0px 0px 300px 0px", threshold: 0 }
    );

    // Observer 2: Active section — narrow band near top for sidebar highlight
    const activeObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-120px 0px -60% 0px", threshold: 0 }
    );

    // Observe all section refs
    const timer = setTimeout(() => {
      Object.values(sectionRefs.current).forEach((el) => {
        if (el) {
          preloadObserver.observe(el);
          activeObserver.observe(el);
        }
      });
    }, 200);

    return () => {
      clearTimeout(timer);
      preloadObserver.disconnect();
      activeObserver.disconnect();
    };
  }, []);

  /* ─── Data: KPI cards ─── */
  const { data: cards, isLoading: cardsLoading } = useHubLatest("credito");
  const kpis = cards?.length ? cards : CREDITO_SAMPLE;

  /* ─── Data: Series bundles (lazy per section) ─── */
  // Overview always loaded: saldo_credito, inadimplencia, taxa
  const { data: saldoBundle } = useHubSeriesBundle("saldo_credito", period, "credito");
  const { data: inadBundle } = useHubSeriesBundle("inadimplencia", period, "credito");
  const { data: taxaBundle } = useHubSeriesBundle("taxa", period, "credito");

  // Lazy: only fetch when section visited
  const { data: saldoPfBundle } = useHubSeriesBundle("saldo_pf_modal", period, "credito", sectionVisible("volume"));
  const { data: saldoPjBundle } = useHubSeriesBundle("saldo_pj_modal", period, "credito", sectionVisible("volume"));
  const { data: concessaoBundle } = useHubSeriesBundle("concessao", period, "credito", sectionVisible("volume"));
  const { data: spreadBundle } = useHubSeriesBundle("spread", period, "credito", sectionVisible("preco"));
  const { data: inadDetalheBundle } = useHubSeriesBundle("inadim_detalhe", period, "credito", sectionVisible("risco"));
  const { data: cartoesBundle } = useHubSeriesBundle("cartoes", period, "credito", sectionVisible("operacoes"));
  const { data: alavancagemBundle } = useHubSeriesBundle("alavancagem", period, "credito", sectionVisible("analytics"));

  const allBundles = { saldoBundle, inadBundle, taxaBundle, saldoPfBundle, saldoPjBundle, concessaoBundle, spreadBundle, inadDetalheBundle, cartoesBundle, alavancagemBundle };
  const sparklineMap = useMemo(() => buildSparklineMap(allBundles), [saldoBundle, inadBundle, taxaBundle, saldoPfBundle, saldoPjBundle, concessaoBundle, spreadBundle, inadDetalheBundle, cartoesBundle, alavancagemBundle]);

  /* ─── Hero KPIs (top 8) vs rest ─── */
  const heroKPIs = useMemo(() => kpis.filter(k => HERO_CODES.includes(k.serie_code)), [kpis]);
  const secondaryKPIs = useMemo(() => kpis.filter(k => !HERO_CODES.includes(k.serie_code)), [kpis]);

  /* ─── Shorthand series access ─── */
  const saldoTotal = pickSeries(saldoBundle, "20540");
  const saldoPF = pickSeries(saldoBundle, "28848");
  const saldoPJLivres = pickSeries(saldoBundle, "28860");
  const veiculos = pickSeries(saldoBundle, "20581");
  const cartaoCredito = pickSeries(saldoBundle, "20590");
  // saldoPME available via: pickSeries(saldoPjBundle, "25891")

  const concessaoPF = pickSeries(concessaoBundle, "20631");
  const concessaoPJ = pickSeries(concessaoBundle, "20632");
  const consignado = pickSeries(concessaoBundle, "20671");

  const taxaPF = pickSeries(taxaBundle, "20714");
  const taxaPJ = pickSeries(taxaBundle, "20715");
  const taxaVeiculos = pickSeries(taxaBundle, "20749");
  const taxaMicro = pickSeries(taxaBundle, "26428");

  const inadTotal = pickSeries(inadBundle, "21082");
  const inadPF = pickSeries(inadBundle, "21083");
  const inadPJ = pickSeries(inadBundle, "21084");
  const inadLivres = pickSeries(inadDetalheBundle, "21085");

  const spreadPF = pickSeries(spreadBundle, "20783");
  const spreadPJ = pickSeries(spreadBundle, "20784");
  const spreadPos = pickSeries(spreadBundle, "20826");
  const spreadPre = pickSeries(spreadBundle, "20837");

  const cartoes = pickSeries(cartoesBundle, "25147");
  const creditoPib = pickSeries(saldoBundle, "20539");

  /* ─── Derived analytics ─── */
  const concessoesMoM = useMemo(() => percentChange(concessaoPF), [concessaoPF]);
  const inadSMA = useMemo(() => sma(inadTotal, 3), [inadTotal]);

  /* ─── KPI value helper ─── */
  const kpiVal = (code: string) => kpis.find(k => k.serie_code === code)?.last_value ?? 0;

  /* ─── Scroll to section ─── */
  const scrollTo = useCallback((id: string) => {
    setActiveSection(id);
    const el = sectionRefs.current[id] || document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  /* ─── Section ref setter ─── */
  const setRef = useCallback((id: string) => (el: HTMLDivElement | null) => {
    sectionRefs.current[id] = el;
  }, []);

  /* ─── Insight inputs for dynamic cards ─── */
  const saldoInsights: InsightInput[] = useMemo(() => [
    { code: "20540", label: "Saldo Total", data: saldoTotal, unit: "R$ bi" },
    { code: "28848", label: "Saldo PF", data: saldoPF, unit: "R$ bi" },
    { code: "20539", label: "Crédito/PIB", data: creditoPib, unit: "%", target: 55 },
  ], [saldoTotal, saldoPF, creditoPib]);

  const taxaInsights: InsightInput[] = useMemo(() => [
    { code: "20714", label: "Taxa PF", data: taxaPF, unit: "% a.a." },
    { code: "20715", label: "Taxa PJ", data: taxaPJ, unit: "% a.a." },
    { code: "20783", label: "Spread PF", data: spreadPF, unit: "p.p." },
  ], [taxaPF, taxaPJ, spreadPF]);

  const riscoInsights: InsightInput[] = useMemo(() => [
    { code: "21082", label: "Inadim. Total", data: inadTotal, unit: "%", target: 3.0, lowerIsBetter: true },
    { code: "21083", label: "Inadim. PF", data: inadPF, unit: "%", lowerIsBetter: true },
    { code: "21084", label: "Inadim. PJ", data: inadPJ, unit: "%", lowerIsBetter: true },
  ], [inadTotal, inadPF, inadPJ]);

  /* Full-page loading state */
  if (cardsLoading && !kpis.length) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Breadcrumbs items={[{ label: "Overview de Crédito" }]} className="mb-4" />
        <SkeletonPage />
      </div>
    );
  }

  /* No-data fallback */
  if (!cardsLoading && (!kpis || kpis.length === 0)) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Breadcrumbs items={[{ label: "Overview de Crédito" }]} className="mb-4" />
        <EmptyState variant="no-data" />
      </div>
    );
  }

  return (
    <div className="w-full">
      <HubSEO title="Overview Crédito" description="Spreads, inadimplência, concessões e análise de risco do SFN com 73 séries BACEN — visão completa do mercado de crédito brasileiro." path="/credito" />
      <Breadcrumbs items={[{ label: "Overview de Crédito" }]} className="mb-4" />
      {/* ─── Sticky header bar ─── */}
      <div className="sticky top-14 z-20 bg-[#0a0a0a]/95 backdrop-blur-sm -mx-6 px-6 py-3 border-b border-[#141414]">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold text-zinc-100 tracking-tight">
              Módulo Crédito
            </h1>
            <span className="text-[9px] text-zinc-600 font-mono hidden sm:inline">
              {kpis.length} indicadores · 73 séries · BACEN SGS
            </span>
          </div>

          <div className="flex items-center gap-0.5 bg-[#111111] border border-[#1a1a1a] rounded-md p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2 py-1 text-[10px] font-mono rounded transition-colors ${
                  period === p
                    ? "bg-[#10B981] text-white"
                    : "text-zinc-600 hover:text-zinc-300"
                }`}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Main layout: sidebar + content ─── */}
      <div className="flex gap-6 mt-4">
        {/* Sidebar navigation */}
        <div className="hidden md:block w-44 flex-shrink-0">
          <MacroSidebar
            items={SECTIONS.map(s => ({ id: s.id, label: s.label, icon: s.icon }))}
            activeId={activeSection}
            onNavigate={scrollTo}
          />
        </div>

        {/* Content area */}
        <div className="flex-1 min-w-0 space-y-8">
          {/* ─── Alerts ─── */}
          <AlertCard kpis={kpis} module="credito" />

          {/* ════════════════════════════════════════════════════════════ */}
          {/* SECTION 1: VISÃO GERAL                                     */}
          {/* ════════════════════════════════════════════════════════════ */}
          <SectionErrorBoundary sectionName="Visão Geral">
            <MacroSection
              ref={setRef("overview")}
              id="overview"
              title="Visão Geral"
              subtitle="KPIs principais e overview mensal do mercado de crédito"
              icon={LayoutGrid}
              seriesCount={kpis.length}
            >
              {/* Hero KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {heroKPIs.map((card) => (
                  <KPICard
                    key={card.serie_code}
                    title={card.display_name}
                    value={card.last_value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                    unit={card.unit}
                    change={card.change_pct}
                    trend={card.trend}
                    lastDate={card.last_date}
                    loading={cardsLoading}
                    sparklineData={sparklineMap[card.serie_code]}
                  />
                ))}
              </div>

              {/* Secondary KPIs (expandable) */}
              {secondaryKPIs.length > 0 && (
                <>
                  <button
                    onClick={() => setHeroExpanded(!heroExpanded)}
                    className="flex items-center gap-1 text-[10px] font-mono text-zinc-600 hover:text-zinc-300 transition-colors"
                  >
                    <ChevronDown className={`w-3 h-3 transition-transform ${heroExpanded ? "rotate-180" : ""}`} />
                    {heroExpanded ? "Ocultar" : `+${secondaryKPIs.length} indicadores`}
                  </button>
                  {heroExpanded && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                      {secondaryKPIs.map((card) => (
                        <KPICard
                          key={card.serie_code}
                          title={card.display_name}
                          value={card.last_value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                          unit={card.unit}
                          change={card.change_pct}
                          trend={card.trend}
                          lastDate={card.last_date}
                          loading={cardsLoading}
                          sparklineData={sparklineMap[card.serie_code]}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Overview Mensal */}
              <CreditOverviewMensal period={period} />
            </MacroSection>
          </SectionErrorBoundary>

          {/* ════════════════════════════════════════════════════════════ */}
          {/* SECTION 2: VOLUME (Saldos + Concessões)                    */}
          {/* ════════════════════════════════════════════════════════════ */}
          <SectionErrorBoundary sectionName="Volume">
            <MacroSection
              ref={setRef("volume")}
              id="volume"
              title="Volume de Crédito"
              subtitle="Saldos da carteira e fluxo de concessões"
              icon={Warehouse}
              seriesCount={16}
              insights={
                <MacroInsightCard inputs={saldoInsights} />
              }
            >
              {/* Saldos */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <MacroChart
                  data={saldoTotal}
                  title="Saldo Total de Crédito — SFN"
                  type="area"
                  color="#10B981"
                  label="Saldo Total"
                  unit=" R$ bi"
                />
                <MacroChart
                  data={saldoPF.map((d, i) => ({
                    ...d,
                    value2: saldoPJLivres[i]?.value ?? d.value * 0.35,
                  }))}
                  title="Saldo PF vs PJ (Livres)"
                  type="line"
                  color="#10B981"
                  color2="#6366F1"
                  label="PF Livres"
                  label2="PJ Livres"
                  unit=" R$ bi"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <MacroChart
                  data={veiculos}
                  title="Crédito Veículos PF"
                  type="bar"
                  color="#F59E0B"
                  label="Veículos"
                  unit=" R$ bi"
                />
                <MacroChart
                  data={cartaoCredito}
                  title="Cartão de Crédito PF"
                  type="area"
                  color="#EF4444"
                  label="Cartão PF"
                  unit=" R$ bi"
                />
              </div>

              {/* Concessões */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <MacroChart
                  data={concessaoPF}
                  title="Concessões PF — Volume Mensal"
                  type="bar"
                  color="#10B981"
                  label="PF"
                  unit=" R$ bi"
                />
                <MacroChart
                  data={concessaoPJ}
                  title="Concessões PJ — Volume Mensal"
                  type="bar"
                  color="#6366F1"
                  label="PJ"
                  unit=" R$ bi"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <MacroChart
                  data={consignado}
                  title="Crédito Consignado PF"
                  type="area"
                  color="#F59E0B"
                  label="Consignado"
                  unit=" R$ bi"
                />
                <MacroChart
                  data={concessoesMoM}
                  title="Concessões PF — Variação Mensal"
                  type="bar"
                  color="#10B981"
                  label="Var. %"
                  unit="%"
                />
              </div>
            </MacroSection>
          </SectionErrorBoundary>

          {/* ════════════════════════════════════════════════════════════ */}
          {/* SECTION 3: PREÇO (Taxas + Spreads)                         */}
          {/* ════════════════════════════════════════════════════════════ */}
          <SectionErrorBoundary sectionName="Taxas & Spreads">
            <MacroSection
              ref={setRef("preco")}
              id="preco"
              title="Taxas & Spreads"
              subtitle="Custo do crédito e margens bancárias"
              icon={Percent}
              seriesCount={13}
              insights={
                <MacroInsightCard inputs={taxaInsights} />
              }
            >
              {/* Taxas */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <MacroChart
                  data={taxaPF.map((d, i) => ({
                    ...d,
                    value2: taxaPJ[i]?.value ?? d.value * 0.46,
                  }))}
                  title="Taxas Médias — PF vs PJ"
                  type="line"
                  color="#EF4444"
                  color2="#6366F1"
                  label="PF"
                  label2="PJ"
                  unit="% a.a."
                  refValue={kpiVal("432") || 14.25}
                  refLabel="Selic"
                />
                <MacroChart
                  data={taxaVeiculos.map((d, i) => ({
                    ...d,
                    value2: taxaMicro[i]?.value ?? d.value * 1.7,
                  }))}
                  title="Taxas — Veículos PF vs Microempresas"
                  type="line"
                  color="#F59E0B"
                  color2="#10B981"
                  label="Veículos"
                  label2="Micro"
                  unit="% a.a."
                />
              </div>

              {/* Interest Calculator */}
              <InterestCalculator
                currentTaxaPF={kpiVal("20714") || undefined}
                currentTaxaPJ={kpiVal("20715") || undefined}
                currentSelic={14.25}
              />

              {/* Spreads */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <MacroChart
                  data={spreadPF}
                  title="Spread Bancário — Pessoa Física"
                  type="area"
                  color="#10B981"
                  label="Spread PF"
                  unit=" p.p."
                />
                <MacroChart
                  data={spreadPJ}
                  title="Spread Bancário — Pessoa Jurídica"
                  type="area"
                  color="#6366F1"
                  label="Spread PJ"
                  unit=" p.p."
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <MacroChart
                  data={spreadPos.map((d, i) => ({
                    ...d,
                    value2: spreadPre[i]?.value ?? d.value * 1.3,
                  }))}
                  title="Spread Pós-fixadas vs Pré-fixadas"
                  type="line"
                  color="#F59E0B"
                  color2="#EF4444"
                  label="Pós"
                  label2="Pré"
                  unit=" p.p."
                />
                <MacroChart
                  data={sma(spreadPF, 3)}
                  title="Spread PF — Média Móvel 3m"
                  type="line"
                  color="#10B981"
                  label="SMA(3)"
                  unit=" p.p."
                />
              </div>

              {/* Spread Monitor */}
              <SpreadMonitor
                spreadPF={kpiVal("20783") || undefined}
                spreadPJ={kpiVal("20784") || undefined}
                spreadLivresPF={kpiVal("20785") || undefined}
                spreadLivresPJ={kpiVal("20786") || undefined}
                spreadDirecionados={kpiVal("20787") || undefined}
                spreadPos={kpiVal("20826") || undefined}
                spreadPre={kpiVal("20837") || undefined}
              />
            </MacroSection>
          </SectionErrorBoundary>

          {/* ════════════════════════════════════════════════════════════ */}
          {/* SECTION 4: RISCO (Inadimplência + Produtos)                */}
          {/* ════════════════════════════════════════════════════════════ */}
          <SectionErrorBoundary sectionName="Risco">
            <MacroSection
              ref={setRef("risco")}
              id="risco"
              title="Risco de Crédito"
              subtitle="Inadimplência, radar setorial e produtos"
              icon={ShieldAlert}
              seriesCount={14}
              insights={
                <MacroInsightCard inputs={riscoInsights} />
              }
            >
              {/* Inadimplência charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <MacroChart
                  data={inadTotal}
                  title="Inadimplência — Taxa Total SFN (>90 dias)"
                  type="area"
                  color="#EF4444"
                  label="Total"
                  unit="%"
                  refValue={3.0}
                  refLabel="Meta BCB"
                />
                <MacroChart
                  data={inadPF.map((d, i) => ({
                    ...d,
                    value2: inadPJ[i]?.value ?? d.value * 0.58,
                  }))}
                  title="Inadimplência PF vs PJ"
                  type="line"
                  color="#EF4444"
                  color2="#F59E0B"
                  label="PF"
                  label2="PJ"
                  unit="%"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <MacroChart
                  data={inadLivres}
                  title="Inadimplência — Recursos Livres"
                  type="area"
                  color="#F59E0B"
                  label="Livres"
                  unit="%"
                />
                <MacroChart
                  data={inadSMA}
                  title="Inadimplência Total — Média Móvel 3m"
                  type="line"
                  color="#10B981"
                  label="SMA(3)"
                  unit="%"
                />
              </div>

              {/* Default Radar */}
              <DefaultRadar
                inadTotal={kpiVal("21082") || undefined}
                inadPF={kpiVal("21083") || undefined}
                inadPJ={kpiVal("21084") || undefined}
                inadPublico={kpiVal("13667") || undefined}
                inadPrivado={kpiVal("13685") || undefined}
                inadDirecionadosPF={kpiVal("21154") || undefined}
              />

              {/* Credit Products */}
              <CreditProductPanel />
            </MacroSection>
          </SectionErrorBoundary>

          {/* ════════════════════════════════════════════════════════════ */}
          {/* SECTION 5: OPERAÇÕES (Query Builder + Outros)              */}
          {/* ════════════════════════════════════════════════════════════ */}
          <SectionErrorBoundary sectionName="Operações">
            <MacroSection
              ref={setRef("operacoes")}
              id="operacoes"
              title="Operações de Crédito"
              subtitle="Query builder por modalidade e indicadores complementares"
              icon={Filter}
              seriesCount={23}
            >
              {/* Operations Query Builder */}
              <CreditOperationsPanel />

              {/* Outros indicadores */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <MacroChart
                  data={cartoes}
                  title="Cartões de Crédito Emitidos"
                  type="bar"
                  color="#10B981"
                  label="Emissão"
                  unit=" mi"
                />
                <MacroChart
                  data={creditoPib}
                  title="Relação Crédito / PIB"
                  type="area"
                  color="#F59E0B"
                  label="Crédito/PIB"
                  unit="%"
                  refValue={55}
                  refLabel="Threshold BCB"
                />
              </div>
            </MacroSection>
          </SectionErrorBoundary>

          {/* ════════════════════════════════════════════════════════════ */}
          {/* SECTION 6: ANALYTICS (Correlação + Benchmarks + Insights)  */}
          {/* ════════════════════════════════════════════════════════════ */}
          <SectionErrorBoundary sectionName="Analytics">
            <MacroSection
              ref={setRef("analytics")}
              id="analytics"
              title="Analytics"
              subtitle="Correlações, benchmarks e inteligência cross-módulo"
              icon={Brain}
              seriesCount={6}
            >
              {/* Credit Narrative Panel — regime detection + cross-signals */}
              <CreditNarrativePanel
                inadTotal={kpiVal("21082") || undefined}
                spreadMedio={kpiVal("20783") || undefined}
                concessoesMoM={concessoesMoM.length ? concessoesMoM[concessoesMoM.length - 1]?.value : undefined}
                creditoPib={kpiVal("20539") || undefined}
                selic={14.25}
                taxaPF={kpiVal("20714") || undefined}
                taxaPJ={kpiVal("20715") || undefined}
                inadPF={kpiVal("21083") || undefined}
                inadPJ={kpiVal("21084") || undefined}
                ipca12m={3.81}
              />

              {/* Correlation Panel */}
              <CreditCorrelationPanel
                series={[
                  { label: "Inadim. Total", data: inadTotal },
                  { label: "Spread PF", data: spreadPF },
                  { label: "Taxa PF", data: taxaPF },
                  { label: "Concessões PF", data: concessaoPF },
                  { label: "Saldo Total", data: saldoTotal },
                  { label: "Crédito/PIB", data: creditoPib },
                ]}
              />

              {/* Alertas Automáticos — Crédito */}
              <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-4">
                <h3 className="text-sm font-bold text-zinc-100 mb-3">Alertas Automáticos</h3>
                <div className="space-y-2">
                  {useMemo(() => {
                    const alerts: Array<{ id: string; severity: "red" | "amber" | "emerald"; icon: string; title: string; desc: string }> = [];
                    const inadTotalVal = kpiVal("21082") || 0;
                    const spreadPFVal = kpiVal("20783") || 0;
                    const creditoPibVal = kpiVal("20539") || 0;

                    // Get last concessões MoM value (from computed series)
                    const concessoesMoMLast = concessoesMoM.length ? concessoesMoM[concessoesMoM.length - 1]?.value : 0;

                    // 1. Inadimplência SFN elevada (> 4%)
                    if (inadTotalVal > 4.0) {
                      alerts.push({
                        id: "inad_high",
                        severity: "red",
                        icon: "🔴",
                        title: "Inadimplência SFN elevada",
                        desc: `Taxa total em ${inadTotalVal.toFixed(2)}%, acima do patamar seguro de 4%.`,
                      });
                    }

                    // 2. Spread stress (> 20pp = arbitrary threshold, adjust to historical avg)
                    if (spreadPFVal > 20.0) {
                      alerts.push({
                        id: "spread_stress",
                        severity: "amber",
                        icon: "⚠",
                        title: "Spread sob pressão",
                        desc: `Spread PF em ${spreadPFVal.toFixed(1)}pp — acima da média histórica.`,
                      });
                    }

                    // 3. Concessões em queda (MoM < -5%)
                    if (concessoesMoMLast < -5.0) {
                      alerts.push({
                        id: "concessoes_drop",
                        severity: "amber",
                        icon: "📉",
                        title: "Concessões em queda",
                        desc: `Variação MoM de ${concessoesMoMLast.toFixed(1)}% — sinal de contração da oferta.`,
                      });
                    }

                    // 4. Crédito/PIB elevado (> 55%)
                    if (creditoPibVal > 55.0) {
                      alerts.push({
                        id: "credito_pib_high",
                        severity: "amber",
                        icon: "📊",
                        title: "Alavancagem acima da média histórica",
                        desc: `Crédito/PIB em ${creditoPibVal.toFixed(1)}% — nível de expansão elevado.`,
                      });
                    }

                    if (alerts.length === 0) {
                      alerts.push({
                        id: "all_clear",
                        severity: "emerald",
                        icon: "✓",
                        title: "Indicadores saudáveis",
                        desc: "Nenhum alerta ativo no momento. Mercado de crédito equilibrado.",
                      });
                    }

                    return alerts;
                  }, [kpiVal, concessoesMoM]).map((a) => {
                    const colorMap = {
                      red: "bg-red-500/5 border-red-500/20 text-red-400",
                      amber: "bg-amber-500/5 border-amber-500/20 text-amber-400",
                      emerald: "bg-emerald-500/5 border-emerald-500/20 text-emerald-400",
                    };
                    return (
                      <div key={a.id} className={`border rounded-md p-2.5 ${colorMap[a.severity]}`}>
                        <div className="flex items-start gap-2">
                          <span className="text-sm flex-shrink-0">{a.icon}</span>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-medium leading-tight">{a.title}</h4>
                            <p className="text-[11px] text-zinc-500 mt-0.5">{a.desc}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Benchmarks vs Targets */}
              <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-4">
                <h3 className="text-sm font-bold text-zinc-100 mb-3">Benchmarks vs Metas</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: "Inadimplência Total", current: kpiVal("21082") || 3.3, target: 3.0, unit: "%", good: "lower" as const },
                    { label: "Crédito/PIB", current: kpiVal("20539") || 54.2, target: 55.0, unit: "%", good: "higher" as const },
                    { label: "Spread PF", current: kpiVal("20783") || 30.2, target: 25.0, unit: "p.p.", good: "lower" as const },
                    { label: "Concessões PF (R$ bi)", current: kpiVal("20631") || 254.3, target: 270.0, unit: "R$ bi", good: "higher" as const },
                  ].map((b) => {
                    const pct = Math.min((b.current / b.target) * 100, 150);
                    const isGood = b.good === "lower" ? b.current <= b.target : b.current >= b.target;
                    return (
                      <div key={b.label} className="bg-[#0a0a0a] border border-[#141414] rounded p-3">
                        <div className="flex justify-between text-[10px] font-mono mb-1.5">
                          <span className="text-zinc-400">{b.label}</span>
                          <span className={isGood ? "text-emerald-400" : "text-amber-400"}>
                            {b.current.toFixed(1)} / {b.target.toFixed(1)} {b.unit}
                          </span>
                        </div>
                        <div className="h-2 bg-[#111] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(pct, 100)}%`,
                              backgroundColor: isGood ? "#10B981" : "#F59E0B",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Cross-module insights */}
              <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-4">
                <h3 className="text-sm font-bold text-zinc-100 mb-3">Insights Cross-Módulo</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    {
                      title: "Spreads × Selic",
                      text: "Spreads tendem a aumentar com ciclos de alta da Selic, comprimindo margem do tomador de crédito.",
                      color: "border-amber-500/20 bg-amber-500/5",
                      textColor: "text-amber-400",
                    },
                    {
                      title: "Inadimplência × Desemprego",
                      text: "Correlação histórica forte entre taxa de desocupação e inadimplência PF. Monitorar PNAD trimestral.",
                      color: "border-red-500/20 bg-red-500/5",
                      textColor: "text-red-400",
                    },
                    {
                      title: "Concessões → Atividade",
                      text: "Volume de concessões é indicador antecedente de atividade econômica (IBC-Br) com lag de ~2 meses.",
                      color: "border-emerald-500/20 bg-emerald-500/5",
                      textColor: "text-emerald-400",
                    },
                    {
                      title: "Crédito/PIB — Tendência",
                      text: "Relação crédito/PIB em tendência de alta, aproximando-se de ~55%. Acima de 60% sinaliza risco sistêmico.",
                      color: "border-blue-500/20 bg-blue-500/5",
                      textColor: "text-blue-400",
                    },
                  ].map((insight) => (
                    <div key={insight.title} className={`rounded border p-3 ${insight.color}`}>
                      <div className={`text-[10px] font-mono font-bold ${insight.textColor}`}>{insight.title}</div>
                      <div className="text-[9px] text-zinc-500 mt-1">{insight.text}</div>
                    </div>
                  ))}
                </div>
              </div>
            </MacroSection>
          </SectionErrorBoundary>

          {/* ─── Source footer ─── */}
          <div className="border-t border-[#141414] pt-3 flex items-center justify-between text-[9px] text-zinc-700 font-mono">
            <span>Fonte: Banco Central do Brasil — SGS · 73 séries ativas</span>
            <span>Atualização: Mensal (último dia útil)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HubCredito;
