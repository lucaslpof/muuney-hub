import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { FundRankingTable } from "@/components/hub/FundRankingTable";
import { FundCategoryRankings } from "@/components/hub/FundCategoryRankings";
import { FundScreener } from "@/components/hub/FundScreener";
import {
  QuotaCompareChart, PLEvolutionChart, FlowChart, ClasseDistribution,
} from "@/components/hub/FundCompareChart";
import {
  FundMetricsSummary, DrawdownChart, VolatilityChart, MetricsCompareTable,
} from "@/components/hub/FundMetricsPanel";
import {
  MonthlyOverviewChart, MonthlyRankingsTable, FundMonthlyDetail,
} from "@/components/hub/FundMonthlyPanel";
import {
  useFundCatalog, useFundDetail, useFundRankings, useFundStats,
  useFundSearch, useGestoraRankings, useAdminRankings,
  formatPL, formatPct, formatCnpj, fundDisplayName, primaryCnpj,
} from "@/hooks/useHubFundos";
import { computeFundMetrics, fmtMetric, metricColor, sharpeLabel } from "@/lib/fundMetrics";
import { computeFundScore } from "@/lib/fundScore";
import { FundScoreCard } from "@/components/hub/FundScoreCard";
import { FundNarrativePanel } from "@/components/hub/FundNarrativePanel";
import { ClasseBadge, HierarquiaBadges, RcvmAdaptadoBadge, ModoAssessorToggle } from "@/lib/rcvm175";
import {
  CompositionSummary, CompositionDetailTable,
} from "@/components/hub/FundCompositionPanel";
import {
  FIDCOverviewKPIs, FIDCRankingTable, FIDCSubordinationChart,
} from "@/components/hub/FIDCPanel";
import {
  FIIOverviewKPIs, FIIRankingTable, FIISegmentoChart, FIITopPerformers,
} from "@/components/hub/FIIPanel";
import {
  FIPOverviewKPIs, FIPRankingTable, FIPCapitalPipeline, FIPTypeDistribution,
} from "@/components/hub/FIPPanel";
import { MacroSection, MacroSidebar } from "@/components/hub/MacroSection";
import { SectionErrorBoundary } from "@/components/hub/SectionErrorBoundary";
import { InsightsFeed } from "@/components/hub/InsightsFeed";
import {
  LayoutGrid, Trophy, Wallet, PieChart, GitCompareArrows,
  Brain, Search, X, BarChart3, Activity, Shield, Layers,
  Building2, Landmark, Users,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/* ─── Period selector ─── */
const PERIODS = ["1m", "3m", "6m", "1y", "max"] as const;

/* ─── 6 Narrative Sections ─── */
const SECTIONS = [
  { id: "overview", label: "Visão Geral", icon: LayoutGrid },
  { id: "estruturados", label: "Estruturados", icon: Shield },
  { id: "gestoras", label: "Gestoras & Admins", icon: Users },
  { id: "metricas-mensal", label: "Métricas & Mensal", icon: Activity },
  { id: "composicao-comparador", label: "Composição & Comparador", icon: GitCompareArrows },
  { id: "analytics", label: "Analytics", icon: Brain },
] as const;

/* ─── Fund Detail Panel ─── */
const FundDetailPanel = ({
  cnpj, period, onClose, modoAssessor = false,
}: {
  cnpj: string; period: string; onClose: () => void; modoAssessor?: boolean;
}) => {
  const { data, isLoading } = useFundDetail(cnpj, period);

  if (isLoading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4 animate-pulse">
        <div className="h-5 bg-[#1a1a1a] rounded w-1/2 mb-3" />
        <div className="h-40 bg-[#1a1a1a] rounded" />
      </motion.div>
    );
  }

  if (!data?.meta) return null;

  const m = data.meta;
  const met = data.metrics;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-[#111111] border border-[#0B6C3E]/20 rounded-lg overflow-hidden"
    >
      {/* Header — Name-first with RCVM 175 hierarchy */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-[#1a1a1a]">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-zinc-100 truncate">
            {fundDisplayName(m)}
          </h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <HierarquiaBadges
              classe_rcvm175={m.classe_rcvm175 || m.classe || m.tp_fundo}
              subclasse_rcvm175={m.subclasse_rcvm175}
              publico_alvo={m.publico_alvo}
              tributacao={m.tributacao}
              size="sm"
            />
            <RcvmAdaptadoBadge hasCnpjClasse={!!m.cnpj_fundo_classe} />
          </div>
          <div className="flex items-center gap-3 mt-1 text-[8px] text-zinc-700 font-mono">
            <span>{formatCnpj(primaryCnpj(m))}</span>
            {m.gestor_nome && <span>Gestor: {m.gestor_nome}</span>}
          </div>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-[#1a1a1a] text-zinc-600 hover:text-zinc-300">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Metrics rows — adapts to Modo Assessor */}
      {(() => {
        const fm = data.daily.length > 5 ? computeFundMetrics(data.daily) : null;
        const sl = fm ? sharpeLabel(fm.sharpe) : null;
        return (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 py-3 border-b border-[#1a1a1a]">
              <div>
                <div className="text-[9px] text-zinc-600 uppercase font-mono">PL</div>
                <div className="text-sm font-bold text-zinc-100 font-mono">{formatPL(met.latest_pl)}</div>
              </div>
              <div>
                <div className="text-[9px] text-zinc-600 uppercase font-mono">Retorno ({met.period})</div>
                <div className={`text-sm font-bold font-mono ${(met.return_period ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {formatPct(met.return_period)}
                </div>
              </div>
              <div>
                <div className="text-[9px] text-zinc-600 uppercase font-mono">Tx Adm</div>
                <div className="text-sm font-bold text-zinc-300 font-mono">{m.taxa_adm != null ? `${m.taxa_adm.toFixed(2)}%` : "—"}</div>
              </div>
              <div>
                <div className="text-[9px] text-zinc-600 uppercase font-mono">Cotistas</div>
                <div className="text-sm font-bold text-zinc-300 font-mono">{m.nr_cotistas != null ? m.nr_cotistas.toLocaleString("pt-BR") : "—"}</div>
              </div>
            </div>
            {/* Assessor: full metrics row */}
            {modoAssessor && fm && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 px-4 py-2.5 border-b border-[#1a1a1a] bg-[#0d0d0d]">
                <div>
                  <div className="text-[8px] text-zinc-700 uppercase font-mono">Vol (a.a.)</div>
                  <div className="text-[11px] font-bold text-zinc-300 font-mono">{fmtMetric(fm.volatility)}%</div>
                </div>
                <div>
                  <div className="text-[8px] text-zinc-700 uppercase font-mono">Sharpe</div>
                  <div className={`text-[11px] font-bold font-mono ${sl?.color || "text-zinc-300"}`}>{fmtMetric(fm.sharpe)}</div>
                </div>
                <div>
                  <div className="text-[8px] text-zinc-700 uppercase font-mono">Sortino</div>
                  <div className={`text-[11px] font-bold font-mono ${metricColor(fm.sortino)}`}>{fmtMetric(fm.sortino)}</div>
                </div>
                <div>
                  <div className="text-[8px] text-zinc-700 uppercase font-mono">Max DD</div>
                  <div className={`text-[11px] font-bold font-mono ${metricColor(fm.max_drawdown, false)}`}>{fmtMetric(fm.max_drawdown)}%</div>
                </div>
                <div>
                  <div className="text-[8px] text-zinc-700 uppercase font-mono">Dias +</div>
                  <div className="text-[11px] font-bold text-zinc-300 font-mono">{fmtMetric(fm.positive_days_pct, 0)}%</div>
                </div>
              </div>
            )}
            {/* Investidor: simplified — just Fund Score badge inline */}
            {!modoAssessor && fm && (
              <div className="flex items-center gap-3 px-4 py-2 border-b border-[#1a1a1a] bg-[#0d0d0d]">
                <div>
                  <div className="text-[8px] text-zinc-700 uppercase font-mono">Sharpe</div>
                  <div className={`text-[11px] font-bold font-mono ${sl?.color || "text-zinc-300"}`}>{fmtMetric(fm.sharpe)}</div>
                </div>
                <div>
                  <div className="text-[8px] text-zinc-700 uppercase font-mono">Vol</div>
                  <div className="text-[11px] font-bold text-zinc-300 font-mono">{fmtMetric(fm.volatility)}%</div>
                </div>
                <div>
                  <div className="text-[8px] text-zinc-700 uppercase font-mono">Max DD</div>
                  <div className={`text-[11px] font-bold font-mono ${metricColor(fm.max_drawdown, false)}`}>{fmtMetric(fm.max_drawdown)}%</div>
                </div>
              </div>
            )}
          </>
        );
      })()}

      {/* Charts */}
      {data.daily.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
          <div className="p-3 border-r border-[#1a1a1a]">
            <PLEvolutionChart daily={data.daily} title="Evolução PL" height={180} />
          </div>
          <div className="p-3">
            <FlowChart daily={data.daily} title="Fluxo Diário" height={180} />
          </div>
        </div>
      )}

      {/* Muuney Fund Score™ */}
      {data.daily.length > 5 && (
        <div className="px-4 py-3 border-t border-[#1a1a1a]">
          <FundScoreCard
            score={computeFundScore(m, data.daily)}
            fundName={fundDisplayName(m)}
          />
        </div>
      )}

      {/* Meta details — extended for Assessor mode */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 py-3 border-t border-[#1a1a1a] text-[9px] font-mono text-zinc-600">
        <div><span className="text-zinc-700">Condomínio:</span> <span className="text-zinc-400">{m.condom || "—"}</span></div>
        <div><span className="text-zinc-700">Aplicação mín:</span> <span className="text-zinc-400">{m.aplicacao_min != null ? formatPL(m.aplicacao_min) : "—"}</span></div>
        <div><span className="text-zinc-700">Resgate:</span> <span className="text-zinc-400">{m.prazo_resgate || "—"}</span></div>
        <div><span className="text-zinc-700">Constituição:</span> <span className="text-zinc-400">{m.dt_const || "—"}</span></div>
      </div>
      {modoAssessor && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 py-2 border-t border-[#141414] text-[9px] font-mono text-zinc-600">
          <div><span className="text-zinc-700">Fundo Cotas:</span> <span className="text-zinc-400">{m.fundo_cotas || "N"}</span></div>
          <div><span className="text-zinc-700">Exclusivo:</span> <span className="text-zinc-400">{m.fundo_exclusivo || "N"}</span></div>
          <div><span className="text-zinc-700">Tx Perfm:</span> <span className="text-zinc-400">{m.taxa_perfm != null ? `${m.taxa_perfm.toFixed(2)}%` : "—"}</span></div>
          <div><span className="text-zinc-700">Benchmark:</span> <span className="text-zinc-400">{m.benchmark || m.rentab_fundo || "—"}</span></div>
        </div>
      )}
    </motion.div>
  );
};

/* ─── Comparador Section v2 (cross-class, up to 6 funds) ─── */
const MAX_COMPARE = 6;
const ComparadorSection = ({ period }: { period: string }) => {
  const [searchQ, setSearchQ] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [showScores, setShowScores] = useState(true);
  const { data: catalog } = useFundCatalog({ limit: 200, search: searchQ || undefined });

  // Fetch details for up to 6 selected funds
  const fund0 = useFundDetail(selected[0] || null, period);
  const fund1 = useFundDetail(selected[1] || null, period);
  const fund2 = useFundDetail(selected[2] || null, period);
  const fund3 = useFundDetail(selected[3] || null, period);
  const fund4 = useFundDetail(selected[4] || null, period);
  const fund5 = useFundDetail(selected[5] || null, period);
  const allFundQueries = [fund0, fund1, fund2, fund3, fund4, fund5];
  const fundDetails = allFundQueries.filter((_, i) => i < selected.length);

  const fundSeries = useMemo(() =>
    fundDetails
      .filter((f) => f.data?.daily?.length)
      .map((f) => ({
        cnpj: primaryCnpj(f.data!.meta) || "",
        name: fundDisplayName(f.data!.meta),
        daily: f.data!.daily,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fund0.data, fund1.data, fund2.data, fund3.data, fund4.data, fund5.data]
  );

  // Compute Fund Scores for all loaded funds (with peer normalization)
  const fundScores = useMemo(() => {
    const loaded = fundDetails.filter((f) => f.data?.meta && f.data?.daily?.length && f.data.daily.length > 5);
    if (loaded.length < 1) return [];

    // Build peer arrays from all loaded funds
    const allMetrics = loaded.map((f) => computeFundMetrics(f.data!.daily));
    const peerMetrics = {
      returns: allMetrics.map((m) => m.return_annualized),
      volatilities: allMetrics.map((m) => m.volatility),
      sharpes: allMetrics.map((m) => m.sharpe),
      drawdowns: allMetrics.map((m) => m.max_drawdown),
      taxasAdm: loaded.map((f) => f.data!.meta!.taxa_adm),
      taxasPerfm: loaded.map((f) => f.data!.meta!.taxa_perfm),
      plValues: loaded.map((f) => f.data!.meta!.vl_patrim_liq),
      cotistas: loaded.map((f) => f.data!.meta!.nr_cotistas),
    };

    return loaded.map((f) => ({
      cnpj: primaryCnpj(f.data!.meta!),
      name: fundDisplayName(f.data!.meta!),
      classe: f.data!.meta!.classe_rcvm175 || f.data!.meta!.classe || f.data!.meta!.tp_fundo,
      score: computeFundScore(f.data!.meta!, f.data!.daily, peerMetrics),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fund0.data, fund1.data, fund2.data, fund3.data, fund4.data, fund5.data]);

  const toggleFund = (cnpj: string) => {
    setSelected((prev) =>
      prev.includes(cnpj) ? prev.filter((c) => c !== cnpj) : prev.length < MAX_COMPARE ? [...prev, cnpj] : prev
    );
  };

  const isLoading = fundDetails.some((f) => f.isLoading);

  return (
    <div className="space-y-4">
      {/* Selection panel */}
      <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[11px] text-zinc-400 uppercase tracking-wider font-mono">
            Selecione até {MAX_COMPARE} fundos <span className="text-zinc-700">(FIDC, FII, FIP ou regular)</span>
          </h3>
          {selected.length > 0 && (
            <button onClick={() => setSelected([])} className="text-[9px] text-zinc-600 hover:text-zinc-400 font-mono">
              Limpar ({selected.length})
            </button>
          )}
        </div>
        <div className="relative mb-2">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600" />
          <input
            type="text"
            placeholder="Buscar por nome ou CNPJ..."
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            className="w-full pl-6 pr-2 py-1.5 text-[10px] bg-[#0a0a0a] border border-[#1a1a1a] rounded text-zinc-300 placeholder-zinc-700 focus:border-[#0B6C3E]/40 focus:outline-none font-mono"
          />
        </div>

        {/* Selected chips with class badges */}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {selected.map((cnpj) => {
              const fund = catalog?.funds.find((f) => f.cnpj_fundo === cnpj);
              return (
                <span key={cnpj} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#0B6C3E]/10 border border-[#0B6C3E]/20 rounded text-[9px] text-[#0B6C3E] font-mono">
                  <ClasseBadge classe={fund?.classe_rcvm175 || fund?.classe || fund?.tp_fundo} />
                  {fund?.denom_social ? fund.denom_social.slice(0, 22) : formatCnpj(cnpj).slice(0, 18)}
                  <button onClick={() => toggleFund(cnpj)} className="hover:text-white ml-0.5">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* Fund list */}
        <div className="max-h-40 overflow-y-auto space-y-0.5">
          {catalog?.funds
            .filter((f) => !selected.includes(f.cnpj_fundo))
            .slice(0, 20)
            .map((f) => (
              <button
                key={f.cnpj_fundo}
                onClick={() => toggleFund(f.cnpj_fundo)}
                disabled={selected.length >= MAX_COMPARE}
                className="w-full text-left flex items-center justify-between px-2 py-1 rounded hover:bg-[#0B6C3E]/5 transition-colors disabled:opacity-30"
              >
                <div className="min-w-0 flex items-center gap-1.5">
                  <ClasseBadge classe={f.classe_rcvm175 || f.classe || f.tp_fundo} />
                  <div>
                    <div className="text-[10px] text-zinc-300 font-mono truncate">
                      {f.denom_social || formatCnpj(f.cnpj_fundo)}
                    </div>
                    <div className="text-[8px] text-zinc-700 font-mono">{f.gestor_nome || formatCnpj(f.cnpj_fundo_classe || f.cnpj_fundo)}</div>
                  </div>
                </div>
                <span className="text-[9px] text-zinc-600 font-mono flex-shrink-0 ml-2">
                  {formatPL(f.vl_patrim_liq)}
                </span>
              </button>
            ))}
        </div>
      </div>

      {/* Loading indicator */}
      {isLoading && selected.length > 0 && (
        <div className="text-[10px] text-zinc-600 font-mono text-center py-2">Carregando dados dos fundos...</div>
      )}

      {/* Indexed performance chart */}
      {fundSeries.length >= 2 && (
        <QuotaCompareChart funds={fundSeries} title="Rentabilidade Indexada (base 100)" height={320} />
      )}

      {/* Muuney Fund Score™ comparison */}
      {fundScores.length >= 2 && (
        <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] text-zinc-400 uppercase tracking-wider font-mono">
              Muuney Fund Score™ Comparado
            </h3>
            <button
              onClick={() => setShowScores(!showScores)}
              className="text-[9px] text-zinc-600 hover:text-zinc-400 font-mono"
            >
              {showScores ? "Ocultar" : "Mostrar"}
            </button>
          </div>
          <AnimatePresence>
            {showScores && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                {/* Score bar comparison */}
                <div className="space-y-2 mb-4">
                  {fundScores
                    .sort((a, b) => b.score.score - a.score.score)
                    .map((f) => (
                      <div key={f.cnpj} className="flex items-center gap-2">
                        <div className="w-[140px] flex-shrink-0">
                          <div className="text-[9px] text-zinc-400 font-mono truncate flex items-center gap-1">
                            <ClasseBadge classe={f.classe} /> {f.name.slice(0, 18)}
                          </div>
                        </div>
                        <div className="flex-1 h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${f.score.score}%`, backgroundColor: f.score.color }}
                          />
                        </div>
                        <div className="w-12 text-right">
                          <span className="text-[10px] font-bold font-mono" style={{ color: f.score.color }}>
                            {f.score.score.toFixed(0)}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>

                {/* Pillar comparison table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px] font-mono">
                    <thead>
                      <tr className="border-b border-[#1a1a1a] text-zinc-600">
                        <th className="text-left px-2 py-1.5">Pilar</th>
                        {fundScores.map((f) => (
                          <th key={f.cnpj} className="text-right px-2 py-1.5 max-w-[100px] truncate">
                            {f.name.slice(0, 14)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="text-zinc-300">
                      {(["rentabilidade", "risco", "liquidez", "custos"] as const).map((pilar) => {
                        const vals = fundScores.map((f) => f.score.pilares[pilar]);
                        const maxVal = Math.max(...vals);
                        return (
                          <tr key={pilar} className="border-b border-[#141414]">
                            <td className="px-2 py-1 text-zinc-500 capitalize">{pilar}</td>
                            {fundScores.map((f) => {
                              const v = f.score.pilares[pilar];
                              const isBest = v === maxVal && vals.filter((x) => x === maxVal).length === 1;
                              return (
                                <td key={f.cnpj} className={`px-2 py-1 text-right ${isBest ? "text-emerald-400 font-bold" : ""}`}>
                                  {v}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                      <tr className="border-t border-[#1a1a1a]">
                        <td className="px-2 py-1.5 text-zinc-400 font-bold">Score</td>
                        {fundScores.map((f) => (
                          <td key={f.cnpj} className="px-2 py-1.5 text-right font-bold" style={{ color: f.score.color }}>
                            {f.score.score.toFixed(0)}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Metrics comparison table */}
      {(() => {
        const metricsData = fundDetails
          .filter((f) => f.data?.daily?.length && f.data.daily.length > 5)
          .map((f) => ({
            name: fundDisplayName(f.data!.meta),
            metrics: computeFundMetrics(f.data!.daily),
          }));
        return metricsData.length >= 2 ? (
          <MetricsCompareTable funds={metricsData} />
        ) : null;
      })()}

      {/* Fund info comparison table */}
      {fundDetails.filter((f) => f.data?.meta).length >= 2 && (
        <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg overflow-x-auto">
          <table className="w-full text-[10px] font-mono">
            <thead>
              <tr className="border-b border-[#1a1a1a] text-zinc-600">
                <th className="text-left px-3 py-2">Info</th>
                {fundDetails.map((f, i) => (
                  <th key={i} className="text-right px-3 py-2 max-w-[130px]">
                    <div className="flex items-center justify-end gap-1">
                      <ClasseBadge classe={f.data?.meta?.classe_rcvm175 || f.data?.meta?.classe || f.data?.meta?.tp_fundo} />
                      <span className="truncate">{f.data?.meta?.denom_social?.slice(0, 16) || "—"}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              <tr className="border-b border-[#141414]">
                <td className="px-3 py-1.5 text-zinc-500">Classe</td>
                {fundDetails.map((f, i) => (
                  <td key={i} className="px-3 py-1.5 text-right text-[9px]">
                    {f.data?.meta?.classe || f.data?.meta?.tp_fundo || "—"}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-[#141414]">
                <td className="px-3 py-1.5 text-zinc-500">PL</td>
                {fundDetails.map((f, i) => (
                  <td key={i} className="px-3 py-1.5 text-right">{formatPL(f.data?.metrics.latest_pl)}</td>
                ))}
              </tr>
              <tr className="border-b border-[#141414]">
                <td className="px-3 py-1.5 text-zinc-500">Cotistas</td>
                {fundDetails.map((f, i) => (
                  <td key={i} className="px-3 py-1.5 text-right">
                    {f.data?.meta?.nr_cotistas != null ? f.data.meta.nr_cotistas.toLocaleString("pt-BR") : "—"}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-[#141414]">
                <td className="px-3 py-1.5 text-zinc-500">Tx Adm</td>
                {fundDetails.map((f, i) => (
                  <td key={i} className="px-3 py-1.5 text-right">
                    {f.data?.meta?.taxa_adm != null ? `${f.data.meta.taxa_adm.toFixed(2)}%` : "—"}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-[#141414]">
                <td className="px-3 py-1.5 text-zinc-500">Tx Perfm</td>
                {fundDetails.map((f, i) => (
                  <td key={i} className="px-3 py-1.5 text-right">
                    {f.data?.meta?.taxa_perfm != null ? `${f.data.meta.taxa_perfm.toFixed(2)}%` : "—"}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-[#141414]">
                <td className="px-3 py-1.5 text-zinc-500">Condomínio</td>
                {fundDetails.map((f, i) => (
                  <td key={i} className="px-3 py-1.5 text-right">{f.data?.meta?.condom || "—"}</td>
                ))}
              </tr>
              <tr>
                <td className="px-3 py-1.5 text-zinc-500">Gestor</td>
                {fundDetails.map((f, i) => (
                  <td key={i} className="px-3 py-1.5 text-right truncate max-w-[110px]">
                    {f.data?.meta?.gestor_nome || "—"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

/* ─── Global Fund Search Bar ─── */
const FundSearchBar = ({ onSelectFund }: { onSelectFund: (cnpj: string) => void }) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const { data: results, isLoading } = useFundSearch(query, { limit: 12 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
      <input
        type="text"
        placeholder="Buscar fundo por nome ou CNPJ..."
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => query.length >= 2 && setOpen(true)}
        className="w-full pl-8 pr-8 py-1.5 text-[11px] bg-[#0a0a0a] border border-[#1a1a1a] rounded-md text-zinc-300 placeholder-zinc-700 focus:border-[#0B6C3E]/40 focus:outline-none font-mono"
      />
      {query && (
        <button onClick={() => { setQuery(""); setOpen(false); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400">
          <X className="w-3 h-3" />
        </button>
      )}
      {open && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#111111] border border-[#1a1a1a] rounded-md shadow-xl z-30 max-h-64 overflow-y-auto">
          {isLoading && (
            <div className="px-3 py-2 text-[10px] text-zinc-600 font-mono">Buscando...</div>
          )}
          {results && results.results.length === 0 && (
            <div className="px-3 py-2 text-[10px] text-zinc-600 font-mono">Nenhum fundo encontrado</div>
          )}
          {results?.results.map((f) => (
            <button
              key={f.cnpj_fundo}
              onClick={() => { onSelectFund(f.cnpj_fundo_classe || f.cnpj_fundo); setOpen(false); setQuery(""); }}
              className="w-full text-left px-3 py-2 hover:bg-[#0B6C3E]/5 border-b border-[#141414] last:border-0 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <ClasseBadge classe={f.classe_rcvm175 || f.classe || f.tp_fundo} size="sm" />
                <span className="text-[10px] text-zinc-300 font-mono truncate">{f.denom_social}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[8px] text-zinc-600 font-mono">
                <span>{formatCnpj(f.cnpj_fundo_classe || f.cnpj_fundo)}</span>
                {f.gestor_nome && <span className="truncate max-w-[120px]">{f.gestor_nome}</span>}
                <span className="ml-auto">{formatPL(f.vl_patrim_liq)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─── Gestora Rankings Table ─── */
const GestoraRankingsTable = () => {
  const { data, isLoading } = useGestoraRankings({ limit: 30 });

  if (isLoading) return <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4 animate-pulse"><div className="h-40 bg-[#1a1a1a] rounded" /></div>;
  if (!data?.gestoras?.length) return null;

  return (
    <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-[#1a1a1a]">
        <h4 className="text-[11px] text-zinc-400 uppercase tracking-wider font-mono">
          Top Gestoras <span className="text-zinc-700">({data.total} total)</span>
        </h4>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] font-mono">
          <thead>
            <tr className="border-b border-[#1a1a1a] text-zinc-600">
              <th className="text-left px-3 py-1.5">#</th>
              <th className="text-left px-3 py-1.5">Gestora</th>
              <th className="text-right px-3 py-1.5">Fundos</th>
              <th className="text-right px-3 py-1.5">PL Total</th>
              <th className="text-right px-3 py-1.5">Tx Adm Média</th>
            </tr>
          </thead>
          <tbody>
            {data.gestoras.slice(0, 20).map((g, i) => (
              <tr key={g.gestor_nome} className="border-b border-[#141414] hover:bg-[#0B6C3E]/5 transition-colors">
                <td className="px-3 py-1.5 text-zinc-600">{i + 1}</td>
                <td className="px-3 py-1.5 text-zinc-300 max-w-[200px] truncate">{g.gestor_nome}</td>
                <td className="px-3 py-1.5 text-right text-zinc-400">{g.fund_count}</td>
                <td className="px-3 py-1.5 text-right text-zinc-200">{formatPL(g.total_pl)}</td>
                <td className="px-3 py-1.5 text-right text-zinc-400">{g.avg_taxa_adm != null ? `${g.avg_taxa_adm.toFixed(2)}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ─── Admin Rankings Table ─── */
const AdminRankingsTable = () => {
  const { data, isLoading } = useAdminRankings({ limit: 30 });

  if (isLoading) return <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4 animate-pulse"><div className="h-40 bg-[#1a1a1a] rounded" /></div>;
  if (!data?.admins?.length) return null;

  return (
    <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-[#1a1a1a]">
        <h4 className="text-[11px] text-zinc-400 uppercase tracking-wider font-mono">
          Top Administradoras <span className="text-zinc-700">({data.total} total)</span>
        </h4>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] font-mono">
          <thead>
            <tr className="border-b border-[#1a1a1a] text-zinc-600">
              <th className="text-left px-3 py-1.5">#</th>
              <th className="text-left px-3 py-1.5">Administradora</th>
              <th className="text-right px-3 py-1.5">Fundos</th>
              <th className="text-right px-3 py-1.5">PL Total</th>
            </tr>
          </thead>
          <tbody>
            {data.admins.slice(0, 20).map((a, i) => (
              <tr key={a.admin_nome} className="border-b border-[#141414] hover:bg-[#0B6C3E]/5 transition-colors">
                <td className="px-3 py-1.5 text-zinc-600">{i + 1}</td>
                <td className="px-3 py-1.5 text-zinc-300 max-w-[200px] truncate">{a.admin_nome}</td>
                <td className="px-3 py-1.5 text-right text-zinc-400">{a.fund_count}</td>
                <td className="px-3 py-1.5 text-right text-zinc-200">{formatPL(a.total_pl)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT — HubFundos (H1.4 Fase B — 6 Narrative Sections)
   ═══════════════════════════════════════════════════════════════════════════ */
const HubFundos = () => {
  /* ─── Deep-linking: period & section from URL ─── */
  const [searchParams, setSearchParams] = useSearchParams();
  const initialPeriod = searchParams.get("period") || "3m";
  const initialSection = searchParams.get("section") || "overview";

  const [period, setPeriod] = useState<string>(
    (PERIODS as readonly string[]).includes(initialPeriod) ? initialPeriod : "3m"
  );
  const [activeSection, setActiveSection] = useState<string>(initialSection);
  const [selectedFund, setSelectedFund] = useState<string | null>(null);
  const [modoAssessor, setModoAssessor] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  /* ─── Lazy-load: track which sections have been visible ─── */
  const [visitedSections, setVisitedSections] = useState<Set<string>>(
    () => new Set(["overview"])
  );
  const sectionVisible = useCallback((id: string) => visitedSections.has(id), [visitedSections]);

  /* ─── Sync period & section to URL ─── */
  useEffect(() => {
    const next: Record<string, string> = {};
    if (period !== "3m") next.period = period;
    if (activeSection !== "overview") next.section = activeSection;
    setSearchParams(next, { replace: true });
  }, [period, activeSection, setSearchParams]);

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
      { rootMargin: "-20% 0px -60% 0px", threshold: 0.1 }
    );

    // Observe all sections
    const timer = setTimeout(() => {
      SECTIONS.forEach(({ id }) => {
        const el = document.getElementById(id);
        if (el) observer.observe(el);
      });
    }, 300);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  /* ─── Data ─── */
  const { data: catalog } = useFundCatalog({ limit: 50 });
  const { data: stats } = useFundStats();
  const { data: rankings, isLoading: rankingsLoading } = useFundRankings(undefined, 30);

  /* ─── Overview KPIs ─── */
  const overviewKPIs = useMemo(() => {
    if (!stats || !catalog) return [];
    const totalPL = Object.values(stats.by_classe).reduce((acc, c) => acc + c.pl_total, 0);
    return [
      { title: "Fundos Ativos", value: String(stats.total_funds), icon: BarChart3 },
      { title: "PL Total", value: formatPL(totalPL), icon: Wallet },
      { title: "Classes", value: String(Object.keys(stats.by_classe).length), icon: PieChart },
      { title: "Top PL", value: formatPL(catalog.funds[0]?.vl_patrim_liq), icon: Trophy },
    ];
  }, [stats, catalog]);

  /* ─── Scroll to section ─── */
  const scrollTo = useCallback((id: string) => {
    setActiveSection(id);
    const el = sectionRefs.current[id] || document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="max-w-[1400px]">
      {/* ─── Sticky Header ─── */}
      <div className="sticky top-0 z-20 bg-[#0a0a0a]/95 backdrop-blur-sm -mx-4 px-4 py-2 border-b border-[#141414] mb-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-base font-bold text-zinc-100 tracking-tight">Módulo Fundos</h1>
            <p className="text-[9px] text-zinc-600 font-mono">
              CVM &middot; {stats?.total_funds ? `${(stats.total_funds / 1000).toFixed(1)}k+` : "—"} classes &middot; RCVM 175 &middot; Dados diários 6M
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ModoAssessorToggle isAssessor={modoAssessor} onToggle={() => setModoAssessor(!modoAssessor)} />
            <div className="flex items-center gap-1">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all ${
                    period === p
                      ? "bg-[#0B6C3E]/15 text-[#0B6C3E] border border-[#0B6C3E]/30"
                      : "text-zinc-600 hover:text-zinc-400 border border-transparent"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
        {/* Global search bar */}
        <FundSearchBar onSelectFund={setSelectedFund} />
      </div>

      {/* ─── Fund Detail Panel (overlay) ─── */}
      <AnimatePresence>
        {selectedFund && (
          <div className="mb-4">
            <FundDetailPanel
              cnpj={selectedFund}
              period={period}
              onClose={() => setSelectedFund(null)}
              modoAssessor={modoAssessor}
            />
          </div>
        )}
      </AnimatePresence>

      {/* ─── Main layout: Sidebar + Content ─── */}
      <div className="flex gap-6">
        {/* Sidebar */}
        <MacroSidebar
          items={SECTIONS.map(s => ({ id: s.id, label: s.label, icon: s.icon }))}
          activeId={activeSection}
          onNavigate={scrollTo}
        />

        {/* Scrollable content */}
        <div className="flex-1 min-w-0 space-y-8">

          {/* ════════════════════════════════════════════════
              SECTION 1: Visão Geral
              ════════════════════════════════════════════════ */}
          <SectionErrorBoundary sectionName="Visão Geral">
            <MacroSection
              ref={(el) => { sectionRefs.current["overview"] = el; }}
              id="overview"
              title="Visão Geral"
              subtitle="Panorama consolidado do mercado de fundos"
              icon={LayoutGrid}
            >
              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {overviewKPIs.map((kpi) => (
                  <motion.div
                    key={kpi.title}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#111111] border border-[#1a1a1a] rounded-md px-3 py-2.5"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <kpi.icon className="w-3 h-3 text-[#0B6C3E]" />
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">{kpi.title}</span>
                    </div>
                    <div className="text-lg font-bold text-zinc-100 font-mono">{kpi.value}</div>
                  </motion.div>
                ))}
              </div>

              {/* Insights Feed — Últimas Movimentações */}
              <InsightsFeed limit={10} days={30} title="Últimas Movimentações" />

              {/* Rankings */}
              <FundRankingTable
                funds={rankings?.funds || []}
                loading={rankingsLoading}
                onSelectFund={setSelectedFund}
                title={`Top Fundos por PL${rankings?.classe ? ` — ${rankings.classe}` : ""}`}
              />

              {/* Category Rankings */}
              <FundCategoryRankings />

              {/* Classes distribution */}
              {stats?.by_classe && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <ClasseDistribution byClasse={stats.by_classe} mode="pl" title="PL por Classe" />
                  <ClasseDistribution byClasse={stats.by_classe} mode="count" title="Fundos por Classe" />
                </div>
              )}

              {/* Catalog summary */}
              {catalog?.funds && (
                <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[11px] text-zinc-400 uppercase tracking-wider font-mono">
                      Catálogo <span className="text-zinc-700">({catalog.total ? `${(catalog.total / 1000).toFixed(1)}k` : "—"} classes)</span>
                    </h3>
                  </div>
                  <p className="text-[9px] text-zinc-600 font-mono">
                    Fonte: CVM (registro_fundo_classe + inf_diario_fi) &middot; RCVM 175 &middot; Última atualização: {stats?.last_updated ? new Date(stats.last_updated).toLocaleDateString("pt-BR") : "—"}
                  </p>
                </div>
              )}
            </MacroSection>
          </SectionErrorBoundary>

          {/* ════════════════════════════════════════════════
              SECTION 2: Estruturados (FIDC + FII + FIP)
              ════════════════════════════════════════════════ */}
          <SectionErrorBoundary sectionName="Estruturados">
            <MacroSection
              ref={(el) => { sectionRefs.current["estruturados"] = el; }}
              id="estruturados"
              title="Estruturados"
              subtitle="FIDC, FII e FIP — veículos de investimento estruturado"
              icon={Shield}
            >
              {sectionVisible("estruturados") ? (
                <div className="space-y-6">
                  {/* FIDC */}
                  <div className="space-y-3">
                    <h3 className="text-[11px] text-zinc-400 uppercase tracking-wider font-mono flex items-center gap-2">
                      <Shield className="w-3 h-3 text-[#0B6C3E]" /> FIDC — Fundos de Direitos Creditórios
                    </h3>
                    <FIDCOverviewKPIs />
                    <FIDCRankingTable onSelectFund={(cnpj) => setSelectedFund(cnpj)} />
                    <FIDCSubordinationChart />
                  </div>

                  {/* FII */}
                  <div className="space-y-3">
                    <h3 className="text-[11px] text-zinc-400 uppercase tracking-wider font-mono flex items-center gap-2">
                      <Building2 className="w-3 h-3 text-[#0B6C3E]" /> FII — Fundos Imobiliários
                    </h3>
                    <FIIOverviewKPIs />
                    <FIIRankingTable onSelectFund={(cnpj) => setSelectedFund(cnpj)} />
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <FIISegmentoChart />
                      <FIITopPerformers />
                    </div>
                  </div>

                  {/* FIP */}
                  <div className="space-y-3">
                    <h3 className="text-[11px] text-zinc-400 uppercase tracking-wider font-mono flex items-center gap-2">
                      <Landmark className="w-3 h-3 text-[#0B6C3E]" /> FIP — Fundos de Participações
                    </h3>
                    <FIPOverviewKPIs />
                    <FIPRankingTable onSelectFund={(cnpj) => setSelectedFund(cnpj)} />
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <FIPCapitalPipeline />
                      <FIPTypeDistribution />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-96 bg-[#111111] border border-[#1a1a1a] rounded-lg animate-pulse" />
              )}
            </MacroSection>
          </SectionErrorBoundary>

          {/* ════════════════════════════════════════════════
              SECTION 3: Gestoras & Administradoras
              ════════════════════════════════════════════════ */}
          <SectionErrorBoundary sectionName="Gestoras & Admins">
            <MacroSection
              ref={(el) => { sectionRefs.current["gestoras"] = el; }}
              id="gestoras"
              title="Gestoras & Administradoras"
              subtitle="Rankings por PL agregado, número de fundos e taxa de administração"
              icon={Users}
            >
              {sectionVisible("gestoras") ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <GestoraRankingsTable />
                  <AdminRankingsTable />
                </div>
              ) : (
                <div className="h-64 bg-[#111111] border border-[#1a1a1a] rounded-lg animate-pulse" />
              )}
            </MacroSection>
          </SectionErrorBoundary>

          {/* ════════════════════════════════════════════════
              SECTION 4: Métricas & Mensal
              ════════════════════════════════════════════════ */}
          <SectionErrorBoundary sectionName="Métricas & Mensal">
            <MacroSection
              ref={(el) => { sectionRefs.current["metricas-mensal"] = el; }}
              id="metricas-mensal"
              title="Métricas & Mensal"
              subtitle="Sharpe, Sortino, drawdown, volatilidade e evolução mensal"
              icon={Activity}
            >
              {sectionVisible("metricas-mensal") ? (
                <div className="space-y-4">
                  {/* Monthly overview */}
                  <MonthlyOverviewChart months={11} />
                  <MonthlyRankingsTable onSelectFund={setSelectedFund} />

                  {/* Metrics: show when a fund is selected */}
                  {selectedFund && (() => {
                    const MetricasDetail = () => {
                      const { data: fundData } = useFundDetail(selectedFund, period);
                      if (!fundData?.daily?.length) return null;
                      return (
                        <div className="space-y-3">
                          <FundMetricsSummary daily={fundData.daily} title={`Métricas — ${fundDisplayName(fundData.meta)}`} />
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            <DrawdownChart daily={fundData.daily} />
                            <VolatilityChart daily={fundData.daily} />
                          </div>
                        </div>
                      );
                    };
                    return <MetricasDetail />;
                  })()}

                  {/* Monthly detail for selected fund */}
                  {selectedFund && <FundMonthlyDetail cnpj={selectedFund} />}

                  {!selectedFund && (
                    <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-6 text-center">
                      <Activity className="w-6 h-6 text-zinc-700 mx-auto mb-2" />
                      <p className="text-[11px] text-zinc-500">Selecione um fundo (busca ou ranking) para ver métricas detalhadas</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-64 bg-[#111111] border border-[#1a1a1a] rounded-lg animate-pulse" />
              )}
            </MacroSection>
          </SectionErrorBoundary>

          {/* ════════════════════════════════════════════════
              SECTION 5: Composição & Comparador
              ════════════════════════════════════════════════ */}
          <SectionErrorBoundary sectionName="Composição & Comparador">
            <MacroSection
              ref={(el) => { sectionRefs.current["composicao-comparador"] = el; }}
              id="composicao-comparador"
              title="Composição & Comparador"
              subtitle="Carteira CDA e comparação entre fundos"
              icon={GitCompareArrows}
            >
              {sectionVisible("composicao-comparador") ? (
                <div className="space-y-6">
                  {/* Screener */}
                  <FundScreener onSelectFund={setSelectedFund} />

                  {/* Composition */}
                  {selectedFund ? (
                    <div className="space-y-3">
                      <h3 className="text-[11px] text-zinc-400 uppercase tracking-wider font-mono flex items-center gap-2">
                        <Layers className="w-3 h-3 text-[#0B6C3E]" /> Composição da Carteira (CDA)
                      </h3>
                      <CompositionSummary cnpj={selectedFund} />
                      <CompositionDetailTable cnpj={selectedFund} />
                    </div>
                  ) : (
                    <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-6 text-center">
                      <Layers className="w-6 h-6 text-zinc-700 mx-auto mb-2" />
                      <p className="text-[11px] text-zinc-500">Selecione um fundo para ver a composição da carteira</p>
                    </div>
                  )}

                  {/* Comparador */}
                  <div>
                    <h3 className="text-[11px] text-zinc-400 uppercase tracking-wider font-mono flex items-center gap-2 mb-3">
                      <GitCompareArrows className="w-3 h-3 text-[#0B6C3E]" /> Comparador de Fundos
                    </h3>
                    <ComparadorSection period={period} />
                  </div>
                </div>
              ) : (
                <div className="h-64 bg-[#111111] border border-[#1a1a1a] rounded-lg animate-pulse" />
              )}
            </MacroSection>
          </SectionErrorBoundary>

          {/* ════════════════════════════════════════════════
              SECTION 6: Analytics
              ════════════════════════════════════════════════ */}
          <SectionErrorBoundary sectionName="Analytics">
            <MacroSection
              ref={(el) => { sectionRefs.current["analytics"] = el; }}
              id="analytics"
              title="Analytics"
              subtitle="Benchmarks, insights e inteligência cross-módulo"
              icon={Brain}
            >
              {sectionVisible("analytics") ? (
                <div className="space-y-4">
                  {/* Fund Market Intelligence */}
                  <FundNarrativePanel
                    totalFunds={stats?.total_funds}
                    totalPL={stats ? Object.values(stats.by_classe).reduce((a, c) => a + c.pl_total, 0) : undefined}
                  />

                  {/* Benchmarks */}
                  <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
                    <h3 className="text-[11px] text-zinc-400 uppercase tracking-wider font-mono mb-3">
                      Benchmarks vs Metas
                    </h3>
                    <div className="space-y-3">
                      {[
                        { label: "Classes catalogadas", current: stats?.total_funds || 0, target: 27000, unit: "" },
                        { label: "Classes RCVM 175", current: Object.keys(stats?.by_classe_rcvm175 || stats?.by_classe || {}).length, target: 7, unit: "" },
                        { label: "Dados diários (meses)", current: 6, target: 12, unit: "" },
                      ].map((b) => (
                        <div key={b.label}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-zinc-500 font-mono">{b.label}</span>
                            <span className="text-[10px] text-zinc-300 font-mono">
                              {b.current}{b.unit} / {b.target}{b.unit}
                            </span>
                          </div>
                          <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#0B6C3E] rounded-full transition-all duration-500"
                              style={{ width: `${Math.min((b.current / b.target) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Insights */}
                  <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
                    <h3 className="text-[11px] text-zinc-400 uppercase tracking-wider font-mono mb-3">
                      Insights
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        {
                          title: "RCVM 175 Adaptado",
                          desc: "27k+ classes com cnpj_fundo_classe como chave primária. Hierarquia Fundo→Classe→Subclasse implementada. Badge ✓ RCVM 175 visível.",
                          color: "#0B6C3E",
                        },
                        {
                          title: "Cobertura de Dados",
                          desc: `${stats?.total_funds ? (stats.total_funds / 1000).toFixed(1) + "k" : "—"} classes catalogadas · 2.6M+ registros diários · 6 meses (Out 2025 — Mar 2026) · Ingestão via pg_cron D+1.`,
                          color: "#3B82F6",
                        },
                        {
                          title: "Modo Assessor",
                          desc: "Toggle entre visão Investidor (simplificada, Fund Score™) e Assessor (Sharpe, Sortino, Calmar, VaR, composição CDA, due diligence).",
                          color: "#06B6D4",
                        },
                        {
                          title: "Cross-module",
                          desc: "Correlação fundos × Selic: fundos RF tendem a captar mais em ciclos de alta. Monitorar spread DI vs cota.",
                          color: "#EC4899",
                        },
                      ].map((insight) => (
                        <div key={insight.title} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: insight.color }} />
                            <span className="text-[10px] text-zinc-300 font-mono font-medium">{insight.title}</span>
                          </div>
                          <p className="text-[9px] text-zinc-600 leading-relaxed">{insight.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-64 bg-[#111111] border border-[#1a1a1a] rounded-lg animate-pulse" />
              )}
            </MacroSection>
          </SectionErrorBoundary>

          {/* ─── CVM Disclaimer ─── */}
          <div className="border-t border-[#141414] pt-3">
            <p className="text-[8px] text-zinc-700 leading-relaxed max-w-3xl">
              <strong className="text-zinc-600">Aviso legal:</strong> Dados de fontes primárias oficiais (CVM).
              Caráter exclusivamente informativo. Não constitui oferta, recomendação ou aconselhamento de investimento.
              Rentabilidade passada não é garantia de resultados futuros.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HubFundos;
