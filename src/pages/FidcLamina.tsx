import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ArrowLeft, TrendingUp, BarChart3, LineChart as LineChartIcon, Info } from "lucide-react";
import { Breadcrumbs } from "@/components/hub/Breadcrumbs";
import { motion } from "framer-motion";

import {
  useFidcDetail, useFidcV4Monthly,
  formatPL, formatCnpj,
} from "@/hooks/useHubFundos";
import { ClasseBadge } from "@/lib/rcvm175";
import { SectionErrorBoundary } from "@/components/hub/SectionErrorBoundary";

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

/**
 * Compute monthly series for chart (Senior, Subordinada, Fundo).
 * HOTFIX (11/04/2026):
 *  - Correct field names: rentab_senior / rentab_subordinada (not rentab_fundo_senior/subord)
 *  - Clip CVM outliers: any |rentab| > 95% in a single month is treated as corrupt
 *    (raw CVM publishes e.g. -280 bi% for funds in liquidation with negative cotas).
 */
const CORRUPT_RENTAB_THRESHOLD = 95; // % in a single month; above this we consider CVM data corrupt

function cleanRentab(v: any): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(v);
  if (!isFinite(n)) return null;
  if (Math.abs(n) > CORRUPT_RENTAB_THRESHOLD) return null;
  return n;
}

/** Compute base-100 indexed series from FIDC monthly rentabilidade */
function computeIndexedSeries(monthly: any[]) {
  if (!monthly || monthly.length === 0) return [];

  let cumulativeReturn = 1.0;
  const result: any[] = [];

  for (const m of monthly) {
    const rentab = cleanRentab(m.rentab_fundo);
    if (rentab != null) {
      cumulativeReturn *= (1 + rentab / 100);
      result.push({
        date: m.dt_comptc,
        index: cumulativeReturn * 100,
      });
    }
  }

  return result;
}

/** Compute accumulated CDI index from monthly FIDC data (monthly CDI ~1.1%) */
function computeCDIIndexMonthly(monthly: any[]) {
  if (!monthly || monthly.length === 0) return [];

  // Approximate monthly CDI from annual 14.15% Selic: ~1.1% monthly
  // More accurate would be daily CDI, but using monthly proxy
  const MONTHLY_CDI_RATE = 0.011; // ~1.1% per month
  let cumulativeReturn = 1.0;
  const result: any[] = [];

  for (const m of monthly) {
    cumulativeReturn *= (1 + MONTHLY_CDI_RATE);
    result.push({
      date: m.dt_comptc,
      cdi: cumulativeReturn * 100,
    });
  }

  return result;
}

function computeRentabilidadeSeries(monthly: any[]) {
  if (!monthly || monthly.length === 0) return [];
  return monthly
    .map((m) => ({
      date: m.dt_comptc,
      rentab_senior: cleanRentab(m.rentab_senior),
      rentab_subord: cleanRentab(m.rentab_subordinada),
      rentab_fundo: cleanRentab(m.rentab_fundo),
    }))
    .filter((d) => d.rentab_senior != null || d.rentab_subord != null || d.rentab_fundo != null);
}

/** Compute capital structure series (PL Senior, Subord, Mezanino) */
function computeCapitalSeries(monthly: any[]) {
  if (!monthly || monthly.length === 0) return [];
  return monthly.map((m) => ({
    date: m.dt_comptc,
    senior: m.vl_pl_senior != null ? m.vl_pl_senior / 1e6 : 0,
    subord: m.vl_pl_subordinada != null ? m.vl_pl_subordinada / 1e6 : 0,
    mezanino: m.vl_pl_mezanino != null ? m.vl_pl_mezanino / 1e6 : 0,
  }));
}

/** Compute subordinacao index over time */
function computeSubordinacaoSeries(monthly: any[]) {
  if (!monthly || monthly.length === 0) return [];
  return monthly.map((m) => ({
    date: m.dt_comptc,
    subordinacao_pct: m.indice_subordinacao != null ? m.indice_subordinacao : null,
  })).filter((d) => d.subordinacao_pct != null);
}

/** Main FIDC Lamina Page */
export default function FidcLamina() {
  const { slug } = useParams<{ slug: string }>();

  const { data: fidcData, isLoading: fidcLoading } = useFidcDetail(slug ?? null);
  const cnpj = fidcData?.meta?.cnpj_fundo || fidcData?.meta?.cnpj_fundo_classe || null;
  const { data: monthlyData } = useFidcV4Monthly(cnpj, 24);

  const meta = fidcData?.meta;
  const monthly = monthlyData?.data || fidcData?.monthly || [];
  const latest = fidcData?.latest;

  const rentabilidadeSeries = useMemo(() => computeRentabilidadeSeries(monthly), [monthly]);
  const capitalSeries = useMemo(() => computeCapitalSeries(monthly), [monthly]);
  const subordinacaoSeries = useMemo(() => computeSubordinacaoSeries(monthly), [monthly]);

  // Indexed chart series (fund + CDI benchmark)
  const indexedSeries = useMemo(() => {
    const fundIndex = computeIndexedSeries(monthly);
    const cdiIndex = computeCDIIndexMonthly(monthly);

    // Merge CDI data into fund data by date
    const merged = fundIndex.map((f) => {
      const cdiPoint = cdiIndex.find((c) => c.date === f.date);
      return {
        date: f.date,
        index: f.index,
        cdi: cdiPoint?.cdi ?? null,
      };
    });

    return merged;
  }, [monthly]);

  // Compute vs CDI metric
  const vsCDIMetric = useMemo(() => {
    if (indexedSeries.length < 2) return null;
    const lastEntry = indexedSeries[indexedSeries.length - 1];

    if (!lastEntry.index || !lastEntry.cdi) return null;

    const fundReturn = lastEntry.index - 100;
    const cdiReturn = lastEntry.cdi - 100;
    const excess = fundReturn - cdiReturn;

    return { fundReturn, cdiReturn, excess };
  }, [indexedSeries]);

  const totalSubord = latest?.indice_subordinacao != null ? latest.indice_subordinacao : null;
  const totalInadim = latest?.taxa_inadimplencia != null ? latest.taxa_inadimplencia : null;
  const carteiraPrejuizo = latest?.vl_carteira_prejuizo || 0;

  if (fidcLoading) {
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
          <p className="text-zinc-400 mb-4">FIDC não encontrado</p>
          <Link to="/fundos/fidc" className="text-[#0B6C3E] hover:underline text-sm flex items-center gap-1 justify-center">
            <ArrowLeft className="w-4 h-4" /> Voltar para Módulo FIDC
          </Link>
        </div>
      </div>
    );
  }

  const fundName = meta.denom_social || `FIDC ${meta.cnpj_fundo_classe || meta.cnpj_fundo}`;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header Navigation */}
      <div className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur border-b border-[#1a1a1a]">
        <div className="w-full px-4 md:px-6 py-3">
          <Breadcrumbs
            items={[
              { label: "Fundos", to: "/fundos" },
              { label: "FIDC", to: "/fundos/fidc" },
              { label: fundName },
            ]}
            className="mb-2"
          />
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold text-zinc-100 truncate">{fundName}</h1>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <ClasseBadge classe="FIDC" size="md" />
                <span className="text-[8px] text-zinc-700">{formatCnpj(meta.cnpj_fundo_classe || meta.cnpj_fundo)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-6 py-8 space-y-8">
        {/* === Section 1: Resumo === */}
        <SectionErrorBoundary sectionName="Resumo">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-[#0B6C3E]" />
              <h2 className="text-sm font-semibold text-zinc-300">Resumo</h2>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KPICard
                label="PL Total"
                value={formatPL(latest?.vl_pl_total || meta.vl_patrim_liq)}
                color="text-zinc-300"
              />
              <KPICard
                label="Subordinação"
                value={totalSubord != null ? totalSubord.toFixed(2) : "—"}
                unit="%"
                color={totalSubord != null && totalSubord < 10 ? "text-red-400" : "text-emerald-400"}
              />
              <KPICard
                label="Inadimplência"
                value={totalInadim != null ? totalInadim.toFixed(2) : "—"}
                unit="%"
                color={totalInadim != null && totalInadim > 5 ? "text-red-400" : "text-emerald-400"}
              />
              <KPICard
                label="Gestor"
                value={meta.gestor_nome?.split(" ")[0] || "—"}
                color="text-zinc-400"
              />
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[9px] font-mono">
              <div className="bg-[#111111] border border-[#1a1a1a] rounded p-3">
                <div className="text-zinc-600 uppercase tracking-wider mb-1">Carteira Total</div>
                <div className="text-zinc-300">{formatPL(latest?.vl_carteira_direitos)}</div>
              </div>
              <div className="bg-[#111111] border border-[#1a1a1a] rounded p-3">
                <div className="text-zinc-600 uppercase tracking-wider mb-1">Carteira a Vencer</div>
                <div className="text-zinc-300">{formatPL(latest?.vl_carteira_a_vencer)}</div>
              </div>
              <div className="bg-[#111111] border border-[#1a1a1a] rounded p-3">
                <div className="text-zinc-600 uppercase tracking-wider mb-1">Inadimplência</div>
                <div className="text-zinc-300">{formatPL(latest?.vl_carteira_inadimplente)}</div>
              </div>
            </div>
          </motion.div>
        </SectionErrorBoundary>

        {/* === Section 2: Estrutura de Capital === */}
        {capitalSeries.length > 1 && (
          <SectionErrorBoundary sectionName="Estrutura de Capital">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-[#0B6C3E]" />
                <h2 className="text-sm font-semibold text-zinc-300">Estrutura de Capital</h2>
              </div>

              {/* Capital Stacked Bar */}
              <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
                <h3 className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-3">PL por Classe (em R$ Mi)</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={capitalSeries} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
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
                      formatter={(v: any) => `R$ ${v?.toFixed(0)} Mi`}
                    />
                    <Bar dataKey="senior" stackId="a" fill="#0B6C3E" name="Senior" />
                    <Bar dataKey="subord" stackId="a" fill="#F59E0B" name="Subordinada" />
                    <Bar dataKey="mezanino" stackId="a" fill="#8B5CF6" name="Mezanino" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Subordinacao Index */}
              {subordinacaoSeries.length > 1 && (
                <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
                  <h3 className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-3">Índice de Subordinação (%)</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={subordinacaoSeries} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
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
                        formatter={(v: any) => `${v?.toFixed(2)}%`}
                      />
                      <Line
                        type="monotone"
                        dataKey="subordinacao_pct"
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
        )}

        {/* === Section 3: Carteira === */}
        <SectionErrorBoundary sectionName="Carteira">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-[#0B6C3E]" />
              <h2 className="text-sm font-semibold text-zinc-300">Carteira</h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KPICard
                label="Carteira Total"
                value={formatPL(latest?.vl_carteira_direitos)}
                color="text-zinc-300"
              />
              <KPICard
                label="A Vencer"
                value={formatPL(latest?.vl_carteira_a_vencer)}
                color="text-[#0B6C3E]"
              />
              <KPICard
                label="Inadimplente"
                value={formatPL(latest?.vl_carteira_inadimplente)}
                color={latest?.vl_carteira_inadimplente && latest.vl_carteira_inadimplente > 0 ? "text-red-400" : "text-zinc-300"}
              />
              <KPICard
                label="PDD Constituída"
                value={formatPL(latest?.vl_pdd)}
                color="text-orange-400"
              />
            </div>

            {/* Carteira Composition Info */}
            <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
              <h3 className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-3">Análise de Carteira</h3>
              <div className="space-y-2 text-[9px] font-mono">
                <div className="flex justify-between">
                  <span className="text-zinc-600">Taxa de Inadimplência</span>
                  <span className={totalInadim && totalInadim > 5 ? "text-red-400" : "text-emerald-400"}>{totalInadim?.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">Cobertura PDD</span>
                  <span className="text-zinc-300">
                    {latest?.vl_carteira_inadimplente && latest?.vl_pdd
                      ? ((latest.vl_pdd / latest.vl_carteira_inadimplente) * 100).toFixed(1)
                      : "—"}%
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-[#1a1a1a]">
                  <span className="text-zinc-600">Carteira Prejuízo</span>
                  <span className={carteiraPrejuizo > 0 ? "text-red-400" : "text-emerald-400"}>{formatPL(carteiraPrejuizo)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">Cotistas</span>
                  <span className="text-zinc-300">{((latest?.nr_cotistas_senior || 0) + (latest?.nr_cotistas_subordinada || 0)).toLocaleString("pt-BR") || "—"}</span>
                </div>
              </div>
            </div>
          </motion.div>
        </SectionErrorBoundary>

        {/* === Section 4: Performance === */}
        {rentabilidadeSeries.length > 1 && (
          <SectionErrorBoundary sectionName="Performance">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-[#0B6C3E]" />
                <h2 className="text-sm font-semibold text-zinc-300">Rentabilidade</h2>
              </div>

              {/* Indexed Chart (Base 100 + CDI) */}
              {indexedSeries.length > 1 && (
                <div className="space-y-3">
                  {vsCDIMetric && (
                    <div className="grid grid-cols-3 gap-3">
                      <KPICard
                        label="Retorno Acumulado"
                        value={vsCDIMetric.fundReturn.toFixed(2)}
                        unit="%"
                        color="text-[#0B6C3E]"
                      />
                      <KPICard
                        label="CDI Acumulado"
                        value={vsCDIMetric.cdiReturn.toFixed(2)}
                        unit="%"
                        color="text-zinc-400"
                      />
                      <KPICard
                        label="vs CDI"
                        value={vsCDIMetric.excess.toFixed(2)}
                        unit="%"
                        color={vsCDIMetric.excess >= 0 ? "text-emerald-400" : "text-red-400"}
                      />
                    </div>
                  )}
                  <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
                    <h3 className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-3">Rentabilidade Indexada (Base 100)</h3>
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={indexedSeries} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
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
                </div>
              )}

              {/* Monthly Rentabilities (Senior, Subordinada, Fundo) */}
              <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
                <h3 className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-3">Rentabilidade Mensal (Senior, Subordinada, Fundo)</h3>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={rentabilidadeSeries} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
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
                      dataKey="rentab_senior"
                      stroke="#0B6C3E"
                      name="Senior"
                      dot={false}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="rentab_subord"
                      stroke="#F59E0B"
                      name="Subordinada"
                      dot={false}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="rentab_fundo"
                      stroke="#8B5CF6"
                      name="Fundo"
                      dot={false}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </SectionErrorBoundary>
        )}

        {/* === Section 5: Informações === */}
        <SectionErrorBoundary sectionName="Informações">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Info className="w-4 h-4 text-[#0B6C3E]" />
              <h2 className="text-sm font-semibold text-zinc-300">Informações do FIDC</h2>
            </div>

            {meta && (
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
            )}
          </motion.div>
        </SectionErrorBoundary>

        {/* === Section 6: Fundos Similares === */}
        {fidcData?.similar && fidcData.similar.length > 0 && (
          <SectionErrorBoundary sectionName="Fundos Similares">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <LineChartIcon className="w-4 h-4 text-[#0B6C3E]" />
                <h2 className="text-sm font-semibold text-zinc-300">FIDCs Similares</h2>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {fidcData.similar.slice(0, 6).map((fund, idx) => (
                  <Link
                    key={idx}
                    to={`/fundos/fidc/${fund.slug || fund.cnpj_fundo}`}
                    className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4 hover:border-[#0B6C3E]/30 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-zinc-300 group-hover:text-[#0B6C3E] truncate transition-colors">
                          {fund.denom_social || `FIDC ${fund.cnpj_fundo}`}
                        </div>
                        <div className="text-[8px] text-zinc-700 mt-1">Gestor: {fund.gestor_nome?.split(" ")[0] || "—"}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] font-mono text-zinc-400">{formatPL(fund.vl_pl_total)}</div>
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
