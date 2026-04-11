import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ArrowLeft, TrendingUp, BarChart3, LineChart as LineChartIcon, PieChart, Info } from "lucide-react";
import { motion } from "framer-motion";

import {
  useFundDetail, useFundCatalog, useFundCompositionSummary, useFundComposition,
  formatPL, formatCnpj, fundDisplayName, primaryCnpj,
} from "@/hooks/useHubFundos";
import { computeFundMetrics, fmtMetric, fmtMetricSigned, metricColor } from "@/lib/fundMetrics";
import { computeFundScore } from "@/lib/fundScore";
import { ClasseBadge, HierarquiaBadges } from "@/lib/rcvm175";
import { FundScoreCard } from "@/components/hub/FundScoreCard";
import { SectionErrorBoundary } from "@/components/hub/SectionErrorBoundary";
import { FundInsightsSection } from "@/components/hub/InsightsFeed";
import {
  CompositionSummary, CompositionDetailTable,
} from "@/components/hub/FundCompositionPanel";
import { useLaminaQuota } from "@/hooks/useLaminaQuota";
import { InlinePaywall } from "@/components/hub/RequireTier";

const PERIODS = ["1m", "3m", "6m", "1y", "max"] as const;

/** Compute base-100 index from quota data */
function computeIndexSeries(daily: any[]) {
  if (!daily || daily.length === 0) return [];
  const firstQuota = daily[0].vl_quota;
  if (!firstQuota) return [];

  return daily.map((d) => ({
    date: d.dt_comptc,
    index: d.vl_quota ? (d.vl_quota / firstQuota) * 100 : null,
  })).filter((d) => d.index != null);
}

/** KPI Card */
const KPICard = ({
  label, value, unit = "", color = "text-zinc-400",
}: {
  label: string; value: string | number; unit?: string; color?: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-3"
  >
    <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-1">{label}</div>
    <div className={`text-lg font-semibold font-mono ${color}`}>
      {value}{unit && <span className="text-sm ml-0.5">{unit}</span>}
    </div>
  </motion.div>
);

/** Main Fund Lamina Page */
export default function FundLamina() {
  const { slug } = useParams<{ slug: string }>();
  const [period, setPeriod] = useState<typeof PERIODS[number]>("3m");

  // Daily lâmina quota (free = 3/day, pro/admin = unlimited)
  const quota = useLaminaQuota(slug);

  const { data: fundData, isLoading: fundLoading } = useFundDetail(slug ?? null, period);
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
    return catalogData.funds
      .filter((f) => f.cnpj_fundo !== meta.cnpj_fundo)
      .slice(0, 6);
  }, [catalogData, fundData]);

  const meta = fundData?.meta;
  const daily = fundData?.daily || [];

  // Compute metrics and score
  const metrics = daily.length > 5 ? computeFundMetrics(daily) : null;
  const score = meta && daily.length > 5 ? computeFundScore(meta, daily) : null;

  // Index series for chart
  const indexSeries = computeIndexSeries(daily);

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
      {/* Header Navigation */}
      <div className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur border-b border-[#1a1a1a]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link to="/fundos" className="p-1.5 hover:bg-[#1a1a1a] rounded transition-colors group">
            <ArrowLeft className="w-5 h-5 text-zinc-600 group-hover:text-[#0B6C3E]" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-zinc-100 truncate">{fundDisplayName(meta)}</h1>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <ClasseBadge classe={meta.classe_rcvm175 || meta.classe || meta.tp_fundo} size="md" />
              <span className="text-[8px] text-zinc-700">{formatCnpj(primaryCnpj(meta))}</span>
            </div>
          </div>
          {score && <span className="text-sm font-semibold font-mono px-2 py-1 rounded bg-[#0B6C3E]/10 text-[#0B6C3E]">
            Score: {score.score.toFixed(0)}
          </span>}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Metadata Row */}
        <div className="grid grid-cols-4 gap-3 text-[9px] font-mono">
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
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-[9px] font-mono rounded transition-all border ${
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

            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-3">
              <KPICard
                label="Retorno"
                value={metrics?.return_annualized != null ? fmtMetricSigned(metrics.return_annualized) : "—"}
                unit="%"
                color={metricColor(metrics?.return_annualized ?? null, true)}
              />
              <KPICard
                label="Volatilidade"
                value={metrics?.volatility != null ? fmtMetric(metrics.volatility) : "—"}
                unit="%"
                color="text-orange-400"
              />
              <KPICard
                label="Sharpe"
                value={metrics?.sharpe != null ? fmtMetric(metrics.sharpe, 2) : "—"}
                color={metrics?.sharpe != null && metrics.sharpe >= 1.0 ? "text-emerald-400" : "text-orange-400"}
              />
              <KPICard
                label="Max Drawdown"
                value={metrics?.max_drawdown != null ? fmtMetric(metrics.max_drawdown) : "—"}
                unit="%"
                color="text-red-400"
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
                      formatter={(v: any) => v?.toFixed(2)}
                    />
                    <Line
                      type="monotone"
                      dataKey="index"
                      stroke="#0B6C3E"
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

            <div className="grid grid-cols-2 gap-4">
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

        {/* === Section 3: Composição === */}
        {compositionSummary && cnpj && (
          <SectionErrorBoundary sectionName="Composição">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <PieChart className="w-4 h-4 text-[#0B6C3E]" />
                <h2 className="text-sm font-semibold text-zinc-300">Composição de Carteira</h2>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {compositionSummary.summary && compositionSummary.summary.length > 0 && (
                  <div className="space-y-3">
                    <CompositionSummary cnpj={cnpj} />
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
                <div className="grid grid-cols-3 gap-3 text-[9px] font-mono">
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
              </>
            )}
          </motion.div>
        </SectionErrorBoundary>

        {/* === Section 5: Fundos Similares === */}
        {similarFunds.length > 0 && (
          <SectionErrorBoundary sectionName="Fundos Similares">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <LineChartIcon className="w-4 h-4 text-[#0B6C3E]" />
                <h2 className="text-sm font-semibold text-zinc-300">Fundos Similares ({similarClasse})</h2>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {similarFunds.map((fund) => (
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
                        <ClasseBadge classe={fund.classe_rcvm175 || fund.classe} size="sm" />
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] font-mono text-zinc-400">{formatPL(fund.vl_patrim_liq)}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </motion.div>
          </SectionErrorBoundary>
        )}
      </div>
    </div>
  );
}
