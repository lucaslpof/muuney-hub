import { useState, useMemo } from "react";
import { Calculator } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { fmtNum, formatBRL, formatBRLCompact } from "@/lib/format";

interface InflationCalculatorProps {
  ipcaData: { date: string; value: number }[];
}

/* ─── Period presets ─── */
const PRESETS = [
  { label: "6M", months: 6 },
  { label: "1A", months: 12 },
  { label: "2A", months: 24 },
  { label: "3A", months: 36 },
  { label: "5A", months: 60 },
  { label: "Tudo", months: -1 },
] as const;

export const InflationCalculator = ({ ipcaData }: InflationCalculatorProps) => {
  const [startIdx, setStartIdx] = useState(0);
  const [endIdx, setEndIdx] = useState(Math.max(0, ipcaData.length - 1));
  const [amount, setAmount] = useState(1000);

  const dates = useMemo(() => ipcaData.map((d) => d.date), [ipcaData]);

  /* ─── Apply preset ─── */
  const applyPreset = (months: number) => {
    if (months === -1) {
      setStartIdx(0);
    } else {
      setStartIdx(Math.max(0, ipcaData.length - months));
    }
    setEndIdx(ipcaData.length - 1);
  };

  /* ─── Main result ─── */
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
    const annualized = slice.length > 12
      ? (Math.pow(cumulative, 12 / slice.length) - 1) * 100
      : totalPct;
    return {
      totalPct: totalPct.toFixed(2),
      adjustedAmount: adjustedAmount.toFixed(2),
      lostPower: lostPower.toFixed(2),
      annualized: annualized.toFixed(2),
      months: slice.length,
    };
  }, [startIdx, endIdx, amount, ipcaData]);

  /* ─── Purchasing power evolution chart data ─── */
  const powerChartData = useMemo(() => {
    if (startIdx >= endIdx || !ipcaData.length) return [];
    const slice = ipcaData.slice(startIdx, endIdx + 1);
    let cumulative = 1;
    return slice.map((d) => {
      cumulative *= 1 + d.value / 100;
      const purchasingPower = amount / cumulative;
      return {
        date: new Date(d.date).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
        poder: Math.round(purchasingPower * 100) / 100,
        inflacao: Math.round((cumulative - 1) * 10000) / 100,
      };
    });
  }, [startIdx, endIdx, amount, ipcaData]);

  if (ipcaData.length < 2) return null;

  const showChart = powerChartData.length > 3;

  return (
    <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Calculator className="w-4 h-4 text-[#0B6C3E]" />
        <h3 className="text-xs font-medium text-zinc-400 font-mono">
          Calculadora de Inflação Acumulada
        </h3>
      </div>

      {/* Period presets */}
      <div className="flex items-center gap-1 mb-3">
        <span className="text-[9px] text-zinc-600 font-mono mr-1">Período:</span>
        {PRESETS.filter(p => p.months === -1 || p.months <= ipcaData.length).map((p) => {
          const isActive = p.months === -1
            ? startIdx === 0 && endIdx === ipcaData.length - 1
            : startIdx === Math.max(0, ipcaData.length - p.months) && endIdx === ipcaData.length - 1;
          return (
            <button
              key={p.label}
              onClick={() => applyPreset(p.months)}
              className={`px-2 py-0.5 rounded text-[9px] font-mono transition-colors border ${
                isActive
                  ? "text-[#0B6C3E] border-[#0B6C3E]/30 bg-[#0B6C3E]/10"
                  : "text-zinc-600 border-[#1a1a1a] hover:text-zinc-400 hover:border-[#2a2a2a]"
              }`}
            >
              {p.label}
            </button>
          );
        })}
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
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
            <div className="bg-[#0a0a0a] rounded-md p-2.5 border border-[#1a1a1a]">
              <span className="text-[9px] text-zinc-600 font-mono block">Inflação Acumulada</span>
              <span className="text-sm font-bold text-red-400 font-mono">{fmtNum(Number(result.totalPct), 2)}%</span>
            </div>
            <div className="bg-[#0a0a0a] rounded-md p-2.5 border border-[#1a1a1a]">
              <span className="text-[9px] text-zinc-600 font-mono block">Anualizada</span>
              <span className="text-sm font-bold text-red-300 font-mono">{fmtNum(Number(result.annualized), 2)}%</span>
            </div>
            <div className="bg-[#0a0a0a] rounded-md p-2.5 border border-[#1a1a1a]">
              <span className="text-[9px] text-zinc-600 font-mono block">Valor Corrigido</span>
              <span className="text-sm font-bold text-[#0B6C3E] font-mono">
                {formatBRL(Number(result.adjustedAmount))}
              </span>
            </div>
            <div className="bg-[#0a0a0a] rounded-md p-2.5 border border-[#1a1a1a]">
              <span className="text-[9px] text-zinc-600 font-mono block">Perda de Poder</span>
              <span className="text-sm font-bold text-amber-400 font-mono">
                {formatBRL(Number(result.lostPower))}
              </span>
            </div>
            <div className="bg-[#0a0a0a] rounded-md p-2.5 border border-[#1a1a1a]">
              <span className="text-[9px] text-zinc-600 font-mono block">Período</span>
              <span className="text-sm font-bold text-zinc-300 font-mono">{result.months} meses</span>
            </div>
          </div>

          {/* ─── Purchasing power evolution chart ─── */}
          {showChart && (
            <div>
              <h4 className="text-[10px] text-zinc-500 font-mono mb-1">
                Evolução do poder de compra de {formatBRL(amount)}
              </h4>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={powerChartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#141414" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#52525b", fontSize: 9, fontFamily: "JetBrains Mono, monospace" }}
                    axisLine={{ stroke: "#1a1a1a" }}
                    tickLine={false}
                    interval={Math.max(0, Math.floor(powerChartData.length / 6))}
                  />
                  <YAxis
                    tick={{ fill: "#52525b", fontSize: 9, fontFamily: "JetBrains Mono, monospace" }}
                    axisLine={false}
                    tickLine={false}
                    width={55}
                    tickFormatter={(v: number) => formatBRLCompact(v)}
                  />
                  <Tooltip
                    contentStyle={{ background: "#0f0f0f", border: "1px solid #2a2a2a", borderRadius: 6, fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
                    formatter={(v: number, name: string) => [
                      name === "poder" ? formatBRL(v) : `${fmtNum(v, 2)}%`,
                      name === "poder" ? "Poder de compra" : "Inflação acum.",
                    ]}
                  />
                  <ReferenceLine y={amount} stroke="#3f3f46" strokeDasharray="4 4" />
                  <defs>
                    <linearGradient id="powerGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="poder"
                    name="poder"
                    stroke="#EF4444"
                    fill="url(#powerGrad)"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
};
