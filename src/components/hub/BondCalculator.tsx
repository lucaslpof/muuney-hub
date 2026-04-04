import { useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Calculator, TrendingUp, TrendingDown, Clock, BarChart3 } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   CALCULADORA DE RENDA FIXA — Preço/Taxa · Duration · Marcação a Mercado
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

function calcDuration(faceValue: number, rate: number, periods: number, couponRate: number): { macaulay: number; modified: number } {
  const r = rate / 100;
  const c = couponRate / 100;
  const coupon = faceValue * c;
  let price = 0;
  let weightedSum = 0;
  for (let t = 1; t <= periods; t++) {
    const cf = t === periods ? coupon + faceValue : coupon;
    const pv = cf / Math.pow(1 + r, t);
    price += pv;
    weightedSum += t * pv;
  }
  const macaulay = weightedSum / price;
  const modified = macaulay / (1 + r);
  return { macaulay, modified };
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

/* ─── Tooltip ─── */
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-2 shadow-xl">
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
export function BondCalculator({
  currentSelic = 14.25,
}: {
  currentSelic?: number;
}) {
  const [tipo, setTipo] = useState<TipoTitulo>("prefixado");
  const [rate, setRate] = useState(PRESETS.prefixado.defaultRate);
  const [periods, setPeriods] = useState(PRESETS.prefixado.defaultPeriods);
  const [purchaseRate, setPurchaseRate] = useState(PRESETS.prefixado.defaultRate);
  const [currentRate, setCurrentRate] = useState(PRESETS.prefixado.defaultRate - 0.5);
  const [activeView, setActiveView] = useState<"calculator" | "mam">("calculator");

  const preset = PRESETS[tipo];

  // When tipo changes, reset rates
  const handleTipoChange = (t: TipoTitulo) => {
    setTipo(t);
    setRate(PRESETS[t].defaultRate);
    setPeriods(PRESETS[t].defaultPeriods);
    setPurchaseRate(PRESETS[t].defaultRate);
    setCurrentRate(PRESETS[t].defaultRate - 0.5);
  };

  /* ─── Calculations ─── */
  const price = useMemo(() => calcPrice(preset.faceValue, rate, periods, preset.couponRate), [rate, periods, preset]);
  const { macaulay, modified } = useMemo(() => calcDuration(preset.faceValue, rate, periods, preset.couponRate), [rate, periods, preset]);
  const cashFlows = useMemo(() => buildCashFlows(preset.faceValue, rate, periods, preset.couponRate), [rate, periods, preset]);
  const mam = useMemo(() => calcMaM(preset.faceValue, purchaseRate, currentRate, periods, preset.couponRate), [purchaseRate, currentRate, periods, preset]);

  /* Sensitivity table: price at different rates */
  const sensitivity = useMemo(() => {
    const steps = [-2, -1, -0.5, 0, 0.5, 1, 2];
    return steps.map((delta) => {
      const r = rate + delta;
      const p = calcPrice(preset.faceValue, r, periods, preset.couponRate);
      const chg = ((p - price) / price) * 100;
      return { rate: r, price: p, change: chg, delta };
    });
  }, [rate, periods, preset, price]);

  return (
    <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-[#10B981]" />
          <span className="text-sm font-bold text-zinc-100">Calculadora de Renda Fixa</span>
        </div>
        <div className="flex gap-1">
          {(["calculator", "mam"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setActiveView(v)}
              className={`px-2.5 py-1 text-[10px] font-mono rounded transition-colors ${
                activeView === v ? "bg-[#10B981]/15 text-[#10B981]" : "text-zinc-600 hover:text-zinc-300"
              }`}
            >
              {v === "calculator" ? "Preço / Duration" : "Marcação a Mercado"}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Tipo selector */}
        <div className="flex gap-1">
          {(Object.entries(PRESETS) as [TipoTitulo, typeof PRESETS.prefixado][]).map(([key, p]) => (
            <button
              key={key}
              onClick={() => handleTipoChange(key)}
              className={`px-3 py-1.5 text-[10px] font-mono rounded-md transition-all ${
                tipo === key
                  ? "bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30"
                  : "bg-[#111] text-zinc-500 border border-[#1a1a1a] hover:text-zinc-300"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {activeView === "calculator" && (
          <>
            {/* Inputs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[9px] text-zinc-600 font-mono mb-1">
                  Taxa ({tipo === "ipca" ? "real" : "nominal"}) % a.a.
                </label>
                <input
                  type="range"
                  min={0}
                  max={tipo === "selic" ? 3 : 25}
                  step={0.01}
                  value={rate}
                  onChange={(e) => setRate(Number(e.target.value))}
                  className="w-full accent-[#10B981]"
                />
                <span className="text-[11px] font-mono text-zinc-100 font-bold">{rate.toFixed(2)}%</span>
              </div>
              <div>
                <label className="block text-[9px] text-zinc-600 font-mono mb-1">Semestres até o vencimento</label>
                <input
                  type="range"
                  min={1}
                  max={30}
                  step={1}
                  value={periods}
                  onChange={(e) => setPeriods(Number(e.target.value))}
                  className="w-full accent-[#10B981]"
                />
                <span className="text-[11px] font-mono text-zinc-100 font-bold">{periods} sem. ({(periods / 2).toFixed(1)} anos)</span>
              </div>
              <div>
                <label className="block text-[9px] text-zinc-600 font-mono mb-1">Selic atual (ref.)</label>
                <span className="text-[11px] font-mono text-zinc-400">{currentSelic}% a.a.</span>
              </div>
            </div>

            {/* Results */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: "Preço Unitário", value: `R$ ${price.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: "text-emerald-400" },
                { label: "Duration Macaulay", value: `${macaulay.toFixed(2)} sem.`, sub: `${(macaulay / 2).toFixed(1)} anos`, color: "text-zinc-100" },
                { label: "Duration Modificada", value: modified.toFixed(4), color: "text-zinc-100" },
                { label: "Cupom Semestral", value: preset.couponRate > 0 ? `${preset.couponRate}%` : "Zero Cupom", color: "text-zinc-400" },
              ].map((r) => (
                <div key={r.label} className="bg-[#0a0a0a] border border-[#141414] rounded p-2.5">
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
                  <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "#52525b", fontSize: 8, fontFamily: "monospace" }} axisLine={{ stroke: "#1a1a1a" }} tickLine={false} />
                  <YAxis tick={{ fill: "#52525b", fontSize: 8, fontFamily: "monospace" }} axisLine={false} tickLine={false} width={50} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="pv" stroke="#10B981" strokeWidth={1.5} dot={{ r: 2, fill: "#10B981" }} name="VP" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Sensitivity Table */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-3 h-3 text-[#6366F1]" />
                <span className="text-[10px] font-bold text-zinc-300 font-mono">Sensibilidade ao Risco de Taxa</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#141414]">
                      {["Δ Taxa", "Taxa", "Preço", "Var. %"].map((h) => (
                        <th key={h} className="px-2 py-1.5 text-[8px] font-mono text-zinc-600 text-right">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sensitivity.map((s) => (
                      <tr key={s.delta} className={`border-b border-[#111] ${s.delta === 0 ? "bg-[#10B981]/5" : ""}`}>
                        <td className="px-2 py-1 text-[9px] font-mono text-zinc-500 text-right">
                          {s.delta > 0 ? "+" : ""}{s.delta.toFixed(1)} p.p.
                        </td>
                        <td className="px-2 py-1 text-[9px] font-mono text-zinc-300 text-right">{s.rate.toFixed(2)}%</td>
                        <td className="px-2 py-1 text-[9px] font-mono text-zinc-100 text-right font-bold">
                          R$ {s.price.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className={`px-2 py-1 text-[9px] font-mono text-right font-bold ${s.change > 0 ? "text-emerald-400" : s.change < 0 ? "text-red-400" : "text-zinc-400"}`}>
                          {s.change > 0 ? "+" : ""}{s.change.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeView === "mam" && (
          <>
            {/* MaM Inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] text-zinc-600 font-mono mb-1">Taxa de Compra (% a.a.)</label>
                <input
                  type="range"
                  min={0}
                  max={tipo === "selic" ? 3 : 25}
                  step={0.01}
                  value={purchaseRate}
                  onChange={(e) => setPurchaseRate(Number(e.target.value))}
                  className="w-full accent-[#F59E0B]"
                />
                <span className="text-[11px] font-mono text-amber-400 font-bold">{purchaseRate.toFixed(2)}%</span>
              </div>
              <div>
                <label className="block text-[9px] text-zinc-600 font-mono mb-1">Taxa Atual de Mercado (% a.a.)</label>
                <input
                  type="range"
                  min={0}
                  max={tipo === "selic" ? 3 : 25}
                  step={0.01}
                  value={currentRate}
                  onChange={(e) => setCurrentRate(Number(e.target.value))}
                  className="w-full accent-[#10B981]"
                />
                <span className="text-[11px] font-mono text-emerald-400 font-bold">{currentRate.toFixed(2)}%</span>
              </div>
            </div>

            {/* MaM Results */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-[#0a0a0a] border border-[#141414] rounded p-2.5">
                <div className="text-[8px] text-zinc-600 font-mono">PU Compra</div>
                <div className="text-[12px] font-bold font-mono text-amber-400">
                  R$ {mam.priceCompra.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="bg-[#0a0a0a] border border-[#141414] rounded p-2.5">
                <div className="text-[8px] text-zinc-600 font-mono">PU Atual (MaM)</div>
                <div className="text-[12px] font-bold font-mono text-emerald-400">
                  R$ {mam.priceAtual.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="bg-[#0a0a0a] border border-[#141414] rounded p-2.5">
                <div className="text-[8px] text-zinc-600 font-mono">Ganho / Perda</div>
                <div className={`text-[12px] font-bold font-mono flex items-center gap-1 ${mam.ganho >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {mam.ganho >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  R$ {Math.abs(mam.ganho).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="bg-[#0a0a0a] border border-[#141414] rounded p-2.5">
                <div className="text-[8px] text-zinc-600 font-mono">Variação %</div>
                <div className={`text-[12px] font-bold font-mono ${mam.ganhoPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {mam.ganhoPct >= 0 ? "+" : ""}{mam.ganhoPct.toFixed(2)}%
                </div>
              </div>
            </div>

            {/* MaM explanation */}
            <div className="bg-[#0a0a0a] border border-[#141414] rounded p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Clock className="w-3 h-3 text-zinc-500" />
                <span className="text-[9px] font-mono font-bold text-zinc-400">Como funciona</span>
              </div>
              <p className="text-[9px] text-zinc-600 leading-relaxed">
                A <strong className="text-zinc-400">marcação a mercado</strong> recalcula o preço do título pela taxa atual de negociação.
                Se a taxa de mercado <strong className="text-emerald-400">caiu</strong> após sua compra, o preço do título <strong className="text-emerald-400">subiu</strong> (ganho).
                Se a taxa <strong className="text-red-400">subiu</strong>, o preço <strong className="text-red-400">caiu</strong> (perda temporária).
                Quanto maior a <strong className="text-zinc-400">duration</strong>, maior a sensibilidade à variação de taxa.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
