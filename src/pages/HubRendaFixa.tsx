import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { HubSEO } from "@/lib/seo";
import { KPICard } from "@/components/hub/KPICard";
import { MacroChart } from "@/components/hub/MacroChart";
import { AlertCard } from "@/components/hub/AlertCard";
import { BondCalculator } from "@/components/hub/BondCalculator";
import { SpreadCreditoPrivado } from "@/components/hub/SpreadCreditoPrivado";
import { MacroSection, MacroSidebar } from "@/components/hub/MacroSection";
import { SectionErrorBoundary } from "@/components/hub/SectionErrorBoundary";
import { MacroInsightCard, type InsightInput } from "@/components/hub/MacroInsightCard";
import { FixedIncomeNarrativePanel } from "@/components/hub/FixedIncomeNarrativePanel";
import { YieldCurveSimulator } from "@/components/hub/YieldCurveSimulator";
import {
  useHubLatest,
  useHubSeriesBundle,
  pickSeries,
  RENDA_FIXA_SAMPLE,
  generateSampleSeries,
} from "@/hooks/useHubData";
import {
  TrendingUp, Landmark,
  LineChart as LineChartIcon, Brain, BarChart3,
} from "lucide-react";

/* ─── Period config ─── */
const PERIODS = ["3m", "6m", "1y", "2y", "5y"] as const;

/* ─── Section config ─── */
const SECTIONS = [
  { id: "overview", label: "Visão Geral", icon: BarChart3 },
  { id: "taxas-curva", label: "Taxas & Curva", icon: LineChartIcon },
  { id: "titulos", label: "Títulos Públicos", icon: TrendingUp },
  { id: "credpriv", label: "Crédito Privado", icon: Landmark },
  { id: "analytics", label: "Analytics", icon: Brain },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

/* ─── Sparkline helper ─── */
function toSparkline(series: { date: string; value: number }[], points = 20) {
  if (!series.length) return [];
  const step = Math.max(1, Math.floor(series.length / points));
  return series.filter((_, i) => i % step === 0).map((d) => ({ value: d.value }));
}

/* ─── Accent colors ─── */
const ACCENT = "#10B981";
const INDIGO = "#6366F1";
const AMBER = "#F59E0B";
const RED = "#EF4444";

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT — HubRendaFixa (H1.3)
   Audit batch 16 — 5 narrative sections, lazy-load, deep-linking, MacroChart v2
   ═══════════════════════════════════════════════════════════════════════════ */
const HubRendaFixa = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [period, setPeriod] = useState<string>(searchParams.get("period") || "1y");
  const [activeSection, setActiveSection] = useState<SectionId>(
    (searchParams.get("section") as SectionId) || "overview"
  );

  /* ─── Deep-linking: sync URL ↔ state ─── */
  useEffect(() => {
    const params: Record<string, string> = {};
    if (activeSection !== "overview") params.section = activeSection;
    if (period !== "1y") params.period = period;
    setSearchParams(params, { replace: true });
  }, [activeSection, period, setSearchParams]);

  /* ─── Scroll-spy via IntersectionObserver ─── */
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [visitedSections, setVisitedSections] = useState<Set<SectionId>>(
    () => new Set(["overview"])
  );

  const setSectionRef = useCallback(
    (id: SectionId) => (el: HTMLDivElement | null) => {
      sectionRefs.current[id] = el;
    },
    []
  );

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    SECTIONS.forEach((sec) => {
      const el = sectionRefs.current[sec.id];
      if (!el) return;
      // Preload observer — triggers data fetch well before section enters viewport
      const preloadObs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setVisitedSections((prev) => {
              if (prev.has(sec.id as SectionId)) return prev;
              return new Set(prev).add(sec.id as SectionId);
            });
          }
        },
        { rootMargin: "0px 0px 300px 0px", threshold: 0 }
      );
      preloadObs.observe(el);
      observers.push(preloadObs);
      // Active section observer — narrow band near top for sidebar highlight
      const activeObs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveSection(sec.id as SectionId);
          }
        },
        { rootMargin: "-120px 0px -60% 0px", threshold: 0 }
      );
      activeObs.observe(el);
      observers.push(activeObs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const sectionVisible = useCallback(
    (id: SectionId) => visitedSections.has(id),
    [visitedSections]
  );

  /* ─── KPI data ─── */
  const { isLoading: cardsLoading } = useHubLatest("macro");
  const kpis = RENDA_FIXA_SAMPLE;

  /* ─── Series bundles (lazy-loaded per section) ─── */
  // Overview + Taxas & Curva (eager — first two sections)
  const { data: taxaRefBundle } = useHubSeriesBundle("taxa_ref", period, "macro", true);
  const { data: curvaDiBundle } = useHubSeriesBundle("curva_di", period, "macro", true);

  // Títulos Públicos (lazy)
  const { data: ntnbBundle } = useHubSeriesBundle("ntnb", period, "macro", sectionVisible("titulos"));
  const { data: breakevenBundle } = useHubSeriesBundle("breakeven", period, "macro", sectionVisible("titulos"));
  const { data: tesouroBundle } = useHubSeriesBundle("tesouro", period, "macro", sectionVisible("titulos"));
  const { data: poupancaBundle } = useHubSeriesBundle("poupanca", period, "macro", sectionVisible("titulos"));

  // Crédito Privado (lazy)
  const { data: credprivBundle } = useHubSeriesBundle("credpriv", period, "macro", sectionVisible("credpriv"));

  /* ─── Extract individual series with fallbacks ─── */
  const selic = pickSeries(taxaRefBundle, "432").length ? pickSeries(taxaRefBundle, "432") : generateSampleSeries(14.25, 24, 0.008);
  const cdi = pickSeries(taxaRefBundle, "4392").length ? pickSeries(taxaRefBundle, "4392") : generateSampleSeries(14.15, 24, 0.008);
  const tr = pickSeries(taxaRefBundle, "226").length ? pickSeries(taxaRefBundle, "226") : generateSampleSeries(0.18, 24, 0.15);
  const tlp = pickSeries(taxaRefBundle, "27547").length ? pickSeries(taxaRefBundle, "27547") : generateSampleSeries(7.10, 24, 0.02);
  const poupanca = pickSeries(poupancaBundle, "195").length ? pickSeries(poupancaBundle, "195") : generateSampleSeries(7.45, 24, 0.005);

  const di30 = pickSeries(curvaDiBundle, "7813").length ? pickSeries(curvaDiBundle, "7813") : generateSampleSeries(14.18, 24, 0.01);
  const di360 = pickSeries(curvaDiBundle, "7817").length ? pickSeries(curvaDiBundle, "7817") : generateSampleSeries(14.82, 24, 0.012);
  const di720 = pickSeries(curvaDiBundle, "7818").length ? pickSeries(curvaDiBundle, "7818") : generateSampleSeries(14.55, 24, 0.015);
  const di1800 = pickSeries(curvaDiBundle, "7821").length ? pickSeries(curvaDiBundle, "7821") : generateSampleSeries(13.65, 24, 0.018);

  const ntnb2029 = pickSeries(ntnbBundle, "12460").length ? pickSeries(ntnbBundle, "12460") : generateSampleSeries(7.25, 24, 0.015);
  const ntnb2035 = pickSeries(ntnbBundle, "12461").length ? pickSeries(ntnbBundle, "12461") : generateSampleSeries(7.10, 24, 0.012);
  const ntnb2045 = pickSeries(ntnbBundle, "12462").length ? pickSeries(ntnbBundle, "12462") : generateSampleSeries(6.85, 24, 0.010);

  const bei1 = pickSeries(breakevenBundle, "990101").length ? pickSeries(breakevenBundle, "990101") : generateSampleSeries(5.82, 24, 0.02);
  const bei3 = pickSeries(breakevenBundle, "990102").length ? pickSeries(breakevenBundle, "990102") : generateSampleSeries(5.35, 24, 0.015);
  const bei5 = pickSeries(breakevenBundle, "990103").length ? pickSeries(breakevenBundle, "990103") : generateSampleSeries(5.10, 24, 0.012);

  const estoqueTD = pickSeries(tesouroBundle, "990201").length ? pickSeries(tesouroBundle, "990201") : generateSampleSeries(142.5, 24, 0.012);
  const vendasTD = pickSeries(tesouroBundle, "990202").length ? pickSeries(tesouroBundle, "990202") : generateSampleSeries(3.85, 24, 0.1);

  const spreadAASeries = pickSeries(credprivBundle, "990301").length ? pickSeries(credprivBundle, "990301") : generateSampleSeries(1.35, 24, 0.04);
  const spreadASeries = pickSeries(credprivBundle, "990302").length ? pickSeries(credprivBundle, "990302") : generateSampleSeries(2.10, 24, 0.05);
  const emissoesSeries = pickSeries(credprivBundle, "990303").length ? pickSeries(credprivBundle, "990303") : generateSampleSeries(28.4, 24, 0.08);

  /* ─── Sparkline map ─── */
  const sparklineMap = useMemo(() => {
    const map: Record<string, { value: number }[]> = {};
    map["432"] = toSparkline(selic);
    map["4189"] = toSparkline(selic);
    map["4392"] = toSparkline(cdi);
    map["226"] = toSparkline(tr);
    map["27547"] = toSparkline(tlp);
    map["256"] = toSparkline(tlp);
    map["7813"] = toSparkline(di30);
    map["7814"] = toSparkline(di30);
    map["7815"] = toSparkline(di30);
    map["7816"] = toSparkline(di360);
    map["7817"] = toSparkline(di360);
    map["7818"] = toSparkline(di720);
    map["7819"] = toSparkline(di720);
    map["7820"] = toSparkline(di1800);
    map["7821"] = toSparkline(di1800);
    map["12460"] = toSparkline(ntnb2029);
    map["12461"] = toSparkline(ntnb2035);
    map["12462"] = toSparkline(ntnb2045);
    map["12463"] = toSparkline(ntnb2045);
    map["990101"] = toSparkline(bei1);
    map["990102"] = toSparkline(bei3);
    map["990103"] = toSparkline(bei5);
    map["195"] = toSparkline(poupanca);
    map["990201"] = toSparkline(estoqueTD);
    map["990202"] = toSparkline(vendasTD);
    map["990203"] = toSparkline(estoqueTD);
    map["990301"] = toSparkline(spreadAASeries);
    map["990302"] = toSparkline(spreadASeries);
    map["990303"] = toSparkline(emissoesSeries);
    map["990304"] = toSparkline(emissoesSeries);
    return map;
  }, [selic, cdi, tr, tlp, di30, di360, di720, di1800, ntnb2029, ntnb2035, ntnb2045, bei1, bei3, bei5, poupanca, estoqueTD, vendasTD, spreadAASeries, spreadASeries, emissoesSeries]);

  /* ─── Yield Curve snapshot ─── */
  const yieldCurveData = useMemo(() => [
    { tenor: "30d", days: 30, rate: kpis.find((k) => k.serie_code === "7813")?.last_value ?? 14.18 },
    { tenor: "60d", days: 60, rate: kpis.find((k) => k.serie_code === "7814")?.last_value ?? 14.32 },
    { tenor: "90d", days: 90, rate: kpis.find((k) => k.serie_code === "7815")?.last_value ?? 14.48 },
    { tenor: "180d", days: 180, rate: kpis.find((k) => k.serie_code === "7816")?.last_value ?? 14.65 },
    { tenor: "1a", days: 360, rate: kpis.find((k) => k.serie_code === "7817")?.last_value ?? 14.82 },
    { tenor: "2a", days: 720, rate: kpis.find((k) => k.serie_code === "7818")?.last_value ?? 14.55 },
    { tenor: "3a", days: 1080, rate: kpis.find((k) => k.serie_code === "7819")?.last_value ?? 14.20 },
    { tenor: "4a", days: 1440, rate: kpis.find((k) => k.serie_code === "7820")?.last_value ?? 13.90 },
    { tenor: "5a", days: 1800, rate: kpis.find((k) => k.serie_code === "7821")?.last_value ?? 13.65 },
  ], [kpis]);

  /* Curve shape analysis */
  const curveShape = useMemo(() => {
    const short = yieldCurveData[0]?.rate ?? 0;
    const mid = yieldCurveData[4]?.rate ?? 0;
    const long = yieldCurveData[8]?.rate ?? 0;
    if (mid > short && long > mid) return { shape: "Normal (positiva)", color: "text-emerald-400" };
    if (mid > short && long < mid) return { shape: "Corcova (hump)", color: "text-amber-400" };
    if (mid < short && long < short) return { shape: "Invertida", color: "text-red-400" };
    return { shape: "Flat", color: "text-zinc-400" };
  }, [yieldCurveData]);

  /* ─── Yield Curve for MacroChart v2 ─── */
  const yieldCurveChartData = useMemo(
    () => yieldCurveData.map((v) => ({ date: v.tenor, value: v.rate })),
    [yieldCurveData]
  );

  /* ─── NTN-B term structure for MacroChart v2 ─── */
  const ntnbTermStructure = useMemo(() => [
    { date: "2029", value: kpis.find((k) => k.serie_code === "12460")?.last_value ?? 7.25 },
    { date: "2035", value: kpis.find((k) => k.serie_code === "12461")?.last_value ?? 7.10 },
    { date: "2045", value: kpis.find((k) => k.serie_code === "12462")?.last_value ?? 6.85 },
    { date: "2055", value: kpis.find((k) => k.serie_code === "12463")?.last_value ?? 6.70 },
  ], [kpis]);

  /* ─── Insight inputs for dynamic MacroInsightCards ─── */
  const taxasCurvaInsights: InsightInput[] = useMemo(() => [
    { code: "432", label: "Selic Meta", data: selic, unit: "% a.a.", target: 12.50, band: 2.0, lowerIsBetter: true },
    { code: "7817", label: "DI Pré 360d", data: di360, unit: "% a.a." },
    { code: "7821", label: "DI Pré 1800d", data: di1800, unit: "% a.a." },
  ], [selic, di360, di1800]);

  const titulosInsights: InsightInput[] = useMemo(() => [
    { code: "12460", label: "NTN-B 2029", data: ntnb2029, unit: "% a.a.", target: 6.0, band: 1.0, lowerIsBetter: true },
    { code: "990101", label: "Breakeven 1a", data: bei1, unit: "%", target: 4.50, band: 1.5, lowerIsBetter: true },
    { code: "990201", label: "Estoque TD", data: estoqueTD, unit: "R$ bi" },
  ], [ntnb2029, bei1, estoqueTD]);

  const credprivInsights: InsightInput[] = useMemo(() => [
    { code: "990301", label: "Spread AA", data: spreadAASeries, unit: "p.p.", target: 1.20, band: 0.5, lowerIsBetter: true },
    { code: "990302", label: "Spread A", data: spreadASeries, unit: "p.p.", target: 1.80, band: 0.8, lowerIsBetter: true },
    { code: "990303", label: "Emissões Deb.", data: emissoesSeries, unit: "R$ bi" },
  ], [spreadAASeries, spreadASeries, emissoesSeries]);

  /* ─── IMA-B Proxy (computed from NTN-B yields) ─── */
  const imaBProxy = useMemo(() => {
    // Use 3 most recent NTN-B data points to estimate returns
    const ntnb2029_prev = ntnb2029.length >= 2 ? ntnb2029[ntnb2029.length - 2]?.value ?? 7.25 : 7.25;
    const ntnb2029_curr = ntnb2029.length > 0 ? ntnb2029[ntnb2029.length - 1]?.value ?? 7.25 : 7.25;
    const ntnb2035_prev = ntnb2035.length >= 2 ? ntnb2035[ntnb2035.length - 2]?.value ?? 7.10 : 7.10;
    const ntnb2035_curr = ntnb2035.length > 0 ? ntnb2035[ntnb2035.length - 1]?.value ?? 7.10 : 7.10;
    const ntnb2045_prev = ntnb2045.length >= 2 ? ntnb2045[ntnb2045.length - 2]?.value ?? 6.85 : 6.85;
    const ntnb2045_curr = ntnb2045.length > 0 ? ntnb2045[ntnb2045.length - 1]?.value ?? 6.85 : 6.85;

    // Approximate duration: short=3y, mid=7y, long=15y
    const shortReturn = 3 * (ntnb2029_prev - ntnb2029_curr);
    const midReturn = 7 * (ntnb2035_prev - ntnb2035_curr);
    const longReturn = 15 * (ntnb2045_prev - ntnb2045_curr);

    return { shortReturn, midReturn, longReturn };
  }, [ntnb2029, ntnb2035, ntnb2045]);

  /* ─── Alert Signals (Fixed Income) ─── */
  const fixedIncomeAlerts = useMemo(() => {
    const alerts: Array<{ type: string; title: string; description: string; severity: 'critical' | 'warning' | 'info' }> = [];

    // 1. Inversão de Curva: Compare DI 30d vs DI 1800d
    const di30_curr = di30.length > 0 ? di30[di30.length - 1]?.value ?? 14.18 : 14.18;
    const di1800_curr = di1800.length > 0 ? di1800[di1800.length - 1]?.value ?? 13.65 : 13.65;
    if (di30_curr > di1800_curr) {
      alerts.push({
        type: 'curva_invertida',
        title: 'Curva Invertida',
        description: `DI 30d (${di30_curr.toFixed(2)}%) > DI 1800d (${di1800_curr.toFixed(2)}%) — sinalizando stress econômico potencial`,
        severity: 'warning'
      });
    }

    // 2. Breakeven Desancoragem: If breakeven 3a > 5% (target 3.0% + 1.5pp tolerance)
    const bei3_curr = bei3.length > 0 ? bei3[bei3.length - 1]?.value ?? 5.35 : 5.35;
    if (bei3_curr > 5.0) {
      alerts.push({
        type: 'breakeven_desancora',
        title: 'Breakeven Desancorado',
        description: `Inflação implícita 3a em ${bei3_curr.toFixed(2)}% — acima do intervalo de tolerância (3.0% ± 1.5pp)`,
        severity: 'warning'
      });
    }

    // 3. Juro Real Elevado: If Selic - IPCA12m > 7%
    const selic_curr = selic.length > 0 ? selic[selic.length - 1]?.value ?? 14.25 : 14.25;
    const ipca12m = RENDA_FIXA_SAMPLE.find((k) => k.serie_code === "13522")?.last_value ?? 5.06;
    const realRate = selic_curr - ipca12m;
    if (realRate > 7.0) {
      alerts.push({
        type: 'juro_real_elevado',
        title: 'Juro Real Restritivo',
        description: `Taxa real (${realRate.toFixed(2)}%) elevada — acima de 7% a.a., indicando postura muito restritiva`,
        severity: 'info'
      });
    }

    return alerts;
  }, [di30, di1800, bei3, selic]);

  /* ─── Sidebar click handler ─── */
  const scrollToSection = useCallback((id: string) => {
    const el = sectionRefs.current[id];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="flex gap-4 w-full">
      <HubSEO title="Renda Fixa" description="Curva DI, NTN-B, Tesouro Direto e crédito privado — simuladores de yield curve, calculadora de bonds e breakeven inflation." path="/renda-fixa" />
      {/* ─── Sidebar ─── */}
      <MacroSidebar
        items={SECTIONS.map((s) => ({ id: s.id, label: s.label, icon: s.icon }))}
        activeId={activeSection}
        onNavigate={scrollToSection}
      />

      {/* ─── Main content ─── */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* ─── Sticky header ─── */}
        <div className="sticky top-14 z-20 bg-[#0a0a0a]/95 backdrop-blur-sm -mx-6 px-6 py-3 border-b border-[#141414]">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <h1 className="text-base font-bold text-zinc-100 tracking-tight">Renda Fixa</h1>
              <span className="text-[9px] text-zinc-600 font-mono hidden sm:inline">
                {kpis.length} indicadores · Curva DI · NTN-B · Crédito Privado
              </span>
              <span className={`text-[9px] font-mono font-bold ${curveShape.color}`}>
                Curva: {curveShape.shape}
              </span>
            </div>
            <div className="flex items-center gap-0.5 bg-[#111111] border border-[#1a1a1a] rounded-md p-0.5">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-2 py-1 text-[10px] font-mono rounded transition-colors ${
                    period === p ? "bg-[#10B981] text-white" : "text-zinc-600 hover:text-zinc-300"
                  }`}
                >
                  {p.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* SECTION 1 — VISÃO GERAL                                        */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <SectionErrorBoundary sectionName="Visão Geral">
          <MacroSection
            ref={setSectionRef("overview")}
            id="overview"
            title="Visão Geral"
            subtitle="KPIs + Taxas de Referência"
            icon={BarChart3}
          >
            <AlertCard kpis={kpis} module="macro" />

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {kpis.map((card) => (
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

            {/* Key reference rates */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <MacroChart
                data={selic.map((d, i) => ({ ...d, value2: cdi[i]?.value ?? d.value - 0.1 }))}
                title="Selic Over vs CDI"
                type="line"
                color={ACCENT}
                color2={INDIGO}
                label="Selic"
                label2="CDI"
                unit="% a.a."
              />
              <MacroChart
                data={tlp.map((d, i) => ({ ...d, value2: poupanca[i]?.value ?? d.value * 1.05 }))}
                title="TLP vs Poupança"
                type="line"
                color={AMBER}
                color2="#EC4899"
                label="TLP"
                label2="Poupança"
                unit="% a.a."
              />
            </div>
          </MacroSection>
        </SectionErrorBoundary>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* SECTION 2 — TAXAS & CURVA                                      */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <SectionErrorBoundary sectionName="Taxas & Curva">
          <MacroSection
            ref={setSectionRef("taxas-curva")}
            id="taxas-curva"
            title="Taxas & Curva"
            subtitle="Curva DI · Evolução de vértices · Taxas secundárias"
            icon={LineChartIcon}
            insights={<MacroInsightCard inputs={taxasCurvaInsights} />}
          >
            {/* Yield Curve snapshot via MacroChart v2 */}
            <MacroChart
              data={yieldCurveChartData}
              title="Curva DI — Swap Pré x DI (Snapshot)"
              type="area"
              color={ACCENT}
              label="Taxa DI"
              unit="% a.a."
              refValue={kpis.find((k) => k.serie_code === "432")?.last_value ?? 14.25}
              refLabel="Selic Meta"
            />

            {/* DI vertex evolution over time */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <MacroChart
                data={di30.map((d, i) => ({ ...d, value2: di360[i]?.value ?? d.value + 0.5 }))}
                title="DI 30d vs DI 360d — Evolução"
                type="line"
                color={ACCENT}
                color2={INDIGO}
                label="DI 30d"
                label2="DI 360d"
                unit="% a.a."
              />
              <MacroChart
                data={di720.map((d, i) => ({ ...d, value2: di1800[i]?.value ?? d.value - 0.8 }))}
                title="DI 720d vs DI 1800d — Evolução"
                type="line"
                color={AMBER}
                color2={RED}
                label="DI 2a"
                label2="DI 5a"
                unit="% a.a."
              />
            </div>

            {/* TR + Poupança */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <MacroChart
                data={tr}
                title="Taxa Referencial (TR)"
                type="area"
                color={ACCENT}
                label="TR"
                unit="%"
              />
              <MacroChart
                data={poupanca}
                title="Poupança — Rendimento Equivalente"
                type="area"
                color="#EC4899"
                label="Poupança"
                unit="% a.a."
                refValue={(kpis.find((k) => k.serie_code === "432")?.last_value ?? 14.25) * 0.7}
                refLabel="70% Selic"
              />
            </div>
          </MacroSection>
        </SectionErrorBoundary>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* SECTION 3 — TÍTULOS PÚBLICOS                                   */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <SectionErrorBoundary sectionName="Títulos Públicos">
          <MacroSection
            ref={setSectionRef("titulos")}
            id="titulos"
            title="Títulos Públicos"
            subtitle="Tesouro Direto · NTN-B · Breakeven Inflation"
            icon={TrendingUp}
            insights={sectionVisible("titulos") ? <MacroInsightCard inputs={titulosInsights} /> : undefined}
          >
            {sectionVisible("titulos") && (
              <>
                {/* Tesouro Direto */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <MacroChart
                    data={estoqueTD}
                    title="Estoque Tesouro Direto"
                    type="area"
                    color={ACCENT}
                    label="Estoque"
                    unit=" R$ bi"
                  />
                  <MacroChart
                    data={vendasTD}
                    title="Vendas Líquidas TD — Mensal"
                    type="bar"
                    color={INDIGO}
                    label="Vendas"
                    unit=" R$ bi"
                  />
                </div>

                {/* NTN-B rates */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <MacroChart
                    data={ntnb2029.map((d, i) => ({ ...d, value2: ntnb2035[i]?.value ?? d.value - 0.15 }))}
                    title="NTN-B 2029 vs 2035 (Taxa Real)"
                    type="line"
                    color={ACCENT}
                    color2={INDIGO}
                    label="2029"
                    label2="2035"
                    unit="% a.a."
                    refValue={6.0}
                    refLabel="Média Histórica"
                  />
                  <MacroChart
                    data={ntnb2045}
                    title="NTN-B 2045 — Taxa Real IPCA+"
                    type="area"
                    color={AMBER}
                    label="2045"
                    unit="% a.a."
                  />
                </div>

                {/* Breakeven inflation */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <MacroChart
                    data={bei1.map((d, i) => ({ ...d, value2: bei5[i]?.value ?? d.value - 0.7 }))}
                    title="Inflação Implícita — 1 Ano vs 5 Anos"
                    type="line"
                    color={RED}
                    color2={INDIGO}
                    label="1 ano"
                    label2="5 anos"
                    unit="%"
                    refValue={3.0}
                    refLabel="Meta IPCA"
                  />
                  <MacroChart
                    data={bei3}
                    title="Breakeven Inflation — 3 Anos"
                    type="area"
                    color={AMBER}
                    label="BEI 3a"
                    unit="%"
                    refValue={3.0}
                    refLabel="Meta IPCA"
                  />
                </div>

                {/* NTN-B Term Structure via MacroChart v2 */}
                <MacroChart
                  data={ntnbTermStructure}
                  title="Estrutura a Termo — NTN-B (IPCA+ Real)"
                  type="area"
                  color={INDIGO}
                  label="IPCA+ Real"
                  unit="% a.a."
                />
              </>
            )}
          </MacroSection>
        </SectionErrorBoundary>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* SECTION 4 — CRÉDITO PRIVADO                                    */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <SectionErrorBoundary sectionName="Crédito Privado">
          <MacroSection
            ref={setSectionRef("credpriv")}
            id="credpriv"
            title="Crédito Privado"
            subtitle="Spreads debêntures · Emissões · CRA + CRI"
            icon={Landmark}
            insights={sectionVisible("credpriv") ? <MacroInsightCard inputs={credprivInsights} /> : undefined}
          >
            {sectionVisible("credpriv") && (
              <>
                {/* Spread time-series charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <MacroChart
                    data={spreadAASeries.map((d, i) => ({ ...d, value2: spreadASeries[i]?.value ?? d.value + 0.7 }))}
                    title="Spreads AA vs A sobre CDI"
                    type="line"
                    color={ACCENT}
                    color2={RED}
                    label="AA"
                    label2="A"
                    unit="p.p."
                  />
                  <MacroChart
                    data={emissoesSeries}
                    title="Emissões Debêntures — Mensal"
                    type="bar"
                    color={INDIGO}
                    label="Emissões"
                    unit=" R$ bi"
                  />
                </div>

                {/* SpreadCreditoPrivado component */}
                <SpreadCreditoPrivado
                  spreadAA={kpis.find((k) => k.serie_code === "990301")?.last_value}
                  spreadA={kpis.find((k) => k.serie_code === "990302")?.last_value}
                  emissoes={kpis.find((k) => k.serie_code === "990303")?.last_value}
                  estoqueCRACRI={kpis.find((k) => k.serie_code === "990304")?.last_value}
                  spreadAASeries={spreadAASeries}
                  spreadASeries={spreadASeries}
                  emissoesSeries={emissoesSeries}
                />
              </>
            )}
          </MacroSection>
        </SectionErrorBoundary>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* SECTION 5 — ANALYTICS                                          */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <SectionErrorBoundary sectionName="Analytics">
          <MacroSection
            ref={setSectionRef("analytics")}
            id="analytics"
            title="Analytics"
            subtitle="Calculadora · Benchmarks · Intelligence"
            icon={Brain}
          >
            {sectionVisible("analytics") && (
              <>
                {/* Intelligence Panel */}
                <FixedIncomeNarrativePanel
                  selicMeta={kpis.find((k) => k.serie_code === "432")?.last_value}
                  focusSelic={14.50}
                  curveShort={kpis.find((k) => k.serie_code === "7813")?.last_value}
                  curveMid={kpis.find((k) => k.serie_code === "7817")?.last_value}
                  curveLong={kpis.find((k) => k.serie_code === "7821")?.last_value}
                  spreadAA={kpis.find((k) => k.serie_code === "990301")?.last_value}
                  breakeven1a={kpis.find((k) => k.serie_code === "990101")?.last_value}
                  breakeven5a={kpis.find((k) => k.serie_code === "990103")?.last_value}
                  ntnb2029={kpis.find((k) => k.serie_code === "12460")?.last_value}
                  vendasTD={kpis.find((k) => k.serie_code === "990202")?.last_value}
                />

                {/* ─── IMA-B Proxy Insight ─── */}
                <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-1 bg-gradient-to-b from-emerald-500 to-emerald-600 rounded-full" />
                    <div className="flex-1">
                      <h3 className="text-xs font-bold text-zinc-100 mb-2">IMA-B Proxy — Retorno Estimado NTN-B</h3>
                      <p className="text-[11px] text-zinc-400 mb-3 leading-relaxed">
                        Proxy calculado a partir de yields NTN-B usando aproximação de duration. Retornos estimados baseados em mudança de yield nos últimos dados disponíveis.
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-[#0a0a0a] border border-[#141414] rounded p-2">
                          <div className="text-[9px] text-zinc-500 mb-1">Curto (2029)</div>
                          <div className={`text-sm font-mono font-bold ${imaBProxy.shortReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {imaBProxy.shortReturn >= 0 ? '+' : ''}{imaBProxy.shortReturn.toFixed(2)}%
                          </div>
                        </div>
                        <div className="bg-[#0a0a0a] border border-[#141414] rounded p-2">
                          <div className="text-[9px] text-zinc-500 mb-1">Médio (2035)</div>
                          <div className={`text-sm font-mono font-bold ${imaBProxy.midReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {imaBProxy.midReturn >= 0 ? '+' : ''}{imaBProxy.midReturn.toFixed(2)}%
                          </div>
                        </div>
                        <div className="bg-[#0a0a0a] border border-[#141414] rounded p-2">
                          <div className="text-[9px] text-zinc-500 mb-1">Longo (2045)</div>
                          <div className={`text-sm font-mono font-bold ${imaBProxy.longReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {imaBProxy.longReturn >= 0 ? '+' : ''}{imaBProxy.longReturn.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ─── Alert Signals ─── */}
                {fixedIncomeAlerts.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-zinc-100">Alertas & Sinais Críticos</h3>
                    {fixedIncomeAlerts.map((alert, idx) => {
                      const severityColors = {
                        critical: { border: 'border-red-500/40', dot: 'bg-red-500', bg: 'bg-red-500/5' },
                        warning: { border: 'border-amber-500/40', dot: 'bg-amber-500', bg: 'bg-amber-500/5' },
                        info: { border: 'border-blue-500/40', dot: 'bg-blue-500', bg: 'bg-blue-500/5' },
                      };
                      const colors = severityColors[alert.severity];
                      return (
                        <div key={idx} className={`${colors.bg} border ${colors.border} rounded-lg p-3 flex items-start gap-2`}>
                          <div className={`flex-shrink-0 w-2 h-2 rounded-full ${colors.dot} mt-1.5`} />
                          <div className="flex-1">
                            <div className="text-xs font-bold text-zinc-100">{alert.title}</div>
                            <div className="text-[11px] text-zinc-400 mt-1">{alert.description}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Yield Curve Simulator v2 */}
                <YieldCurveSimulator
                  currentSelic={kpis.find((k) => k.serie_code === "432")?.last_value ?? 14.25}
                />

                {/* BondCalculator v2 */}
                <BondCalculator
                  currentSelic={kpis.find((k) => k.serie_code === "432")?.last_value ?? 14.25}
                />

                {/* Benchmarks */}
                <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-4">
                  <h3 className="text-sm font-bold text-zinc-100 mb-3">Benchmarks vs Metas</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { label: "Selic Meta", current: kpis.find((k) => k.serie_code === "432")?.last_value ?? 14.25, target: 12.50, unit: "% a.a." },
                      { label: "NTN-B 2035 (real)", current: kpis.find((k) => k.serie_code === "12461")?.last_value ?? 7.10, target: 6.0, unit: "% a.a." },
                      { label: "Breakeven 1a", current: kpis.find((k) => k.serie_code === "990101")?.last_value ?? 5.82, target: 4.50, unit: "%" },
                      { label: "Spread AA", current: kpis.find((k) => k.serie_code === "990301")?.last_value ?? 1.35, target: 1.20, unit: "p.p." },
                    ].map((b) => {
                      const pct = Math.min((b.current / b.target) * 100, 150);
                      const isGood = b.current <= b.target;
                      return (
                        <div key={b.label} className="bg-[#0a0a0a] border border-[#141414] rounded p-3">
                          <div className="flex justify-between text-[10px] font-mono mb-1.5">
                            <span className="text-zinc-400">{b.label}</span>
                            <span className={isGood ? "text-emerald-400" : "text-amber-400"}>
                              {b.current.toFixed(2)} / {b.target.toFixed(2)} {b.unit}
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
              </>
            )}
          </MacroSection>
        </SectionErrorBoundary>

        {/* ─── Footer ─── */}
        <div className="border-t border-[#141414] pt-3 flex items-center justify-between text-[9px] text-zinc-700 font-mono">
          <span>Fonte: BACEN SGS · ANBIMA · Tesouro Nacional</span>
          <span>Atualização: Diária (D+1 útil)</span>
        </div>
      </div>
    </div>
  );
};

export default HubRendaFixa;
