import { useState, useMemo } from "react";
import { Calculator, ArrowRight } from "lucide-react";

interface InterestCalculatorProps {
  currentTaxaPF?: number;
  currentTaxaPJ?: number;
  currentSelic?: number;
}

interface SimResult {
  totalPaid: number;
  totalInterest: number;
  monthlyPayment: number;
  effectiveRate: number;
  costOverSelic: number;
  annualizedRate: number;
}

/* ─── Amortization systems ─── */
type AmortSystem = "price" | "sac";

function pricePayment(principal: number, monthlyRate: number, months: number): number {
  if (monthlyRate === 0) return principal / months;
  const factor = Math.pow(1 + monthlyRate, months);
  return principal * (monthlyRate * factor) / (factor - 1);
}

function sacFirstPayment(principal: number, monthlyRate: number, months: number): number {
  const amort = principal / months;
  return amort + principal * monthlyRate;
}

function sacTotalPaid(principal: number, monthlyRate: number, months: number): number {
  const amort = principal / months;
  let total = 0;
  for (let i = 0; i < months; i++) {
    const remaining = principal - amort * i;
    total += amort + remaining * monthlyRate;
  }
  return total;
}

/* ─── Scenario presets ─── */
const SCENARIOS = [
  { label: "Conservador", rate: 1.15, months: 24 },
  { label: "Base", rate: 1.0, months: 36 },
  { label: "Agressivo", rate: 0.85, months: 60 },
] as const;

/* ─── Sensitivity heatmap data ─── */
function buildSensitivity(
  principal: number,
  baseRate: number,
  system: AmortSystem
): { rates: number[]; terms: number[]; grid: number[][] } {
  const rates = [baseRate * 0.7, baseRate * 0.85, baseRate, baseRate * 1.15, baseRate * 1.3];
  const terms = [12, 24, 36, 48, 60, 72];
  const grid = rates.map((r) =>
    terms.map((t) => {
      const mr = Math.pow(1 + r / 100, 1 / 12) - 1;
      if (system === "sac") return sacTotalPaid(principal, mr, t) - principal;
      const pmt = pricePayment(principal, mr, t);
      return pmt * t - principal;
    })
  );
  return { rates, terms, grid };
}

export const InterestCalculator = ({
  currentTaxaPF = 52.6,
  currentTaxaPJ = 23.8,
  currentSelic = 14.25,
}: InterestCalculatorProps) => {
  const [principal, setPrincipal] = useState(50000);
  const [months, setMonths] = useState(36);
  const [segment, setSegment] = useState<"pf" | "pj">("pf");
  const [customRate, setCustomRate] = useState<number | null>(null);
  const [system, setSystem] = useState<AmortSystem>("price");
  const [showSensitivity, setShowSensitivity] = useState(false);

  const annualRate = customRate ?? (segment === "pf" ? currentTaxaPF : currentTaxaPJ);

  /* ─── Main simulation ─── */
  const result: SimResult = useMemo(() => {
    const mr = Math.pow(1 + annualRate / 100, 1 / 12) - 1;
    let pmt: number, totalPaid: number;

    if (system === "price") {
      pmt = pricePayment(principal, mr, months);
      totalPaid = pmt * months;
    } else {
      pmt = sacFirstPayment(principal, mr, months);
      totalPaid = sacTotalPaid(principal, mr, months);
    }

    const totalInterest = totalPaid - principal;
    const effectiveRate = (totalPaid / principal - 1) * 100;
    const selicMr = Math.pow(1 + currentSelic / 100, 1 / 12) - 1;
    const selicTotal = principal * (Math.pow(1 + selicMr, months) - 1);
    const costOverSelic = totalInterest - selicTotal;
    const annualizedRate = (Math.pow(totalPaid / principal, 12 / months) - 1) * 100;

    return { totalPaid, totalInterest, monthlyPayment: pmt, effectiveRate, costOverSelic, annualizedRate };
  }, [principal, months, annualRate, currentSelic, system]);

  /* ─── Scenario comparison ─── */
  const scenarios = useMemo(() =>
    SCENARIOS.map((s) => {
      const rate = annualRate * s.rate;
      const mr = Math.pow(1 + rate / 100, 1 / 12) - 1;
      let totalPaid: number, pmt: number;
      if (system === "price") {
        pmt = pricePayment(principal, mr, s.months);
        totalPaid = pmt * s.months;
      } else {
        pmt = sacFirstPayment(principal, mr, s.months);
        totalPaid = sacTotalPaid(principal, mr, s.months);
      }
      return {
        label: s.label,
        rate,
        months: s.months,
        payment: pmt,
        totalInterest: totalPaid - principal,
      };
    }), [annualRate, principal, system]
  );

  /* ─── Sensitivity heatmap ─── */
  const sensitivity = useMemo(
    () => showSensitivity ? buildSensitivity(principal, annualRate, system) : null,
    [showSensitivity, principal, annualRate, system]
  );

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  /* ─── Heatmap color ─── */
  const heatColor = (val: number, max: number) => {
    const ratio = Math.min(val / max, 1);
    if (ratio < 0.3) return "bg-emerald-500/20 text-emerald-400";
    if (ratio < 0.6) return "bg-amber-500/20 text-amber-400";
    return "bg-red-500/20 text-red-400";
  };

  return (
    <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Calculator className="w-4 h-4 text-[#10B981]" />
        <h3 className="text-sm font-bold text-zinc-100">Simulador de Custo de Empréstimo</h3>
        <span className="text-[9px] font-mono text-zinc-600 ml-auto">v2 · Price + SAC</span>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        <div>
          <label className="text-[9px] text-zinc-600 font-mono block mb-1">Valor (R$)</label>
          <input
            type="number"
            value={principal}
            onChange={(e) => setPrincipal(Math.max(1000, Number(e.target.value)))}
            className="w-full bg-[#111] border border-[#222] rounded px-2 py-1.5 text-xs text-zinc-100 font-mono"
          />
        </div>
        <div>
          <label className="text-[9px] text-zinc-600 font-mono block mb-1">Prazo (meses)</label>
          <input
            type="number"
            value={months}
            onChange={(e) => setMonths(Math.min(360, Math.max(1, Number(e.target.value))))}
            min={1}
            max={360}
            className="w-full bg-[#111] border border-[#222] rounded px-2 py-1.5 text-xs text-zinc-100 font-mono"
          />
        </div>
        <div>
          <label className="text-[9px] text-zinc-600 font-mono block mb-1">Segmento</label>
          <div className="flex gap-1">
            {(["pf", "pj"] as const).map((s) => (
              <button
                key={s}
                onClick={() => { setSegment(s); setCustomRate(null); }}
                className={`flex-1 px-2 py-1.5 text-[10px] font-mono rounded transition-colors ${
                  segment === s
                    ? "bg-[#10B981] text-white"
                    : "bg-[#111] border border-[#222] text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {s.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[9px] text-zinc-600 font-mono block mb-1">Sistema</label>
          <div className="flex gap-1">
            {(["price", "sac"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSystem(s)}
                className={`flex-1 px-2 py-1.5 text-[10px] font-mono rounded transition-colors ${
                  system === s
                    ? "bg-[#10B981] text-white"
                    : "bg-[#111] border border-[#222] text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {s.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[9px] text-zinc-600 font-mono block mb-1">Taxa (% a.a.)</label>
          <input
            type="number"
            value={annualRate}
            onChange={(e) => setCustomRate(Number(e.target.value))}
            step={0.1}
            className="w-full bg-[#111] border border-[#222] rounded px-2 py-1.5 text-xs text-zinc-100 font-mono"
          />
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 mb-4">
        {[
          { label: system === "price" ? "Parcela Fixa" : "1a Parcela", value: fmt(result.monthlyPayment), color: "text-zinc-100" },
          { label: "Total Pago", value: fmt(result.totalPaid), color: "text-zinc-100" },
          { label: "Total Juros", value: fmt(result.totalInterest), color: "text-red-400" },
          { label: "Custo Efetivo", value: `${result.effectiveRate.toFixed(1)}%`, color: "text-amber-400" },
          { label: "Taxa Anualizada", value: `${result.annualizedRate.toFixed(1)}%`, color: "text-amber-400" },
          { label: "Excesso vs Selic", value: fmt(result.costOverSelic), color: result.costOverSelic > 0 ? "text-red-400" : "text-emerald-400" },
        ].map((item) => (
          <div key={item.label} className="bg-[#0a0a0a] border border-[#141414] rounded p-2">
            <div className="text-[9px] text-zinc-600 font-mono">{item.label}</div>
            <div className={`text-sm font-bold font-mono ${item.color}`}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Scenario comparison */}
      <div className="mb-3">
        <h4 className="text-[10px] font-mono text-zinc-500 mb-2 flex items-center gap-1">
          <ArrowRight className="w-3 h-3" /> Cenários Comparativos
        </h4>
        <div className="grid grid-cols-3 gap-2">
          {scenarios.map((s) => (
            <div key={s.label} className="bg-[#0a0a0a] border border-[#141414] rounded p-2.5">
              <div className="text-[10px] font-mono font-bold text-zinc-300 mb-1">{s.label}</div>
              <div className="space-y-0.5 text-[9px] font-mono">
                <div className="flex justify-between">
                  <span className="text-zinc-600">Taxa</span>
                  <span className="text-zinc-300">{s.rate.toFixed(1)}% a.a.</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">Prazo</span>
                  <span className="text-zinc-300">{s.months}m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">Parcela</span>
                  <span className="text-zinc-300">{fmt(s.payment)}</span>
                </div>
                <div className="flex justify-between pt-0.5 border-t border-[#1a1a1a]">
                  <span className="text-zinc-600">Juros Total</span>
                  <span className="text-red-400">{fmt(s.totalInterest)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sensitivity toggle */}
      <button
        onClick={() => setShowSensitivity(!showSensitivity)}
        className="text-[10px] font-mono text-zinc-600 hover:text-[#10B981] transition-colors mb-2"
      >
        {showSensitivity ? "▼ Ocultar" : "▶ Heatmap de Sensibilidade"} (Taxa × Prazo)
      </button>

      {/* Sensitivity heatmap */}
      {sensitivity && (
        <div className="overflow-x-auto">
          <table className="w-full text-[9px] font-mono">
            <thead>
              <tr>
                <th className="text-left text-zinc-600 p-1">Taxa ↓ / Prazo →</th>
                {sensitivity.terms.map((t) => (
                  <th key={t} className="text-center text-zinc-500 p-1">{t}m</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sensitivity.rates.map((r, ri) => {
                const maxVal = Math.max(...sensitivity.grid.flat());
                return (
                  <tr key={r}>
                    <td className="text-zinc-400 p-1">{r.toFixed(1)}%</td>
                    {sensitivity.grid[ri].map((val, ci) => (
                      <td key={ci} className={`text-center p-1 rounded ${heatColor(val, maxVal)}`}>
                        {fmt(val)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-2 text-[9px] text-zinc-700 font-mono">
        {system === "price" ? "Sistema Price (parcelas fixas)" : "SAC (amortização constante)"} · Taxa {segment.toUpperCase()}: {annualRate.toFixed(1)}% a.a. · Selic: {currentSelic}% a.a.
      </div>
    </div>
  );
};
