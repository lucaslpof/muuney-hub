import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ArrowLeft, TrendingUp, BarChart3, LineChart as LineChartIcon, Info, Building2 } from "lucide-react";
import { Breadcrumbs } from "@/components/hub/Breadcrumbs";
import { motion } from "framer-motion";

import {
  useFiiDetail, useFiiV4Monthly,
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

/** Compute monthly performance series (rentabilidade + DY) */
function computePerformanceSeries(monthly: any[]) {
  if (!monthly || monthly.length === 0) return [];
  return monthly.map((m) => ({
    date: m.dt_comptc,
    dy: m.dividend_yield_mes != null ? Number(m.dividend_yield_mes) : null,
    rentab_efetiva: m.rentabilidade_efetiva_mes != null ? Number(m.rentabilidade_efetiva_mes) : null,
    rentab_patrim: m.rentabilidade_patrimonial_mes != null ? Number(m.rentabilidade_patrimonial_mes) : null,
  })).filter((d) => d.dy != null || d.rentab_efetiva != null || d.rentab_patrim != null);
}

/** Compute PL over time (in Millions) */
function computePlSeries(monthly: any[]) {
  if (!monthly || monthly.length === 0) return [];
  return monthly.map((m) => ({
    date: m.dt_comptc,
    pl: m.patrimonio_liquido != null ? m.patrimonio_liquido / 1e6 : null,
    vpc: m.valor_patrimonial_cota != null ? Number(m.valor_patrimonial_cota) : null,
  })).filter((d) => d.pl != null);
}

/** Compute cotistas series */
function computeCotistasSeries(monthly: any[]) {
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

  const dyMes = latest?.dividend_yield_mes != null ? Number(latest.dividend_yield_mes) : null;
  const rentabMes = latest?.rentabilidade_efetiva_mes != null ? Number(latest.rentabilidade_efetiva_mes) : null;

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
                      formatter={(v: any) => (v != null ? `${Number(v).toFixed(2)}%` : "—")}
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
                        formatter={(v: any) => `R$ ${Number(v).toFixed(0)} Mi`}
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
                        formatter={(v: any) => Number(v).toLocaleString("pt-BR")}
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

            <div className="grid grid-cols-2 gap-4 text-[10px] font-mono">
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
              <div className="grid grid-cols-2 gap-4 text-[9px] font-mono">
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
          </motion.div>
        </SectionErrorBoundary>

        {/* === Section 4: Fundos Similares === */}
        {fiiData?.similar && fiiData.similar.length > 0 && (
          <SectionErrorBoundary sectionName="Fundos Similares">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <LineChartIcon className="w-4 h-4 text-[#EC4899]" />
                <h2 className="text-sm font-semibold text-zinc-300">FIIs Similares (mesmo segmento)</h2>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {fiiData.similar.slice(0, 6).map((fund, idx) => (
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
                        <div className="text-[8px] text-zinc-700 mt-1 truncate">
                          {fund.segmento || "—"}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[9px] font-mono text-zinc-400">{formatPL(fund.patrimonio_liquido)}</div>
                        {fund.dividend_yield_mes != null && (
                          <div className="text-[8px] font-mono text-emerald-400 mt-0.5">
                            DY {Number(fund.dividend_yield_mes).toFixed(2)}%
                          </div>
                        )}
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
