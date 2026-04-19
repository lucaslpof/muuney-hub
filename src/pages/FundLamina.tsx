import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ArrowLeft, TrendingUp, BarChart3, LineChart as LineChartIcon, PieChart, Info } from "lucide-react";
import { Breadcrumbs } from "@/components/hub/Breadcrumbs";
import { HubSEO } from "@/lib/seo";
import { motion } from "framer-motion";

import {
  useFundDetail, useFundCatalog, useFundCompositionSummary, useFundComposition,
  formatPL, formatCnpj, fundDisplayName, primaryCnpj,
} from "@/hooks/useHubFundos";
import { useHubSeries } from "@/hooks/useHubData";
import { computeFundMetrics, fmtMetric, fmtMetricSigned, metricColor } from "@/lib/fundMetrics";
import { computeFundScore } from "@/lib/fundScore";
import { computeRollingReturnsFromDaily } from "@/lib/rollingReturns";
import { RollingReturnsGrid } from "@/components/hub/RollingReturnsGrid";
import { computeMonthlyGridFromDaily, summarizeDrawdown } from "@/lib/drawdown";
import { DrawdownHeatmap } from "@/components/hub/DrawdownHeatmap";
import { FundNarrativePanel, type FundScopeContext } from "@/components/hub/FundNarrativePanel";
import { ClasseBadge, HierarquiaBadges } from "@/lib/rcvm175";
import { DataAsOfStamp } from "@/components/hub/DataAsOfStamp";
import { ExportPdfButton } from "@/components/hub/ExportPdfButton";
import { PrintFooter } from "@/components/hub/PrintFooter";
import { FundScoreCard } from "@/components/hub/FundScoreCard";
import { ManagerTenureTimeline } from "@/components/hub/ManagerTenureTimeline";
import { SectionErrorBoundary } from "@/components/hub/SectionErrorBoundary";
import { FundInsightsSection } from "@/components/hub/InsightsFeed";
import { SimpleKPICard as KPICard } from "@/components/hub/KPICard";
import {
  CompositionSummary, CompositionDetailTable,
} from "@/components/hub/FundCompositionPanel";
import { useLaminaQuota } from "@/hooks/useLaminaQuota";
import { InlinePaywall } from "@/components/hub/RequireTier";

const PERIODS = ["1m", "3m", "6m", "1y", "max"] as const;

/** CDA asset block labels */
const BLOCO_LABELS: Record<string, string> = {
  titulo_publico: "Títulos Públicos",
  cota_fi: "Cotas de FI",
  swap: "Swaps",
  ativo_codificado: "Ativos Codificados",
  deposito_titfi: "Depósitos/TIT-FI",
  agro_credpriv: "Agro/Crédito Privado",
  investimento_exterior: "Investimento Exterior",
  ativo_nao_codificado: "Ativos Não Codificados",
};

/** Compute base-100 index from quota data */
function computeIndexSeries(daily: Array<{ dt_comptc: string; vl_quota?: number | null }>) {
  if (!daily || daily.length === 0) return [];
  const firstQuota = daily[0]?.vl_quota;
  if (!firstQuota) return [];

  return daily.map((d) => ({
    date: d.dt_comptc,
    index: d.vl_quota ? (d.vl_quota / firstQuota) * 100 : null,
  })).filter((d): d is { date: string; index: number } => d.index != null);
}

/** Compute accumulated CDI index from daily CDI rates, normalized to base 100 */
function computeCDIIndex(cdiDaily: Array<{ date?: string; value?: number | null }>) {
  if (!cdiDaily || cdiDaily.length === 0) return [];

  let cumulativeReturn = 1.0;
  const result: { date: string | undefined; cdi: number }[] = [];

  for (const d of cdiDaily) {
    const dailyRate = d.value ?? 0; // CDI as annual % rate
    // Convert annual rate to daily (simple division by 252 trading days, then convert to decimal)
    const dailyDecimal = (dailyRate / 100) / 252;
    cumulativeReturn *= (1 + dailyDecimal);
    result.push({
      date: d.date,
      cdi: cumulativeReturn * 100, // normalize to base 100
    });
  }

  return result;
}

/** Main Fund Lamina Page */
export default function FundLamina() {
  const { slug } = useParams<{ slug: string }>();
  const [period, setPeriod] = useState<typeof PERIODS[number]>("3m");

  // Daily lâmina quota (free = 3/day, pro/admin = unlimited)
  const quota = useLaminaQuota(slug);

  const { data: fundData, isLoading: fundLoading } = useFundDetail(slug ?? null, period);
  const { data: cdiDaily = [] } = useHubSeries("monetaria", period, "macro");
  const cnpj = fundData?.meta ? primaryCnpj(fundData.meta) : null;
  const { data: compositionSummary } = useFundCompositionSummary(cnpj);
  const { data: compositionFull } = useFundComposition(cnpj);

  // Fetch similar funds (same classe_rcvm175)
  const similarClasse = fundData?.meta?.classe_rcvm175 || fundData?.meta?.classe;
  const { data: catalogData } = useFundCatalog({
    classe: similarClasse || undefined,
    limit: 10,
  });

  const similarFunds = useMemo(() => {
    if (!catalogData?.funds || !fundData?.meta) return [];
    const meta = fundData.meta;
    const selfCnpj = meta.cnpj_fundo_classe || meta.cnpj_fundo;
    return catalogData.funds
      .filter((f) => (f.cnpj_fundo_classe || f.cnpj_fundo) !== selfCnpj)
      .slice(0, 6);
  }, [catalogData, fundData]);

  const meta = fundData?.meta;
  const daily = fundData?.daily || [];

  // Compute metrics and score (with error safety)
  const metrics = useMemo(() => {
    if (!daily || daily.length <= 5) return null;
    try { return computeFundMetrics(daily); } catch { return null; }
  }, [daily]);
  const score = useMemo(() => {
    if (!meta || !daily || daily.length <= 5) return null;
    try { return computeFundScore(meta, daily); } catch { return null; }
  }, [meta, daily]);

  // Rolling returns across standard windows (1m, 3m, 6m, 12m, 24m, 36m)
  const rollingRows = useMemo(() => {
    if (!daily || daily.length < 5) return [];
    try { return computeRollingReturnsFromDaily(daily); } catch { return []; }
  }, [daily]);

  // Drawdown calendar (monthly returns aggregated from daily quotas)
  const drawdownCells = useMemo(() => {
    if (!daily || daily.length < 20) return [];
    try { return computeMonthlyGridFromDaily(daily); } catch { return []; }
  }, [daily]);
  const drawdownSummary = useMemo(() => {
    if (!drawdownCells.length) return undefined;
    try { return summarizeDrawdown(drawdownCells); } catch { return undefined; }
  }, [drawdownCells]);

  // Index series for chart (fund + CDI benchmark)
  const indexSeries = useMemo(() => {
    const fundIndex = computeIndexSeries(daily);
    const cdiIndex = computeCDIIndex(cdiDaily);

    // Merge CDI data into fund data by date (O(n) via Map lookup)
    const cdiMap = new Map(cdiIndex.map((c) => [c.date, c.cdi]));
    const merged = fundIndex.map((f) => ({
      date: f.date,
      index: f.index,
      cdi: cdiMap.get(f.date) ?? null,
    }));

    return merged;
  }, [daily, cdiDaily]);

  // Compute vs CDI metric
  const vsCDIMetric = useMemo(() => {
    if (indexSeries.length < 2) return null;
    const firstEntry = indexSeries[0];
    const lastEntry = indexSeries[indexSeries.length - 1];

    if (!firstEntry.index || !lastEntry.index || !lastEntry.cdi) return null;

    const fundReturn = lastEntry.index - 100;
    const cdiReturn = lastEntry.cdi - 100;
    const excess = fundReturn - cdiReturn;

    return { fundReturn, cdiReturn, excess };
  }, [indexSeries]);

  // Per-fund narrative context (regime + signals tailored to this fund)
  const fundNarrativeContext = useMemo<FundScopeContext | null>(() => {
    if (!meta) return null;
    // Prefer 12m rolling row for annualized context, fallback to longest available
    const twelveMonth = rollingRows.find((r) => r.months === 12 && r.returnPct != null);
    const longest = [...rollingRows].reverse().find((r) => r.returnPct != null);
    const ref = twelveMonth ?? longest;

    // PL trend: compare first vs last daily PL
    let plTrend: "up" | "down" | "flat" | null = null;
    if (daily.length > 5) {
      const firstPL = daily[0]?.vl_patrim_liq ?? null;
      const lastPL = daily[daily.length - 1]?.vl_patrim_liq ?? null;
      if (firstPL && lastPL) {
        const delta = (lastPL - firstPL) / firstPL;
        plTrend = delta > 0.02 ? "up" : delta < -0.02 ? "down" : "flat";
      }
    }

    return {
      classe: meta.classe_rcvm175 ?? null,
      nome: fundDisplayName(meta),
      returnPct: ref?.returnPct ?? metrics?.return_period ?? null,
      annualizedPct: ref?.annualizedPct ?? metrics?.return_annualized ?? null,
      cdiPct: ref?.cdiPct ?? null,
      vsCdiPP: ref?.vsCdiPct ?? vsCDIMetric?.excess ?? null,
      volAnnualPct: metrics?.volatility ?? null,
      sharpe: metrics?.sharpe ?? null,
      sortino: metrics?.sortino ?? null,
      maxDrawdownPct: metrics?.max_drawdown ?? null,
      plBRL: meta.vl_patrim_liq ?? null,
      plTrend,
      taxaAdmPct: meta.taxa_adm ?? null,
      selicMeta: 14.15,
      ipcaAccum: 5.0,
    };
  }, [meta, daily, metrics, rollingRows, vsCDIMetric]);

  // Net Flow Proxy: ΔPL - (rentab_dia × PL_anterior) — estimates net inflows/outflows
  const netFlowData = useMemo(() => {
    if (daily.length < 5) return null;
    const flows: { date: string; flow: number }[] = [];
    let totalInflow = 0;
    let totalOutflow = 0;
    for (let i = 1; i < daily.length; i++) {
      const curr = daily[i];
      const prev = daily[i - 1];
      const plCurr = curr.vl_patrim_liq ?? 0;
      const plPrev = prev.vl_patrim_liq ?? 0;
      const quotaCurr = curr.vl_quota ?? 0;
      const quotaPrev = prev.vl_quota ?? 0;
      if (!plPrev || !quotaPrev) continue;
      const rentabDay = (quotaCurr - quotaPrev) / quotaPrev;
      const impliedPL = plPrev * (1 + rentabDay);
      const flow = plCurr - impliedPL; // positive = net inflow
      flows.push({ date: curr.dt_comptc, flow });
      if (flow > 0) totalInflow += flow;
      else totalOutflow += Math.abs(flow);
    }
    // Aggregate by ISO week for smoother display (handles holidays correctly)
    const weekly: { week: string; flow: number }[] = [];
    let weekBucket = 0;
    let currentWeekStart = flows[0]?.date ?? "";
    let prevWeekNum = -1;
    for (let i = 0; i < flows.length; i++) {
      const d = new Date(flows[i].date + "T00:00:00");
      // ISO week number: week changes on Monday
      const dayOfYear = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000);
      const weekNum = Math.floor((dayOfYear + new Date(d.getFullYear(), 0, 1).getDay()) / 7);
      if (prevWeekNum >= 0 && weekNum !== prevWeekNum) {
        weekly.push({ week: currentWeekStart, flow: weekBucket });
        weekBucket = 0;
        currentWeekStart = flows[i].date;
      }
      weekBucket += flows[i].flow;
      prevWeekNum = weekNum;
    }
    if (weekBucket !== 0 || weekly.length === 0) {
      weekly.push({ week: currentWeekStart, flow: weekBucket });
    }
    const netTotal = totalInflow - totalOutflow;
    return { weekly, netTotal, totalInflow, totalOutflow };
  }, [daily]);

    if (fundLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-[#1a1a1a] rounded w-1/3" />
          <div className="h-80 bg-[#1a1a1a] rounded" />
        </div>
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] p-6 flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400 mb-4">Fundo não encontrado</p>
          <Link to="/fundos" className="text-[#0B6C3E] hover:underline text-sm flex items-center gap-1 justify-center">
            <ArrowLeft className="w-4 h-4" /> Voltar para Módulo Fundos
          </Link>
        </div>
      </div>
    );
  }

  // Free-tier daily quota exceeded
  if (!quota.allowed) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] p-6">
        <div className="max-w-2xl mx-auto pt-12">
          <Link to="/fundos" className="inline-flex items-center gap-1 text-zinc-500 hover:text-[#0B6C3E] text-sm mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Voltar para Módulo Fundos
          </Link>
          <div className="mb-6 text-center">
            <p className="text-zinc-400 text-sm">
              Você atingiu o limite diário de <span className="text-white font-semibold">{quota.total} lâminas</span> no plano Free.
            </p>
            <p className="text-zinc-600 text-xs mt-1">O contador reseta à meia-noite.</p>
          </div>
          <InlinePaywall feature="lâminas ilimitadas" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Dynamic SEO for Fund Lâmina */}
      <HubSEO
        title={fundDisplayName(meta) || "Lâmina do Fundo"}
        description={`Análise completa: ${fundDisplayName(meta) || "fundo"} — ${meta?.classe_rcvm175 || meta?.classe || ""}, PL R$ ${formatPL(meta?.vl_patrim_liq)}, ${meta?.gestor_nome || "gestor"}. Performance, composição, drawdown e Fund Score™.`}
        path={`/fundos/${slug}`}
        keywords={`${fundDisplayName(meta)}, ${meta?.classe_rcvm175 || meta?.classe}, lâmina fundo, análise fundo, Fund Score`}
        isProtected={true}
      />

      {/* Header Navigation */}
      <div className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur border-b border-[#1a1a1a]">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3">
          <Breadcrumbs
            items={[
              { label: "Fundos", to: "/fundos" },
              { label: fundDisplayName(meta) },
            ]}
            className="mb-2"
          />
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold text-zinc-100 truncate">{fundDisplayName(meta)}</h1>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <ClasseBadge classe={meta.classe_rcvm175 || meta.classe || meta.tp_fundo} size="md" />
                <span className="text-[8px] text-zinc-700">{formatCnpj(primaryCnpj(meta))}</span>
                <DataAsOfStamp
                  date={daily.length > 0 ? daily[daily.length - 1]?.dt_comptc : null}
                  cadence="daily"
                  source="CVM Cota Diária"
                  compact
                />
              </div>
            </div>
            {score && <span className="text-sm font-semibold font-mono px-2 py-1 rounded bg-[#0B6C3E]/10 text-[#0B6C3E]">
              Score: {score.score.toFixed(0)}
            </span>}
            <ExportPdfButton
              title={fundDisplayName(meta)}
              accent="#0B6C3E"
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Metadata Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[9px] font-mono">
          <div className="bg-[#111111] border border-[#1a1a1a] rounded p-3">
            <div className="text-zinc-600 uppercase tracking-wider mb-1">PL</div>
            <div className="text-zinc-300">{formatPL(meta.vl_patrim_liq)}</div>
          </div>
          <div className="bg-[#111111] border border-[#1a1a1a] rounded p-3">
            <div className="text-zinc-600 uppercase tracking-wider mb-1">Cotistas</div>
            <div className="text-zinc-300">{meta.nr_cotistas?.toLocaleString("pt-BR") || "—"}</div>
          </div>
          <div className="bg-[#111111] border border-[#1a1a1a] rounded p-3">
            <div className="text-zinc-600 uppercase tracking-wider mb-1">Tx Adm</div>
            <div className="text-zinc-300">{meta.taxa_adm != null ? `${meta.taxa_adm.toFixed(2)}%` : "—"}</div>
          </div>
          <div className="bg-[#111111] border border-[#1a1a1a] rounded p-3">
            <div className="text-zinc-600 uppercase tracking-wider mb-1">Condomínio</div>
            <div className="text-zinc-300">{meta.condom || "—"}</div>
          </div>
        </div>

        {/* Period Selector */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-[9px] font-mono rounded transition-all border whitespace-nowrap flex-shrink-0 ${
                period === p
                  ? "bg-[#0B6C3E] text-white border-[#0B6C3E]"
                  : "bg-[#111111] text-zinc-400 border-[#1a1a1a] hover:border-[#0B6C3E]/30"
              }`}
            >
              {p === "max" ? "Máx" : p.toUpperCase()}
            </button>
          ))}
        </div>

        {/* === Section 1: Resumo === */}
        <SectionErrorBoundary sectionName="Resumo">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-[#0B6C3E]" />
              <h2 className="text-sm font-semibold text-zinc-300">Resumo</h2>
            </div>

            {/* KPI Cards — Risco & Retorno */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              <KPICard
                label="Retorno (a.a.)"
                value={metrics?.return_annualized != null ? fmtMetricSigned(metrics.return_annualized) : "—"}
                unit="%"
                color={metricColor(metrics?.return_annualized ?? null, true)}
                sublabel="anualizado"
              />
              <KPICard
                label="Volatilidade"
                value={metrics?.volatility != null ? fmtMetric(metrics.volatility) : "—"}
                unit="%"
                color="text-orange-400"
                sublabel="anualizada"
              />
              <KPICard
                label="Sharpe"
                value={metrics?.sharpe != null ? fmtMetric(metrics.sharpe, 2) : "—"}
                color={metrics?.sharpe != null && metrics.sharpe >= 1.0 ? "text-emerald-400" : "text-orange-400"}
                sublabel="vs CDI / vol"
              />
              <KPICard
                label="Sortino"
                value={metrics?.sortino != null ? fmtMetric(metrics.sortino, 2) : "—"}
                color={metrics?.sortino != null && metrics.sortino >= 1.0 ? "text-emerald-400" : "text-orange-400"}
                sublabel="vs risco baixista"
              />
              <KPICard
                label="Max Drawdown"
                value={metrics?.max_drawdown != null ? fmtMetric(metrics.max_drawdown) : "—"}
                unit="%"
                color="text-red-400"
                sublabel="pior queda"
              />
              <KPICard
                label="vs CDI"
                value={vsCDIMetric?.excess != null ? fmtMetricSigned(vsCDIMetric.excess) : "—"}
                unit="%"
                color={vsCDIMetric?.excess != null && vsCDIMetric.excess >= 0 ? "text-emerald-400" : "text-red-400"}
                sublabel="excesso período"
              />
            </div>

            {/* Indexed Return Chart */}
            {indexSeries.length > 1 && (
              <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
                <h3 className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-3">Rentabilidade Indexada (Base 100)</h3>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={indexSeries} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "#71717a" }}
                      tickLine={false}
                      axisLine={{ stroke: "#1a1a1a" }}
                    />
                    <YAxis tick={{ fontSize: 10, fill: "#71717a" }} axisLine={{ stroke: "#1a1a1a" }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#111111", border: "1px solid #1a1a1a", borderRadius: 4 }}
                      labelStyle={{ color: "#d4d4d8" }}
                      formatter={(v: number | string) => (typeof v === "number" ? v.toFixed(2) : String(v))}
                    />
                    <Legend
                      wrapperStyle={{ paddingTop: 12 }}
                      iconType="line"
                      height={24}
                    />
                    <Line
                      type="monotone"
                      dataKey="index"
                      name="Fundo"
                      stroke="#0B6C3E"
                      dot={false}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="cdi"
                      name="CDI"
                      stroke="#a1a1aa"
                      strokeDasharray="5 5"
                      dot={false}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </motion.div>
        </SectionErrorBoundary>

        {/* === Section 2: Performance === */}
        <SectionErrorBoundary sectionName="Performance">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-[#0B6C3E]" />
              <h2 className="text-sm font-semibold text-zinc-300">Performance</h2>
            </div>

            {/* Rolling Returns Grid — 1m/3m/6m/12m/24m/36m */}
            <RollingReturnsGrid
              rows={rollingRows}
              subtitle="Retornos acumulados e anualizados para janelas de 1 a 36 meses."
              accent="#0B6C3E"
            />

            {/* Drawdown Heatmap — calendário mensal ano × mês */}
            {drawdownCells.length > 0 && (
              <DrawdownHeatmap
                cells={drawdownCells}
                summary={drawdownSummary}
                subtitle="Retorno mensal e drawdown corrente a partir da cota diária."
                accent="#0B6C3E"
              />
            )}

            {/* Fund-scope narrative (regime + sinais específicos) */}
            {fundNarrativeContext && (
              <FundNarrativePanel scope="fund" fundContext={fundNarrativeContext} />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Metrics Table */}
              <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
                <h3 className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-3">Métricas Principais</h3>
                <div className="space-y-2 text-[9px] font-mono">
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Retorno Período</span>
                    <span className={metricColor(metrics?.return_period ?? null, true)}>{fmtMetricSigned(metrics?.return_period ?? null)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Retorno Anualizado</span>
                    <span className={metricColor(metrics?.return_annualized ?? null, true)}>{fmtMetricSigned(metrics?.return_annualized ?? null)}%</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-[#1a1a1a]">
                    <span className="text-zinc-600">Sharpe</span>
                    <span>{fmtMetric(metrics?.sharpe ?? null, 2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Sortino</span>
                    <span>{fmtMetric(metrics?.sortino ?? null, 2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Calmar</span>
                    <span>{fmtMetric(metrics?.calmar ?? null, 2)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-[#1a1a1a]">
                    <span className="text-zinc-600">Volatilidade</span>
                    <span>{fmtMetric(metrics?.volatility ?? null)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Max Drawdown</span>
                    <span className="text-red-400">{fmtMetric(metrics?.max_drawdown ?? null)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Dias Positivos</span>
                    <span>{fmtMetric(metrics?.positive_days_pct ?? null)}%</span>
                  </div>
                </div>
              </div>

              {/* Fund Score Card */}
              {score && (
                <div>
                  <FundScoreCard score={score} />
                </div>
              )}
            </div>
          </motion.div>
        </SectionErrorBoundary>

        {/* === Section 2b: Net Flow Proxy === */}
        {netFlowData && netFlowData.weekly.length > 2 && (
          <SectionErrorBoundary sectionName="Fluxo Captação">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-[#0B6C3E]" />
                <h2 className="text-sm font-semibold text-zinc-300">Fluxo Estimado de Captação</h2>
                <span className="text-[8px] text-zinc-600 font-mono ml-auto">proxy: ΔPL − rentab×PL</span>
              </div>
              <p className="text-[10px] text-zinc-500 font-mono leading-relaxed border-l-2 border-[#0B6C3E]/40 pl-3">
                Estimativa de fluxo líquido baseada na variação patrimonial ajustada pela rentabilidade.
                {netFlowData.netTotal >= 0
                  ? <> Captação líquida estimada de <span className="text-emerald-400">{formatPL(netFlowData.netTotal)}</span> no período.</>
                  : <> Resgate líquido estimado de <span className="text-red-400">{formatPL(Math.abs(netFlowData.netTotal))}</span> no período.</>
                }
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-3">
                  <div className="text-[8px] text-zinc-600 uppercase tracking-wider font-mono">Fluxo Líquido</div>
                  <div className={`text-sm font-mono font-semibold ${netFlowData.netTotal >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {netFlowData.netTotal >= 0 ? "+" : ""}{formatPL(netFlowData.netTotal)}
                  </div>
                </div>
                <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-3">
                  <div className="text-[8px] text-zinc-600 uppercase tracking-wider font-mono">Entradas</div>
                  <div className="text-sm font-mono font-semibold text-emerald-400">{formatPL(netFlowData.totalInflow)}</div>
                </div>
                <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-3">
                  <div className="text-[8px] text-zinc-600 uppercase tracking-wider font-mono">Saídas</div>
                  <div className="text-sm font-mono font-semibold text-red-400">{formatPL(netFlowData.totalOutflow)}</div>
                </div>
              </div>
              {/* Weekly flow bar chart */}
              <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={netFlowData.weekly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                    <XAxis dataKey="week" stroke="#52525b" style={{ fontSize: 9 }} tickFormatter={(v: string) => v?.slice(5) ?? ""} />
                    <YAxis stroke="#52525b" style={{ fontSize: 9 }} tickFormatter={(v: number) => {
                      const abs = Math.abs(v);
                      if (abs >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
                      if (abs >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
                      if (abs >= 1e3) return `${(v / 1e3).toFixed(0)}k`;
                      return String(Math.round(v));
                    }} />
                    <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #1a1a1a", fontSize: 10, fontFamily: "monospace" }} />
                    <Line type="monotone" dataKey="flow" stroke="#0B6C3E" strokeWidth={1.5} dot={false} name="Fluxo Semanal" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </SectionErrorBoundary>
        )}

        {/* === Section 3: Composição === */}
        {compositionSummary && cnpj && (
          <SectionErrorBoundary sectionName="Composição">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <PieChart className="w-4 h-4 text-[#0B6C3E]" />
                <h2 className="text-sm font-semibold text-zinc-300">Composição de Carteira</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {compositionSummary.summary && compositionSummary.summary.length > 0 && (
                  <div className="space-y-3">
                    <CompositionSummary cnpj={cnpj} />
                    {/* Composição Analytics Card */}
                    {(() => {
                      const summary = compositionSummary.summary || [];
                      if (summary.length === 0) return null;

                      // Sort by percentage and get top 3
                      const sorted = [...summary].sort((a, b) => b.pct_pl - a.pct_pl);
                      const top3 = sorted.slice(0, 3);
                      const top3Pct = top3.reduce((sum, b) => sum + b.pct_pl, 0);

                      // Calculate HHI: sum of squared percentages
                      const hhi = summary.reduce((sum, b) => sum + Math.pow(b.pct_pl, 2), 0);
                      const hhiLabel = hhi > 2500 ? "concentrada" : hhi > 1500 ? "moderadamente concentrada" : "diversificada";

                      // Asset block labels mapping (module-level constant)
                      const blocoLabels = BLOCO_LABELS;

                      return (
                        <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-3">
                          <h4 className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-3">Composição Analytics</h4>
                          <div className="space-y-2 text-[9px] font-mono">
                            <div>
                              <div className="text-zinc-600 mb-1">Top 3 Blocos:</div>
                              <div className="space-y-1 text-zinc-300">
                                {top3.map((b) => (
                                  <div key={b.bloco} className="flex justify-between pl-2">
                                    <span className="text-zinc-500">{blocoLabels[b.bloco] || b.bloco}</span>
                                    <span className="text-[#0B6C3E] font-semibold">{b.pct_pl.toFixed(1)}%</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="pt-2 border-t border-[#1a1a1a]">
                              <div className="flex justify-between">
                                <span className="text-zinc-600">HHI:</span>
                                <span className="text-zinc-300">{hhi.toFixed(0)}</span>
                              </div>
                              <p className="text-[8px] text-zinc-500 mt-1 leading-relaxed">
                                Carteira <span className="text-zinc-400 font-semibold">{hhiLabel}</span> — top 3 blocos representam <span className="text-zinc-400 font-semibold">{top3Pct.toFixed(1)}%</span> do total.
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
                {compositionFull && compositionFull.assets && (
                  <CompositionDetailTable cnpj={cnpj} />
                )}
              </div>
            </motion.div>
          </SectionErrorBoundary>
        )}

        {/* === Section 3.5: Alertas / Insights === */}
        <FundInsightsSection identifier={slug || null} />

        {/* === Section 4: Informações === */}
        <SectionErrorBoundary sectionName="Informações">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Info className="w-4 h-4 text-[#0B6C3E]" />
              <h2 className="text-sm font-semibold text-zinc-300">Informações do Fundo</h2>
            </div>

            {meta && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[9px] font-mono">
                  <div className="bg-[#111111] border border-[#1a1a1a] rounded p-3">
                    <div className="text-zinc-600 uppercase tracking-wider mb-2">RCVM 175</div>
                    <HierarquiaBadges
                      classe_rcvm175={meta.classe_rcvm175 || meta.classe || meta.tp_fundo}
                      subclasse_rcvm175={meta.subclasse_rcvm175 || undefined}
                      publico_alvo={meta.publico_alvo || undefined}
                      tributacao={meta.tributacao || undefined}
                      size="sm"
                    />
                  </div>
                  <div className="bg-[#111111] border border-[#1a1a1a] rounded p-3">
                    <div className="text-zinc-600 uppercase tracking-wider mb-1">Público-Alvo</div>
                    <div className="text-zinc-300">{meta.publico_alvo || "—"}</div>
                  </div>
                  <div className="bg-[#111111] border border-[#1a1a1a] rounded p-3">
                    <div className="text-zinc-600 uppercase tracking-wider mb-1">Tributação</div>
                    <div className="text-zinc-300">{meta.tributacao || "—"}</div>
                  </div>
                  <div className="bg-[#111111] border border-[#1a1a1a] rounded p-3">
                    <div className="text-zinc-600 uppercase tracking-wider mb-1">Prazo Resgate</div>
                    <div className="text-zinc-300">{meta.prazo_resgate || "—"}</div>
                  </div>
                  <div className="bg-[#111111] border border-[#1a1a1a] rounded p-3">
                    <div className="text-zinc-600 uppercase tracking-wider mb-1">Aplicação Mín</div>
                    <div className="text-zinc-300">{meta.aplicacao_min ? formatPL(meta.aplicacao_min) : "—"}</div>
                  </div>
                  <div className="bg-[#111111] border border-[#1a1a1a] rounded p-3">
                    <div className="text-zinc-600 uppercase tracking-wider mb-1">Benchmark</div>
                    <div className="text-zinc-300 truncate">{meta.benchmark || "—"}</div>
                  </div>
                </div>

                {/* Gestora & Admin Info */}
                <div className="grid grid-cols-2 gap-4 text-[9px] font-mono">
                  <div className="bg-[#111111] border border-[#1a1a1a] rounded p-4">
                    <div className="text-zinc-600 uppercase tracking-wider mb-2">Gestor</div>
                    <div className="text-zinc-300 font-semibold">{meta.gestor_nome || "—"}</div>
                    <div className="text-zinc-700 mt-1">{formatCnpj(meta.cnpj_gestor || "")}</div>
                  </div>
                  <div className="bg-[#111111] border border-[#1a1a1a] rounded p-4">
                    <div className="text-zinc-600 uppercase tracking-wider mb-2">Administrador</div>
                    <div className="text-zinc-300 font-semibold">{meta.admin_nome || "—"}</div>
                    <div className="text-zinc-700 mt-1">{formatCnpj(meta.cnpj_admin || "")}</div>
                  </div>
                </div>

                {/* P1-6: Manager tenure timeline */}
                <ManagerTenureTimeline
                  cnpj={cnpj}
                  dt_const={meta.dt_const}
                  gestor_nome={meta.gestor_nome}
                  accent="#0B6C3E"
                />
              </>
            )}
          </motion.div>
        </SectionErrorBoundary>

        {/* === Section 5: Fundos Similares === */}
        {similarFunds.length === 0 && !fundLoading && (
          <div className="text-center py-6 text-zinc-600 text-xs font-mono">
            Nenhum fundo similar encontrado para a classe {similarClasse || "—"}.
          </div>
        )}
        {similarFunds.length > 0 && (
          <SectionErrorBoundary sectionName="Fundos Similares">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <LineChartIcon className="w-4 h-4 text-[#0B6C3E]" />
                <h2 className="text-sm font-semibold text-zinc-300">Fundos Similares ({similarClasse})</h2>
              </div>
              <div className="text-[10px] font-mono text-zinc-500 mb-4">
                Referência: {fundDisplayName(meta!)} · PL {formatPL(meta?.vl_patrim_liq ?? null)}
                {meta?.taxa_adm != null && ` · Tx. Adm ${Number(meta.taxa_adm).toFixed(2)}%`}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {similarFunds.map((fund) => {
                  // Delta PL vs current fund (as %)
                  const basePL = meta?.vl_patrim_liq ?? null;
                  const peerPL = fund.vl_patrim_liq ?? null;
                  const deltaPL =
                    basePL && peerPL && basePL > 0
                      ? ((peerPL - basePL) / basePL) * 100
                      : null;
                  const deltaColor =
                    deltaPL == null
                      ? "text-zinc-600"
                      : Math.abs(deltaPL) < 20
                      ? "text-zinc-400"
                      : deltaPL > 0
                      ? "text-amber-400"
                      : "text-emerald-400";
                  // Taxa adm delta (in pp)
                  const baseTaxa = meta?.taxa_adm ?? null;
                  const peerTaxa = fund.taxa_adm ?? null;
                  const deltaTaxa =
                    baseTaxa != null && peerTaxa != null
                      ? peerTaxa - baseTaxa
                      : null;
                  const deltaTaxaColor =
                    deltaTaxa == null
                      ? "text-zinc-600"
                      : deltaTaxa > 0.1
                      ? "text-red-400"
                      : deltaTaxa < -0.1
                      ? "text-emerald-400"
                      : "text-zinc-400";

                  return (
                    <Link
                      key={fund.cnpj_fundo}
                      to={`/fundos/${fund.slug || fund.cnpj_fundo_classe || fund.cnpj_fundo}`}
                      className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4 hover:border-[#0B6C3E]/30 transition-all group"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-zinc-300 group-hover:text-[#0B6C3E] truncate transition-colors">
                            {fundDisplayName(fund)}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5">
                            <ClasseBadge classe={fund.classe_rcvm175 || fund.classe} />
                          </div>
                          {fund.gestor_nome && (
                            <div className="text-[9px] font-mono text-zinc-600 mt-1.5 truncate">
                              {fund.gestor_nome}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[10px] font-mono text-zinc-400">{formatPL(peerPL)}</div>
                          {deltaPL != null && (
                            <div className={`text-[9px] font-mono mt-0.5 ${deltaColor}`}>
                              {deltaPL > 0 ? "+" : ""}
                              {deltaPL.toFixed(0)}% PL
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 pt-2 border-t border-[#1a1a1a] text-[9px] font-mono">
                        {peerTaxa != null ? (
                          <span className="text-zinc-600">
                            Tx. Adm{" "}
                            <span className="text-zinc-400">{peerTaxa.toFixed(2)}%</span>
                            {deltaTaxa != null && (
                              <span className={`ml-1 ${deltaTaxaColor}`}>
                                ({deltaTaxa > 0 ? "+" : ""}
                                {deltaTaxa.toFixed(2)}pp)
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-zinc-700">Tx. Adm —</span>
                        )}
                        {fund.nr_cotistas != null && (
                          <span className="text-zinc-600">
                            Cotistas{" "}
                            <span className="text-zinc-400">
                              {fund.nr_cotistas.toLocaleString("pt-BR")}
                            </span>
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          </SectionErrorBoundary>
        )}

        {/* Print-only footer (hidden in app, visible in PDF) */}
        <PrintFooter
          fundName={fundDisplayName(meta)}
          dataAsOf={daily.length > 0 ? daily[daily.length - 1]?.dt_comptc ?? null : null}
          source="CVM Cota Diária"
        />
      </div>
    </div>
  );
}
