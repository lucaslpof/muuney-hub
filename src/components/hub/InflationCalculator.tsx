import { useState, useMemo } from "react";
import { Calculator } from "lucide-react";

interface InflationCalculatorProps {
  ipcaData: { date: string; value: number }[];
}

export const InflationCalculator = ({ ipcaData }: InflationCalculatorProps) => {
  const [startIdx, setStartIdx] = useState(0);
  const [endIdx, setEndIdx] = useState(Math.max(0, ipcaData.length - 1));
  const [amount, setAmount] = useState(1000);

  const dates = useMemo(() => ipcaData.map((d) => d.date), [ipcaData]);

  const result = useMemo(() => {
    if (startIdx >= endIdx || !ipcaData.length) return null;
    const slice = ipcaData.slice(startIdx, endIdx + 1);
    let cumulative = 1;
    for (const d of slice) {
      cumulative *= 1 + d.value / 100;
    }
    const totalPct = (cumulative - 1) * 100;
    const adjustedAmount = amount * cumulative;
    const lostPower = amount - amount / cumulative;
    return {
      totalPct: totalPct.toFixed(2),
      adjustedAmount: adjustedAmount.toFixed(2),
      lostPower: lostPower.toFixed(2),
      months: slice.length,
    };
  }, [startIdx, endIdx, amount, ipcaData]);

  if (ipcaData.length < 2) return null;

  return (
    <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Calculator className="w-4 h-4 text-[#0B6C3E]" />
        <h3 className="text-xs font-medium text-zinc-400 font-mono">
          Calculadora de Inflação Acumulada
        </h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <div>
          <label className="text-[9px] text-zinc-600 font-mono block mb-1">De</label>
          <select
            value={startIdx}
            onChange={(e) => setStartIdx(Number(e.target.value))}
            className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded px-2 py-1.5 text-[11px] text-zinc-300 font-mono"
          >
            {dates.map((d, i) => (
              <option key={`s-${i}`} value={i}>
                {new Date(d).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[9px] text-zinc-600 font-mono block mb-1">Até</label>
          <select
            value={endIdx}
            onChange={(e) => setEndIdx(Number(e.target.value))}
            className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded px-2 py-1.5 text-[11px] text-zinc-300 font-mono"
          >
            {dates.map((d, i) => (
              <option key={`e-${i}`} value={i}>
                {new Date(d).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-[9px] text-zinc-600 font-mono block mb-1">Valor (R$)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value) || 0)}
            className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded px-2 py-1.5 text-[11px] text-zinc-300 font-mono"
          />
        </div>
      </div>

      {result && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-[#0a0a0a] rounded-md p-2.5 border border-[#1a1a1a]">
            <span className="text-[9px] text-zinc-600 font-mono block">Inflação Acumulada</span>
            <span className="text-sm font-bold text-red-400 font-mono">{result.totalPct}%</span>
          </div>
          <div className="bg-[#0a0a0a] rounded-md p-2.5 border border-[#1a1a1a]">
            <span className="text-[9px] text-zinc-600 font-mono block">Valor Corrigido</span>
            <span className="text-sm font-bold text-[#0B6C3E] font-mono">
              R$ {Number(result.adjustedAmount).toLocaleString("pt-BR")}
            </span>
          </div>
          <div className="bg-[#0a0a0a] rounded-md p-2.5 border border-[#1a1a1a]">
            <span className="text-[9px] text-zinc-600 font-mono block">Perda de Poder</span>
            <span className="text-sm font-bold text-amber-400 font-mono">
              R$ {Number(result.lostPower).toLocaleString("pt-BR")}
            </span>
          </div>
          <div className="bg-[#0a0a0a] rounded-md p-2.5 border border-[#1a1a1a]">
            <span className="text-[9px] text-zinc-600 font-mono block">Período</span>
            <span className="text-sm font-bold text-zinc-300 font-mono">{result.months} meses</span>
          </div>
        </div>
      )}
    </div>
  );
};
