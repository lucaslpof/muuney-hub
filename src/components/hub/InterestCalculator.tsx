import { useState, useMemo } from "react";
import { Calculator } from "lucide-react";

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
}

function pricePayment(principal: number, monthlyRate: number, months: number): number {
  if (monthlyRate === 0) return principal / months;
  const factor = Math.pow(1 + monthlyRate, months);
  return principal * (monthlyRate * factor) / (factor - 1);
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

  const annualRate = customRate ?? (segment === "pf" ? currentTaxaPF : currentTaxaPJ);

  const result: SimResult = useMemo(() => {
    const monthlyRate = Math.pow(1 + annualRate / 100, 1 / 12) - 1;
    const pmt = pricePayment(principal, monthlyRate, months);
    const totalPaid = pmt * months;
    const totalInterest = totalPaid - principal;
    const effectiveRate = ((totalPaid / principal - 1) * 100);
    const selicMonthly = Math.pow(1 + currentSelic / 100, 1 / 12) - 1;
    const selicTotal = principal * (Math.pow(1 + selicMonthly, months) - 1);
    const costOverSelic = totalInterest - selicTotal;
    return { totalPaid, totalInterest, monthlyPayment: pmt, effectiveRate, costOverSelic };
  }, [principal, months, annualRate, currentSelic]);

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  return (
    <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Calculator className="w-4 h-4 text-[#10B981]" />
        <h3 className="text-sm font-bold text-zinc-100">Simulador de Custo de Empréstimo</h3>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div>
          <label className="text-[9px] text-zinc-600 font-mono block mb-1">Valor (R$)</label>
          <input
            type="number"
            value={principal}
            onChange={(e) => setPrincipal(Number(e.target.value))}
            className="w-full bg-[#111] border border-[#222] rounded px-2 py-1.5 text-xs text-zinc-100 font-mono"
          />
        </div>
        <div>
          <label className="text-[9px] text-zinc-600 font-mono block mb-1">Prazo (meses)</label>
          <input
            type="number"
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
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
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          { label: "Parcela Mensal", value: fmt(result.monthlyPayment), color: "text-zinc-100" },
          { label: "Total Pago", value: fmt(result.totalPaid), color: "text-zinc-100" },
          { label: "Total Juros", value: fmt(result.totalInterest), color: "text-red-400" },
          { label: "Custo Efetivo", value: `${result.effectiveRate.toFixed(1)}%`, color: "text-amber-400" },
          { label: "Excesso vs Selic", value: fmt(result.costOverSelic), color: result.costOverSelic > 0 ? "text-red-400" : "text-emerald-400" },
        ].map((item) => (
          <div key={item.label} className="bg-[#0a0a0a] border border-[#141414] rounded p-2">
            <div className="text-[9px] text-zinc-600 font-mono">{item.label}</div>
            <div className={`text-sm font-bold font-mono ${item.color}`}>{item.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-2 text-[9px] text-zinc-700 font-mono">
        Sistema Price · Taxa {segment.toUpperCase()}: {annualRate.toFixed(1)}% a.a. · Selic: {currentSelic}% a.a.
      </div>
    </div>
  );
};
