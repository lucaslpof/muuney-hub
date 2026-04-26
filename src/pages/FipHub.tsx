import { useState, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useDebouncedValue } from "@/hooks/useDebounce";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Building2, Search } from "lucide-react";
import { Breadcrumbs } from "@/components/hub/Breadcrumbs";
import { DataAsOfStamp } from "@/components/hub/DataAsOfStamp";
import { HubSEO } from "@/lib/seo";
import { motion } from "framer-motion";
import { useFipV2Overview, useFipV2Rankings, useFipSearchV2 } from "@/hooks/useHubFundos";
import { SectionErrorBoundary } from "@/components/hub/SectionErrorBoundary";
import { SkeletonKPI, SkeletonTableRow } from "@/components/hub/SkeletonLoader";
import { EmptyState } from "@/components/hub/EmptyState";
import { SimpleKPICard as KPICard } from "@/components/hub/KPICard";
import { NarrativeSection } from "@/components/hub/NarrativeSection";

const FIP_ACCENT = "#06B6D4";

function fmtMoney(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e9) return `R$ ${(v / 1e9).toFixed(2)} bi`;
  if (abs >= 1e6) return `R$ ${(v / 1e6).toFixed(0)} mi`;
  if (abs >= 1e3) return `R$ ${(v / 1e3).toFixed(0)} k`;
  return `R$ ${v.toFixed(0)}`;
}

const COLORS = ["#06B6D4", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899", "#F59E0B", "#A3A3A3", "#525252"];

const ORDER_BY_OPTIONS = [
  { value: "patrimonio_liquido", label: "PL" },
  { value: "vl_cap_comprom", label: "Comprometido" },
  { value: "vl_cap_integr", label: "Integralizado" },
  { value: "nr_cotistas", label: "Cotistas" },
];

export default function FipHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [sortBy, setSortBy] = useState(searchParams.get("sort") ?? "patrimonio_liquido");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(
    (searchParams.get("dir") as "asc" | "desc") ?? "desc"
  );
  const [tipoFilter, setTipoFilter] = useState(searchParams.get("tipo") ?? "");

  const debouncedSearch = useDebouncedValue(search, 300);

  const { data: overview, isLoading: ovLoading } = useFipV2Overview();
  const { data: rankings, isLoading: rkLoading } = useFipV2Rankings({
    orderBy: sortBy,
    order: sortOrder,
    limit: 50,
    tipo: tipoFilter || undefined,
    search: debouncedSearch || undefined,
  });
  const { data: searchResults } = useFipSearchV2(debouncedSearch, {
    enabled: debouncedSearch.length >= 2,
  });

  const tipoChartData = useMemo(() => {
    if (!overview?.by_tipo) return [];
    return overview.by_tipo.slice(0, 8).map((t, i) => ({
      name: t.tipo.length > 25 ? t.tipo.slice(0, 22) + "..." : t.tipo,
      value: t.pl,
      pct: t.pct_pl,
      count: t.count,
      color: COLORS[i % COLORS.length],
    }));
  }, [overview?.by_tipo]);

  return (
    <div className="space-y-4">
      <HubSEO
        title="FIPs — Hub Muuney"
        description="Universo de Fundos de Investimento em Participações (Private Equity & Venture Capital BR) com TVPI, vintage, J-curve e breakdown de cotistas."
      />

      <Breadcrumbs items={[{ label: "Fundos", to: "/fundos" }, { label: "FIPs" }]} />

      <div className="flex items-baseline gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-[#06B6D4]" />
          <h1 className="text-xl font-mono text-zinc-200">FIPs — Private Equity Brasil</h1>
        </div>
        {overview?.date && (
          <DataAsOfStamp
            date={overview.date}
            cadence="quarterly"
            source="CVM Inf Quadrimestral"
            compact
            footnote="DPI puro (Distribuído/Integralizado) não disponível — CVM não publica capital distribuído. TVPI mistura realizado + unrealizado."
          />
        )}
      </div>

      <div className="flex flex-col gap-6">
        {/* Visão Geral */}
        <SectionErrorBoundary sectionName="Visão Geral FIP">
          <section id="overview" className="scroll-mt-24">
            <h2 className="text-[10px] font-mono uppercase tracking-wide text-zinc-500 mb-2">Visão Geral</h2>
            <NarrativeSection
              accent={FIP_ACCENT}
              prose={
                ovLoading || !overview
                  ? "Carregando agregados FIP..."
                  : `${overview.total_fips} FIPs ativos, PL agregado de ${fmtMoney(overview.total_pl)}, capital comprometido ${fmtMoney(overview.total_cap_comprom)} (${overview.pct_integralizado != null ? overview.pct_integralizado.toFixed(1) : "—"}% chamado). Capital ainda a chamar (dry powder agregado): ${fmtMoney(overview.capital_a_chamar)}. Veículo dominante: ${overview.by_tipo?.[0]?.tipo ?? "—"}.`
              }
              miniStats={
                ovLoading || !overview
                  ? []
                  : [
                      { label: "FIPs", value: String(overview.total_fips) },
                      { label: "PL agregado", value: fmtMoney(overview.total_pl) },
                      { label: "Comprometido", value: fmtMoney(overview.total_cap_comprom) },
                      { label: "Integralizado", value: fmtMoney(overview.total_cap_integr) },
                      { label: "% chamado", value: overview.pct_integralizado != null ? `${overview.pct_integralizado.toFixed(1)}%` : "—" },
                    ]
              }
            >
              {ovLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <SkeletonKPI /><SkeletonKPI /><SkeletonKPI /><SkeletonKPI />
                </div>
              ) : overview ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="grid grid-cols-2 gap-2">
                    <KPICard label="FIPs" value={String(overview.total_fips)} sublabel="universo" />
                    <KPICard label="PL total" value={fmtMoney(overview.total_pl)} sublabel="patrimônio agregado" />
                    <KPICard
                      label="Call-down médio"
                      value={overview.pct_integralizado != null ? `${overview.pct_integralizado.toFixed(1)}%` : "—"}
                      sublabel="do comprometido"
                    />
                    <KPICard
                      label="Dry powder"
                      value={fmtMoney(overview.capital_a_chamar)}
                      sublabel="capital a chamar"
                    />
                  </div>
                  {tipoChartData.length > 0 && (
                    <div className="rounded-md border border-zinc-800/60 bg-zinc-900/40 p-3">
                      <h4 className="text-[10px] font-mono uppercase text-zinc-500 mb-2">PL por tipo de classe</h4>
                      <ResponsiveContainer width="100%" height={170}>
                        <PieChart>
                          <Pie
                            data={tipoChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={70}
                            dataKey="value"
                            paddingAngle={1}
                            label={(e: { pct?: number }) => (e.pct && e.pct > 5 ? `${e.pct.toFixed(0)}%` : "")}
                            labelLine={false}
                          >
                            {tipoChartData.map((d, i) => (
                              <Cell key={i} fill={d.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ background: "#09090b", border: "1px solid #27272a", fontSize: 11 }}
                            formatter={(v: number, _n, p: { payload?: { count?: number; pct?: number } }) =>
                              `${fmtMoney(v)} (${p?.payload?.pct?.toFixed(1) ?? "?"}% · ${p?.payload?.count ?? 0} fundos)`
                            }
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              ) : (
                <EmptyState variant="no-data" title="Sem dados" description="Overview FIP indisponível." />
              )}
            </NarrativeSection>
          </section>
        </SectionErrorBoundary>

        {/* Rankings */}
        <SectionErrorBoundary sectionName="Rankings FIP">
          <section id="rankings" className="scroll-mt-24">
            <h2 className="text-[10px] font-mono uppercase tracking-wide text-zinc-500 mb-2">Rankings</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    setSearchParams((prev) => { prev.set("sort", e.target.value); return prev; }, { replace: true });
                  }}
                  className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-[10px] font-mono px-2 py-1 rounded"
                >
                  {ORDER_BY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    const next = sortOrder === "desc" ? "asc" : "desc";
                    setSortOrder(next);
                    setSearchParams((prev) => { prev.set("dir", next); return prev; }, { replace: true });
                  }}
                  className="px-2 py-1 text-[10px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-300 rounded hover:bg-zinc-800"
                >
                  {sortOrder === "desc" ? "↓ desc" : "↑ asc"}
                </button>
                <input
                  type="text"
                  placeholder="Filtrar por tipo (ex: FIP-IE)"
                  value={tipoFilter}
                  onChange={(e) => {
                    setTipoFilter(e.target.value);
                    if (e.target.value) {
                      setSearchParams((prev) => { prev.set("tipo", e.target.value); return prev; }, { replace: true });
                    } else {
                      setSearchParams((prev) => { prev.delete("tipo"); return prev; }, { replace: true });
                    }
                  }}
                  className="flex-1 min-w-[200px] bg-zinc-900 border border-zinc-800 text-zinc-300 text-[10px] font-mono px-2 py-1 rounded placeholder-zinc-600"
                />
              </div>

              {rkLoading ? (
                <div className="space-y-1">
                  {[0, 1, 2, 3, 4].map((i) => <SkeletonTableRow key={i} />)}
                </div>
              ) : rankings?.funds && rankings.funds.length > 0 ? (
                <div className="overflow-auto rounded-md border border-zinc-800/60 bg-zinc-900/40 max-h-[600px]">
                  <table className="w-full text-[10px] font-mono">
                    <thead className="sticky top-0 bg-zinc-900/95">
                      <tr className="text-zinc-500 uppercase">
                        <th className="text-left p-2">#</th>
                        <th className="text-left p-2">Fundo</th>
                        <th className="text-left p-2">Tipo</th>
                        <th className="text-right p-2">PL</th>
                        <th className="text-right p-2">Comprometido</th>
                        <th className="text-right p-2">Integr.</th>
                        <th className="text-right p-2">% chamado</th>
                        <th className="text-right p-2">Cotistas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankings.funds.map((f, i) => {
                        const fAny = f as typeof f & { slug?: string | null; denom_social?: string | null };
                        const callPct =
                          f.vl_cap_comprom && f.vl_cap_comprom > 0 && f.vl_cap_integr != null
                            ? (f.vl_cap_integr / f.vl_cap_comprom) * 100
                            : null;
                        const slug = fAny.slug;
                        const cnpj = f.cnpj_fundo;
                        const target = slug ? `/fundos/fip/${slug}` : `/fundos/fip/${encodeURIComponent(cnpj)}`;
                        return (
                          <tr key={`${cnpj}-${i}`} className="border-t border-zinc-800/40 hover:bg-zinc-800/30">
                            <td className="p-2 text-zinc-500">{i + 1}</td>
                            <td className="p-2 text-zinc-200">
                              <Link to={target} className="hover:text-[#06B6D4] truncate block max-w-[280px]">
                                {fAny.denom_social ?? f.nome_fundo ?? cnpj}
                              </Link>
                            </td>
                            <td className="p-2 text-zinc-400">{f.tp_fundo_classe ?? "—"}</td>
                            <td className="p-2 text-right text-zinc-300">{fmtMoney(f.patrimonio_liquido)}</td>
                            <td className="p-2 text-right text-zinc-400">{fmtMoney(f.vl_cap_comprom)}</td>
                            <td className="p-2 text-right text-zinc-400">{fmtMoney(f.vl_cap_integr)}</td>
                            <td className="p-2 text-right text-zinc-300">
                              {callPct != null ? `${Math.min(callPct, 999).toFixed(1)}%` : "—"}
                            </td>
                            <td className="p-2 text-right text-zinc-400">{f.nr_cotistas ?? "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState variant="no-results" title="Nenhum fundo" description="Ajuste filtros." />
              )}
            </div>
          </section>
        </SectionErrorBoundary>

        {/* Screener / Search */}
        <SectionErrorBoundary sectionName="Screener FIP">
          <section id="screener" className="scroll-mt-24">
            <h2 className="text-[10px] font-mono uppercase tracking-wide text-zinc-500 mb-2">Buscar FIP</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-2 bg-zinc-900/40 border border-zinc-800/60 rounded-md p-2">
                <Search className="w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Busca por nome do FIP (mín. 2 caracteres)..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSearchParams((prev) => {
                      if (e.target.value) prev.set("search", e.target.value);
                      else prev.delete("search");
                      return prev;
                    }, { replace: true });
                  }}
                  className="flex-1 bg-transparent text-zinc-200 text-xs font-mono placeholder-zinc-600 focus:outline-none"
                />
              </div>
              {searchResults?.results && searchResults.results.length > 0 ? (
                <div className="rounded-md border border-zinc-800/60 bg-zinc-900/40 divide-y divide-zinc-800/40">
                  {searchResults.results.map((r) => {
                    const target = r.slug
                      ? `/fundos/fip/${r.slug}`
                      : `/fundos/fip/${encodeURIComponent(r.cnpj_fundo_classe)}`;
                    return (
                      <Link
                        key={r.cnpj_fundo_classe}
                        to={target}
                        className="flex items-baseline justify-between px-3 py-2 hover:bg-zinc-800/40"
                      >
                        <div>
                          <div className="text-xs text-zinc-200 font-mono">{r.denom_social}</div>
                          <div className="text-[9px] text-zinc-500 font-mono">
                            {r.gestor_nome ?? "Gestor não informado"}
                          </div>
                        </div>
                        <div className="text-[10px] text-zinc-400 font-mono">{fmtMoney(r.vl_patrim_liq)}</div>
                      </Link>
                    );
                  })}
                </div>
              ) : debouncedSearch.length >= 2 ? (
                <EmptyState variant="no-results" title="Nenhum FIP encontrado" description={`Sem resultados para "${debouncedSearch}".`} />
              ) : (
                <div className="text-[10px] font-mono text-zinc-600 italic px-2">
                  Digite ao menos 2 caracteres para buscar...
                </div>
              )}
            </div>
          </section>
        </SectionErrorBoundary>

        {/* Tipos */}
        <SectionErrorBoundary sectionName="Tipos FIP">
          <section id="tipos" className="scroll-mt-24">
            <h2 className="text-[10px] font-mono uppercase tracking-wide text-zinc-500 mb-2">Tipos de FIP</h2>
            {ovLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => <SkeletonKPI key={i} />)}
              </div>
            ) : overview?.by_tipo && overview.by_tipo.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {overview.by_tipo.map((t) => (
                  <motion.button
                    key={t.tipo}
                    type="button"
                    whileHover={{ scale: 1.01 }}
                    onClick={() => {
                      setTipoFilter(t.tipo);
                      setSearchParams((prev) => { prev.set("tipo", t.tipo); return prev; }, { replace: true });
                      document.getElementById("rankings")?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="text-left rounded-md border border-zinc-800/60 bg-zinc-900/40 p-3 hover:border-[#06B6D4]/40"
                  >
                    <div className="text-xs text-zinc-200 font-mono mb-1 truncate">{t.tipo}</div>
                    <div className="flex items-baseline justify-between text-[10px] text-zinc-500 font-mono">
                      <span>{t.count} fundos</span>
                      <span className="text-zinc-300">{fmtMoney(t.pl)}</span>
                    </div>
                    <div className="text-[9px] text-zinc-600 font-mono mt-1">{t.pct_pl.toFixed(1)}% do AUM</div>
                  </motion.button>
                ))}
              </div>
            ) : (
              <EmptyState variant="no-data" title="Sem dados" description="Tipos FIP indisponíveis." />
            )}
          </section>
        </SectionErrorBoundary>
      </div>
    </div>
  );
}
