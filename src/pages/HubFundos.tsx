import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { FundRankingTable } from "@/components/hub/FundRankingTable";
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
  formatPL, formatPct, shortCnpj,
} from "@/hooks/useHubFundos";
import { computeFundMetrics, fmtMetric, metricColor, sharpeLabel } from "@/lib/fundMetrics";
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
  cnpj, period, onClose,
}: {
  cnpj: string; period: string; onClose: () => void;
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
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-[#1a1a1a]">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-zinc-100 truncate">
            {m.denom_social || shortCnpj(m.cnpj_fundo)}
          </h3>
          <div className="flex items-center gap-3 mt-1 text-[9px] text-zinc-600 font-mono">
            <span>{m.cnpj_fundo}</span>
            {m.classe && <span className="px-1 py-0.5 bg-[#1a1a1a] rounded">{m.classe}</span>}
            {m.classe_anbima && <span className="px-1 py-0.5 bg-[#1a1a1a] rounded">{m.classe_anbima}</span>}
          </div>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-[#1a1a1a] text-zinc-600 hover:text-zinc-300">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Metrics rows */}
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
                <div className="text-[9px] text-zinc-600 uppercase font-mono">Gestor</div>
                <div className="text-[11px] text-zinc-400 truncate">{m.gestor_nome || "—"}</div>
              </div>
            </div>
            {fm && (
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

      {/* Meta details */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 py-3 border-t border-[#1a1a1a] text-[9px] font-mono text-zinc-600">
        <div><span className="text-zinc-700">Condomínio:</span> <span className="text-zinc-400">{m.condom || "—"}</span></div>
        <div><span className="text-zinc-700">Fundo Cotas:</span> <span className="text-zinc-400">{m.fundo_cotas || "N"}</span></div>
        <div><span className="text-zinc-700">Exclusivo:</span> <span className="text-zinc-400">{m.fundo_exclusivo || "N"}</span></div>
        <div><span className="text-zinc-700">Constituição:</span> <span className="text-zinc-400">{m.dt_const || "—"}</span></div>
      </div>
    </motion.div>
  );
};

/* ─── Comparador Section ─── */
const ComparadorSection = ({ period }: { period: string }) => {
  const [searchQ, setSearchQ] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const { data: catalog } = useFundCatalog({ limit: 200, search: searchQ || undefined });

  const fund0 = useFundDetail(selected[0] || null, period);
  const fund1 = useFundDetail(selected[1] || null, period);
  const fund2 = useFundDetail(selected[2] || null, period);
  const fund3 = useFundDetail(selected[3] || null, period);
  const fundDetails = [fund0, fund1, fund2, fund3].filter((_, i) => i < selected.length);

  const fundSeries = useMemo(() =>
    fundDetails
      .filter((f) => f.data?.daily?.length)
      .map((f) => ({
        cnpj: f.data!.meta?.cnpj_fundo || "",
        name: f.data!.meta?.denom_social || shortCnpj(f.data!.meta?.cnpj_fundo || ""),
        daily: f.data!.daily,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fund0.data, fund1.data, fund2.data, fund3.data]
  );

  const toggleFund = (cnpj: string) => {
    setSelected((prev) =>
      prev.includes(cnpj) ? prev.filter((c) => c !== cnpj) : prev.length < 4 ? [...prev, cnpj] : prev
    );
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[11px] text-zinc-400 uppercase tracking-wider font-mono">
            Selecione até 4 fundos
          </h3>
          {selected.length > 0 && (
            <button onClick={() => setSelected([])} className="text-[9px] text-zinc-600 hover:text-zinc-400 font-mono">
              Limpar
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
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {selected.map((cnpj) => {
              const fund = catalog?.funds.find((f) => f.cnpj_fundo === cnpj);
              return (
                <span key={cnpj} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#0B6C3E]/10 border border-[#0B6C3E]/20 rounded text-[9px] text-[#0B6C3E] font-mono">
                  {fund?.denom_social ? fund.denom_social.slice(0, 25) : shortCnpj(cnpj)}
                  <button onClick={() => toggleFund(cnpj)} className="hover:text-white">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
        <div className="max-h-40 overflow-y-auto space-y-0.5">
          {catalog?.funds
            .filter((f) => !selected.includes(f.cnpj_fundo))
            .slice(0, 20)
            .map((f) => (
              <button
                key={f.cnpj_fundo}
                onClick={() => toggleFund(f.cnpj_fundo)}
                disabled={selected.length >= 4}
                className="w-full text-left flex items-center justify-between px-2 py-1 rounded hover:bg-[#0B6C3E]/5 transition-colors disabled:opacity-30"
              >
                <div className="min-w-0">
                  <div className="text-[10px] text-zinc-300 font-mono truncate">
                    {f.denom_social || shortCnpj(f.cnpj_fundo)}
                  </div>
                  <div className="text-[8px] text-zinc-700 font-mono">{shortCnpj(f.cnpj_fundo)}</div>
                </div>
                <span className="text-[9px] text-zinc-600 font-mono flex-shrink-0 ml-2">
                  {formatPL(f.vl_patrim_liq)}
                </span>
              </button>
            ))}
        </div>
      </div>

      {fundSeries.length >= 2 && (
        <QuotaCompareChart funds={fundSeries} title="Rentabilidade Indexada (base 100)" height={320} />
      )}

      {(() => {
        const metricsData = fundDetails
          .filter((f) => f.data?.daily?.length && f.data.daily.length > 5)
          .map((f) => ({
            name: f.data!.meta?.denom_social || shortCnpj(f.data!.meta?.cnpj_fundo || ""),
            metrics: computeFundMetrics(f.data!.daily),
          }));
        return metricsData.length >= 2 ? (
          <MetricsCompareTable funds={metricsData} />
        ) : null;
      })()}

      {fundDetails.filter((f) => f.data?.meta).length >= 2 && (
        <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg overflow-x-auto">
          <table className="w-full text-[10px] font-mono">
            <thead>
              <tr className="border-b border-[#1a1a1a] text-zinc-600">
                <th className="text-left px-3 py-2">Info</th>
                {fundDetails.map((f, i) => (
                  <th key={i} className="text-right px-3 py-2 max-w-[150px] truncate">
                    {f.data?.meta?.denom_social?.slice(0, 20) || "—"}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              <tr className="border-b border-[#141414]">
                <td className="px-3 py-1.5 text-zinc-500">PL</td>
                {fundDetails.map((f, i) => (
                  <td key={i} className="px-3 py-1.5 text-right">{formatPL(f.data?.metrics.latest_pl)}</td>
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
              <tr>
                <td className="px-3 py-1.5 text-zinc-500">Gestor</td>
                {fundDetails.map((f, i) => (
                  <td key={i} className="px-3 py-1.5 text-right truncate max-w-[120px]">
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
              onClick={() => { onSelectFund(f.cnpj_fundo); setOpen(false); setQuery(""); }}
              className="w-full text-left px-3 py-2 hover:bg-[#0B6C3E]/5 border-b border-[#141414] last:border-0 transition-colors"
            >
              <div className="text-[10px] text-zinc-300 font-mono truncate">{f.denom_social}</div>
              <div className="flex items-center gap-2 mt-0.5 text-[8px] text-zinc-600 font-mono">
                <span>{shortCnpj(f.cnpj_fundo)}</span>
                {f.classe && <span className="px-1 py-0.5 bg-[#1a1a1a] rounded">{f.classe}</span>}
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
              CVM &middot; {stats?.total_funds || "—"} fundos &middot; FIDC + FII + FIP &middot; Dados diários
            </p>
          </div>
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

              {/* Rankings */}
              <FundRankingTable
                funds={rankings?.funds || []}
                loading={rankingsLoading}
                onSelectFund={setSelectedFund}
                title={`Top Fundos por PL${rankings?.classe ? ` — ${rankings.classe}` : ""}`}
              />

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
                      Catálogo <span className="text-zinc-700">({catalog.total} fundos)</span>
                    </h3>
                  </div>
                  <p className="text-[9px] text-zinc-600 font-mono">
                    Fonte: CVM (cad_fi + inf_diario) &middot; Última atualização: {stats?.last_updated ? new Date(stats.last_updated).toLocaleDateString("pt-BR") : "—"}
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
                          <FundMetricsSummary daily={fundData.daily} title={`Métricas — ${fundData.meta?.denom_social || shortCnpj(selectedFund)}`} />
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
                  {/* Benchmarks */}
                  <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
                    <h3 className="text-[11px] text-zinc-400 uppercase tracking-wider font-mono mb-3">
                      Benchmarks vs Metas
                    </h3>
                    <div className="space-y-3">
                      {[
                        { label: "Fundos catalogados", current: stats?.total_funds || 0, target: 500, unit: "" },
                        { label: "Classes com dados", current: Object.keys(stats?.by_classe || {}).length, target: 15, unit: "" },
                        { label: "Dados diários (dias)", current: 22, target: 60, unit: "" },
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
                          title: "CVM Resolução 175",
                          desc: "CNPJ_FUNDO_CLASSE diverge de CNPJ_FUNDO para ~83% dos fundos. Pipeline adaptado para match por ambos campos.",
                          color: "#F59E0B",
                        },
                        {
                          title: "Concentração de PL",
                          desc: `Top 10 fundos concentram a maior parte do PL total. ${stats?.total_funds || 0} fundos catalogados de ~40.000 ativos na CVM.`,
                          color: "#6366F1",
                        },
                        {
                          title: "Dados Diários",
                          desc: "Cobertura: março/2026 (22 dias úteis). Próximo passo: ingestão retroativa + pg_cron automático.",
                          color: "#0B6C3E",
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
