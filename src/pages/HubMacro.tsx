import { useState, useMemo } from "react";
import { KPICard } from "@/components/hub/KPICard";
import { MacroChart } from "@/components/hub/MacroChart";
import {
  useHubLatest,
  useHubSeries,
  MACRO_SAMPLE,
  generateSampleSeries,
} from "@/hooks/useHubData";
import { Activity, DollarSign, TrendingUp, Globe, Landmark, LayoutGrid } from "lucide-react";

/* ─── Period & Subcategory configs ─── */
const PERIODS = ["3m", "6m", "1y", "2y", "5y"] as const;

const SUBCATEGORIES = [
  { id: "all", label: "Visão Geral", icon: LayoutGrid },
  { id: "atividade", label: "Atividade", icon: Activity },
  { id: "inflacao", label: "Preços", icon: DollarSign },
  { id: "monetaria", label: "Monetária", icon: TrendingUp },
  { id: "externo", label: "Externo", icon: Globe },
  { id: "fiscal", label: "Fiscal", icon: Landmark },
] as const;

const catMap: Record<string, string[]> = {
  atividade: ["pib"],
  inflacao: ["ipca"],
  monetaria: ["selic"],
  externo: ["cambio", "balanca"],
  fiscal: ["divida"],
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

  /* Series data for charts + sparklines */
  const { data: selicData } = useHubSeries("selic", period, "macro");
  const { data: ipcaData } = useHubSeries("ipca", period, "macro");
  const { data: cambioData } = useHubSeries("cambio", period, "macro");
  const { data: pibData } = useHubSeries("pib", period, "macro");
  const { data: dividaData } = useHubSeries("divida", period, "macro");
  const { data: balancaData } = useHubSeries("balanca", period, "macro");

  const selic = selicData?.length ? selicData : generateSampleSeries(14.25, 24, 0.01);
  const ipca = ipcaData?.length ? ipcaData : generateSampleSeries(0.5, 24, 0.15);
  const cambio = cambioData?.length ? cambioData : generateSampleSeries(5.7, 24, 0.03);
  const pib = pibData?.length ? pibData : generateSampleSeries(3.0, 12, 0.08);
  const divida = dividaData?.length ? dividaData : generateSampleSeries(62, 24, 0.005);
  const balanca = balancaData?.length ? balancaData : generateSampleSeries(7000, 24, 0.1);

  /* Map serie_code → sparkline data */
  const sparklineMap = useMemo(() => {
    const map: Record<string, { value: number }[]> = {};
    map["selic_meta"] = toSparkline(selic);
    map["ipca_mensal"] = toSparkline(ipca);
    map["ipca_12m"] = toSparkline(ipca);
    map["ptax_compra"] = toSparkline(cambio);
    map["pib_var"] = toSparkline(pib);
    map["divida_pib"] = toSparkline(divida);
    return map;
  }, [selic, ipca, cambio, pib, divida]);

  /* Filter KPIs by subcategory */
  const filteredKPIs = useMemo(() => {
    if (activeTab === "all") return kpis;
    return kpis.filter((k) =>
      catMap[activeTab]?.some((c) => k.category.includes(c))
    );
  }, [activeTab, kpis]);

  /* Tab counts */
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: kpis.length };
    Object.entries(catMap).forEach(([tab, cats]) => {
      counts[tab] = kpis.filter((k) =>
        cats.some((c) => k.category.includes(c))
      ).length;
    });
    return counts;
  }, [kpis]);

  /* Chart visibility */
  const showMonetaria = activeTab === "all" || activeTab === "monetaria" || activeTab === "inflacao";
  const showExterno = activeTab === "all" || activeTab === "externo";
  const showAtivFiscal = activeTab === "all" || activeTab === "atividade" || activeTab === "fiscal";

  return (
    <div className="space-y-4 max-w-[1400px]">
      {/* ─── Sticky header bar ─── */}
      <div className="sticky top-14 z-20 bg-[#0a0a0a]/95 backdrop-blur-sm -mx-6 px-6 py-3 border-b border-[#141414]">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Title + meta */}
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold text-zinc-100 tracking-tight">
              Panorama Macroeconômico
            </h1>
            <span className="text-[9px] text-zinc-600 font-mono hidden sm:inline">
              {kpis.length} indicadores &middot; BACEN SGS
            </span>
          </div>

          {/* Period selector */}
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
                <span
                  className={`text-[9px] px-1 rounded ${
                    isActive
                      ? "bg-[#0B6C3E]/20 text-[#0B6C3E]"
                      : "bg-[#1a1a1a] text-zinc-600"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── KPI Cards Grid — Bloomberg density ─── */}
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

      {/* ─── Charts Grid ─── */}
      {showMonetaria && (
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
            data={ipca}
            title="IPCA — Inflação Mensal"
            type="bar"
            color="#10B981"
            label="IPCA"
            unit="%"
          />
        </div>
      )}

      {showExterno && (
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
      )}

      {showAtivFiscal && (
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
            data={divida}
            title="Dívida Líquida / PIB"
            type="area"
            color="#EF4444"
            label="Dívida/PIB"
            unit="%"
          />
        </div>
      )}

      {/* ─── Source footer ─── */}
      <div className="border-t border-[#141414] pt-3 flex items-center justify-between text-[9px] text-zinc-700 font-mono">
        <span>Fonte: Banco Central do Brasil — SGS</span>
        <span>Atualização: Diária (D+1 útil)</span>
      </div>
    </div>
  );
};

export default HubMacro;
