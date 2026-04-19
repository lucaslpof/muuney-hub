import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ArrowLeft, TrendingUp, BarChart3, LineChart as LineChartIcon, Info, Building2 } from "lucide-react";
import { Breadcrumbs } from "@/components/hub/Breadcrumbs";
import { HubSEO } from "@/lib/seo";
import { motion } from "framer-motion";

import {
  useFiiDetail, useFiiV4Monthly,
  formatPL, formatCnpj,
  type FiiMonthlyItem,
} from "@/hooks/useHubFundos";
import { ClasseBadge } from "@/lib/rcvm175";
import { SectionErrorBoundary } from "@/components/hub/SectionErrorBoundary";
import { SimpleKPICard as KPICard } from "@/components/hub/KPICard";
import { computeMonthlyRiskMetrics } from "@/lib/monthlyRiskMetrics";
import { computeRollingReturnsFromMonthly } from "@/lib/rollingReturns";
import { RollingReturnsGrid } from "@/components/hub/RollingReturnsGrid";
import { computeMonthlyGridFromMonthly, summarizeDrawdown } from "@/lib/drawdown";
import { DrawdownHeatmap } from "@/components/hub/DrawdownHeatmap";
import { FundNarrativePanel, type FundScopeContext } from "@/components/hub/FundNarrativePanel";
import { ManagerTenureTimeline } from "@/components/hub/ManagerTenureTimeline";
import { DataAsOfStamp } from "@/components/hub/DataAsOfStamp";

// FII rentabilidade can be corrupt at edges (e.g. funds in liquidation);
// cap at ±95%/mês same as FIDC.
const CORRUPT_RENTAB_THRESHOLD = 95;
function cleanMonthlyReturn(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (!isFinite(n)) return null;
  if (Math.abs(n) > CORRUPT_RENTAB_THRESHOLD) return null;
  return n;
}

/** Compute monthly performance series (rentabilidade + DY) */
function computePerformanceSeries(monthly: FiiMonthlyItem[]) {
  if (!monthly || monthly.length === 0) return [];
  return monthly.map((m) => ({
    date: m.dt_comptc,
    dy: m.dividend_yield_mes != null ? Number(m.dividend_yield_mes) : null,
    rentab_efetiva: m.rentabilidade_efetiva_mes != null ? Number(m.rentabilidade_efetiva_mes) : null,
    rentab_patrim: m.rentabilidade_patrimonial_mes != null ? Number(m.rentabilidade_patrimonial_mes) : null,
  })).filter((d) => d.dy != null || d.rentab_efetiva != null || d.rentab_patrim != null);
}

/** Compute PL over time (in Millions) */
function computePlSeries(monthly: FiiMonthlyItem[]) {
  if (!monthly || monthly.length === 0) return [];
  return monthly.map((m) => ({
    date: m.dt_comptc,
    pl: m.patrimonio_liquido != null ? m.patrimonio_liquido / 1e6 : null,
    vpc: m.valor_patrimonial_cota != null ? Number(m.valor_patrimonial_cota) : null,
  })).filter((d) => d.pl != null);
}

/** Compute cotistas series */
function computeCotistasSeries(monthly: FiiMonthlyItem[]) {
  if (!monthly || monthly.length === 0) return [];
  return monthly.map((m) => ({
    date: m.dt_comptc,
    cotistas: m.nr_cotistas != null ? m.nr_cotistas : null,
  })).filter((d) => d.cotistas != null);
}

/** Main FII Lamina Page */
export default function FiiLamina() {
  const { slug } = useParams<{ slug: string }>();

  const { data: fiiData, isLoading: fiiLoading } = useFiiDetail(slug ?? null);
  const cnpj = fiiData?.meta?.cnpj_fundo || fiiData?.meta?.cnpj_fundo_classe || null;
  const { data: monthlyData } = useFiiV4Monthly(cnpj, 24);

  const meta = fiiData?.meta;
  const monthly = monthlyData?.data || fiiData?.monthly || [];
  const latest = fiiData?.latest;

  const performanceSeries = useMemo(() => computePerformanceSeries(monthly), [monthly]);
  const plSeries = useMemo(() => computePlSeries(monthly), [monthly]);
  const cotistasSeries = useMemo(() => computeCotistasSeries(monthly), [monthly]);

  // Cleaned monthly rentab. efetiva (shared by risk metrics + rolling returns)
  const cleanedMonthlyReturns = useMemo(
    () =>
      monthly
        .map((m) => cleanMonthlyReturn(m.rentabilidade_efetiva_mes))
        .filter((r): r is number => r != null),
    [monthly],
  );

  // Risk & return metrics from monthly rentab. efetiva series
  const riskMetrics = useMemo(() => {
    if (cleanedMonthlyReturns.length < 3) return null;
    try {
      return computeMonthlyRiskMetrics(cleanedMonthlyReturns);
    } catch {
      return null;
    }
  }, [cleanedMonthlyReturns]);

  // Rolling returns grid (1m/3m/6m/12m/24m/36m)
  const rollingRows = useMemo(() => {
    if (cleanedMonthlyReturns.length < 1) return [];
    try {
      return computeRollingReturnsFromMonthly(cleanedMonthlyReturns);
    } catch {
      return [];
    }
  }, [cleanedMonthlyReturns]);

  // Drawdown calendar (ano × mês) — from monthly rentab. efetiva FII
  const drawdownCells = useMemo(() => {
    if (!monthly || monthly.length < 3) return [];
    try {
      const dated = monthly
        .map((m) => {
          const r = cleanMonthlyReturn(m.rentabilidade_efetiva_mes);
          return m.dt_comptc ? { dt_comptc: m.dt_comptc, returnPct: r } : null;
        })
        .filter((x): x is { dt_comptc: string; returnPct: number | null } => x !== null);
      return computeMonthlyGridFromMonthly(dated);
    } catch {
      return [];
    }
  }, [monthly]);
  const drawdownSummary = useMemo(() => {
    if (!drawdownCells.length) return undefined;
    try { return summarizeDrawdown(drawdownCells); } catch { return undefined; }
  }, [drawdownCells]);

  const dyMes = latest?.dividend_yield_mes != null ? Number(latest.dividend_yield_mes) : null;
  const rentabMes = latest?.rentabilidade_efetiva_mes != null ? Number(latest.rentabilidade_efetiva_mes) : null;

  // Per-fund narrative context (FII regime + signals)
  const fundNarrativeContext = useMemo<FundScopeContext | null>(() => {
    if (!meta) return null;
    const twelveMonth = rollingRows.find((r) => r.months === 12 && r.returnPct != null);
    const longest = [...rollingRows].reverse().find((r) => r.returnPct != null);
    const ref = twelveMonth ?? longest;

    let plTrend: "up" | "down" | "flat" | null = null;
    let cotistasTrend: "up" | "down" | "flat" | null = null;
    if (monthly.length >= 2) {
      const firstPL = (monthly[0] as { patrimonio_liquido?: number | null })?.patrimonio_liquido ?? null;
      const lastPL = (monthly[monthly.length - 1] as { patrimonio_liquido?: number | null })?.patrimonio_liquido ?? null;
      if (firstPL && lastPL) {
        const d = (lastPL - firstPL) / firstPL;
        plTrend = d > 0.02 ? "up" : d < -0.02 ? "down" : "flat";
      }
      const firstCot = (monthly[0] as { nr_cotistas?: number | null })?.nr_cotistas ?? null;
      const lastCot = (monthly[monthly.length - 1] as { nr_cotistas?: number | null })?.nr_cotistas ?? null;
      if (firstCot && lastCot) {
        const d = (lastCot - firstCot) / firstCot;
        cotistasTrend = d > 0.02 ? "up" : d < -0.02 ? "down" : "flat";
      }
    }

    return {
      classe: "FII",
      nome: meta.denom_social ?? null,
      returnPct: ref?.returnPct ?? null,
      annualizedPct: ref?.annualizedPct ?? riskMetrics?.return_annualized ?? null,
      cdiPct: ref?.cdiPct ?? null,
      vsCdiPP: ref?.vsCdiPct ?? null,
      volAnnualPct: riskMetrics?.volatility ?? null,
      sharpe: riskMetrics?.sharpe ?? null,
      sortino: riskMetrics?.sortino ?? null,
      maxDrawdownPct: riskMetrics?.max_drawdown ?? null,
      plBRL: (latest as { patrimonio_liquido?: number | null })?.patrimonio_liquido ?? null,
      plTrend,
      cotistasTrend,
      fiiDyMensal: dyMes,
      selicMeta: 14.15,
      ipcaAccum: 5.0,
    };
  }, [meta, monthly, latest, riskMetrics, rollingRows, dyMes]);

  // Auto-generated assessment
  const fiiAssessment = useMemo(() => {
    const signals: { label: string; severity: "positive" | "warning" | "alert"; text: string }[] = [];

    // DY assessment
    if (dyMes != null) {
      const selicMensal = (Math.pow(1 + 14.25 / 100, 1 / 12) - 1) * 100;
      const dyAnual = dyMes * 12;
      if (dyMes > selicMensal) signals.push({ label: "DY Acima da Selic", severity: "positive", text: `DY mensal (${dyMes.toFixed(2)}%) supera Selic mensal (${selicMensal.toFixed(2)}%). DY anualizado: ~${dyAnual.toFixed(1)}%.` });
      else if (dyMes > selicMensal * 0.8) signals.push({ label: "DY Próximo da Selic", severity: "warning", text: `DY mensal (${dyMes.toFixed(2)}%) ligeiramente abaixo da Selic mensal (${selicMensal.toFixed(2)}%). Considerar custo oportunidade.` });
      else signals.push({ label: "DY Comprimido", severity: "alert", text: `DY mensal (${dyMes.toFixed(2)}%) significativamente abaixo da Selic mensal (${selicMensal.toFixed(2)}%). Descontando prêmio de risco.` });
    }

    // Rentab vs DY spread (distributing more than earning?)
    if (dyMes != null && rentabMes != null) {
      if (rentabMes < 0 && dyMes > 0) signals.push({ label: "Yield Trap Risk", severity: "alert", text: `Rentabilidade efetiva negativa (${rentabMes.toFixed(2)}%) mas DY positivo (${dyMes.toFixed(2)}%). Distribuindo mais do que gera — possível destruição de valor patrimonial.` });
      else if (rentabMes > dyMes * 1.5) signals.push({ label: "Valorização Patrimonial", severity: "positive", text: `Rentabilidade efetiva (${rentabMes.toFixed(2)}%) supera DY (${dyMes.toFixed(2)}%). Apreciação real do patrimônio.` });
    }

    // Cotistas trend (basic - just show count)
    if (latest?.nr_cotistas != null && latest.nr_cotistas > 10000) {
      signals.push({ label: "Alta Liquidez", severity: "positive", text: `${latest.nr_cotistas.toLocaleString("pt-BR")} cotistas — base ampla indica boa liquidez no mercado secundário.` });
    }

    return signals;
  }, [dyMes, rentabMes, latest]);

  if (fiiLoading) {
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
          <p className="text-zinc-400 mb-4">FII não encontrado</p>
          <Link to="/fundos/fii" className="text-[#EC4899] hover:underline text-sm flex items-center gap-1 justify-center">
            <ArrowLeft className="w-4 h-4" /> Voltar para Módulo FII
          </Link>
        </div>
      </div>
    );
  }

  const fundName = meta.denom_social || latest?.nome_fundo || `FII ${meta.cnpj_fundo_classe || meta.cnpj_fundo}`;
  const segmento = latest?.segmento || "—";
  const mandato = latest?.mandato || "—";
  const tipoGestao = latest?.tipo_gestao || "—";

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Dynamic SEO for FII Lâmina */}
      <HubSEO
        title={fundName || "FII"}
        description={`Análise FII: ${fundName || "fundo imobiliário"} — PL R$ ${formatPL(meta?.vl_patrim_liq)}, segmento ${segmento}, dividend yield ${latest?.dividend_yield_mes}%. Rentabilidade, distribuição mensal e composição de ativos.`}
        path={`/fundos/fii/${slug}`}
        keywords={`${fundName}, FII, fundo imobiliário, lâmina FII, análise FII, dividend yield, fundos imobiliários Brasil`}
        isProtected={true}
      />

      {/* Header Navigation */}
      <div className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur border-b border-[#1a1a1a]">
        <div className="w-full px-4 md:px-6 py-3">
          <Breadcrumbs
            items={[
              { label: "Fundos", to: "/fundos" },
              { label: "FII", to: "/fundos/fii" },
              { label: fundName },
            ]}
            className="mb-2"
          />
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold text-zinc-100 truncate flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#EC4899] shrink-0" />
                {fundName}
              </h1>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <ClasseBadge classe="FII" size="md" />
                <span className="text-[8px] text-zinc-700">{formatCnpj(meta.cnpj_fundo_classe || meta.cnpj_fundo)}</span>
                {segmento !== "—" && (
                  <span className="text-[8px] text-zinc-500 font-mono">· {segmento}</span>
                )}
                <DataAsOfStamp
                  date={latest?.dt_comptc}
                  cadence="monthly"
                  source="CVM Informe FII"
                  compact
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-6 py-8 space-y-8">
        {/* === Section 1: Resumo + KPIs === */}
        <SectionErrorBoundary sectionName="Resumo">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-[#EC4899]" />
              <h2 className="text-sm font-semibold text-zinc-300">Resumo</h2>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KPICard
                label="Patrimônio Líquido"
                value={formatPL(latest?.patrimonio_liquido || meta.vl_patrim_liq)}
                color="text-zinc-300"
              />
              <KPICard
                label="Dividend Yield (mês)"
                value={dyMes != null ? dyMes.toFixed(2) : "—"}
                unit="%"
                color={dyMes != null && dyMes > 0.8 ? "text-emerald-400" : "text-zinc-300"}
              />
              <KPICard
                label="Rentab. Efetiva (mês)"
                value={rentabMes != null ? rentabMes.toFixed(2) : "—"}
                unit="%"
                color={rentabMes != null && rentabMes > 0 ? "text-emerald-400" : "text-red-400"}
              />
              <KPICard
                label="Cotistas"
                value={latest?.nr_cotistas != null ? latest.nr_cotistas.toLocaleString("pt-BR") : "—"}
                color="text-zinc-400"
              />
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[9px] font-mono">
              <div className="bg-[#111111] border border-[#1a1a1a] rounded p-3">
                <div className="text-zinc-600 uppercase tracking-wider mb-1">Valor Patrimonial/Cota</div>
                <div className="text-zinc-300">
                  {latest?.valor_patrimonial_cota != null
                    ? `R$ ${Number(latest.valor_patrimonial_cota).toFixed(2)}`
                    : "—"}
                </div>
              </div>
              <div className="bg-[#111111] border border-[#1a1a1a] rounded p-3">
                <div className="text-zinc-600 uppercase tracking-wider mb-1">Mandato</div>
                <div className="text-zinc-300 truncate">{mandato}</div>
              </div>
              <div className="bg-[#111111] border border-[#1a1a1a] rounded p-3">
                <div className="text-zinc-600 uppercase tracking-wider mb-1">Tipo de Gestão</div>
                <div className="text-zinc-300">{tipoGestao}</div>
              </div>
            </div>
            {/* FII Assessment */}
            {fiiAssessment.length > 0 && (
              <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-3 space-y-2">
                <h4 className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-1">Avaliação Automática</h4>
                {fiiAssessment.map((s) => {
                  const severityStyles = {
                    positive: { bg: "bg-emerald-500/5", border: "border-emerald-500/20", text: "text-emerald-400", dot: "bg-emerald-400" },
                    warning: { bg: "bg-amber-500/5", border: "border-amber-500/20", text: "text-amber-400", dot: "bg-amber-400" },
                    alert: { bg: "bg-red-500/5", border: "border-red-500/20", text: "text-red-400", dot: "bg-red-400" },
                  };
                  const style = severityStyles[s.severity];
                  return (
                    <div key={s.label} className={`${style.bg} border ${style.border} rounded px-3 py-2 flex items-start gap-2`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${style.dot} mt-1 shrink-0`} />
                      <div>
                        <span className={`text-[9px] font-mono font-bold ${style.text}`}>{s.label}</span>
                        <p className="text-[8px] text-zinc-600 mt-0.5">{s.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </SectionErrorBoundary>

        {/* === Section 2: Performance Histórica === */}
        {performanceSeries.length > 1 && (
          <SectionErrorBoundary sectionName="Performance">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-[#EC4899]" />
                <h2 className="text-sm font-semibold text-zinc-300">Performance Histórica</h2>
              </div>

              {/* Risco & Retorno (annualized from monthly rentab. efetiva) */}
              {riskMetrics && riskMetrics.data_points >= 3 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  <KPICard
                    label="Retorno (a.a.)"
                    value={riskMetrics.return_annualized != null ? riskMetrics.return_annualized.toFixed(2) : "—"}
                    unit="%"
                    color={riskMetrics.return_annualized != null && riskMetrics.return_annualized > 0 ? "text-emerald-400" : "text-red-400"}
                    sublabel="anualizado"
                  />
                  <KPICard
                    label="Volatilidade"
                    value={riskMetrics.volatility != null ? riskMetrics.volatility.toFixed(2) : "—"}
                    unit="%"
                    color="text-amber-400"
                    sublabel="anualizada"
                  />
                  <KPICard
                    label="Sharpe"
                    value={riskMetrics.sharpe != null ? riskMetrics.sharpe.toFixed(2) : "—"}
                    color={riskMetrics.sharpe != null && riskMetrics.sharpe > 1 ? "text-emerald-400" : riskMetrics.sharpe != null && riskMetrics.sharpe > 0 ? "text-zinc-300" : "text-red-400"}
                    sublabel="vs CDI / vol"
                  />
                  <KPICard
                    label="Sortino"
                    value={riskMetrics.sortino != null ? riskMetrics.sortino.toFixed(2) : "—"}
                    color={riskMetrics.sortino != null && riskMetrics.sortino > 1 ? "text-emerald-400" : riskMetrics.sortino != null && riskMetrics.sortino > 0 ? "text-zinc-300" : "text-red-400"}
                    sublabel="vs risco baixista"
                  />
                  <KPICard
                    label="Max Drawdown"
                    value={riskMetrics.max_drawdown != null ? riskMetrics.max_drawdown.toFixed(2) : "—"}
                    unit="%"
                    color="text-red-400"
                    sublabel="pior queda"
                  />
                </div>
              )}

              {/* Rolling Returns Grid — 1m/3m/6m/12m/24m/36m */}
              <RollingReturnsGrid
                rows={rollingRows}
                subtitle="Janelas calculadas sobre a rentabilidade efetiva mensal CVM."
                accent="#EC4899"
              />

              {/* Drawdown Heatmap — calendário mensal ano × mês */}
              {drawdownCells.length > 0 && (
                <DrawdownHeatmap
                  cells={drawdownCells}
                  summary={drawdownSummary}
                  subtitle="Rentabilidade efetiva mensal e drawdown corrente sobre a cota do FII."
                  accent="#EC4899"
                />
              )}

              {/* Fund-scope narrative (regime + sinais específicos FII) */}
              {fundNarrativeContext && (
                <FundNarrativePanel scope="fund" fundContext={fundNarrativeContext} />
              )}

              {/* Rentabilidade + DY */}
              <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
                <h3 className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-3">
                  Rentabilidade & Dividend Yield (%/mês)
                </h3>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={performanceSeries} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
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
                      formatter={(v: number | string) => (v != null ? `${Number(v).toFixed(2)}%` : "—")}
                    />
                    <Line
                      type="monotone"
                      dataKey="dy"
                      stroke="#EC4899"
                      name="Dividend Yield"
                      dot={false}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="rentab_efetiva"
                      stroke="#0B6C3E"
                      name="Rentab. Efetiva"
                      dot={false}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="rentab_patrim"
                      stroke="#F59E0B"
                      name="Rentab. Patrimonial"
                      dot={false}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* PL over time */}
              {plSeries.length > 1 && (
                <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
                  <h3 className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-3">
                    Patrimônio Líquido (R$ Mi)
                  </h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={plSeries} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
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
                        formatter={(v: number | string) => `R$ ${Number(v).toFixed(0)} Mi`}
                      />
                      <Line
                        type="monotone"
                        dataKey="pl"
                        stroke="#EC4899"
                        dot={false}
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Cotistas */}
              {cotistasSeries.length > 1 && (
                <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
                  <h3 className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-3">Número de Cotistas</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={cotistasSeries} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
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
                        formatter={(v: number | string) => Number(v).toLocaleString("pt-BR")}
                      />
                      <Line
                        type="monotone"
                        dataKey="cotistas"
                        stroke="#8B5CF6"
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
        )}

        {/* === Section 3: Composição por Segmento === */}
        <SectionErrorBoundary sectionName="Composição">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-[#EC4899]" />
              <h2 className="text-sm font-semibold text-zinc-300">Classificação & Segmento</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px] font-mono">
              <div className="bg-[#111111] border border-[#1a1a1a] rounded p-4 space-y-3">
                <div className="text-zinc-600 uppercase tracking-wider text-[9px] pb-2 border-b border-[#1a1a1a]">
                  Classificação
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">Segmento</span>
                  <span className="text-[#EC4899] font-semibold">{segmento}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">Mandato</span>
                  <span className="text-zinc-300">{mandato}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">Tipo Gestão</span>
                  <span className="text-zinc-300">{tipoGestao}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">Público-Alvo</span>
                  <span className="text-zinc-300 truncate max-w-[60%]">{latest?.publico_alvo || meta.publico_alvo || "—"}</span>
                </div>
              </div>

              <div className="bg-[#111111] border border-[#1a1a1a] rounded p-4 space-y-3">
                <div className="text-zinc-600 uppercase tracking-wider text-[9px] pb-2 border-b border-[#1a1a1a]">
                  Métricas Operacionais
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">Cotas Emitidas</span>
                  <span className="text-zinc-300">
                    {latest?.cotas_emitidas != null ? Number(latest.cotas_emitidas).toLocaleString("pt-BR") : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">VP/Cota</span>
                  <span className="text-zinc-300">
                    {latest?.valor_patrimonial_cota != null ? `R$ ${Number(latest.valor_patrimonial_cota).toFixed(2)}` : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">% Despesas Adm</span>
                  <span className="text-zinc-300">
                    {latest?.pct_despesas_adm != null ? `${Number(latest.pct_despesas_adm).toFixed(2)}%` : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">Rentab. Patrimonial</span>
                  <span className="text-zinc-300">
                    {latest?.rentabilidade_patrimonial_mes != null
                      ? `${Number(latest.rentabilidade_patrimonial_mes).toFixed(2)}%`
                      : "—"}
                  </span>
                </div>
              </div>
            </div>

            {meta && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[9px] font-mono">
                <div className="bg-[#111111] border border-[#1a1a1a] rounded p-4">
                  <div className="text-zinc-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Info className="w-3 h-3" /> Gestor
                  </div>
                  <div className="text-zinc-300 font-semibold">{meta.gestor_nome || "—"}</div>
                  <div className="text-zinc-700 mt-1">{formatCnpj(meta.cnpj_gestor || "")}</div>
                </div>
                <div className="bg-[#111111] border border-[#1a1a1a] rounded p-4">
                  <div className="text-zinc-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Info className="w-3 h-3" /> Administrador
                  </div>
                  <div className="text-zinc-300 font-semibold">{meta.admin_nome || "—"}</div>
                  <div className="text-zinc-700 mt-1">{formatCnpj(meta.cnpj_admin || "")}</div>
                </div>
              </div>
            )}

            {meta && (
              <ManagerTenureTimeline
                cnpj={meta.cnpj_fundo_classe || meta.cnpj_fundo}
                dt_const={meta.dt_const}
                gestor_nome={meta.gestor_nome}
                accent="#EC4899"
              />
            )}
          </motion.div>
        </SectionErrorBoundary>

        {/* === Section 4: Fundos Similares === */}
        {(!fiiData?.similar || fiiData.similar.length === 0) && !fiiLoading && (
          <div className="text-center py-6 text-zinc-600 text-xs font-mono">
            Nenhum FII similar encontrado para o mesmo segmento.
          </div>
        )}
        {fiiData?.similar && fiiData.similar.length > 0 && (
          <SectionErrorBoundary sectionName="Fundos Similares">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <LineChartIcon className="w-4 h-4 text-[#EC4899]" />
                <h2 className="text-sm font-semibold text-zinc-300">FIIs Similares (mesmo segmento)</h2>
              </div>
              <div className="text-[10px] font-mono text-zinc-500 mb-4">
                Referência: {meta?.denom_social || "—"}
                {latest?.dividend_yield_mes != null &&
                  ` · DY ${Number(latest.dividend_yield_mes).toFixed(2)}%`}
                {latest?.rentabilidade_efetiva_mes != null &&
                  ` · Rentab ${Number(latest.rentabilidade_efetiva_mes).toFixed(2)}%`}
                {latest?.segmento && ` · ${latest.segmento}`}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fiiData.similar.slice(0, 6).map((fund, idx) => {
                  const peerDY =
                    fund.dividend_yield_mes != null ? Number(fund.dividend_yield_mes) : null;
                  const baseDY =
                    latest?.dividend_yield_mes != null ? Number(latest.dividend_yield_mes) : null;
                  const deltaDY =
                    peerDY != null && baseDY != null ? peerDY - baseDY : null;

                  const peerRentab =
                    fund.rentabilidade_efetiva_mes != null
                      ? Number(fund.rentabilidade_efetiva_mes)
                      : null;
                  const baseRentab =
                    latest?.rentabilidade_efetiva_mes != null
                      ? Number(latest.rentabilidade_efetiva_mes)
                      : null;
                  const deltaRentab =
                    peerRentab != null && baseRentab != null ? peerRentab - baseRentab : null;

                  return (
                    <Link
                      key={idx}
                      to={`/fundos/fii/${fund.slug || fund.cnpj_fundo_classe || fund.cnpj_fundo}`}
                      className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4 hover:border-[#EC4899]/30 transition-all group"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-zinc-300 group-hover:text-[#EC4899] truncate transition-colors">
                            {fund.denom_social || fund.nome_fundo || `FII ${fund.cnpj_fundo}`}
                          </div>
                          {fund.segmento && (
                            <div className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider bg-[#EC4899]/10 text-[#EC4899] border border-[#EC4899]/30 truncate max-w-full">
                              {fund.segmento}
                            </div>
                          )}
                          {fund.gestor_nome && (
                            <div className="text-[9px] font-mono text-zinc-600 mt-1.5 truncate">
                              {fund.gestor_nome}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[10px] font-mono text-zinc-400">{formatPL(fund.patrimonio_liquido)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 pt-2 border-t border-[#1a1a1a] text-[9px] font-mono flex-wrap">
                        {peerDY != null ? (
                          <span className="text-zinc-600">
                            DY{" "}
                            <span className="text-emerald-400">{peerDY.toFixed(2)}%</span>
                            {deltaDY != null && (
                              <span className={`ml-1 ${deltaDY > 0 ? "text-emerald-500" : "text-red-500"}`}>
                                ({deltaDY > 0 ? "+" : ""}
                                {deltaDY.toFixed(2)}pp)
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-zinc-700">DY —</span>
                        )}
                        {peerRentab != null ? (
                          <span className="text-zinc-600">
                            Rentab{" "}
                            <span className={peerRentab >= 0 ? "text-emerald-400" : "text-red-400"}>
                              {peerRentab.toFixed(2)}%
                            </span>
                            {deltaRentab != null && (
                              <span className={`ml-1 ${deltaRentab > 0 ? "text-emerald-500" : "text-red-500"}`}>
                                ({deltaRentab > 0 ? "+" : ""}
                                {deltaRentab.toFixed(2)}pp)
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-zinc-700">Rentab —</span>
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
      </div>
    </div>
  );
}
