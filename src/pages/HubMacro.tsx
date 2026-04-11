import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { KPICard } from "@/components/hub/KPICard";
import { MacroChart } from "@/components/hub/MacroChart";
import { MacroInsightCard, type InsightInput } from "@/components/hub/MacroInsightCard";
import { MacroSection, MacroSidebar } from "@/components/hub/MacroSection";
import { SectionErrorBoundary } from "@/components/hub/SectionErrorBoundary";
import {
  useHubLatest,
  useHubSeriesBundle,
  useMonetaryEvents,
  pickSeries,
  type SeriesBundle,
} from "@/hooks/useHubData";
import type { MacroChartEvent } from "@/components/hub/MacroChart";
import { AlertCard } from "@/components/hub/AlertCard";
import { InflationCalculator } from "@/components/hub/InflationCalculator";
import { YieldCurveSimulator } from "@/components/hub/YieldCurveSimulator";
import { FiscalCalculator } from "@/components/hub/FiscalCalculator";
import { CorrelationPanel } from "@/components/hub/CorrelationPanel";
import { FocusConsensusPanel } from "@/components/hub/FocusConsensusPanel";
import { MacroNarrativePanel } from "@/components/hub/MacroNarrativePanel";
import {
  DollarSign, Globe, Users, Target, Brain,
  LayoutGrid, ChevronDown,
} from "lucide-react";

/* ─── Period selector ─── */
const PERIODS = ["3m", "6m", "1y", "2y", "5y"] as const;

/* ─── Section definitions ─── */
const SECTIONS = [
  { id: "overview", label: "Visão Geral", icon: LayoutGrid },
  { id: "inflacao-juros", label: "Inflação & Juros", icon: DollarSign },
  { id: "emprego-renda", label: "Emprego & Renda", icon: Users },
  { id: "setor-externo", label: "Setor Externo", icon: Globe },
  { id: "expectativas", label: "Expectativas", icon: Target },
  { id: "analytics", label: "Analytics", icon: Brain },
] as const;

/* ─── Hero KPI definitions (top 8) ─── */
const HERO_CODES = ["432", "13522", "433", "1", "24369", "4503", "990001", "990002"];

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
const HubMacro = () => {
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

  /* ─── Data: KPI cards ─── */
  const { data: cards, isLoading: cardsLoading } = useHubLatest("macro");
  const kpis = cards || [];

  /* ─── Data: Series bundles (lazy per section) ─── */
  // Overview always needs: selic, ipca, cambio, trabalho
  const { data: selicBundle } = useHubSeriesBundle("selic", period, "macro");
  const { data: ipcaBundle } = useHubSeriesBundle("ipca", period, "macro");
  const { data: cambioBundle } = useHubSeriesBundle("cambio", period, "macro");
  const { data: trabalhoBundle } = useHubSeriesBundle("trabalho", period, "macro");
  // Lazy: only fetch when section has been visited
  const { data: pibBundle } = useHubSeriesBundle("pib", period, "macro", sectionVisible("analytics"));
  const { data: dividaBundle } = useHubSeriesBundle("divida", period, "macro", sectionVisible("analytics"));
  const { data: balancaBundle } = useHubSeriesBundle("balanca", period, "macro", sectionVisible("setor-externo"));
  const { data: fiscalBundle } = useHubSeriesBundle("fiscal", period, "macro", sectionVisible("analytics"));
  const { data: focusBundle } = useHubSeriesBundle("focus", period, "macro", sectionVisible("expectativas"));

  const allBundles = { selicBundle, ipcaBundle, cambioBundle, pibBundle, dividaBundle, balancaBundle, trabalhoBundle, fiscalBundle, focusBundle };
  const sparklineMap = useMemo(() => buildSparklineMap(allBundles), [selicBundle, ipcaBundle, cambioBundle, pibBundle, dividaBundle, balancaBundle, trabalhoBundle, fiscalBundle, focusBundle]);

  /* ─── Hero KPIs (top 8) vs rest ─── */
  const heroKPIs = useMemo(() => kpis.filter(k => HERO_CODES.includes(k.serie_code)), [kpis]);
  const secondaryKPIs = useMemo(() => kpis.filter(k => !HERO_CODES.includes(k.serie_code)), [kpis]);

  /* ─── Shorthand series access ─── */
  const selic = pickSeries(selicBundle, 432);
  const selicEfetiva = pickSeries(selicBundle, 11);
  const ipcaMensal = pickSeries(ipcaBundle, 433);
  const ipca12m = pickSeries(ipcaBundle, 13522);
  const ptaxCompra = pickSeries(cambioBundle, 1);
  const ptaxVenda = pickSeries(cambioBundle, 10813);
  // pibBundle[4380] = PIB Trimestral — available after atividade backfill
  const dividaPib = pickSeries(dividaBundle, 4503);
  const dividaBruta = pickSeries(dividaBundle, 13762);
  const balancaSaldo = pickSeries(balancaBundle, 22707);
  const exportacoes = pickSeries(balancaBundle, 22709);
  const importacoes = pickSeries(balancaBundle, 22710);
  const desocupacao = pickSeries(trabalhoBundle, 24369);
  const empregadosTotal = pickSeries(trabalhoBundle, 24370);
  const rendimentoMedio = pickSeries(trabalhoBundle, 24376);
  const massaSalarial = pickSeries(trabalhoBundle, 28544);
  const estoqueCaged = pickSeries(trabalhoBundle, 28763);
  const primario = pickSeries(fiscalBundle, 5364);
  const nfsp = pickSeries(fiscalBundle, 4505);
  const focusIpca = pickSeries(focusBundle, 990001);
  const focusSelic = pickSeries(focusBundle, 990002);
  const focusPib = pickSeries(focusBundle, 990003);
  const focusCambio = pickSeries(focusBundle, 990004);

  /* ─── Monetary policy events (COPOM + FOMC overlay) ─── */
  const { data: monetaryEvents } = useMonetaryEvents("both");
  const copomEvents: MacroChartEvent[] = useMemo(() => {
    if (!monetaryEvents) return [];
    return monetaryEvents
      .filter((e) => e.authority === "COPOM")
      .map((e) => ({
        date: e.event_date,
        label: `${e.authority} ${e.bps_change && e.bps_change > 0 ? "+" : ""}${e.bps_change ?? 0}bps → ${e.rate_after}%`,
        kind: e.decision,
        authority: e.authority,
        rationale: e.rationale || undefined,
      }));
  }, [monetaryEvents]);
  const fomcEvents: MacroChartEvent[] = useMemo(() => {
    if (!monetaryEvents) return [];
    return monetaryEvents
      .filter((e) => e.authority === "FOMC")
      .map((e) => ({
        date: e.event_date,
        label: `${e.authority} ${e.bps_change && e.bps_change > 0 ? "+" : ""}${e.bps_change ?? 0}bps → ${e.rate_after}%`,
        kind: e.decision,
        authority: e.authority,
        rationale: e.rationale || undefined,
      }));
  }, [monetaryEvents]);
  const allMonetaryEvents = useMemo(() => [...copomEvents, ...fomcEvents], [copomEvents, fomcEvents]);

  /* ─── KPI value helper ─── */
  const kpiVal = (code: string) => kpis.find(k => k.serie_code === code)?.last_value ?? 0;

  /* ─── Scroll to section ─── */
  const scrollTo = useCallback((id: string) => {
    setActiveSection(id);
    const el = sectionRefs.current[id] || document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  /* ─── IntersectionObserver for active section + lazy-load tracking ─── */
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
    for (const id of SECTIONS.map(s => s.id)) {
      const el = document.getElementById(id);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── Insight inputs per section ─── */
  const inflacaoInsights: InsightInput[] = useMemo(() => [
    { code: "ipca12m", label: "IPCA 12 meses", data: ipca12m, unit: "%", target: 3.0, band: 1.5 },
    { code: "selic", label: "Selic Meta", data: selic, unit: "% a.a." },
    { code: "ptax", label: "Câmbio PTAX", data: ptaxCompra, unit: "R$" },
  ], [ipca12m, selic, ptaxCompra]);

  const trabalhoInsights: InsightInput[] = useMemo(() => [
    { code: "desocupacao", label: "Desocupação", data: desocupacao, unit: "%", lowerIsBetter: true },
    { code: "rendimento", label: "Rendimento Médio", data: rendimentoMedio, unit: "R$" },
    { code: "massa", label: "Massa Salarial", data: massaSalarial, unit: "R$ mi" },
  ], [desocupacao, rendimentoMedio, massaSalarial]);

  const externoInsights: InsightInput[] = useMemo(() => [
    { code: "ptax_ext", label: "Dólar PTAX", data: ptaxCompra, unit: "R$", lowerIsBetter: true },
    { code: "balanca", label: "Balança Comercial", data: balancaSaldo, unit: "US$ mi" },
  ], [ptaxCompra, balancaSaldo]);

  const expectativasInsights: InsightInput[] = useMemo(() => [
    { code: "focus_ipca", label: "Focus IPCA 2026", data: focusIpca, unit: "%", target: 3.0, band: 1.5 },
    { code: "focus_selic", label: "Focus Selic 2026", data: focusSelic, unit: "%" },
    { code: "focus_pib", label: "Focus PIB 2026", data: focusPib, unit: "%" },
    { code: "focus_cambio", label: "Focus Câmbio 2026", data: focusCambio, unit: "R$" },
  ], [focusIpca, focusSelic, focusPib, focusCambio]);

  return (
    <div className="w-full">
      {/* ═══ Sticky header ═══ */}
      <div className="sticky top-14 z-20 bg-[#0a0a0a]/95 backdrop-blur-sm -mx-6 px-6 py-3 border-b border-[#141414]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-base font-bold text-zinc-100 tracking-tight font-mono">
              Panorama Macroeconômico
            </h1>
            <span className="text-[9px] text-zinc-600 font-mono">
              {kpis.length} indicadores · BACEN SGS + Focus
            </span>
          </div>
          <div className="flex items-center gap-0.5 bg-[#111111] border border-[#1a1a1a] rounded-md p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2.5 py-1 text-[10px] font-mono rounded transition-colors ${
                  period === p
                    ? "bg-[#0B6C3E] text-white"
                    : "text-zinc-600 hover:text-zinc-300"
                }`}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ Layout: sidebar + content ═══ */}
      <div className="flex gap-6 mt-4">
        {/* Sidebar nav */}
        <div className="hidden md:block w-40 flex-shrink-0">
          <MacroSidebar
            items={SECTIONS.map(s => ({ id: s.id, label: s.label, icon: s.icon }))}
            activeId={activeSection}
            onNavigate={scrollTo}
          />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-8">

          {/* ═══════════════════════════════════════════
              VISÃO GERAL — Hero KPIs + Alerts
              ═══════════════════════════════════════════ */}
          <section id="overview" className="scroll-mt-32">
            {/* Alerts */}
            <AlertCard kpis={kpis} module="macro" />

            {/* Hero KPIs — top 8 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
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

            {/* Expandable secondary KPIs */}
            {secondaryKPIs.length > 0 && (
              <div className="mt-2">
                <button
                  onClick={() => setHeroExpanded(!heroExpanded)}
                  className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400 font-mono transition-colors mb-2"
                >
                  <ChevronDown className={`w-3 h-3 transition-transform ${heroExpanded ? "rotate-180" : ""}`} />
                  {heroExpanded ? "Recolher" : `Ver todos os ${secondaryKPIs.length} indicadores`}
                </button>
                {heroExpanded && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
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
              </div>
            )}

            {/* Overview charts — key snapshot */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-4">
              <MacroChart data={selic} title="Selic Meta" type="area" color="#0B6C3E" label="Selic" unit="% a.a." events={copomEvents} />
              <MacroChart data={ipcaMensal} title="IPCA Mensal" type="bar" color="#10B981" label="IPCA" unit="%" events={copomEvents} />
              <MacroChart data={ptaxCompra} title="Câmbio PTAX Compra" type="line" color="#F59E0B" label="PTAX" unit=" R$" events={allMonetaryEvents} />
              <MacroChart data={desocupacao} title="Taxa de Desocupação" type="area" color="#8B5CF6" label="Desocupação" unit="%" />
            </div>
          </section>

          {/* ═══════════════════════════════════════════
              INFLAÇÃO & JUROS
              ═══════════════════════════════════════════ */}
          <SectionErrorBoundary sectionName="Inflação & Juros">
            <MacroSection
              id="inflacao-juros"
              title="Inflação & Juros"
              subtitle="Selic, IPCA, agregados monetários e curva de juros"
              icon={DollarSign}
              seriesCount={4}
              insights={<MacroInsightCard inputs={inflacaoInsights} />}
              ref={(el) => { sectionRefs.current["inflacao-juros"] = el; }}
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <MacroChart data={selic} title="Selic Meta — Taxa Básica de Juros" type="area" color="#0B6C3E" label="Selic" unit="% a.a." events={copomEvents} />
                <MacroChart data={selicEfetiva} title="Selic Efetiva — Overnight" type="line" color="#6366F1" label="Selic Efetiva" unit="% a.a." events={copomEvents} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <MacroChart data={ipcaMensal} title="IPCA Mensal" type="bar" color="#10B981" label="IPCA" unit="%" events={copomEvents} />
                <MacroChart data={ipca12m} title="IPCA Acumulado 12 Meses" type="area" color="#EF4444" label="IPCA 12m" unit="%" events={copomEvents} />
              </div>
              <InflationCalculator ipcaData={ipcaMensal} />
              <YieldCurveSimulator
                currentSelic={kpiVal("432") || 14.25}
                focusSelic2026={kpiVal("990002") || 12.5}
                focusSelic2027={kpiVal("990012") || 10.5}
              />
            </MacroSection>
          </SectionErrorBoundary>

          {/* ═══════════════════════════════════════════
              EMPREGO & RENDA
              ═══════════════════════════════════════════ */}
          <SectionErrorBoundary sectionName="Emprego & Renda">
            <MacroSection
              id="emprego-renda"
              title="Emprego & Renda"
              subtitle="PNAD Contínua, CAGED, rendimento e massa salarial"
              icon={Users}
              seriesCount={9}
              insights={<MacroInsightCard inputs={trabalhoInsights} />}
              ref={(el) => { sectionRefs.current["emprego-renda"] = el; }}
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <MacroChart data={desocupacao} title="Taxa de Desocupação — PNAD Contínua" type="area" color="#8B5CF6" label="Desocupação" unit="%" />
                <MacroChart data={rendimentoMedio} title="Rendimento Médio Real Habitual" type="line" color="#F59E0B" label="Rendimento" unit=" R$" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <MacroChart data={massaSalarial} title="Massa Salarial Real" type="area" color="#06B6D4" label="Massa Salarial" unit=" R$ mi" />
                <MacroChart data={empregadosTotal} title="Empregados Total — PNAD" type="line" color="#10B981" label="Empregados" unit=" mil" />
              </div>
              <MacroChart data={estoqueCaged} title="Estoque de Empregos Formais — CAGED" type="area" color="#0B6C3E" label="Estoque" unit=" vínculos" />
            </MacroSection>
          </SectionErrorBoundary>

          {/* ═══════════════════════════════════════════
              SETOR EXTERNO
              ═══════════════════════════════════════════ */}
          <SectionErrorBoundary sectionName="Setor Externo">
            <MacroSection
              id="setor-externo"
              title="Setor Externo"
              subtitle="Câmbio, balança comercial, reservas e investimento direto"
              icon={Globe}
              seriesCount={5}
              insights={<MacroInsightCard inputs={externoInsights} />}
              ref={(el) => { sectionRefs.current["setor-externo"] = el; }}
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <MacroChart data={ptaxCompra} title="PTAX Compra — USD/BRL" type="line" color="#F59E0B" label="PTAX Compra" unit=" R$" />
                <MacroChart data={ptaxVenda} title="PTAX Venda — USD/BRL" type="line" color="#EF4444" label="PTAX Venda" unit=" R$" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <MacroChart data={balancaSaldo} title="Balança Comercial — Saldo Mensal" type="bar" color="#0B6C3E" label="Saldo" unit=" US$ mi" />
                <MacroChart data={exportacoes} title="Exportações" type="area" color="#10B981" label="Exportações" unit=" US$ mi" />
              </div>
              <MacroChart data={importacoes} title="Importações" type="area" color="#8B5CF6" label="Importações" unit=" US$ mi" />
            </MacroSection>
          </SectionErrorBoundary>

          {/* ═══════════════════════════════════════════
              EXPECTATIVAS
              ═══════════════════════════════════════════ */}
          <SectionErrorBoundary sectionName="Expectativas">
            <MacroSection
              id="expectativas"
              title="Expectativas"
              subtitle="Focus BACEN — consenso de mercado para IPCA, Selic, PIB e câmbio"
              icon={Target}
              seriesCount={6}
              insights={<MacroInsightCard inputs={expectativasInsights} />}
              ref={(el) => { sectionRefs.current["expectativas"] = el; }}
            >
              <FocusConsensusPanel
                entries={[
                  { label: "IPCA 2026", expected: kpiVal("990001") || 4.31, actual: kpiVal("13522") || 3.81, unit: "%", prevExpected: (focusIpca.length > 5 ? focusIpca[focusIpca.length - 6].value : undefined) },
                  { label: "Selic 2026", expected: kpiVal("990002") || 12.5, actual: kpiVal("432") || 14.75, unit: "%", prevExpected: (focusSelic.length > 5 ? focusSelic[focusSelic.length - 6].value : undefined) },
                  { label: "PIB 2026", expected: kpiVal("990003") || 1.85, actual: 0, unit: "%", prevExpected: (focusPib.length > 5 ? focusPib[focusPib.length - 6].value : undefined) },
                  { label: "Câmbio 2026", expected: kpiVal("990004") || 5.4, actual: kpiVal("1") || 5.17, unit: "", prevExpected: (focusCambio.length > 5 ? focusCambio[focusCambio.length - 6].value : undefined) },
                ]}
              />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <MacroChart data={focusIpca} title="Focus — IPCA Esperado 2026" type="line" color="#10B981" label="IPCA 2026" unit="%" />
                <MacroChart data={focusSelic} title="Focus — Selic Esperada 2026" type="line" color="#0B6C3E" label="Selic 2026" unit="% a.a." />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <MacroChart data={focusPib} title="Focus — PIB Esperado 2026" type="line" color="#6366F1" label="PIB 2026" unit="%" />
                <MacroChart data={focusCambio} title="Focus — Câmbio Esperado 2026" type="line" color="#F59E0B" label="Câmbio 2026" unit=" R$/US$" />
              </div>
            </MacroSection>
          </SectionErrorBoundary>

          {/* ═══════════════════════════════════════════
              ANALYTICS — Correlação, Fiscal, Insights
              ═══════════════════════════════════════════ */}
          <SectionErrorBoundary sectionName="Analytics">
            <MacroSection
              id="analytics"
              title="Analytics"
              subtitle="Correlações, projeções fiscais e benchmarks vs metas"
              icon={Brain}
              ref={(el) => { sectionRefs.current["analytics"] = el; }}
            >
              {/* Macro Intelligence — regime + cross-module signals */}
              <MacroNarrativePanel
                selic={kpiVal("432") || 14.25}
                ipca12m={kpiVal("13522") || 3.81}
                desocupacao={kpiVal("24369") || 5.8}
                dividaPib={kpiVal("4503") || 57.06}
                ptax={kpiVal("1") || 5.17}
                focusIpca={kpiVal("990001") || undefined}
                focusSelic={kpiVal("990002") || undefined}
              />

              <CorrelationPanel
                series={[
                  { label: "Selic", data: selic },
                  { label: "IPCA", data: ipcaMensal },
                  { label: "Câmbio", data: ptaxCompra },
                  { label: "Desemprego", data: desocupacao },
                  { label: "Dívida/PIB", data: dividaPib },
                ]}
              />

              <FiscalCalculator
                currentDebtGdp={kpiVal("4503") || 57.06}
                currentPrimary={kpiVal("5364") || 1.57}
              />

              {/* Benchmarks vs Metas */}
              <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
                <h3 className="text-xs font-medium text-zinc-400 font-mono mb-3">
                  Benchmarks vs Metas Oficiais
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  {[
                    { label: "IPCA 12m", actual: kpiVal("13522") || 3.81, target: 3.0, band: 1.5, unit: "%" },
                    { label: "Resultado Primário", actual: kpiVal("5364") || 1.57, target: 0.5, band: 0.25, unit: "% PIB" },
                    { label: "Dívida/PIB", actual: kpiVal("4503") || 57.06, target: 60.0, band: 5, unit: "%" },
                    { label: "Desocupação", actual: kpiVal("24369") || 5.8, target: 7.0, band: 1, unit: "%" },
                  ].map((b) => {
                    const inBand = Math.abs(b.actual - b.target) <= b.band;
                    const above = b.actual > b.target + b.band;
                    return (
                      <div key={b.label} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-md p-3">
                        <span className="text-[9px] text-zinc-600 font-mono block mb-1">{b.label}</span>
                        <div className="flex items-baseline gap-2">
                          <span className={`text-lg font-bold font-mono ${inBand ? "text-emerald-400" : above ? "text-red-400" : "text-amber-400"}`}>
                            {b.actual.toFixed(1)}
                          </span>
                          <span className="text-[10px] text-zinc-600 font-mono">
                            meta: {b.target}{b.unit}
                          </span>
                        </div>
                        <div className="w-full bg-[#1a1a1a] rounded-full h-1.5 mt-2">
                          <div
                            className={`h-1.5 rounded-full ${inBand ? "bg-emerald-500" : above ? "bg-red-500" : "bg-amber-500"}`}
                            style={{ width: `${Math.min(100, (b.actual / (b.target + b.band * 2)) * 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Fiscal charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <MacroChart data={dividaPib} title="Dívida Líquida / PIB" type="area" color="#EF4444" label="Dívida/PIB" unit="%" />
                <MacroChart data={dividaBruta} title="Dívida Bruta / PIB" type="area" color="#F59E0B" label="Dívida Bruta" unit="%" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <MacroChart data={primario} title="Resultado Primário 12m" type="bar" color="#10B981" label="Primário" unit="% PIB" />
                <MacroChart data={nfsp} title="Necessidade Financ. Governo" type="bar" color="#8B5CF6" label="NFSP" unit="% PIB" />
              </div>
            </MacroSection>
          </SectionErrorBoundary>

          {/* ─── Footer ─── */}
          <div className="border-t border-[#141414] pt-3 flex items-center justify-between text-[9px] text-zinc-700 font-mono">
            <span>Fonte: Banco Central do Brasil — SGS + Focus</span>
            <span>Atualização: Diária (D+1 útil)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HubMacro;
