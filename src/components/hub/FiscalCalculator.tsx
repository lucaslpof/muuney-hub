import { useState, useMemo } from "react";
import { Landmark } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

interface FiscalCalculatorProps {
  currentDebtGdp: number;
  currentPrimary: number;
}

export const FiscalCalculator = ({
  currentDebtGdp,
  currentPrimary,
}: FiscalCalculatorProps) => {
  const [gdpGrowth, setGdpGrowth] = useState(2.0);
  const [realRate, setRealRate] = useState(6.0);
  const [primaryTarget, setPrimaryTarget] = useState(currentPrimary);
  const [years, setYears] = useState(10);

  const projection = useMemo(() => {
    const data: { year: string; debt: number; sustainable: number }[] = [];
    let debt = currentDebtGdp;
    const sustainableThreshold = 80;

    for (let i = 0; i <= years; i++) {
      data.push({
        year: `${2026 + i}`,
        debt: Math.round(debt * 10) / 10,
        sustainable: sustainableThreshold,
      });
      // Domar equation: Δd = (r - g)/(1+g) * d - p
      const r = realRate / 100;
      const g = gdpGrowth / 100;
      const p = primaryTarget / 100;
      const snowball = ((r - g) / (1 + g)) * (debt / 100);
      debt = debt + (snowball - p) * 100;
      debt = Math.max(0, debt);
    }
    return data;
  }, [currentDebtGdp, gdpGrowth, realRate, primaryTarget, years]);

  const finalDebt = projection[projection.length - 1]?.debt ?? 0;
  const isExplosive = finalDebt > 90;
  const isStable = Math.abs(finalDebt - currentDebtGdp) < 5;

  return (
    <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Landmark className="w-4 h-4 text-[#0B6C3E]" />
        <h3 className="text-xs font-medium text-zinc-400 font-mono">
          Calculadora Sustentabilidade Fiscal
        </h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <div>
          <label className="text-[9px] text-zinc-600 font-mono block mb-1">Cresc. PIB real (%)</label>
          <input
            type="number"
            step={0.5}
            value={gdpGrowth}
            onChange={(e) => setGdpGrowth(Number(e.target.value))}
            className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded px-2 py-1.5 text-[11px] text-zinc-300 font-mono"
          />
        </div>
        <div>
          <label className="text-[9px] text-zinc-600 font-mono block mb-1">Juro real (%)</label>
          <input
            type="number"
            step={0.5}
            value={realRate}
            onChange={(e) => setRealRate(Number(e.target.value))}
            className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded px-2 py-1.5 text-[11px] text-zinc-300 font-mono"
          />
        </div>
        <div>
          <label className="text-[9px] text-zinc-600 font-mono block mb-1">Primário (%PIB)</label>
          <input
            type="number"
            step={0.25}
            value={primaryTarget}
            onChange={(e) => setPrimaryTarget(Number(e.target.value))}
            className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded px-2 py-1.5 text-[11px] text-zinc-300 font-mono"
          />
        </div>
        <div>
          <label className="text-[9px] text-zinc-600 font-mono block mb-1">Horizonte (anos)</label>
          <input
            type="number"
            min={1}
            max={30}
            value={years}
            onChange={(e) => setYears(Number(e.target.value))}
            className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded px-2 py-1.5 text-[11px] text-zinc-300 font-mono"
          />
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={projection} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#141414" vertical={false} />
          <XAxis
            dataKey="year"
            tick={{ fill: "#52525b", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
            axisLine={{ stroke: "#1a1a1a" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#52525b", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
            axisLine={false}
            tickLine={false}
            width={45}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              background: "#0f0f0f",
              border: "1px solid #2a2a2a",
              borderRadius: 6,
              fontSize: 11,
              fontFamily: "JetBrains Mono, monospace",
            }}
            formatter={(v: number) => [`${v.toFixed(1)}%`]}
          />
          <ReferenceLine y={80} stroke="#EF4444" strokeDasharray="4 4" label={{ value: "Teto 80%", fill: "#EF4444", fontSize: 9 }} />
          <defs>
            <linearGradient id="debtGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={isExplosive ? "#EF4444" : "#0B6C3E"} stopOpacity={0.3} />
              <stop offset="95%" stopColor={isExplosive ? "#EF4444" : "#0B6C3E"} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="debt"
            name="Dívida/PIB"
            stroke={isExplosive ? "#EF4444" : "#0B6C3E"}
            fill="url(#debtGrad)"
            strokeWidth={2}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-3 mt-2">
        <span
          className={`text-[10px] font-mono px-2 py-0.5 rounded ${
            isExplosive
              ? "bg-red-500/10 text-red-400 border border-red-500/20"
              : isStable
              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
          }`}
        >
          {isExplosive ? "⚠ Trajetória explosiva" : isStable ? "→ Trajetória estável" : "✓ Trajetória decrescente"}
        </span>
        <span className="text-[9px] text-zinc-600 font-mono">
          {currentDebtGdp.toFixed(1)}% → {finalDebt.toFixed(1)}% em {years} anos
        </span>
      </div>
    </div>
  );
};
