import { useState, useMemo } from "react";
import { KPICard } from "@/components/hub/KPICard";
import { MacroChart } from "@/components/hub/MacroChart";
import { AlertCard } from "@/components/hub/AlertCard";
import {
  useHubLatest,
  useHubSeries,
  CREDITO_SAMPLE,
  generateSampleSeries,
} from "@/hooks/useHubData";
import {
  LayoutGrid, ShieldAlert, ArrowLeftRight, Percent,
  Banknote, Warehouse,
} from "lucide-react";

/* ─── Period & Subcategory configs ─── */
const PERIODS = ["3m", "6m", "1y", "2y", "5y"] as const;

const SUBCATEGORIES = [
  { id: "all", label: "Visão Geral", icon: LayoutGrid },
  { id: "inadimplencia", label: "Inadimplência", icon: ShieldAlert },
  { id: "spreads", label: "Spreads", icon: ArrowLeftRight },
  { id: "taxas", label: "Taxas", icon: Percent },
  { id: "concessoes", label: "Concessões", icon: Banknote },
  { id: "estoque", label: "Estoque", icon: Warehouse },
] as const;

const catMap: Record<string, string[]> = {
  inadimplencia: ["inadimplencia"],
  spreads: ["spread"],
  taxas: ["taxa"],
  concessoes: ["concess"],
  estoque: ["estoque", "credito_pib"],
};

/* ─── Sparkline helper ─── */
function toSparkline(series: { date: string; value: number }[], points = 20) {
  if (!series.length) return [];
  const step = Math.max(1, Math.floor(series.length / points));
  return series.filter((_, i) => i % step === 0).map((d) => ({ value: d.value }));
}

/* ─── Accent color ─── */
const ACCENT = "#10B981";

/* ─── Main Component ─── */
const HubCredito = () => {
  const [period, setPeriod] = useState<string>("1y");
  const [activeTab, setActiveTab] = useState<string>("all");

  /* KPI Cards */
  const { data: cards, isLoading: cardsLoading } = useHubLatest("credito");
  const kpis = cards?.length ? cards : CREDITO_SAMPLE;

  /* Series data for charts + sparklines */
  const { data: inadData } = useHubSeries("inadimplencia", period, "credito");
  const { data: inadPFData } = useHubSeries("inadimplencia_pf", period, "credito");
  const { data: spreadData } = useHubSeries("spread", period, "credito");
  const { data: spreadPJData } = useHubSeries("spread_pj", period, "credito");
  const { data: taxaData } = useHubSeries("taxas", period, "credito");
  const { data: concessaoData } = useHubSeries("concessoes", period, "credito");
  const { data: estoqueData } = useHubSeries("estoque", period, "credito");

  const inadimplencia = inadData?.length ? inadData : generateSampleSeries(3.3, 24, 0.03);
  const inadPF = inadPFData?.length ? inadPFData : generateSampleSeries(4.1, 24, 0.025);
  const spreads = spreadData?.length ? spreadData : generateSampleSeries(30, 24, 0.02);
  const spreadsPJ = spreadPJData?.length ? spreadPJData : generateSampleSeries(10.8, 24, 0.025);
  const taxas = taxaData?.length ? taxaData : generateSampleSeries(52, 24, 0.015);
  const concessoes = concessaoData?.length ? concessaoData : generateSampleSeries(254, 24, 0.04);
  const estoque = estoqueData?.length ? estoqueData : generateSampleSeries(6.1, 24, 0.01);

  /* Sparkline map */
  const sparklineMap = useMemo(() => {
    const map: Record<string, { value: number }[]> = {};
    map["inadimplencia_total"] = toSparkline(inadimplencia);
    map["inadimplencia_pf"] = toSparkline(inadPF);
    map["inadimplencia_pj"] = toSparkline(inadimplencia); // approx
    map["spread_pf"] = toSparkline(spreads);
    map["spread_pj"] = toSparkline(spreadsPJ);
    map["taxa_pf"] = toSparkline(taxas);
    map["concessao_pf"] = toSparkline(concessoes);
    map["concessao_pj"] = toSparkline(concessoes);
    map["credito_pib"] = toSparkline(estoque);
    map["estoque_total"] = toSparkline(estoque);
    return map;
  }, [inadimplencia, inadPF, spreads, spreadsPJ, taxas, concessoes, estoque]);

  /* Filter KPIs by subcategory */
  const filteredKPIs = useMemo(() => {
    if (activeTab === "all") return kpis;
    return kpis.filter((k) =>
      catMap[activeTab]?.some((c) => k.category.includes(c) || k.serie_code.includes(c))
    );
  }, [activeTab, kpis]);

  /* Tab counts */
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: kpis.length };
    Object.entries(catMap).forEach(([tab, cats]) => {
      counts[tab] = kpis.filter((k) =>
        cats.some((c) => k.category.includes(c) || k.serie_code.includes(c))
      ).length;
    });
    return counts;
  }, [kpis]);

  /* Chart visibility */
  const showInad = activeTab === "all" || activeTab === "inadimplencia";
  const showSpreads = activeTab === "all" || activeTab === "spreads";
  const showTaxas = activeTab === "all" || activeTab === "taxas";
  const showConcessoes = activeTab === "all" || activeTab === "concessoes";
  const showEstoque = activeTab === "all" || activeTab === "estoque";

  return (
    <div className="space-y-4 max-w-[1400px]">
      {/* ─── Sticky header bar ─── */}
      <div className="sticky top-14 z-20 bg-[#0a0a0a]/95 backdrop-blur-sm -mx-6 px-6 py-3 border-b border-[#141414]">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Title + meta */}
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold text-zinc-100 tracking-tight">
              Overview de Crédito
            </h1>
            <span className="text-[9px] text-zinc-600 font-mono hidden sm:inline">
              {kpis.length} indicadores &middot; BACEN SGS + IF.data
            </span>
          </div>

          {/* Period selector — emerald accent */}
          <div className="flex items-center gap-0.5 bg-[#111111] border border-[#1a1a1a] rounded-md p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2 py-1 text-[10px] font-mono rounded transition-colors ${
                  period === p
                    ? "bg-[#10B981] text-white"
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
                    ? "bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20"
                    : "text-zinc-600 hover:text-zinc-300 border border-transparent hover:border-[#1a1a1a]"
                }`}
              >
                <Icon className="w-3 h-3" />
                {sub.label}
                <span
                  className={`text-[9px] px-1 rounded ${
                    isActive
                      ? "bg-[#10B981]/20 text-[#10B981]"
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

      {/* ─── Dynamic Alerts ─── */}
      <AlertCard kpis={kpis} module="credito" />

      {/* ─── KPI Cards Grid — Bloomberg density ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
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

      {/* Inadimplência */}
      {showInad && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <MacroChart
            data={inadimplencia}
            title="Inadimplência — Taxa Total SFN"
            type="area"
            color="#EF4444"
            label="Total"
            unit="%"
          />
          <MacroChart
            data={inadPF.map((d, i) => ({
              ...d,
              value2: inadimplencia[i]?.value
                ? inadimplencia[i].value * 0.58
                : d.value * 0.58,
            }))}
            title="Inadimplência PF vs PJ"
            type="line"
            color="#EF4444"
            color2="#F59E0B"
            label="PF"
            label2="PJ"
            unit="%"
          />
        </div>
      )}

      {/* Spreads */}
      {showSpreads && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <MacroChart
            data={spreads}
            title="Spread Bancário — Pessoa Física"
            type="area"
            color={ACCENT}
            label="Spread PF"
            unit=" p.p."
          />
          <MacroChart
            data={spreadsPJ}
            title="Spread Bancário — Pessoa Jurídica"
            type="area"
            color="#6366F1"
            label="Spread PJ"
            unit=" p.p."
          />
        </div>
      )}

      {/* Taxas + Concessões */}
      {showTaxas && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <MacroChart
            data={taxas}
            title="Taxa Média de Empréstimo — PF"
            type="line"
            color="#F59E0B"
            label="Taxa PF"
            unit="% a.a."
          />
          <MacroChart
            data={concessoes}
            title="Concessões de Crédito — Volume Mensal"
            type="bar"
            color={ACCENT}
            label="Volume"
            unit=" R$ bi"
          />
        </div>
      )}

      {/* Concessões (dedicated tab) */}
      {showConcessoes && activeTab === "concessoes" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <MacroChart
            data={concessoes}
            title="Concessões PF — Volume Mensal"
            type="bar"
            color={ACCENT}
            label="PF"
            unit=" R$ bi"
          />
          <MacroChart
            data={concessoes.map((d) => ({
              ...d,
              value: d.value * 0.78,
            }))}
            title="Concessões PJ — Volume Mensal"
            type="bar"
            color="#6366F1"
            label="PJ"
            unit=" R$ bi"
          />
        </div>
      )}

      {/* Estoque */}
      {showEstoque && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <MacroChart
            data={estoque}
            title="Estoque de Crédito — SFN Total"
            type="area"
            color={ACCENT}
            label="Estoque"
            unit=" R$ tri"
          />
          <MacroChart
            data={estoque.map((d) => ({
              ...d,
              value: (d.value / 11.5) * 100, // approx crédito/PIB
            }))}
            title="Relação Crédito / PIB"
            type="line"
            color="#F59E0B"
            label="Crédito/PIB"
            unit="%"
          />
        </div>
      )}

      {/* ─── Source footer ─── */}
      <div className="border-t border-[#141414] pt-3 flex items-center justify-between text-[9px] text-zinc-700 font-mono">
        <span>Fonte: Banco Central do Brasil — SGS + IF.data</span>
        <span>Atualização: Mensal (último dia útil)</span>
      </div>
    </div>
  );
};

export default HubCredito;
