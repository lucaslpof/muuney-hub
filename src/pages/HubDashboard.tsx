import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { HubSEO } from "@/lib/seo";
import {
  TrendingUp, TrendingDown, BarChart3, Landmark, Building2, GraduationCap,
  ArrowRight, Zap, Radio, ScrollText, Banknote, Briefcase, Bell,
} from "lucide-react";
import { KPICard } from "@/components/hub/KPICard";
import { MacroChart } from "@/components/hub/MacroChart";
import { AlertCard } from "@/components/hub/AlertCard";
import { HeroKPIs } from "@/components/hub/HeroKPIs";
import { IngestionStatus } from "@/components/hub/IngestionStatus";
import { Breadcrumbs } from "@/components/hub/Breadcrumbs";
import { SkeletonPage } from "@/components/hub/SkeletonLoader";
import { EmptyState } from "@/components/hub/EmptyState";
import {
  useHubLatest, useHubSeries,
  MACRO_SAMPLE, CREDITO_SAMPLE,
} from "@/hooks/useHubData";
import {
  useInsightsFeed,
  useOfertasStats,
  INSIGHT_TYPE_LABELS,
  INSIGHT_SEVERITY_COLORS,
} from "@/hooks/useHubFundos";
/* ─── Helpers ─── */
const useHubPrefix = () => "";

function toSparkline(series: { date: string; value: number }[], points = 20) {
  if (!series.length) return [];
  const step = Math.max(1, Math.floor(series.length / points));
  return series.filter((_, i) => i % step === 0).map((d) => ({ value: d.value }));
}

/** Safely render polyline points for an inline sparkline. Filters NaN and avoids divide-by-zero. */
function sparkPoints(arr: { value: number }[]): string {
  if (!arr || arr.length < 2) return "";
  const vals = arr.map((d) => d.value).filter((v) => Number.isFinite(v));
  if (vals.length < 2) return "";
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const range = max - min || 1;
  const w = 80;
  const h = 24;
  return arr
    .map((d, i) => {
      const x = (i / (arr.length - 1)) * w;
      const y = Number.isFinite(d.value) ? h - ((d.value - min) / range) * h : h;
      return `${x},${y}`;
    })
    .join(" ");
}

/* ─── Module config ─── */
const useModules = () => {
  const prefix = useHubPrefix();
  return [
    { path: `${prefix}/macro`, label: "Panorama Macro", desc: "Selic, IPCA, câmbio, PIB, dívida", icon: TrendingUp, color: "#0B6C3E", active: true },
    { path: `${prefix}/credito`, label: "Overview Crédito", desc: "Spreads, inadimplência, concessões", icon: BarChart3, color: "#10B981", active: true },
    { path: `${prefix}/renda-fixa`, label: "Renda Fixa", desc: "Curva DI, NTN-B, Tesouro, crédito privado", icon: Banknote, color: "#6366F1", active: true },
    { path: `${prefix}/fundos`, label: "Fundos", desc: "RCVM 175, lâminas, screener, Fund Score™", icon: Landmark, color: "#F59E0B", active: true },
    { path: `${prefix}/ofertas`, label: "Ofertas Públicas", desc: "CVM 160, pipeline, timeline", icon: ScrollText, color: "#F59E0B", active: true, badge: "PRO" },
    { path: `${prefix}/portfolio`, label: "Portfolio", desc: "Alocação, drift, metas", icon: Briefcase, color: "#8B5CF6", active: true, badge: "NEW" },
    { path: "#", label: "Empresas", desc: "P/L, ROE, EV/EBITDA", icon: Building2, color: "#71717a", active: false },
    { path: "#", label: "Educacional", desc: "Glossário, calculadoras", icon: GraduationCap, color: "#71717a", active: false },
  ];
};

/* ─── Main Component ─── */
const HubDashboard = () => {
  const navigate = useNavigate();
  const prefix = useHubPrefix();
  const modules = useModules();

  /* Data — Macro */
  const { data: macroCards, isLoading: macroLoading } = useHubLatest("macro");
  const macro = macroCards?.length ? macroCards : MACRO_SAMPLE;
  const topMacro = macro.slice(0, 4); // Selic, IPCA Mensal, IPCA 12m, PTAX

  /* Data — Crédito */
  const { data: creditoCards, isLoading: creditoLoading } = useHubLatest("credito");
  const credito = creditoCards?.length ? creditoCards : CREDITO_SAMPLE;
  const topCredito = credito.slice(0, 4); // Spread PF, Spread PJ, Inad Total, Inad PF

  /* Series for mini-charts */
  const { data: selicSeries } = useHubSeries("selic", "1y", "macro");
  const { data: ipcaSeries } = useHubSeries("ipca", "1y", "macro");
  const { data: cambioSeries } = useHubSeries("cambio", "1y", "macro");
  const { data: inadSeries } = useHubSeries("inadimplencia", "1y", "credito");
  const { data: spreadSeries } = useHubSeries("spread", "1y", "credito");

  const selic = selicSeries?.length ? selicSeries : [];
  const ipca = ipcaSeries?.length ? ipcaSeries : [];
  const cambio = cambioSeries?.length ? cambioSeries : [];
  const inadimplencia = inadSeries?.length ? inadSeries : [];
  const spread = spreadSeries?.length ? spreadSeries : [];

  /* Sparklines for KPI cards — each series_code maps to its own true data */
  const sparkMap = useMemo(() => ({
    selic_meta: toSparkline(selic),
    ipca_mensal: toSparkline(ipca),
    ipca_12m: toSparkline(ipca),
    ptax_compra: toSparkline(cambio),
    spread_pf: toSparkline(spread),
    spread_pj: toSparkline(spread),
    inadimplencia_total: toSparkline(inadimplencia),
    inadimplencia_pf: toSparkline(inadimplencia),
  }), [selic, ipca, cambio, inadimplencia, spread]);

  /* Combined KPIs for alert evaluation */
  const allKPIs = useMemo(() => [...macro, ...credito], [macro, credito]);

  /* AAI value-add: Insights + Ofertas Ativas */
  const { data: insightsData } = useInsightsFeed({ days: 7, limit: 50 });
  const insightsAll = insightsData?.insights ?? [];
  const insightsCount = insightsData?.total ?? insightsAll.length;
  const topInsights = useMemo(
    () =>
      [...insightsAll]
        .sort((a, b) => {
          const sevRank = (s: string) => (s === "critical" ? 0 : s === "warning" ? 1 : 2);
          const sevDiff = sevRank(a.severidade) - sevRank(b.severidade);
          if (sevDiff !== 0) return sevDiff;
          return (b.detectado_em ?? "").localeCompare(a.detectado_em ?? "");
        })
        .slice(0, 3),
    [insightsAll]
  );

  const { data: ofertasStats } = useOfertasStats();
  const ofertasAtivasCount = ofertasStats?.em_distribuicao ?? 0;

  /* Full-page loading state */
  if (macroLoading && creditoLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Breadcrumbs items={[{ label: "Dashboard" }]} className="mb-4" />
        <SkeletonPage />
      </div>
    );
  }

  /* No-data fallback */
  if (!macroLoading && !creditoLoading && (!macroCards?.length || !creditoCards?.length)) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Breadcrumbs items={[{ label: "Dashboard" }]} className="mb-4" />
        <EmptyState variant="no-data" />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <HubSEO
        title="Dashboard"
        description="Painel de inteligência financeira com indicadores em tempo real: Selic, IPCA, câmbio, inadimplência e fundos CVM monitorados."
        path="/dashboard"
        keywords="dashboard financeiro, indicadores econômicos, Selic hoje, IPCA acumulado, câmbio dólar, spreads bancários, inadimplência PF"
        isProtected={true}
      />
      <Breadcrumbs items={[{ label: "Dashboard" }]} className="mb-4" />

      {/* ─── Enhanced Hero Banner with Consolidated KPIs ─── */}
      <div className="bg-gradient-to-br from-[#0a0a0a] to-[#111] border border-zinc-800/50 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0B6C3E]/8 via-[#111] to-[#111] border-b border-zinc-800/50 p-4 md:p-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">
                  Hub de Inteligência Financeira
                </h1>
                {macroCards?.length ? (
                  <span className="flex items-center gap-1 text-[9px] bg-[#0B6C3E]/15 text-[#0B6C3E] px-2 py-1 rounded font-mono shadow-[0_0_8px_rgba(11,108,62,0.3)]">
                    <Radio className="w-2.5 h-2.5 animate-pulse" />
                    LIVE
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[9px] bg-zinc-800/50 text-zinc-500 px-2 py-1 rounded font-mono">
                    OFFLINE
                  </span>
                )}
              </div>
              <p className="text-[10px] text-zinc-600 font-mono">
                Fontes oficiais BACEN SGS · CVM · PTAX · {macro.length + credito.length} indicadores ativos
              </p>
            </div>
            <div className="hidden md:flex items-center gap-1.5 text-[9px] text-zinc-600 font-mono">
              <Zap className="w-3 h-3 text-[#0B6C3E]" />
              {new Date().toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        </div>

        {/* KPI Hero Grid */}
        <div className="p-4 md:p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Selic Meta */}
            <div className="group bg-zinc-900/50 backdrop-blur border border-zinc-800/50 hover:border-[#0B6C3E]/30 rounded-lg p-3.5 transition-all duration-150">
              <p className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-2">Selic</p>
              <div className="flex items-end justify-between gap-2">
                <div>
                  <div className="text-3xl font-bold text-zinc-100 font-mono leading-none">
                    {macro.find(m => m.serie_code === "selic_meta")?.last_value.toFixed(2) ?? "—"}
                  </div>
                  <p className="text-[8px] text-zinc-700 font-mono mt-0.5">% a.a.</p>
                  {macro.find(m => m.serie_code === "selic_meta") && (
                    <div className="text-[8px] text-zinc-700 font-mono mt-1">
                      {macro.find(m => m.serie_code === "selic_meta")?.last_date}
                    </div>
                  )}
                </div>
                {macro.find(m => m.serie_code === "selic_meta")?.trend && (
                  <div className={`flex items-center text-sm ${
                    macro.find(m => m.serie_code === "selic_meta")?.trend === "up" ? "text-emerald-400" : 
                    macro.find(m => m.serie_code === "selic_meta")?.trend === "down" ? "text-red-400" : 
                    "text-zinc-500"
                  }`}>
                    {macro.find(m => m.serie_code === "selic_meta")?.trend === "up" ? <TrendingUp className="w-4 h-4" /> :
                     macro.find(m => m.serie_code === "selic_meta")?.trend === "down" ? <TrendingDown className="w-4 h-4" /> :
                     <div className="w-4 h-4" />}
                  </div>
                )}
              </div>
              {sparkMap.selic_meta?.length > 2 && (
                <svg width="100%" height="24" viewBox="0 0 80 24" className="mt-2 opacity-50" style={{ maxWidth: "100%" }}>
                  <polyline points={sparkPoints(sparkMap.selic_meta)} fill="none" stroke="#0B6C3E" strokeWidth="1.5" />
                </svg>
              )}
            </div>

            {/* IPCA 12m */}
            <div className="group bg-zinc-900/50 backdrop-blur border border-zinc-800/50 hover:border-[#10B981]/30 rounded-lg p-3.5 transition-all duration-150">
              <p className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-2">IPCA 12m</p>
              <div className="flex items-end justify-between gap-2">
                <div>
                  <div className="text-3xl font-bold text-zinc-100 font-mono leading-none">
                    {macro.find(m => m.serie_code === "ipca_12m")?.last_value.toFixed(2) ?? "—"}
                  </div>
                  <p className="text-[8px] text-zinc-700 font-mono mt-0.5">%</p>
                  {macro.find(m => m.serie_code === "ipca_12m") && (
                    <div className="text-[8px] text-zinc-700 font-mono mt-1">
                      {macro.find(m => m.serie_code === "ipca_12m")?.last_date}
                    </div>
                  )}
                </div>
                {macro.find(m => m.serie_code === "ipca_12m")?.trend && (
                  <div className={`flex items-center text-sm ${
                    macro.find(m => m.serie_code === "ipca_12m")?.trend === "up" ? "text-red-400" : 
                    macro.find(m => m.serie_code === "ipca_12m")?.trend === "down" ? "text-emerald-400" : 
                    "text-zinc-500"
                  }`}>
                    {macro.find(m => m.serie_code === "ipca_12m")?.trend === "up" ? <TrendingUp className="w-4 h-4" /> :
                     macro.find(m => m.serie_code === "ipca_12m")?.trend === "down" ? <TrendingDown className="w-4 h-4" /> :
                     <div className="w-4 h-4" />}
                  </div>
                )}
              </div>
              {sparkMap.ipca_12m?.length > 2 && (
                <svg width="100%" height="24" viewBox="0 0 80 24" className="mt-2 opacity-50" style={{ maxWidth: "100%" }}>
                  <polyline points={sparkPoints(sparkMap.ipca_12m)} fill="none" stroke="#10B981" strokeWidth="1.5" />
                </svg>
              )}
            </div>

            {/* PTAX USD/BRL */}
            <div className="group bg-zinc-900/50 backdrop-blur border border-zinc-800/50 hover:border-[#F59E0B]/30 rounded-lg p-3.5 transition-all duration-150">
              <p className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-2">PTAX</p>
              <div className="flex items-end justify-between gap-2">
                <div>
                  <div className="text-3xl font-bold text-zinc-100 font-mono leading-none">
                    {macro.find(m => m.serie_code === "ptax_compra")?.last_value.toFixed(2) ?? "—"}
                  </div>
                  <p className="text-[8px] text-zinc-700 font-mono mt-0.5">USD/BRL</p>
                  {macro.find(m => m.serie_code === "ptax_compra") && (
                    <div className="text-[8px] text-zinc-700 font-mono mt-1">
                      {macro.find(m => m.serie_code === "ptax_compra")?.last_date}
                    </div>
                  )}
                </div>
                {macro.find(m => m.serie_code === "ptax_compra")?.trend && (
                  <div className={`flex items-center text-sm ${
                    macro.find(m => m.serie_code === "ptax_compra")?.trend === "up" ? "text-red-400" : 
                    macro.find(m => m.serie_code === "ptax_compra")?.trend === "down" ? "text-emerald-400" : 
                    "text-zinc-500"
                  }`}>
                    {macro.find(m => m.serie_code === "ptax_compra")?.trend === "up" ? <TrendingUp className="w-4 h-4" /> :
                     macro.find(m => m.serie_code === "ptax_compra")?.trend === "down" ? <TrendingDown className="w-4 h-4" /> :
                     <div className="w-4 h-4" />}
                  </div>
                )}
              </div>
              {sparkMap.ptax_compra?.length > 2 && (
                <svg width="100%" height="24" viewBox="0 0 80 24" className="mt-2 opacity-50" style={{ maxWidth: "100%" }}>
                  <polyline points={sparkPoints(sparkMap.ptax_compra)} fill="none" stroke="#F59E0B" strokeWidth="1.5" />
                </svg>
              )}
            </div>

            {/* Inadimplência PF */}
            <div className="group bg-zinc-900/50 backdrop-blur border border-zinc-800/50 hover:border-[#EF4444]/30 rounded-lg p-3.5 transition-all duration-150">
              <p className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-2">Inad. PF</p>
              <div className="flex items-end justify-between gap-2">
                <div>
                  <div className="text-3xl font-bold text-zinc-100 font-mono leading-none">
                    {credito.find(c => c.serie_code === "21082")?.last_value.toFixed(2) ?? "—"}
                  </div>
                  <p className="text-[8px] text-zinc-700 font-mono mt-0.5">%</p>
                  {credito.find(c => c.serie_code === "21082") && (
                    <div className="text-[8px] text-zinc-700 font-mono mt-1">
                      {credito.find(c => c.serie_code === "21082")?.last_date}
                    </div>
                  )}
                </div>
                {credito.find(c => c.serie_code === "21082")?.trend && (
                  <div className={`flex items-center text-sm ${
                    credito.find(c => c.serie_code === "21082")?.trend === "up" ? "text-red-400" : 
                    credito.find(c => c.serie_code === "21082")?.trend === "down" ? "text-emerald-400" : 
                    "text-zinc-500"
                  }`}>
                    {credito.find(c => c.serie_code === "21082")?.trend === "up" ? <TrendingUp className="w-4 h-4" /> :
                     credito.find(c => c.serie_code === "21082")?.trend === "down" ? <TrendingDown className="w-4 h-4" /> :
                     <div className="w-4 h-4" />}
                  </div>
                )}
              </div>
              {sparkMap.inadimplencia_pf?.length > 2 && (
                <svg width="100%" height="24" viewBox="0 0 80 24" className="mt-2 opacity-50" style={{ maxWidth: "100%" }}>
                  <polyline points={sparkPoints(sparkMap.inadimplencia_pf)} fill="none" stroke="#EF4444" strokeWidth="1.5" />
                </svg>
              )}
            </div>

            {/* Ofertas Ativas (em distribuição) */}
            <button
              type="button"
              onClick={() => navigate("/ofertas")}
              className="group text-left bg-zinc-900/50 backdrop-blur border border-zinc-800/50 hover:border-[#F59E0B]/30 rounded-lg p-3.5 transition-all duration-150"
              aria-label="Ver ofertas em distribuição"
            >
              <p className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-2 flex items-center gap-1">
                <ScrollText className="w-2.5 h-2.5" />
                Ofertas Ativas
              </p>
              <div className="flex items-end justify-between gap-2">
                <div>
                  <div className="text-3xl font-bold text-zinc-100 font-mono leading-none">
                    {ofertasAtivasCount.toLocaleString("pt-BR")}
                  </div>
                  <p className="text-[8px] text-zinc-700 font-mono mt-0.5">em distribuição</p>
                  <p className="text-[8px] text-zinc-700 font-mono mt-1">CVM 160/476</p>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-700 group-hover:text-[#F59E0B] transition-colors" />
              </div>
            </button>

            {/* Alertas Fundos (insights 7d) */}
            <button
              type="button"
              onClick={() => navigate("/fundos?section=overview")}
              className="group text-left bg-zinc-900/50 backdrop-blur border border-zinc-800/50 hover:border-[#06B6D4]/30 rounded-lg p-3.5 transition-all duration-150"
              aria-label="Ver alertas de fundos"
            >
              <p className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-2 flex items-center gap-1">
                <Bell className="w-2.5 h-2.5" />
                Alertas Fundos
              </p>
              <div className="flex items-end justify-between gap-2">
                <div>
                  <div className="text-3xl font-bold text-zinc-100 font-mono leading-none">
                    {insightsCount.toLocaleString("pt-BR")}
                  </div>
                  <p className="text-[8px] text-zinc-700 font-mono mt-0.5">últimos 7 dias</p>
                  <p className="text-[8px] text-zinc-700 font-mono mt-1">PL · DD · Taxa · Fluxo</p>
                </div>
                {insightsData?.summary?.by_severity?.critical ? (
                  <span className="flex items-center gap-0.5 text-[9px] bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded font-mono">
                    {insightsData.summary.by_severity.critical} crítico{insightsData.summary.by_severity.critical > 1 ? "s" : ""}
                  </span>
                ) : (
                  <ArrowRight className="w-4 h-4 text-zinc-700 group-hover:text-[#06B6D4] transition-colors" />
                )}
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* ─── Hero KPIs: Universo de Fundos ─── */}
      <HeroKPIs />

      {/* ─── Cross-module Alerts ─── */}
      <AlertCard kpis={allKPIs} module="credito" />

      {/* ─── Fund Insights Strip (AAI beta value-add) ─── */}
      {topInsights.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-[#06B6D4]" />
              <h2 className="text-xs text-zinc-400 uppercase tracking-wider font-mono">
                Alertas de Fundos
              </h2>
              <span className="text-[9px] bg-zinc-800/50 text-zinc-500 px-1.5 py-0.5 rounded font-mono">
                {insightsCount} em 7d
              </span>
            </div>
            <button
              onClick={() => navigate("/fundos?section=overview")}
              className="text-[10px] text-[#06B6D4] hover:text-[#06B6D4]/70 flex items-center gap-0.5 font-mono transition-colors"
              aria-label="Ver todos os alertas de fundos"
            >
              Ver todos <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {topInsights.map((ins) => {
              const color = INSIGHT_SEVERITY_COLORS[ins.severidade];
              const destination = ins.slug
                ? `/fundos/${ins.slug}`
                : ins.classe_rcvm175 === "FIDC" && ins.slug
                ? `/fundos/fidc/${ins.slug}`
                : ins.classe_rcvm175 === "FII" && ins.slug
                ? `/fundos/fii/${ins.slug}`
                : "/fundos?section=overview";
              return (
                <button
                  key={ins.id}
                  type="button"
                  onClick={() => navigate(destination)}
                  className="text-left bg-[#111] border rounded-lg p-3 hover:bg-zinc-900/60 transition-all duration-150 group"
                  style={{ borderColor: color.border }}
                  aria-label={`${INSIGHT_TYPE_LABELS[ins.tipo]} — ${ins.denom_social ?? ""}`}
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span
                      className="text-[8px] px-1.5 py-0.5 rounded font-mono uppercase"
                      style={{ backgroundColor: color.bg, color: color.text }}
                    >
                      {ins.severidade}
                    </span>
                    <span className="text-[9px] text-zinc-500 font-mono">
                      {INSIGHT_TYPE_LABELS[ins.tipo]}
                    </span>
                    {ins.classe_rcvm175 && (
                      <span className="text-[8px] text-zinc-600 font-mono ml-auto">
                        {ins.classe_rcvm175}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-200 font-medium leading-tight line-clamp-1">
                    {ins.denom_social ?? "Fundo sem nome"}
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed line-clamp-2">
                    {ins.titulo}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── Top-line grid: Macro KPIs + Crédito KPIs ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Macro section */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-[#0B6C3E]" />
              <h2 className="text-xs text-zinc-400 uppercase tracking-wider font-mono">
                Macro
              </h2>
            </div>
            <button
              onClick={() => navigate(`${prefix}/macro`)}
              className="text-[10px] text-[#0B6C3E] hover:text-[#0B6C3E]/70 flex items-center gap-0.5 font-mono transition-colors"
            >
              Ver módulo <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {topMacro.map((card) => (
              <KPICard
                key={card.serie_code}
                title={card.display_name}
                value={card.last_value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                unit={card.unit}
                change={card.change_pct}
                trend={card.trend}
                lastDate={card.last_date}
                loading={macroLoading}
                sparklineData={sparkMap[card.serie_code as keyof typeof sparkMap]}
                onClick={() => navigate(`${prefix}/macro`)}
              />
            ))}
          </div>
        </section>

        {/* Crédito section */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-[#10B981]" />
              <h2 className="text-xs text-zinc-400 uppercase tracking-wider font-mono">
                Crédito
              </h2>
            </div>
            <button
              onClick={() => navigate(`${prefix}/credito`)}
              className="text-[10px] text-[#10B981] hover:text-[#10B981]/70 flex items-center gap-0.5 font-mono transition-colors"
            >
              Ver módulo <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {topCredito.map((card) => (
              <KPICard
                key={card.serie_code}
                title={card.display_name}
                value={card.last_value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                unit={card.unit}
                change={card.change_pct}
                trend={card.trend}
                lastDate={card.last_date}
                loading={creditoLoading}
                sparklineData={sparkMap[card.serie_code as keyof typeof sparkMap]}
                onClick={() => navigate(`${prefix}/credito`)}
              />
            ))}
          </div>
        </section>
      </div>

      {/* ─── Mini-charts row: 4 key series ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <MacroChart data={selic} title="Selic" type="area" color="#0B6C3E" label="Selic" unit="%" height={140} />
        <MacroChart data={ipca} title="IPCA" type="bar" color="#10B981" label="IPCA" unit="%" height={140} />
        <MacroChart data={cambio} title="PTAX" type="line" color="#F59E0B" label="PTAX" unit=" R$" height={140} />
        <MacroChart data={inadimplencia} title="Inadimplência" type="area" color="#EF4444" label="Inad." unit="%" height={140} />
      </div>

      {/* ─── Bottom row: Modules + Ingestion Status ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Module cards — 2 cols */}
        <div className="lg:col-span-2">
          <h2 className="text-[10px] text-zinc-600 uppercase tracking-wider font-mono mb-2">
            Módulos
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {modules.map((mod) => (
              <button
                key={mod.label}
                onClick={() => mod.active && navigate(mod.path)}
                disabled={!mod.active}
                className={`text-left bg-[#111111] border border-[#1a1a1a] rounded-lg p-3 transition-all duration-150 group ${
                  mod.active
                    ? "hover:border-[#0B6C3E]/30 cursor-pointer"
                    : "opacity-30 cursor-not-allowed"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center"
                    style={{ backgroundColor: `${mod.color}12` }}
                  >
                    <mod.icon className="w-3.5 h-3.5" style={{ color: mod.color }} />
                  </div>
                  {!mod.active ? (
                    <span className="text-[8px] bg-zinc-800 text-zinc-600 px-1 py-0.5 rounded font-mono">
                      Q3
                    </span>
                  ) : mod.badge ? (
                    <span className="text-[8px] bg-[#0B6C3E]/15 text-[#0B6C3E] px-1 py-0.5 rounded font-mono">
                      {mod.badge}
                    </span>
                  ) : (
                    <ArrowRight className="w-3 h-3 text-zinc-800 group-hover:text-[#0B6C3E] transition-colors" />
                  )}
                </div>
                <h3 className="text-[12px] font-medium text-zinc-300">{mod.label}</h3>
                <p className="text-[9px] text-zinc-600 mt-0.5 leading-relaxed">{mod.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Ingestion Status — 1 col */}
        <div>
          <h2 className="text-[10px] text-zinc-600 uppercase tracking-wider font-mono mb-2">
            Status do Pipeline
          </h2>
          <IngestionStatus />
        </div>
      </div>

      {/* ─── CVM Disclaimer ─── */}
      <div className="border-t border-[#141414] pt-3">
        <p className="text-[8px] text-zinc-700 leading-relaxed max-w-3xl">
          <strong className="text-zinc-600">Aviso legal:</strong> Dados de fontes primárias oficiais
          (BACEN/CVM). Caráter exclusivamente informativo. Não constitui oferta, recomendação ou aconselhamento
          de investimento. A Muuney não é instituição financeira nem está autorizada a distribuir produtos financeiros.
        </p>
      </div>
    </div>
  );
};

export default HubDashboard;
