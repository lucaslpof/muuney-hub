import { useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Calculator, TrendingUp, TrendingDown, Clock, BarChart3, GitCompare } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   CALCULADORA DE RENDA FIXA v2
   Preço/Taxa · Duration · Convexidade · Cenários · Heatmap · MaM
   ═══════════════════════════════════════════════════════════════════════════ */

type TipoTitulo = "prefixado" | "ipca" | "selic";

interface CashFlow {
  period: number;
  date: string;
  coupon: number;
  principal: number;
  total: number;
  pv: number;
}

/* ─── Finance Math ─── */
function calcPrice(faceValue: number, rate: number, periods: number, couponRate: number): number {
  const r = rate / 100;
  const c = couponRate / 100;
  const coupon = faceValue * c;
  let price = 0;
  for (let t = 1; t <= periods; t++) {
    price += (t === periods ? coupon + faceValue : coupon) / Math.pow(1 + r, t);
  }
  return price;
}

function calcDurationConvexity(faceValue: number, rate: number, periods: number, couponRate: number) {
  const r = rate / 100;
  const c = couponRate / 100;
  const coupon = faceValue * c;
  let price = 0;
  let weightedSum = 0;
  let convexitySum = 0;
  for (let t = 1; t <= periods; t++) {
    const cf = t === periods ? coupon + faceValue : coupon;
    const pv = cf / Math.pow(1 + r, t);
    price += pv;
    weightedSum += t * pv;
    convexitySum += t * (t + 1) * pv;
  }
  const macaulay = weightedSum / price;
  const modified = macaulay / (1 + r);
  const convexity = convexitySum / (price * Math.pow(1 + r, 2));
  return { macaulay, modified, convexity, price };
}

function buildCashFlows(faceValue: number, rate: number, periods: number, couponRate: number): CashFlow[] {
  const r = rate / 100;
  const c = couponRate / 100;
  const coupon = faceValue * c;
  const flows: CashFlow[] = [];
  const now = new Date();
  for (let t = 1; t <= periods; t++) {
    const date = new Date(now);
    date.setMonth(date.getMonth() + t * 6);
    const principal = t === periods ? faceValue : 0;
    const total = coupon + principal;
    const pv = total / Math.pow(1 + r, t);
    flows.push({
      period: t,
      date: date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      coupon,
      principal,
      total,
      pv: Math.round(pv * 100) / 100,
    });
  }
  return flows;
}

function calcMaM(faceValue: number, purchaseRate: number, currentRate: number, periods: number, couponRate: number) {
  const priceCompra = calcPrice(faceValue, purchaseRate, periods, couponRate);
  const priceAtual = calcPrice(faceValue, currentRate, periods, couponRate);
  const ganho = priceAtual - priceCompra;
  const ganhoPct = (ganho / priceCompra) * 100;
  return { priceCompra, priceAtual, ganho, ganhoPct };
}

/* ─── Preset títulos ─── */
const PRESETS: Record<TipoTitulo, { label: string; couponRate: number; defaultRate: number; faceValue: number; defaultPeriods: number }> = {
  prefixado: { label: "Tesouro Prefixado", couponRate: 0, defaultRate: 14.82, faceValue: 1000, defaultPeriods: 4 },
  ipca: { label: "Tesouro IPCA+ (NTN-B)", couponRate: 2.96, defaultRate: 7.25, faceValue: 1000, defaultPeriods: 10 },
  selic: { label: "Tesouro Selic (LFT)", couponRate: 0, defaultRate: 0.10, faceValue: 1000, defaultPeriods: 6 },
};

/* ─── Scenario comparison presets ─── */
const SCENARIOS = [
  { label: "Curto", tipo: "prefixado" as TipoTitulo, periods: 2, rate: 14.50 },
  { label: "Médio", tipo: "ipca" as TipoTitulo, periods: 6, rate: 7.25 },
  { label: "Longo", tipo: "ipca" as TipoTitulo, periods: 20, rate: 6.85 },
];

/* ─── Tooltip ─── */
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-2 shadow-xl">
      <div className="text-[9px] text-zinc-500 font-mono mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="text-[10px] font-mono text-zinc-200">
          <span style={{ color: p.color }}>{p.name}:</span> R$ {p.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </div>
      ))}
    </div>
  );
}

/* ═══ MAIN COMPONENT ═══ */
export function BondCalculator({ currentSelic = 14.25 }: { currentSelic?: number }) {
  const [tipo, setTipo] = useState<TipoTitulo>("prefixado");
  const [rate, setRate] = useState(PRESETS.prefixado.defaultRate);
  const [periods, setPeriods] = useState(PRESETS.prefixado.defaultPeriods);
  const [purchaseRate, setPurchaseRate] = useState(PRESETS.prefixado.defaultRate);
  const [currentRate, setCurrentRate] = useState(PRESETS.prefixado.defaultRate - 0.5);
  const [activeView, setActiveView] = useState<"calculator" | "scenarios" | "mam">("calculator");

  const preset = PRESETS[tipo];

  const handleTipoChange = (t: TipoTitulo) => {
    setTipo(t);
    setRate(PRESETS[t].defaultRate);
    setPeriods(PRESETS[t].defaultPeriods);
    setPurchaseRate(PRESETS[t].defaultRate);
    setCurrentRate(PRESETS[t].defaultRate - 0.5);
  };

  /* ─── Calculations ─── */
  const { macaulay, modified, convexity, price } = useMemo(
    () => calcDurationConvexity(preset.faceValue, rate, periods, preset.couponRate),
    [rate, periods, preset]
  );
  const cashFlows = useMemo(() => buildCashFlows(preset.faceValue, rate, periods, preset.couponRate), [rate, periods, preset]);
  const mam = useMemo(() => calcMaM(preset.faceValue, purchaseRate, currentRate, periods, preset.couponRate), [purchaseRate, currentRate, periods, preset]);

  /* Sensitivity heatmap: 5 rates × 6 terms */
  const heatmap = useMemo(() => {
    const rateDeltas = [-2, -1, 0, 1, 2];
    const termDeltas = [-4, -2, 0, 2, 4, 8];
    return rateDeltas.map((rd) => ({
      rateLabel: `${(rate + rd).toFixed(1)}%`,
      cells: termDeltas.map((td) => {
        const p = Math.max(1, periods + td);
        const px = calcPrice(preset.faceValue, rate + rd, p, preset.couponRate);
        const chg = ((px - price) / price) * 100;
        return { periods: p, price: px, change: chg };
      }),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rate, periods, preset, price]);

  const termHeaders = [-4, -2, 0, 2, 4, 8].map((td) => Math.max(1, periods + td));

  /* Scenario comparison */
  const scenarioResults = useMemo(
    () =>
      SCENARIOS.map((sc) => {
        const p = PRESETS[sc.tipo];
        const res = calcDurationConvexity(p.faceValue, sc.rate, sc.periods, p.couponRate);
        return { ...sc, ...res };
      }),
    []
  );

  /* ─── Heatmap color ─── */
  function heatColor(change: number): string {
    if (change > 5) return "bg-emerald-500/20 text-emerald-400";
    if (change > 2) return "bg-emerald-500/10 text-emerald-400";
    if (change > 0) return "bg-emerald-500/5 text-emerald-400";
    if (change > -2) return "bg-red-500/5 text-red-400";
    if (change > -5) return "bg-red-500/10 text-red-400";
    return "bg-red-500/20 text-red-400";
  }

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-[#10B981]" />
          <span className="text-sm font-bold text-zinc-100">Calculadora de Renda Fixa</span>
          <span className="text-[9px] font-mono text-zinc-600">v2</span>
        </div>
        <div className="flex gap-1">
          {(["calculator", "scenarios", "mam"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setActiveView(v)}
              className={`px-2.5 py-1 text-[10px] font-mono rounded transition-colors ${
                activeView === v ? "bg-[#10B981]/15 text-[#10B981]" : "text-zinc-600 hover:text-zinc-300"
              }`}
            >
              {v === "calculator" ? "Preço / Duration" : v === "scenarios" ? "Comparador" : "Marcação a Mercado"}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Tipo selector */}
        {activeView !== "scenarios" && (
          <div className="flex gap-1">
            {(Object.entries(PRESETS) as [TipoTitulo, typeof PRESETS.prefixado][]).map(([key, p]) => (
              <button
                key={key}
                onClick={() => handleTipoChange(key)}
                className={`px-3 py-1.5 text-[10px] font-mono rounded-md transition-all ${
                  tipo === key
                    ? "bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30"
                    : "bg-zinc-900/50 text-zinc-500 border border-zinc-800/50 hover:text-zinc-300"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        {/* ─── CALCULATOR VIEW ─── */}
        {activeView === "calculator" && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[9px] text-zinc-600 font-mono mb-1">
                  Taxa ({tipo === "ipca" ? "real" : "nominal"}) % a.a.
                </label>
                <input type="range" min={0} max={tipo === "selic" ? 3 : 25} step={0.01} value={rate}
                  onChange={(e) => setRate(Number(e.target.value))} className="w-full accent-[#10B981]" />
                <span className="text-[11px] font-mono text-zinc-100 font-bold">{rate.toFixed(2)}%</span>
              </div>
              <div>
                <label className="block text-[9px] text-zinc-600 font-mono mb-1">Semestres até o vencimento</label>
                <input type="range" min={1} max={30} step={1} value={periods}
                  onChange={(e) => setPeriods(Number(e.target.value))} className="w-full accent-[#10B981]" />
                <span className="text-[11px] font-mono text-zinc-100 font-bold">{periods} sem. ({(periods / 2).toFixed(1)} anos)</span>
              </div>
              <div>
                <label className="block text-[9px] text-zinc-600 font-mono mb-1">Selic atual (ref.)</label>
                <span className="text-[11px] font-mono text-zinc-400">{currentSelic}% a.a.</span>
              </div>
            </div>

            {/* Results — 6 KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {[
                { label: "Preço Unitário", value: `R$ ${price.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: "text-emerald-400" },
                { label: "Duration Macaulay", value: `${macaulay.toFixed(2)} sem.`, sub: `${(macaulay / 2).toFixed(1)} anos`, color: "text-zinc-100" },
                { label: "Duration Modificada", value: modified.toFixed(4), color: "text-zinc-100" },
                { label: "Convexidade", value: convexity.toFixed(2), color: "text-indigo-400" },
                { label: "Cupom Semestral", value: preset.couponRate > 0 ? `${preset.couponRate}%` : "Zero Cupom", color: "text-zinc-400" },
                { label: "ΔP/Δy aprox.", value: `${(-(modified * 100) + 0.5 * convexity * 100).toFixed(2)} bps/1%`, color: "text-amber-400" },
              ].map((r) => (
                <div key={r.label} className="bg-[#0a0a0a] border border-zinc-800/30 rounded p-2.5">
                  <div className="text-[8px] text-zinc-600 font-mono">{r.label}</div>
                  <div className={`text-[12px] font-bold font-mono ${r.color}`}>{r.value}</div>
                  {r.sub && <div className="text-[8px] text-zinc-600 font-mono">{r.sub}</div>}
                </div>
              ))}
            </div>

            {/* Cash Flow Chart */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-3 h-3 text-[#10B981]" />
                <span className="text-[10px] font-bold text-zinc-300 font-mono">Fluxo de Caixa (VP)</span>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={cashFlows}>
                  <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "#52525b", fontSize: 8, fontFamily: "monospace" }} axisLine={{ stroke: "#1a1a1a" }} tickLine={false} />
                  <YAxis tick={{ fill: "#52525b", fontSize: 8, fontFamily: "monospace" }} axisLine={false} tickLine={false} width={50} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="pv" stroke="#10B981" strokeWidth={1.5} dot={{ r: 2, fill: "#10B981" }} name="VP" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Sensitivity Heatmap (rate × term) */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-3 h-3 text-[#6366F1]" />
                <span className="text-[10px] font-bold text-zinc-300 font-mono">Heatmap de Sensibilidade (Taxa × Prazo)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-800/30">
                      <th className="px-2 py-1.5 text-[8px] font-mono text-zinc-600 text-left">Taxa ↓ / Sem →</th>
                      {termHeaders.map((t) => (
                        <th key={t} className="px-2 py-1.5 text-[8px] font-mono text-zinc-600 text-center">{t} sem</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {heatmap.map((row) => (
                      <tr key={row.rateLabel} className="border-b border-[#111]">
                        <td className="px-2 py-1 text-[9px] font-mono text-zinc-400">{row.rateLabel}</td>
                        {row.cells.map((cell, ci) => (
                          <td key={ci} className={`px-2 py-1 text-[9px] font-mono text-center font-bold ${heatColor(cell.change)}`}>
                            {cell.change >= 0 ? "+" : ""}{cell.change.toFixed(1)}%
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-[8px] text-zinc-700 font-mono mt-1">Variação % do preço vs cenário base ({rate.toFixed(1)}% / {periods} sem)</div>
            </div>
          </>
        )}

        {/* ─── SCENARIOS VIEW ─── */}
        {activeView === "scenarios" && (
          <>
            <div className="flex items-center gap-2 mb-2">
              <GitCompare className="w-3.5 h-3.5 text-[#10B981]" />
              <span className="text-[10px] font-bold text-zinc-300 font-mono">Comparador de Títulos — 3 perfis</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {scenarioResults.map((sc, idx) => {
                const colors = ["text-emerald-400", "text-indigo-400", "text-amber-400"];
                const bgColors = ["bg-emerald-500/5", "bg-indigo-500/5", "bg-amber-500/5"];
                return (
                  <div key={sc.label} className={`rounded-lg border border-zinc-800/50 p-3 ${bgColors[idx]}`}>
                    <div className={`text-[11px] font-mono font-bold ${colors[idx]} mb-2`}>{sc.label}</div>
                    <div className="text-[9px] text-zinc-500 font-mono mb-2">
                      {PRESETS[sc.tipo].label} · {sc.rate}% · {sc.periods} sem ({(sc.periods / 2).toFixed(1)}a)
                    </div>
                    <div className="space-y-1.5">
                      {[
                        { label: "Preço", value: `R$ ${sc.price.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
                        { label: "Duration", value: `${sc.macaulay.toFixed(2)} sem (${(sc.macaulay / 2).toFixed(1)}a)` },
                        { label: "Mod. Duration", value: sc.modified.toFixed(4) },
                        { label: "Convexidade", value: sc.convexity.toFixed(2) },
                        { label: "Sensib. +1%", value: `${((-sc.modified + 0.5 * sc.convexity) * 1).toFixed(2)}%` },
                      ].map((r) => (
                        <div key={r.label} className="flex justify-between">
                          <span className="text-[8px] text-zinc-600 font-mono">{r.label}</span>
                          <span className="text-[9px] text-zinc-200 font-mono font-bold">{r.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="bg-[#0a0a0a] border border-zinc-800/30 rounded p-3 mt-2">
              <span className="text-[9px] text-zinc-600 font-mono">
                Títulos mais longos e com menor cupom têm maior duration e convexidade — mais sensíveis a variações de taxa.
                Em cenário de corte de juros, o título longo ganha mais; em alta, perde mais.
              </span>
            </div>
          </>
        )}

        {/* ─── MAM VIEW ─── */}
        {activeView === "mam" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] text-zinc-600 font-mono mb-1">Taxa de Compra (% a.a.)</label>
                <input type="range" min={0} max={tipo === "selic" ? 3 : 25} step={0.01} value={purchaseRate}
                  onChange={(e) => setPurchaseRate(Number(e.target.value))} className="w-full accent-[#F59E0B]" />
                <span className="text-[11px] font-mono text-amber-400 font-bold">{purchaseRate.toFixed(2)}%</span>
              </div>
              <div>
                <label className="block text-[9px] text-zinc-600 font-mono mb-1">Taxa Atual de Mercado (% a.a.)</label>
                <input type="range" min={0} max={tipo === "selic" ? 3 : 25} step={0.01} value={currentRate}
                  onChange={(e) => setCurrentRate(Number(e.target.value))} className="w-full accent-[#10B981]" />
                <span className="text-[11px] font-mono text-emerald-400 font-bold">{currentRate.toFixed(2)}%</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-[#0a0a0a] border border-zinc-800/30 rounded p-2.5">
                <div className="text-[8px] text-zinc-600 font-mono">PU Compra</div>
                <div className="text-[12px] font-bold font-mono text-amber-400">
                  R$ {mam.priceCompra.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="bg-[#0a0a0a] border border-zinc-800/30 rounded p-2.5">
                <div className="text-[8px] text-zinc-600 font-mono">PU Atual (MaM)</div>
                <div className="text-[12px] font-bold font-mono text-emerald-400">
                  R$ {mam.priceAtual.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="bg-[#0a0a0a] border border-zinc-800/30 rounded p-2.5">
                <div className="text-[8px] text-zinc-600 font-mono">Ganho / Perda</div>
                <div className={`text-[12px] font-bold font-mono flex items-center gap-1 ${mam.ganho >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {mam.ganho >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  R$ {Math.abs(mam.ganho).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="bg-[#0a0a0a] border border-zinc-800/30 rounded p-2.5">
                <div className="text-[8px] text-zinc-600 font-mono">Variação %</div>
                <div className={`text-[12px] font-bold font-mono ${mam.ganhoPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {mam.ganhoPct >= 0 ? "+" : ""}{mam.ganhoPct.toFixed(2)}%
                </div>
              </div>
            </div>

            <div className="bg-[#0a0a0a] border border-zinc-800/30 rounded p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Clock className="w-3 h-3 text-zinc-500" />
                <span className="text-[9px] font-mono font-bold text-zinc-400">Como funciona</span>
              </div>
              <p className="text-[9px] text-zinc-600 leading-relaxed">
                A <strong className="text-zinc-400">marcação a mercado</strong> recalcula o preço do título pela taxa atual.
                Se a taxa <strong className="text-emerald-400">caiu</strong>, o preço <strong className="text-emerald-400">subiu</strong> (ganho).
                Se a taxa <strong className="text-red-400">subiu</strong>, o preço <strong className="text-red-400">caiu</strong> (perda temporária).
                A <strong className="text-indigo-400">convexidade</strong> faz com que ganhos sejam maiores que perdas para variações iguais de taxa.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
