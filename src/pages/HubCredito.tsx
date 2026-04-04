import { useState, useMemo } from "react";
import { KPICard } from "@/components/hub/KPICard";
import { MacroChart } from "@/components/hub/MacroChart";
import { AlertCard } from "@/components/hub/AlertCard";
import { InterestCalculator } from "@/components/hub/InterestCalculator";
import { DefaultRadar } from "@/components/hub/DefaultRadar";
import { SpreadMonitor } from "@/components/hub/SpreadMonitor";
import { CreditCorrelationPanel } from "@/components/hub/CreditCorrelationPanel";
import { CreditOverviewMensal } from "@/components/hub/CreditOverviewMensal";
import { CreditProductPanel } from "@/components/hub/CreditProductPanel";
import {
  useHubLatest,
  useHubSeries,
  CREDITO_SAMPLE,
  generateSampleSeries,
} from "@/hooks/useHubData";
import { percentChange, sma } from "@/lib/statistics";
import {
  LayoutGrid, ShieldAlert, ArrowLeftRight, Percent,
  Banknote, Warehouse, CreditCard, Brain, CalendarRange, ShoppingBag,
} from "lucide-react";

/* ─── Period & Subcategory configs ─── */
const PERIODS = ["3m", "6m", "1y", "2y", "5y"] as const;

const SUBCATEGORIES = [
  { id: "all", label: "Visão Geral", icon: LayoutGrid },
  { id: "overview", label: "Overview Mensal", icon: CalendarRange },
  { id: "saldos", label: "Saldos", icon: Warehouse },
  { id: "concessoes", label: "Concessões", icon: Banknote },
  { id: "taxas", label: "Taxas", icon: Percent },
  { id: "inadimplencia", label: "Inadimplência", icon: ShieldAlert },
  { id: "spreads", label: "Spreads", icon: ArrowLeftRight },
  { id: "produtos", label: "Produtos", icon: ShoppingBag },
  { id: "outros", label: "Outros", icon: CreditCard },
  { id: "analytics", label: "Analytics", icon: Brain },
] as const;

const catMap: Record<string, string[]> = {
  saldos: ["saldo_credito"],
  concessoes: ["concessao"],
  taxas: ["taxa"],
  inadimplencia: ["inadimplencia"],
  spreads: ["spread"],
  outros: ["cartoes"],
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

  const show = (tabs: string[]) => (activeTab === "all" || tabs.includes(activeTab)) && activeTab !== "overview" && activeTab !== "produtos";

  /* KPI Cards */
  const { data: cards, isLoading: cardsLoading } = useHubLatest("credito");
  const kpis = cards?.length ? cards : CREDITO_SAMPLE;

  /* ── Series data ── */
  // Saldos (H1.1b-1)
  const { data: saldoTotalData } = useHubSeries("saldo_credito", period, "credito");
  const { data: saldoPFData } = useHubSeries("saldo_pf", period, "credito");
  const { data: saldoPJLivresData } = useHubSeries("saldo_pj_livres", period, "credito");
  const { data: veiculosData } = useHubSeries("veiculos_pf", period, "credito");
  const { data: cartaoCreditoData } = useHubSeries("cartao_pf", period, "credito");

  // Concessões (H1.1b-2)
  const { data: concessaoPFData } = useHubSeries("concessao_pf", period, "credito");
  const { data: concessaoPJData } = useHubSeries("concessao_pj", period, "credito");
  const { data: consignadoData } = useHubSeries("consignado", period, "credito");

  // Taxas (H1.1b-3)
  const { data: taxaPFData } = useHubSeries("taxa_pf", period, "credito");
  const { data: taxaPJData } = useHubSeries("taxa_pj", period, "credito");
  const { data: taxaVeiculosData } = useHubSeries("taxa_veiculos", period, "credito");
  const { data: taxaMicroData } = useHubSeries("taxa_micro", period, "credito");

  // Inadimplência (H1.1b-4)
  const { data: inadTotalData } = useHubSeries("inadimplencia", period, "credito");
  const { data: inadPFData } = useHubSeries("inadimplencia_pf", period, "credito");
  const { data: inadPJData } = useHubSeries("inadimplencia_pj", period, "credito");
  const { data: inadSFNData } = useHubSeries("inadimplencia_sfn", period, "credito");

  // Spreads (H1.1b-5)
  const { data: spreadPFData } = useHubSeries("spread_pf", period, "credito");
  const { data: spreadPJData } = useHubSeries("spread_pj", period, "credito");
  const { data: spreadPosData } = useHubSeries("spread_pos", period, "credito");
  const { data: spreadPreData } = useHubSeries("spread_pre", period, "credito");

  // Outros (H1.1b-6)
  const { data: cartoesData } = useHubSeries("cartoes", period, "credito");
  const { data: creditoPibData } = useHubSeries("credito_pib", period, "credito");

  /* ── Fallback data ── */
  const saldoTotal = saldoTotalData?.length ? saldoTotalData : generateSampleSeries(6120, 24, 0.01);
  const saldoPF = saldoPFData?.length ? saldoPFData : generateSampleSeries(3580, 24, 0.012);
  const saldoPJLivres = saldoPJLivresData?.length ? saldoPJLivresData : generateSampleSeries(1240, 24, 0.015);
  const veiculos = veiculosData?.length ? veiculosData : generateSampleSeries(312, 24, 0.02);
  const cartaoCredito = cartaoCreditoData?.length ? cartaoCreditoData : generateSampleSeries(548, 24, 0.025);

  const concessaoPF = concessaoPFData?.length ? concessaoPFData : generateSampleSeries(254, 24, 0.04);
  const concessaoPJ = concessaoPJData?.length ? concessaoPJData : generateSampleSeries(198, 24, 0.035);
  const consignado = consignadoData?.length ? consignadoData : generateSampleSeries(38, 24, 0.02);

  const taxaPF = taxaPFData?.length ? taxaPFData : generateSampleSeries(52, 24, 0.015);
  const taxaPJ = taxaPJData?.length ? taxaPJData : generateSampleSeries(24, 24, 0.015);
  const taxaVeiculos = taxaVeiculosData?.length ? taxaVeiculosData : generateSampleSeries(26, 24, 0.01);
  const taxaMicro = taxaMicroData?.length ? taxaMicroData : generateSampleSeries(44, 24, 0.02);

  const inadTotal = inadTotalData?.length ? inadTotalData : generateSampleSeries(3.3, 24, 0.03);
  const inadPF = inadPFData?.length ? inadPFData : generateSampleSeries(4.1, 24, 0.025);
  const inadPJ = inadPJData?.length ? inadPJData : generateSampleSeries(2.4, 24, 0.03);
  const inadSFN = inadSFNData?.length ? inadSFNData : generateSampleSeries(3.05, 24, 0.02);

  const spreadPF = spreadPFData?.length ? spreadPFData : generateSampleSeries(30, 24, 0.02);
  const spreadPJ = spreadPJData?.length ? spreadPJData : generateSampleSeries(10.8, 24, 0.025);
  const spreadPos = spreadPosData?.length ? spreadPosData : generateSampleSeries(22, 24, 0.02);
  const spreadPre = spreadPreData?.length ? spreadPreData : generateSampleSeries(28, 24, 0.02);

  const cartoes = cartoesData?.length ? cartoesData : generateSampleSeries(215, 24, 0.015);
  const creditoPib = creditoPibData?.length ? creditoPibData : generateSampleSeries(54, 24, 0.008);

  /* ── Sparkline map ── */
  const sparklineMap = useMemo(() => {
    const map: Record<string, { value: number }[]> = {};
    // Saldos
    map["20539"] = toSparkline(creditoPib);
    map["20540"] = toSparkline(saldoTotal);
    map["20541"] = toSparkline(saldoPF);
    map["28848"] = toSparkline(saldoPF);
    map["28860"] = toSparkline(saldoPJLivres);
    map["20581"] = toSparkline(veiculos);
    map["20590"] = toSparkline(cartaoCredito);
    map["25891"] = toSparkline(saldoPJLivres);
    // Concessões
    map["20631"] = toSparkline(concessaoPF);
    map["20632"] = toSparkline(concessaoPJ);
    map["20671"] = toSparkline(consignado);
    // Taxas
    map["20714"] = toSparkline(taxaPF);
    map["20715"] = toSparkline(taxaPJ);
    map["20740"] = toSparkline(taxaPF);
    map["20749"] = toSparkline(taxaVeiculos);
    map["20763"] = toSparkline(taxaPJ);
    map["26428"] = toSparkline(taxaMicro);
    // Inadimplência
    map["21082"] = toSparkline(inadTotal);
    map["21083"] = toSparkline(inadPF);
    map["21084"] = toSparkline(inadPJ);
    map["12948"] = toSparkline(inadSFN);
    map["13685"] = toSparkline(inadPF);
    map["13667"] = toSparkline(inadSFN);
    map["21154"] = toSparkline(inadSFN);
    // Spreads
    map["20783"] = toSparkline(spreadPF);
    map["20784"] = toSparkline(spreadPJ);
    map["20785"] = toSparkline(spreadPF);
    map["20786"] = toSparkline(spreadPJ);
    map["20787"] = toSparkline(spreadPJ);
    map["20826"] = toSparkline(spreadPos);
    map["20837"] = toSparkline(spreadPre);
    // Outros
    map["25147"] = toSparkline(cartoes);
    return map;
  }, [saldoTotal, saldoPF, saldoPJLivres, veiculos, cartaoCredito, concessaoPF, concessaoPJ, consignado, taxaPF, taxaPJ, taxaVeiculos, taxaMicro, inadTotal, inadPF, inadPJ, inadSFN, spreadPF, spreadPJ, spreadPos, spreadPre, cartoes, creditoPib]);

  /* ── Filter KPIs ── */
  const filteredKPIs = useMemo(() => {
    if (activeTab === "all" || activeTab === "analytics" || activeTab === "overview" || activeTab === "produtos") return kpis;
    return kpis.filter((k) =>
      catMap[activeTab]?.some((c) => k.category.includes(c) || k.serie_code.includes(c))
    );
  }, [activeTab, kpis]);

  /* Tab counts */
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: kpis.length, analytics: kpis.length, overview: 75, produtos: 20 };
    Object.entries(catMap).forEach(([tab, cats]) => {
      counts[tab] = kpis.filter((k) =>
        cats.some((c) => k.category.includes(c) || k.serie_code.includes(c))
      ).length;
    });
    return counts;
  }, [kpis]);

  /* ── Derived analytics data (H1.1b-7) ── */
  const concessoesMoM = useMemo(() => percentChange(concessaoPF), [concessaoPF]);
  const inadSMA = useMemo(() => sma(inadTotal, 3), [inadTotal]);

  return (
    <div className="space-y-4 max-w-[1400px]">
      {/* ─── Sticky header bar ─── */}
      <div className="sticky top-14 z-20 bg-[#0a0a0a]/95 backdrop-blur-sm -mx-6 px-6 py-3 border-b border-[#141414]">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold text-zinc-100 tracking-tight">
              Overview de Crédito
            </h1>
            <span className="text-[9px] text-zinc-600 font-mono hidden sm:inline">
              {kpis.length} indicadores · 40 séries · BACEN SGS
            </span>
          </div>

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
      {activeTab !== "overview" && activeTab !== "produtos" && <AlertCard kpis={kpis} module="credito" />}

      {/* ─── Overview Mensal (full-page view) ─── */}
      {activeTab === "overview" && <CreditOverviewMensal period={period} />}

      {/* ─── Produtos (full-page view) ─── */}
      {activeTab === "produtos" && <CreditProductPanel />}

      {/* ─── KPI Cards Grid ─── */}
      {activeTab !== "overview" && activeTab !== "produtos" && <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
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
      </div>}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* H1.1b-1 — SALDOS DA CARTEIRA DE CRÉDITO                      */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {show(["saldos"]) && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <MacroChart
              data={saldoTotal}
              title="Saldo Total de Crédito — SFN"
              type="area"
              color={ACCENT}
              label="Saldo Total"
              unit=" R$ bi"
            />
            <MacroChart
              data={saldoPF.map((d, i) => ({
                ...d,
                value2: saldoPJLivres[i]?.value ?? d.value * 0.35,
              }))}
              title="Saldo PF vs PJ (Livres)"
              type="line"
              color={ACCENT}
              color2="#6366F1"
              label="PF Livres"
              label2="PJ Livres"
              unit=" R$ bi"
            />
          </div>
          {activeTab === "saldos" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <MacroChart
                data={veiculos}
                title="Crédito Veículos PF"
                type="bar"
                color="#F59E0B"
                label="Veículos"
                unit=" R$ bi"
              />
              <MacroChart
                data={cartaoCredito}
                title="Cartão de Crédito PF"
                type="area"
                color="#EF4444"
                label="Cartão PF"
                unit=" R$ bi"
              />
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* H1.1b-2 — CONCESSÕES DE CRÉDITO                               */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {show(["concessoes"]) && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <MacroChart
              data={concessaoPF}
              title="Concessões PF — Volume Mensal"
              type="bar"
              color={ACCENT}
              label="PF"
              unit=" R$ bi"
            />
            <MacroChart
              data={concessaoPJ}
              title="Concessões PJ — Volume Mensal"
              type="bar"
              color="#6366F1"
              label="PJ"
              unit=" R$ bi"
            />
          </div>
          {activeTab === "concessoes" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <MacroChart
                data={consignado}
                title="Crédito Consignado PF"
                type="area"
                color="#F59E0B"
                label="Consignado"
                unit=" R$ bi"
              />
              <MacroChart
                data={concessoesMoM}
                title="Concessões PF — Variação Mensal"
                type="bar"
                color={ACCENT}
                label="Var. %"
                unit="%"
              />
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* H1.1b-3 — TAXAS DE JUROS + CALCULADORA                        */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {show(["taxas"]) && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <MacroChart
              data={taxaPF.map((d, i) => ({
                ...d,
                value2: taxaPJ[i]?.value ?? d.value * 0.46,
              }))}
              title="Taxas Médias — PF vs PJ"
              type="line"
              color="#EF4444"
              color2="#6366F1"
              label="PF"
              label2="PJ"
              unit="% a.a."
            />
            <MacroChart
              data={taxaVeiculos.map((d, i) => ({
                ...d,
                value2: taxaMicro[i]?.value ?? d.value * 1.7,
              }))}
              title="Taxas — Veículos PF vs Microempresas"
              type="line"
              color="#F59E0B"
              color2="#10B981"
              label="Veículos"
              label2="Micro"
              unit="% a.a."
            />
          </div>
          {activeTab === "taxas" && (
            <InterestCalculator
              currentTaxaPF={kpis.find((k) => k.serie_code === "20714")?.last_value}
              currentTaxaPJ={kpis.find((k) => k.serie_code === "20715")?.last_value}
              currentSelic={14.25}
            />
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* H1.1b-4 — RADAR DE INADIMPLÊNCIA                              */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {show(["inadimplencia"]) && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <MacroChart
              data={inadTotal}
              title="Inadimplência — Taxa Total SFN (>90 dias)"
              type="area"
              color="#EF4444"
              label="Total"
              unit="%"
            />
            <MacroChart
              data={inadPF.map((d, i) => ({
                ...d,
                value2: inadPJ[i]?.value ?? d.value * 0.58,
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
          {activeTab === "inadimplencia" && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <MacroChart
                  data={inadSFN}
                  title="Inadimplência SFN Agregada"
                  type="area"
                  color="#F59E0B"
                  label="SFN"
                  unit="%"
                />
                <MacroChart
                  data={inadSMA}
                  title="Inadimplência Total — Média Móvel 3m"
                  type="line"
                  color="#10B981"
                  label="SMA(3)"
                  unit="%"
                />
              </div>
              <DefaultRadar
                inadTotal={kpis.find((k) => k.serie_code === "21082")?.last_value}
                inadPF={kpis.find((k) => k.serie_code === "21083")?.last_value}
                inadPJ={kpis.find((k) => k.serie_code === "21084")?.last_value}
                inadPublico={kpis.find((k) => k.serie_code === "13667")?.last_value}
                inadPrivado={kpis.find((k) => k.serie_code === "13685")?.last_value}
                inadDirecionadosPF={kpis.find((k) => k.serie_code === "21154")?.last_value}
              />
            </>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* H1.1b-5 — MONITOR DE SPREADS                                   */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {show(["spreads"]) && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <MacroChart
              data={spreadPF}
              title="Spread Bancário — Pessoa Física"
              type="area"
              color={ACCENT}
              label="Spread PF"
              unit=" p.p."
            />
            <MacroChart
              data={spreadPJ}
              title="Spread Bancário — Pessoa Jurídica"
              type="area"
              color="#6366F1"
              label="Spread PJ"
              unit=" p.p."
            />
          </div>
          {activeTab === "spreads" && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <MacroChart
                  data={spreadPos.map((d, i) => ({
                    ...d,
                    value2: spreadPre[i]?.value ?? d.value * 1.3,
                  }))}
                  title="Spread Pós-fixadas vs Pré-fixadas"
                  type="line"
                  color="#F59E0B"
                  color2="#EF4444"
                  label="Pós"
                  label2="Pré"
                  unit=" p.p."
                />
                <MacroChart
                  data={sma(spreadPF, 3)}
                  title="Spread PF — Média Móvel 3m"
                  type="line"
                  color={ACCENT}
                  label="SMA(3)"
                  unit=" p.p."
                />
              </div>
              <SpreadMonitor
                spreadPF={kpis.find((k) => k.serie_code === "20783")?.last_value}
                spreadPJ={kpis.find((k) => k.serie_code === "20784")?.last_value}
                spreadLivresPF={kpis.find((k) => k.serie_code === "20785")?.last_value}
                spreadLivresPJ={kpis.find((k) => k.serie_code === "20786")?.last_value}
                spreadDirecionados={kpis.find((k) => k.serie_code === "20787")?.last_value}
                spreadPos={kpis.find((k) => k.serie_code === "20826")?.last_value}
                spreadPre={kpis.find((k) => k.serie_code === "20837")?.last_value}
              />
            </>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* H1.1b-6 — OUTROS INDICADORES                                   */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {show(["outros"]) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <MacroChart
            data={cartoes}
            title="Cartões de Crédito Emitidos"
            type="bar"
            color={ACCENT}
            label="Emissão"
            unit=" mi"
          />
          <MacroChart
            data={creditoPib}
            title="Relação Crédito / PIB"
            type="area"
            color="#F59E0B"
            label="Crédito/PIB"
            unit="%"
          />
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* H1.1b-7 — ANALYTICS (Correlações + Benchmarks + Insights)      */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {activeTab === "analytics" && (
        <>
          {/* Correlation Panel */}
          <CreditCorrelationPanel
            series={[
              { label: "Inadim. Total", data: inadTotal },
              { label: "Spread PF", data: spreadPF },
              { label: "Taxa PF", data: taxaPF },
              { label: "Concessões PF", data: concessaoPF },
              { label: "Saldo Total", data: saldoTotal },
              { label: "Crédito/PIB", data: creditoPib },
            ]}
          />

          {/* Benchmarks vs Targets */}
          <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-4">
            <h3 className="text-sm font-bold text-zinc-100 mb-3">Benchmarks vs Metas</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: "Inadimplência Total", current: kpis.find((k) => k.serie_code === "21082")?.last_value ?? 3.3, target: 3.0, unit: "%", good: "lower" as const },
                { label: "Crédito/PIB", current: kpis.find((k) => k.serie_code === "20539")?.last_value ?? 54.2, target: 55.0, unit: "%", good: "higher" as const },
                { label: "Spread PF", current: kpis.find((k) => k.serie_code === "20783")?.last_value ?? 30.2, target: 25.0, unit: "p.p.", good: "lower" as const },
                { label: "Concessões PF (R$ bi)", current: kpis.find((k) => k.serie_code === "20631")?.last_value ?? 254.3, target: 270.0, unit: "R$ bi", good: "higher" as const },
              ].map((b) => {
                const pct = Math.min((b.current / b.target) * 100, 150);
                const isGood = b.good === "lower" ? b.current <= b.target : b.current >= b.target;
                return (
                  <div key={b.label} className="bg-[#0a0a0a] border border-[#141414] rounded p-3">
                    <div className="flex justify-between text-[10px] font-mono mb-1.5">
                      <span className="text-zinc-400">{b.label}</span>
                      <span className={isGood ? "text-emerald-400" : "text-amber-400"}>
                        {b.current.toFixed(1)} / {b.target.toFixed(1)} {b.unit}
                      </span>
                    </div>
                    <div className="h-2 bg-[#111] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(pct, 100)}%`,
                          backgroundColor: isGood ? "#10B981" : "#F59E0B",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cross-module insights */}
          <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-4">
            <h3 className="text-sm font-bold text-zinc-100 mb-3">Insights Cross-Módulo</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                {
                  title: "Spreads × Selic",
                  text: "Spreads tendem a aumentar com ciclos de alta da Selic, comprimindo margem do tomador de crédito.",
                  color: "border-amber-500/20 bg-amber-500/5",
                  textColor: "text-amber-400",
                },
                {
                  title: "Inadimplência × Desemprego",
                  text: "Correlação histórica forte entre taxa de desocupação e inadimplência PF. Monitorar PNAD trimestral.",
                  color: "border-red-500/20 bg-red-500/5",
                  textColor: "text-red-400",
                },
                {
                  title: "Concessões → Atividade",
                  text: "Volume de concessões é indicador antecedente de atividade econômica (IBC-Br) com lag de ~2 meses.",
                  color: "border-emerald-500/20 bg-emerald-500/5",
                  textColor: "text-emerald-400",
                },
                {
                  title: "Crédito/PIB — Tendência",
                  text: "Relação crédito/PIB em tendência de alta, aproximando-se de ~55%. Acima de 60% sinaliza risco sistêmico.",
                  color: "border-blue-500/20 bg-blue-500/5",
                  textColor: "text-blue-400",
                },
              ].map((insight) => (
                <div key={insight.title} className={`rounded border p-3 ${insight.color}`}>
                  <div className={`text-[10px] font-mono font-bold ${insight.textColor}`}>{insight.title}</div>
                  <div className="text-[9px] text-zinc-500 mt-1">{insight.text}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ─── Source footer ─── */}
      <div className="border-t border-[#141414] pt-3 flex items-center justify-between text-[9px] text-zinc-700 font-mono">
        <span>Fonte: Banco Central do Brasil — SGS · 40 séries ativas</span>
        <span>Atualização: Mensal (último dia útil)</span>
      </div>
    </div>
  );
};

export default HubCredito;
