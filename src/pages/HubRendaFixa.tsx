import { useState, useMemo } from "react";
import { KPICard } from "@/components/hub/KPICard";
import { MacroChart } from "@/components/hub/MacroChart";
import { AlertCard } from "@/components/hub/AlertCard";
import { BondCalculator } from "@/components/hub/BondCalculator";
import { SpreadCreditoPrivado } from "@/components/hub/SpreadCreditoPrivado";
import {
  useHubLatest,
  useHubSeries,
  RENDA_FIXA_SAMPLE,
  generateSampleSeries,
} from "@/hooks/useHubData";
import {
  LayoutGrid, TrendingUp, Banknote, Landmark, Calculator, LineChart as LineChartIcon,
  Brain, BarChart3,
} from "lucide-react";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area,
} from "recharts";

/* ─── Period & Tab configs ─── */
const PERIODS = ["3m", "6m", "1y", "2y", "5y"] as const;

const SUBCATEGORIES = [
  { id: "all", label: "Visão Geral", icon: LayoutGrid },
  { id: "taxas", label: "Taxas de Referência", icon: Banknote },
  { id: "curva", label: "Curva de Juros", icon: LineChartIcon },
  { id: "tesouro", label: "Tesouro Direto", icon: TrendingUp },
  { id: "ntnb", label: "NTN-B / IPCA+", icon: BarChart3 },
  { id: "credpriv", label: "Crédito Privado", icon: Landmark },
  { id: "calculadora", label: "Calculadora", icon: Calculator },
  { id: "analytics", label: "Analytics", icon: Brain },
] as const;

const catMap: Record<string, string[]> = {
  taxas: ["taxa_ref", "poupanca"],
  curva: ["curva_di"],
  tesouro: ["tesouro"],
  ntnb: ["ntnb", "breakeven"],
  credpriv: ["credpriv"],
};

/* ─── Sparkline helper ─── */
function toSparkline(series: { date: string; value: number }[], points = 20) {
  if (!series.length) return [];
  const step = Math.max(1, Math.floor(series.length / points));
  return series.filter((_, i) => i % step === 0).map((d) => ({ value: d.value }));
}

/* ─── Tooltip for yield curve ─── */
function CurveTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-2 shadow-xl">
      <div className="text-[9px] text-zinc-500 font-mono mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="text-[10px] font-mono">
          <span style={{ color: p.color }}>{p.name}:</span>{" "}
          <span className="text-zinc-100 font-bold">{typeof p.value === "number" ? p.value.toFixed(2) + "%" : p.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Accent colors ─── */
const ACCENT = "#10B981";
const INDIGO = "#6366F1";
const AMBER = "#F59E0B";
const RED = "#EF4444";

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT — HubRendaFixa (H1.3)
   ═══════════════════════════════════════════════════════════════════════════ */
const HubRendaFixa = () => {
  const [period, setPeriod] = useState<string>("1y");
  const [activeTab, setActiveTab] = useState<string>("all");

  const show = (tabs: string[]) =>
    (activeTab === "all" || tabs.includes(activeTab)) && activeTab !== "calculadora" && activeTab !== "credpriv";

  /* ─── KPI Cards ─── */
  const { isLoading: cardsLoading } = useHubLatest("macro"); // renda fixa shares macro API for now
  const kpis = RENDA_FIXA_SAMPLE; // Use dedicated sample data

  /* ─── Series data — Taxas de referência ─── */
  const { data: selicData } = useHubSeries("selic", period, "macro");
  const { data: cdiData } = useHubSeries("cdi", period, "macro");
  const { data: trData } = useHubSeries("tr", period, "macro");
  const { data: tlpData } = useHubSeries("tlp", period, "macro");

  const selic = selicData?.length ? selicData : generateSampleSeries(14.25, 24, 0.008);
  const cdi = cdiData?.length ? cdiData : generateSampleSeries(14.15, 24, 0.008);
  const tr = trData?.length ? trData : generateSampleSeries(0.18, 24, 0.15);
  const tlp = tlpData?.length ? tlpData : generateSampleSeries(7.10, 24, 0.02);

  /* ─── Series data — DI Curve (Swaps) ─── */
  const { data: di30Data } = useHubSeries("di_pre_30", period, "macro");
  const { data: di360Data } = useHubSeries("di_pre_360", period, "macro");
  const { data: di720Data } = useHubSeries("di_pre_720", period, "macro");
  const { data: di1800Data } = useHubSeries("di_pre_1800", period, "macro");

  const di30 = di30Data?.length ? di30Data : generateSampleSeries(14.18, 24, 0.01);
  const di360 = di360Data?.length ? di360Data : generateSampleSeries(14.82, 24, 0.012);
  const di720 = di720Data?.length ? di720Data : generateSampleSeries(14.55, 24, 0.015);
  const di1800 = di1800Data?.length ? di1800Data : generateSampleSeries(13.65, 24, 0.018);

  /* ─── Series data — NTN-B ─── */
  const { data: ntnb2029Data } = useHubSeries("ntnb_2029", period, "macro");
  const { data: ntnb2035Data } = useHubSeries("ntnb_2035", period, "macro");
  const { data: ntnb2045Data } = useHubSeries("ntnb_2045", period, "macro");

  const ntnb2029 = ntnb2029Data?.length ? ntnb2029Data : generateSampleSeries(7.25, 24, 0.015);
  const ntnb2035 = ntnb2035Data?.length ? ntnb2035Data : generateSampleSeries(7.10, 24, 0.012);
  const ntnb2045 = ntnb2045Data?.length ? ntnb2045Data : generateSampleSeries(6.85, 24, 0.010);

  /* ─── Breakeven inflation ─── */
  const { data: bei1Data } = useHubSeries("bei_1a", period, "macro");
  const { data: bei3Data } = useHubSeries("bei_3a", period, "macro");
  const { data: bei5Data } = useHubSeries("bei_5a", period, "macro");

  const bei1 = bei1Data?.length ? bei1Data : generateSampleSeries(5.82, 24, 0.02);
  const bei3 = bei3Data?.length ? bei3Data : generateSampleSeries(5.35, 24, 0.015);
  const bei5 = bei5Data?.length ? bei5Data : generateSampleSeries(5.10, 24, 0.012);

  /* ─── Tesouro Direto ─── */
  const { data: estoqueTDData } = useHubSeries("estoque_td", period, "macro");
  const { data: vendasTDData } = useHubSeries("vendas_td", period, "macro");

  const estoqueTD = estoqueTDData?.length ? estoqueTDData : generateSampleSeries(142.5, 24, 0.012);
  const vendasTD = vendasTDData?.length ? vendasTDData : generateSampleSeries(3.85, 24, 0.1);

  /* ─── Crédito Privado ─── */
  const { data: spreadAAData } = useHubSeries("spread_aa", period, "macro");
  const { data: spreadAData } = useHubSeries("spread_a", period, "macro");
  const { data: emissaoData } = useHubSeries("emissoes_debentures", period, "macro");

  const spreadAASeries = spreadAAData?.length ? spreadAAData : generateSampleSeries(1.35, 24, 0.04);
  const spreadASeries = spreadAData?.length ? spreadAData : generateSampleSeries(2.10, 24, 0.05);
  const emissoesSeries = emissaoData?.length ? emissaoData : generateSampleSeries(28.4, 24, 0.08);

  /* ─── Poupança ─── */
  const { data: poupancaData } = useHubSeries("poupanca", period, "macro");
  const poupanca = poupancaData?.length ? poupancaData : generateSampleSeries(7.45, 24, 0.005);

  /* ─── Sparkline map ─── */
  const sparklineMap = useMemo(() => {
    const map: Record<string, { value: number }[]> = {};
    map["432"] = toSparkline(selic);
    map["4189"] = toSparkline(selic);
    map["4392"] = toSparkline(cdi);
    map["226"] = toSparkline(tr);
    map["27547"] = toSparkline(tlp);
    map["256"] = toSparkline(tlp);
    map["7813"] = toSparkline(di30);
    map["7814"] = toSparkline(di30);
    map["7815"] = toSparkline(di30);
    map["7816"] = toSparkline(di360);
    map["7817"] = toSparkline(di360);
    map["7818"] = toSparkline(di720);
    map["7819"] = toSparkline(di720);
    map["7820"] = toSparkline(di1800);
    map["7821"] = toSparkline(di1800);
    map["12460"] = toSparkline(ntnb2029);
    map["12461"] = toSparkline(ntnb2035);
    map["12462"] = toSparkline(ntnb2045);
    map["12463"] = toSparkline(ntnb2045);
    map["990101"] = toSparkline(bei1);
    map["990102"] = toSparkline(bei3);
    map["990103"] = toSparkline(bei5);
    map["195"] = toSparkline(poupanca);
    map["990201"] = toSparkline(estoqueTD);
    map["990202"] = toSparkline(vendasTD);
    map["990203"] = toSparkline(estoqueTD);
    map["990301"] = toSparkline(spreadAASeries);
    map["990302"] = toSparkline(spreadASeries);
    map["990303"] = toSparkline(emissoesSeries);
    map["990304"] = toSparkline(emissoesSeries);
    return map;
  }, [selic, cdi, tr, tlp, di30, di360, di720, di1800, ntnb2029, ntnb2035, ntnb2045, bei1, bei3, bei5, poupanca, estoqueTD, vendasTD, spreadAASeries, spreadASeries, emissoesSeries]);

  /* ─── Filter KPIs ─── */
  const filteredKPIs = useMemo(() => {
    if (activeTab === "all" || activeTab === "analytics" || activeTab === "calculadora" || activeTab === "credpriv") return kpis;
    return kpis.filter((k) =>
      catMap[activeTab]?.some((c) => k.category.includes(c))
    );
  }, [activeTab, kpis]);

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: kpis.length, analytics: kpis.length, calculadora: 3, credpriv: 4 };
    Object.entries(catMap).forEach(([tab, cats]) => {
      counts[tab] = kpis.filter((k) => cats.some((c) => k.category.includes(c))).length;
    });
    return counts;
  }, [kpis]);

  /* ─── Yield Curve snapshot (static latest values) ─── */
  const yieldCurveData = useMemo(() => {
    const vertices = [
      { tenor: "30d", days: 30, rate: kpis.find((k) => k.serie_code === "7813")?.last_value ?? 14.18 },
      { tenor: "60d", days: 60, rate: kpis.find((k) => k.serie_code === "7814")?.last_value ?? 14.32 },
      { tenor: "90d", days: 90, rate: kpis.find((k) => k.serie_code === "7815")?.last_value ?? 14.48 },
      { tenor: "180d", days: 180, rate: kpis.find((k) => k.serie_code === "7816")?.last_value ?? 14.65 },
      { tenor: "1a", days: 360, rate: kpis.find((k) => k.serie_code === "7817")?.last_value ?? 14.82 },
      { tenor: "2a", days: 720, rate: kpis.find((k) => k.serie_code === "7818")?.last_value ?? 14.55 },
      { tenor: "3a", days: 1080, rate: kpis.find((k) => k.serie_code === "7819")?.last_value ?? 14.20 },
      { tenor: "4a", days: 1440, rate: kpis.find((k) => k.serie_code === "7820")?.last_value ?? 13.90 },
      { tenor: "5a", days: 1800, rate: kpis.find((k) => k.serie_code === "7821")?.last_value ?? 13.65 },
    ];
    return vertices;
  }, [kpis]);

  /* Curve shape analysis */
  const curveShape = useMemo(() => {
    const short = yieldCurveData[0]?.rate ?? 0;
    const mid = yieldCurveData[4]?.rate ?? 0;
    const long = yieldCurveData[8]?.rate ?? 0;

    if (mid > short && long > mid) return { shape: "Normal (positiva)", color: "text-emerald-400", desc: "Curto < Longo — mercado espera aperto gradual ou normalização." };
    if (mid > short && long < mid) return { shape: "Corcova (hump)", color: "text-amber-400", desc: "Taxa de pico no meio da curva — mercado precifica Selic alta no curto e cortes futuros." };
    if (mid < short && long < short) return { shape: "Invertida", color: "text-red-400", desc: "Curto > Longo — mercado precifica cortes agressivos de Selic ou recessão." };
    return { shape: "Flat", color: "text-zinc-400", desc: "Curva relativamente plana — incerteza sobre direção de política monetária." };
  }, [yieldCurveData]);

  return (
    <div className="space-y-4 max-w-[1400px]">
      {/* ─── Sticky header ─── */}
      <div className="sticky top-14 z-20 bg-[#0a0a0a]/95 backdrop-blur-sm -mx-6 px-6 py-3 border-b border-[#141414]">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold text-zinc-100 tracking-tight">Renda Fixa</h1>
            <span className="text-[9px] text-zinc-600 font-mono hidden sm:inline">
              {kpis.length} indicadores · Curva DI · NTN-B · Crédito Privado
            </span>
          </div>
          <div className="flex items-center gap-0.5 bg-[#111111] border border-[#1a1a1a] rounded-md p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2 py-1 text-[10px] font-mono rounded transition-colors ${
                  period === p ? "bg-[#10B981] text-white" : "text-zinc-600 hover:text-zinc-300"
                }`}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

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
                <span className={`text-[9px] px-1 rounded ${isActive ? "bg-[#10B981]/20 text-[#10B981]" : "bg-[#1a1a1a] text-zinc-600"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Alerts ─── */}
      {activeTab !== "calculadora" && activeTab !== "credpriv" && (
        <AlertCard kpis={kpis} module="macro" />
      )}

      {/* ─── KPI Cards ─── */}
      {activeTab !== "calculadora" && activeTab !== "credpriv" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {filteredKPIs.map((card) => (
            <KPICard
              key={card.serie_code}
              title={card.display_name}
              value={card.last_value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
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

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* H1.3-1 — TAXAS DE REFERÊNCIA                                   */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {show(["taxas"]) && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <MacroChart
              data={selic.map((d, i) => ({ ...d, value2: cdi[i]?.value ?? d.value - 0.1 }))}
              title="Selic Over vs CDI"
              type="line"
              color={ACCENT}
              color2={INDIGO}
              label="Selic"
              label2="CDI"
              unit="% a.a."
            />
            <MacroChart
              data={tlp.map((d, i) => ({ ...d, value2: poupanca[i]?.value ?? d.value * 1.05 }))}
              title="TLP vs Poupança"
              type="line"
              color={AMBER}
              color2="#EC4899"
              label="TLP"
              label2="Poupança"
              unit="% a.a."
            />
          </div>
          {activeTab === "taxas" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <MacroChart
                data={tr}
                title="Taxa Referencial (TR)"
                type="area"
                color={ACCENT}
                label="TR"
                unit="%"
              />
              <MacroChart
                data={poupanca}
                title="Poupança — Rendimento Equivalente"
                type="area"
                color="#EC4899"
                label="Poupança"
                unit="% a.a."
              />
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* H1.3-2 — CURVA DE JUROS (Yield Curve)                          */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {show(["curva"]) && (
        <>
          {/* Static Yield Curve snapshot */}
          <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <LineChartIcon className="w-4 h-4 text-[#10B981]" />
                <span className="text-sm font-bold text-zinc-100">Curva DI — Swap Pré x DI</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-mono font-bold ${curveShape.color}`}>{curveShape.shape}</span>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={yieldCurveData}>
                <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="tenor"
                  tick={{ fill: "#52525b", fontSize: 9, fontFamily: "monospace" }}
                  axisLine={{ stroke: "#1a1a1a" }}
                  tickLine={false}
                />
                <YAxis
                  domain={["dataMin - 0.5", "dataMax + 0.3"]}
                  tick={{ fill: "#52525b", fontSize: 9, fontFamily: "monospace" }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                  tickFormatter={(v: number) => `${v.toFixed(1)}%`}
                />
                <Tooltip content={<CurveTooltip />} />
                <Area
                  type="monotone"
                  dataKey="rate"
                  stroke={ACCENT}
                  fill={ACCENT}
                  fillOpacity={0.08}
                  strokeWidth={2}
                  dot={{ r: 3, fill: ACCENT, stroke: "#0a0a0a", strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: ACCENT }}
                  name="Taxa DI"
                />
              </AreaChart>
            </ResponsiveContainer>

            <div className="mt-2 text-[9px] text-zinc-600 font-mono">{curveShape.desc}</div>
          </div>

          {/* DI vertex evolution over time */}
          {activeTab === "curva" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <MacroChart
                data={di30.map((d, i) => ({ ...d, value2: di360[i]?.value ?? d.value + 0.5 }))}
                title="DI 30d vs DI 360d — Evolução"
                type="line"
                color={ACCENT}
                color2={INDIGO}
                label="DI 30d"
                label2="DI 360d"
                unit="% a.a."
              />
              <MacroChart
                data={di720.map((d, i) => ({ ...d, value2: di1800[i]?.value ?? d.value - 0.8 }))}
                title="DI 720d vs DI 1800d — Evolução"
                type="line"
                color={AMBER}
                color2={RED}
                label="DI 2a"
                label2="DI 5a"
                unit="% a.a."
              />
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* H1.3-3 — TESOURO DIRETO                                        */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {show(["tesouro"]) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <MacroChart
            data={estoqueTD}
            title="Estoque Tesouro Direto"
            type="area"
            color={ACCENT}
            label="Estoque"
            unit=" R$ bi"
          />
          <MacroChart
            data={vendasTD}
            title="Vendas Líquidas TD — Mensal"
            type="bar"
            color={INDIGO}
            label="Vendas"
            unit=" R$ bi"
          />
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* H1.3-4 — NTN-B / IPCA+ & Breakeven Inflation                   */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {show(["ntnb"]) && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <MacroChart
              data={ntnb2029.map((d, i) => ({
                ...d,
                value2: ntnb2035[i]?.value ?? d.value - 0.15,
              }))}
              title="NTN-B 2029 vs 2035 (Taxa Real)"
              type="line"
              color={ACCENT}
              color2={INDIGO}
              label="2029"
              label2="2035"
              unit="% a.a."
            />
            <MacroChart
              data={ntnb2045}
              title="NTN-B 2045 — Taxa Real IPCA+"
              type="area"
              color={AMBER}
              label="2045"
              unit="% a.a."
            />
          </div>

          {(activeTab === "ntnb" || activeTab === "all") && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <MacroChart
                data={bei1.map((d, i) => ({
                  ...d,
                  value2: bei5[i]?.value ?? d.value - 0.7,
                }))}
                title="Inflação Implícita — 1 Ano vs 5 Anos"
                type="line"
                color={RED}
                color2={INDIGO}
                label="1 ano"
                label2="5 anos"
                unit="%"
              />
              <MacroChart
                data={bei3}
                title="Breakeven Inflation — 3 Anos"
                type="area"
                color={AMBER}
                label="BEI 3a"
                unit="%"
              />
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* H1.3-5 — CRÉDITO PRIVADO (full-page view)                      */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {activeTab === "credpriv" && (
        <SpreadCreditoPrivado
          spreadAA={kpis.find((k) => k.serie_code === "990301")?.last_value}
          spreadA={kpis.find((k) => k.serie_code === "990302")?.last_value}
          emissoes={kpis.find((k) => k.serie_code === "990303")?.last_value}
          estoqueCRACRI={kpis.find((k) => k.serie_code === "990304")?.last_value}
          spreadAASeries={spreadAASeries}
          spreadASeries={spreadASeries}
          emissoesSeries={emissoesSeries}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* H1.3-6 — CALCULADORA (full-page view)                          */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {activeTab === "calculadora" && (
        <BondCalculator
          currentSelic={kpis.find((k) => k.serie_code === "432")?.last_value ?? 14.25}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* H1.3-7 — ANALYTICS                                             */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {activeTab === "analytics" && (
        <>
          {/* NTN-B Term Structure */}
          <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-[#10B981]" />
              <span className="text-sm font-bold text-zinc-100">Estrutura a Termo — NTN-B (IPCA+ Real)</span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart
                data={[
                  { tenor: "2029", rate: kpis.find((k) => k.serie_code === "12460")?.last_value ?? 7.25 },
                  { tenor: "2035", rate: kpis.find((k) => k.serie_code === "12461")?.last_value ?? 7.10 },
                  { tenor: "2045", rate: kpis.find((k) => k.serie_code === "12462")?.last_value ?? 6.85 },
                  { tenor: "2055", rate: kpis.find((k) => k.serie_code === "12463")?.last_value ?? 6.70 },
                ]}
              >
                <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="tenor" tick={{ fill: "#52525b", fontSize: 9, fontFamily: "monospace" }} axisLine={{ stroke: "#1a1a1a" }} tickLine={false} />
                <YAxis domain={["dataMin - 0.3", "dataMax + 0.3"]} tick={{ fill: "#52525b", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false} width={40} tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
                <Tooltip content={<CurveTooltip />} />
                <Area type="monotone" dataKey="rate" stroke={INDIGO} fill={INDIGO} fillOpacity={0.08} strokeWidth={2} dot={{ r: 3, fill: INDIGO, stroke: "#0a0a0a", strokeWidth: 2 }} name="IPCA+ Real" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Benchmarks */}
          <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-4">
            <h3 className="text-sm font-bold text-zinc-100 mb-3">Benchmarks vs Metas</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: "Selic Meta", current: kpis.find((k) => k.serie_code === "432")?.last_value ?? 14.25, target: 12.50, unit: "% a.a.", good: "lower" as const },
                { label: "NTN-B 2035 (real)", current: kpis.find((k) => k.serie_code === "12461")?.last_value ?? 7.10, target: 6.0, unit: "% a.a.", good: "lower" as const },
                { label: "Breakeven 1a", current: kpis.find((k) => k.serie_code === "990101")?.last_value ?? 5.82, target: 4.50, unit: "%", good: "lower" as const },
                { label: "Spread AA", current: kpis.find((k) => k.serie_code === "990301")?.last_value ?? 1.35, target: 1.20, unit: "p.p.", good: "lower" as const },
              ].map((b) => {
                const pct = Math.min((b.current / b.target) * 100, 150);
                const isGood = b.good === "lower" ? b.current <= b.target : b.current >= b.target;
                return (
                  <div key={b.label} className="bg-[#0a0a0a] border border-[#141414] rounded p-3">
                    <div className="flex justify-between text-[10px] font-mono mb-1.5">
                      <span className="text-zinc-400">{b.label}</span>
                      <span className={isGood ? "text-emerald-400" : "text-amber-400"}>
                        {b.current.toFixed(2)} / {b.target.toFixed(2)} {b.unit}
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

          {/* Cross-module Insights */}
          <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-4">
            <h3 className="text-sm font-bold text-zinc-100 mb-3">Insights Renda Fixa</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { title: "Curva Invertida → Cortes", text: "Quando DI longo < DI curto, o mercado precifica cortes de Selic. Títulos prefixados longos podem ter ganho de capital.", color: "border-emerald-500/20 bg-emerald-500/5", textColor: "text-emerald-400" },
                { title: "NTN-B × Fiscal", text: "Taxas reais NTN-B acima de 7% refletem prêmio de risco fiscal elevado. Correlação com dívida/PIB é positiva.", color: "border-red-500/20 bg-red-500/5", textColor: "text-red-400" },
                { title: "Breakeven → Expectativas", text: "Inflação implícita de 1 ano acima da meta de 3% sinaliza desancoragem de expectativas. Monitorar Focus semanal.", color: "border-amber-500/20 bg-amber-500/5", textColor: "text-amber-400" },
                { title: "Spread Privado × Ciclo", text: "Compressão de spreads coincide com ciclos de afrouxamento monetário. Alargamento pode antecipar stress de crédito.", color: "border-blue-500/20 bg-blue-500/5", textColor: "text-blue-400" },
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

      {/* ─── Footer ─── */}
      <div className="border-t border-[#141414] pt-3 flex items-center justify-between text-[9px] text-zinc-700 font-mono">
        <span>Fonte: BACEN SGS · ANBIMA · Tesouro Nacional</span>
        <span>Atualização: Diária (D+1 útil)</span>
      </div>
    </div>
  );
};

export default HubRendaFixa;
