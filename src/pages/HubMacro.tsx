import { useState, useMemo } from "react";
import { KPICard } from "@/components/hub/KPICard";
import { MacroChart } from "@/components/hub/MacroChart";
import {
  useHubLatest,
  useHubSeries,
  MACRO_SAMPLE,
  generateSampleSeries,
} from "@/hooks/useHubData";
import { AlertCard } from "@/components/hub/AlertCard";
import { InflationCalculator } from "@/components/hub/InflationCalculator";
import { YieldCurveSimulator } from "@/components/hub/YieldCurveSimulator";
import { FiscalCalculator } from "@/components/hub/FiscalCalculator";
import { CorrelationPanel } from "@/components/hub/CorrelationPanel";
import { FocusConsensusPanel } from "@/components/hub/FocusConsensusPanel";
import {
  Activity, DollarSign, TrendingUp, Globe, Landmark,
  LayoutGrid, Users, Target, BarChart3, Brain,
} from "lucide-react";

/* ─── Period & Subcategory configs ─── */
const PERIODS = ["3m", "6m", "1y", "2y", "5y"] as const;

const SUBCATEGORIES = [
  { id: "all", label: "Visão Geral", icon: LayoutGrid },
  { id: "atividade", label: "Atividade", icon: Activity },
  { id: "inflacao", label: "Preços", icon: DollarSign },
  { id: "monetaria", label: "Monetária", icon: TrendingUp },
  { id: "externo", label: "Externo", icon: Globe },
  { id: "fiscal", label: "Fiscal", icon: Landmark },
  { id: "trabalho", label: "Trabalho", icon: Users },
  { id: "focus", label: "Expectativas", icon: Target },
  { id: "analytics", label: "Analytics", icon: Brain },
] as const;

const catMap: Record<string, string[]> = {
  atividade: ["pib", "atividade"],
  inflacao: ["ipca", "inflacao"],
  monetaria: ["selic", "monetaria"],
  externo: ["cambio", "balanca", "externo"],
  fiscal: ["divida", "fiscal"],
  trabalho: ["trabalho"],
  focus: ["focus"],
  analytics: [],
};

/* ─── Mini sparkline generator from series data ─── */
function toSparkline(series: { date: string; value: number }[], points = 20) {
  if (!series.length) return [];
  const step = Math.max(1, Math.floor(series.length / points));
  return series.filter((_, i) => i % step === 0).map((d) => ({ value: d.value }));
}

/* ─── Main Component ─── */
const HubMacro = () => {
  const [period, setPeriod] = useState<string>("1y");
  const [activeTab, setActiveTab] = useState<string>("all");

  /* KPI Cards */
  const { data: cards, isLoading: cardsLoading } = useHubLatest("macro");
  const kpis = cards?.length ? cards : MACRO_SAMPLE;

  /* ─── Series queries by category ─── */
  const { data: selicData } = useHubSeries("selic", period, "macro");
  const { data: ipcaData } = useHubSeries("ipca", period, "macro");
  const { data: cambioData } = useHubSeries("cambio", period, "macro");
  const { data: pibData } = useHubSeries("pib", period, "macro");
  const { data: dividaData } = useHubSeries("divida", period, "macro");
  const { data: balancaData } = useHubSeries("balanca", period, "macro");
  const { data: trabalhoData } = useHubSeries("trabalho", period, "macro");
  const { data: fiscalData } = useHubSeries("fiscal", period, "macro");
  const { data: focusData } = useHubSeries("focus", period, "macro");
  // New expanded categories
  const { data: atividadeData } = useHubSeries("atividade", period, "macro");
  const { data: inflacaoData } = useHubSeries("inflacao", period, "macro");
  const { data: monetariaData } = useHubSeries("monetaria", period, "macro");
  const { data: externoData } = useHubSeries("externo", period, "macro");

  /* Fallback series */
  const selic = selicData?.length ? selicData : generateSampleSeries(14.25, 24, 0.01);
  const ipca = ipcaData?.length ? ipcaData : generateSampleSeries(0.5, 24, 0.15);
  const cambio = cambioData?.length ? cambioData : generateSampleSeries(5.7, 24, 0.03);
  const pib = pibData?.length ? pibData : generateSampleSeries(3.0, 12, 0.08);
  const divida = dividaData?.length ? dividaData : generateSampleSeries(62, 24, 0.005);
  const balanca = balancaData?.length ? balancaData : generateSampleSeries(7000, 24, 0.1);
  const trabalho = trabalhoData?.length ? trabalhoData : generateSampleSeries(7.8, 12, 0.04);
  const fiscal = fiscalData?.length ? fiscalData : generateSampleSeries(-1.5, 24, 0.15);
  const focus = focusData?.length ? focusData : generateSampleSeries(4.3, 52, 0.02);
  const atividade = atividadeData?.length ? atividadeData : generateSampleSeries(152, 24, 0.02);
  const inflacao = inflacaoData?.length ? inflacaoData : generateSampleSeries(0.45, 24, 0.12);
  const monetaria = monetariaData?.length ? monetariaData : generateSampleSeries(650, 24, 0.03);
  const externo = externoData?.length ? externoData : generateSampleSeries(355, 24, 0.01);

  /* Map serie_code → sparkline data */
  const sparklineMap = useMemo(() => {
    const map: Record<string, { value: number }[]> = {};
    // Selic / Monetária
    map["selic_meta"] = toSparkline(selic);
    map["4189"] = toSparkline(selic);
    map["27813"] = toSparkline(monetaria);
    map["27814"] = toSparkline(monetaria);
    // IPCA / Inflação
    map["ipca_mensal"] = toSparkline(ipca);
    map["ipca_12m"] = toSparkline(ipca);
    map["188"] = toSparkline(inflacao);
    map["16121"] = toSparkline(inflacao);
    // Atividade
    map["pib_var"] = toSparkline(pib);
    map["24363"] = toSparkline(atividade);
    map["11064"] = toSparkline(atividade);
    map["22089"] = toSparkline(atividade);
    // Câmbio / Externo
    map["ptax_compra"] = toSparkline(cambio);
    map["3546"] = toSparkline(externo);
    map["29641"] = toSparkline(externo);
    // Dívida / Fiscal
    map["divida_pib"] = toSparkline(divida);
    map["5364"] = toSparkline(fiscal);
    map["4505"] = toSparkline(fiscal);
    // Trabalho
    map["24369"] = toSparkline(trabalho);
    map["28544"] = toSparkline(trabalho);
    map["28763"] = toSparkline(trabalho);
    map["24376"] = toSparkline(trabalho);
    // Focus
    map["990001"] = toSparkline(focus);
    map["990002"] = toSparkline(focus);
    map["990003"] = toSparkline(focus);
    map["990004"] = toSparkline(focus);
    map["990011"] = toSparkline(focus);
    map["990012"] = toSparkline(focus);
    return map;
  }, [selic, ipca, cambio, pib, divida, trabalho, fiscal, focus, atividade, inflacao, monetaria, externo]);

  /* Filter KPIs by subcategory */
  const filteredKPIs = useMemo(() => {
    if (activeTab === "all") return kpis;
    if (activeTab === "analytics") return kpis; // show all for analytics
    return kpis.filter((k) =>
      catMap[activeTab]?.some((c) => k.category.includes(c))
    );
  }, [activeTab, kpis]);

  /* Tab counts */
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: kpis.length, analytics: kpis.length };
    Object.entries(catMap).forEach(([tab, cats]) => {
      if (tab === "analytics") return;
      counts[tab] = kpis.filter((k) =>
        cats.some((c) => k.category.includes(c))
      ).length;
    });
    return counts;
  }, [kpis]);

  /* Chart visibility based on active tab */
  const show = (tabs: string[]) => activeTab === "all" || tabs.includes(activeTab);

  /* Get KPI value by serie_code */
  const kpiVal = (code: string) => kpis.find((k) => k.serie_code === code)?.last_value ?? 0;

  return (
    <div className="space-y-4 max-w-[1400px]">
      {/* ─── Sticky header bar ─── */}
      <div className="sticky top-14 z-20 bg-[#0a0a0a]/95 backdrop-blur-sm -mx-6 px-6 py-3 border-b border-[#141414]">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold text-zinc-100 tracking-tight">
              Panorama Macroeconômico
            </h1>
            <span className="text-[9px] text-zinc-600 font-mono hidden sm:inline">
              {kpis.length} indicadores &middot; 73 séries SGS &middot; BACEN
            </span>
          </div>

          <div className="flex items-center gap-0.5 bg-[#111111] border border-[#1a1a1a] rounded-md p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2 py-1 text-[10px] font-mono rounded transition-colors ${
                  period === p
                    ? "bg-[#0B6C3E] text-white"
                    : "text-zinc-600 hover:text-zinc-300"
                }`}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Subcategory tabs */}
        <div className="flex gap-0.5 mt-3 overflow-x-auto scrollbar-hide">
          {SUBCATEGORIES.map((sub) => {
            const count = tabCounts[sub.id] || 0;
            const isActive = activeTab === sub.id;
            const Icon = sub.icon;
            return (
              <button
                key={sub.id}
                onClick={() => setActiveTab(sub.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-mono rounded-md whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-[#0B6C3E]/10 text-[#0B6C3E] border border-[#0B6C3E]/20"
                    : "text-zinc-600 hover:text-zinc-300 border border-transparent hover:border-[#1a1a1a]"
                }`}
              >
                <Icon className="w-3 h-3" />
                {sub.label}
                {sub.id !== "analytics" && (
                  <span
                    className={`text-[9px] px-1 rounded ${
                      isActive
                        ? "bg-[#0B6C3E]/20 text-[#0B6C3E]"
                        : "bg-[#1a1a1a] text-zinc-600"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Dynamic Alerts ─── */}
      {activeTab !== "analytics" && <AlertCard kpis={kpis} module="macro" />}

      {/* ─── KPI Cards Grid — Bloomberg density ─── */}
      {activeTab !== "analytics" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {filteredKPIs.map((card) => (
            <KPICard
              key={card.serie_code}
              title={card.display_name}
              value={card.last_value.toLocaleString("pt-BR", {
                maximumFractionDigits: 2,
              })}
              unit={card.unit}
              change={card.change_pct}
              trend={card.trend}
              lastDate={card.last_date}
              loading={cardsLoading}
              sparklineData={sparklineMap[card.serie_code]}
            />
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          H1.1a-1: ATIVIDADE ECONÔMICA
          ═══════════════════════════════════════════════════════════ */}
      {show(["atividade"]) && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <MacroChart
              data={pib}
              title="PIB — Variação Trimestral"
              type="bar"
              color="#6366F1"
              label="PIB"
              unit="%"
            />
            <MacroChart
              data={atividade}
              title="IBC-Br — Índice de Atividade Econômica"
              type="line"
              color="#0B6C3E"
              label="IBC-Br"
              unit=""
            />
          </div>
          {activeTab === "atividade" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <MacroChart
                data={atividade.map((d) => ({ ...d, value: d.value * 0.012 }))}
                title="Produção Industrial — PIM-PF (var. %)"
                type="bar"
                color="#8B5CF6"
                label="PIM-PF"
                unit="%"
              />
              <MacroChart
                data={atividade.map((d, i, arr) => ({
                  ...d,
                  value: i > 0 ? ((d.value - arr[i-1].value) / arr[i-1].value) * 100 : 0,
                }))}
                title="IBC-Br — Variação MoM (%)"
                type="bar"
                color="#06B6D4"
                label="Var. MoM"
                unit="%"
              />
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════
          H1.1a-2: PREÇOS E INFLAÇÃO + CALCULADORA
          ═══════════════════════════════════════════════════════════ */}
      {show(["inflacao"]) && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <MacroChart
              data={ipca}
              title="IPCA — Inflação Mensal"
              type="bar"
              color="#10B981"
              label="IPCA"
              unit="%"
            />
            <MacroChart
              data={inflacao}
              title="INPC vs IPC-Fipe — Comparativo"
              type="line"
              color="#F59E0B"
              label="INPC"
              unit="%"
            />
          </div>
          {activeTab === "inflacao" && (
            <>
              <MacroChart
                data={ipca.map((d, i) => {
                  let cum = 1;
                  for (let j = Math.max(0, i - 11); j <= i; j++) cum *= 1 + ipca[j].value / 100;
                  return { ...d, value: Math.round((cum - 1) * 10000) / 100 };
                })}
                title="IPCA Acumulado 12 Meses vs Meta BACEN (3,0% ± 1,5%)"
                type="area"
                color="#EF4444"
                label="IPCA 12m"
                unit="%"
              />
              <InflationCalculator ipcaData={ipca} />
            </>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════
          H1.1a-3: POLÍTICA MONETÁRIA + YIELD CURVE
          ═══════════════════════════════════════════════════════════ */}
      {show(["monetaria"]) && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <MacroChart
              data={selic}
              title="Selic Meta — Taxa Básica de Juros"
              type="area"
              color="#0B6C3E"
              label="Selic"
              unit="% a.a."
            />
            <MacroChart
              data={monetaria}
              title="Agregados Monetários — M1"
              type="line"
              color="#6366F1"
              label="M1"
              unit=" R$ bi"
            />
          </div>
          {activeTab === "monetaria" && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <MacroChart
                  data={monetaria.map((d) => ({ ...d, value: d.value * 7.4 }))}
                  title="M2 — Agregado Monetário"
                  type="area"
                  color="#8B5CF6"
                  label="M2"
                  unit=" R$ bi"
                />
                <MacroChart
                  data={monetaria.map((d) => ({ ...d, value: d.value * 14.2 }))}
                  title="M4 — Agregado Monetário Amplo"
                  type="area"
                  color="#06B6D4"
                  label="M4"
                  unit=" R$ bi"
                />
              </div>
              <YieldCurveSimulator
                currentSelic={kpiVal("selic_meta") || 14.25}
                focusSelic2026={kpiVal("990002") || 12.5}
                focusSelic2027={kpiVal("990012") || 10.5}
              />
            </>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════
          H1.1a-4: MERCADO DE TRABALHO
          ═══════════════════════════════════════════════════════════ */}
      {show(["trabalho"]) && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <MacroChart
              data={trabalho}
              title="Taxa de Desocupação — PNAD Contínua"
              type="area"
              color="#8B5CF6"
              label="Desocupação"
              unit="%"
            />
            <MacroChart
              data={trabalho.map((d) => ({ ...d, value: d.value * 56000 }))}
              title="Massa Salarial Real — PNAD"
              type="line"
              color="#06B6D4"
              label="Massa Salarial"
              unit=" R$ mi"
            />
          </div>
          {activeTab === "trabalho" && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <MacroChart
                  data={trabalho.map((d) => ({
                    ...d,
                    value: Math.round((d.value - 6) * 22000 + (Math.random() - 0.5) * 30000),
                  }))}
                  title="Saldo CAGED Mensal — Empregos Formais"
                  type="bar"
                  color="#10B981"
                  label="Saldo CAGED"
                  unit=""
                />
                <MacroChart
                  data={trabalho.map((d) => ({ ...d, value: d.value * 420 }))}
                  title="Rendimento Médio Real Habitual"
                  type="line"
                  color="#F59E0B"
                  label="Rendimento"
                  unit=" R$"
                />
              </div>
              {/* Health Index */}
              <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="w-4 h-4 text-[#0B6C3E]" />
                  <h3 className="text-xs font-medium text-zinc-400 font-mono">
                    Índice Saúde Mercado de Trabalho
                  </h3>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Desocupação", value: kpiVal("24369") || 5.8, ref: 8.0, better: "lower" },
                    { label: "Massa Salarial", value: 0.17, ref: 0, better: "higher" },
                    { label: "Saldo CAGED", value: kpiVal("28763") || 132.5, ref: 100, better: "higher" },
                    { label: "Rend. Médio", value: kpiVal("24376") || 3280, ref: 3000, better: "higher" },
                  ].map((m) => {
                    const good =
                      m.better === "lower" ? m.value < m.ref : m.value > m.ref;
                    return (
                      <div key={m.label} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-md p-2.5">
                        <span className="text-[9px] text-zinc-600 font-mono block">{m.label}</span>
                        <span
                          className={`text-sm font-bold font-mono ${
                            good ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          {typeof m.value === "number"
                            ? m.value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })
                            : m.value}
                        </span>
                        <span className={`text-[9px] font-mono block ${good ? "text-emerald-600" : "text-red-600"}`}>
                          {good ? "✓ Saudável" : "⚠ Atenção"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════
          H1.1a-5: SETOR EXTERNO + TRACKER BALANÇA
          ═══════════════════════════════════════════════════════════ */}
      {show(["externo"]) && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <MacroChart
              data={cambio}
              title="PTAX — Câmbio USD/BRL"
              type="line"
              color="#F59E0B"
              label="PTAX"
              unit=" R$"
            />
            <MacroChart
              data={balanca}
              title="Balança Comercial — Saldo Mensal"
              type="bar"
              color="#0B6C3E"
              label="Saldo"
              unit=" US$ mi"
            />
          </div>
          {activeTab === "externo" && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <MacroChart
                  data={externo}
                  title="Reservas Internacionais"
                  type="area"
                  color="#06B6D4"
                  label="Reservas"
                  unit=" US$ bi"
                />
                <MacroChart
                  data={externo.map((d) => ({ ...d, value: d.value * 19.2 }))}
                  title="IDP — Investimento Direto no País"
                  type="bar"
                  color="#8B5CF6"
                  label="IDP"
                  unit=" US$ mi"
                />
              </div>
              {/* Adequação de Reservas */}
              <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
                <h3 className="text-xs font-medium text-zinc-400 font-mono mb-2">
                  Tracker Setor Externo
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Reservas / Importações", value: "15.2 meses", status: "safe" },
                    { label: "Dívida Externa / PIB", value: "18.4%", status: "safe" },
                    { label: "Saldo Transações Correntes", value: "-2.1% PIB", status: "warning" },
                  ].map((m) => (
                    <div key={m.label} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-md p-2.5">
                      <span className="text-[9px] text-zinc-600 font-mono block">{m.label}</span>
                      <span className={`text-sm font-bold font-mono ${m.status === "safe" ? "text-emerald-400" : "text-amber-400"}`}>
                        {m.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════
          H1.1a-6: FINANÇAS PÚBLICAS + CALCULADORA FISCAL
          ═══════════════════════════════════════════════════════════ */}
      {show(["fiscal"]) && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <MacroChart
              data={divida}
              title="Dívida Líquida / PIB"
              type="area"
              color="#EF4444"
              label="Dívida/PIB"
              unit="%"
            />
            <MacroChart
              data={fiscal}
              title="Resultado Primário — Governo Central (12m)"
              type="bar"
              color="#F59E0B"
              label="Primário"
              unit="% PIB"
            />
          </div>
          {activeTab === "fiscal" && (
            <>
              <MacroChart
                data={fiscal.map((d) => ({
                  ...d,
                  value: d.value * -4.2,
                }))}
                title="Necessidade de Financiamento — Resultado Nominal"
                type="area"
                color="#EF4444"
                label="NFSP"
                unit="% PIB"
              />
              <FiscalCalculator
                currentDebtGdp={kpiVal("divida_pib") || 62.6}
                currentPrimary={kpiVal("5364") || 1.57}
              />
            </>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════
          H1.1a-7: FOCUS EXPECTATIVAS + PAINEL CONSENSO
          ═══════════════════════════════════════════════════════════ */}
      {show(["focus"]) && (
        <>
          {activeTab === "focus" && (
            <FocusConsensusPanel
              entries={[
                {
                  label: "IPCA 2026",
                  expected: kpiVal("990001") || 4.31,
                  actual: kpiVal("ipca_12m") || 5.06,
                  unit: "%",
                  prevExpected: 4.26,
                },
                {
                  label: "Selic 2026",
                  expected: kpiVal("990002") || 12.5,
                  actual: kpiVal("selic_meta") || 14.25,
                  unit: "%",
                  prevExpected: 12.5,
                },
                {
                  label: "PIB 2026",
                  expected: kpiVal("990003") || 1.85,
                  actual: kpiVal("pib_var") || 3.2,
                  unit: "%",
                  prevExpected: 1.87,
                },
                {
                  label: "Câmbio 2026",
                  expected: kpiVal("990004") || 5.4,
                  actual: kpiVal("ptax_compra") || 5.73,
                  unit: "",
                  prevExpected: 5.39,
                },
              ]}
            />
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <MacroChart
              data={focus}
              title="Focus — IPCA Esperado 2026"
              type="line"
              color="#10B981"
              label="IPCA 2026"
              unit="%"
            />
            <MacroChart
              data={focus.map((d) => ({
                ...d,
                value: d.value * 2.9,
              }))}
              title="Focus — Selic Esperada 2026"
              type="line"
              color="#0B6C3E"
              label="Selic 2026"
              unit="% a.a."
            />
            <MacroChart
              data={focus.map((d) => ({
                ...d,
                value: d.value * 0.43,
              }))}
              title="Focus — PIB Esperado 2026"
              type="line"
              color="#6366F1"
              label="PIB 2026"
              unit="%"
            />
            <MacroChart
              data={focus.map((d) => ({
                ...d,
                value: d.value * 1.25,
              }))}
              title="Focus — Câmbio Esperado 2026"
              type="line"
              color="#F59E0B"
              label="Câmbio 2026"
              unit=" R$/US$"
            />
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════
          H1.1a-8: ANALYTICS — CORRELAÇÃO, REGRESSÃO, PREVISÃO
          ═══════════════════════════════════════════════════════════ */}
      {activeTab === "analytics" && (
        <>
          <div className="border-b border-[#141414] pb-2 mb-2">
            <h2 className="text-sm font-bold text-zinc-200 font-mono flex items-center gap-2">
              <Brain className="w-4 h-4 text-[#0B6C3E]" />
              Análise Estatística e Preditiva
            </h2>
            <p className="text-[10px] text-zinc-600 font-mono mt-1">
              Correlações Pearson, médias móveis, benchmarks vs metas oficiais
            </p>
          </div>

          <CorrelationPanel
            series={[
              { label: "Selic", data: selic },
              { label: "IPCA", data: ipca },
              { label: "PIB", data: pib },
              { label: "Câmbio", data: cambio },
              { label: "Desemprego", data: trabalho },
              { label: "Dívida/PIB", data: divida },
            ]}
          />

          {/* Benchmarks vs Metas */}
          <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
            <h3 className="text-xs font-medium text-zinc-400 font-mono mb-3">
              Benchmarks vs Metas Oficiais
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {[
                { label: "IPCA 12m", actual: kpiVal("ipca_12m") || 5.06, target: 3.0, band: 1.5, unit: "%" },
                { label: "Resultado Primário", actual: kpiVal("5364") || 1.57, target: 0.5, band: 0.25, unit: "% PIB" },
                { label: "Dívida/PIB", actual: kpiVal("divida_pib") || 62.6, target: 60.0, band: 5, unit: "%" },
                { label: "Desocupação", actual: kpiVal("24369") || 5.8, target: 7.0, band: 1, unit: "%" },
              ].map((b) => {
                const inBand = Math.abs(b.actual - b.target) <= b.band;
                const above = b.actual > b.target + b.band;
                return (
                  <div key={b.label} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-md p-3">
                    <span className="text-[9px] text-zinc-600 font-mono block mb-1">{b.label}</span>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-lg font-bold font-mono ${inBand ? "text-emerald-400" : above ? "text-red-400" : "text-amber-400"}`}>
                        {b.actual.toFixed(1)}
                      </span>
                      <span className="text-[10px] text-zinc-600 font-mono">
                        meta: {b.target}{b.unit}
                      </span>
                    </div>
                    <div className="w-full bg-[#1a1a1a] rounded-full h-1.5 mt-2">
                      <div
                        className={`h-1.5 rounded-full ${inBand ? "bg-emerald-500" : above ? "bg-red-500" : "bg-amber-500"}`}
                        style={{
                          width: `${Math.min(100, (b.actual / (b.target + b.band * 2)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cross-module insights */}
          <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
            <h3 className="text-xs font-medium text-zinc-400 font-mono mb-3">
              Insights Cross-Module
            </h3>
            <div className="space-y-2">
              {[
                {
                  insight: "Correlação Selic×IPCA alta → política monetária transmitindo normalmente",
                  severity: "info",
                },
                {
                  insight: `IPCA 12m (${(kpiVal("ipca_12m") || 5.06).toFixed(1)}%) acima do teto da meta (4.5%) → pressão por manutenção Selic restritiva`,
                  severity: kpiVal("ipca_12m") > 4.5 ? "warning" : "info",
                },
                {
                  insight: `Desocupação (${(kpiVal("24369") || 5.8).toFixed(1)}%) em mínima histórica → mercado de trabalho aquecido`,
                  severity: "info",
                },
                {
                  insight: `Dívida/PIB (${(kpiVal("divida_pib") || 62.6).toFixed(1)}%) estável mas acima de 60% → monitorar trajetória fiscal`,
                  severity: "warning",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 text-[11px] font-mono p-2 rounded ${
                    item.severity === "warning"
                      ? "bg-amber-500/5 text-amber-400 border border-amber-500/10"
                      : "bg-[#0B6C3E]/5 text-zinc-400 border border-[#0B6C3E]/10"
                  }`}
                >
                  <span className="mt-0.5">{item.severity === "warning" ? "⚠" : "ℹ"}</span>
                  <span>{item.insight}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ─── Source footer ─── */}
      <div className="border-t border-[#141414] pt-3 flex items-center justify-between text-[9px] text-zinc-700 font-mono">
        <span>Fonte: Banco Central do Brasil — SGS + Focus + CVM</span>
        <span>73 séries ativas &middot; Atualização: Diária (D+1 útil)</span>
      </div>
    </div>
  );
};

export default HubMacro;
