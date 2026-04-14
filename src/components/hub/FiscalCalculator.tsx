import { useState, useMemo } from "react";
import { Landmark } from "lucide-react";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

interface FiscalCalculatorProps {
  currentDebtGdp: number;
  currentPrimary: number;
}

/* ─── Scenario presets ─── */
const FISCAL_SCENARIOS = {
  base: { label: "Base", gdp: 2.0, rate: 6.0, primary: 0.5, color: "#F59E0B" },
  optimista: { label: "Otimista", gdp: 3.0, rate: 4.5, primary: 1.5, color: "#10B981" },
  pessimista: { label: "Pessimista", gdp: 1.0, rate: 7.5, primary: -0.5, color: "#EF4444" },
} as const;

type ScenarioKey = keyof typeof FISCAL_SCENARIOS;

function computeProjection(
  startDebt: number, gdpGrowth: number, realRate: number, primaryTarget: number, years: number
) {
  const data: number[] = [];
  let debt = startDebt;
  for (let i = 0; i <= years; i++) {
    data.push(Math.round(debt * 10) / 10);
    const r = realRate / 100;
    const g = gdpGrowth / 100;
    const p = primaryTarget / 100;
    const snowball = ((r - g) / (1 + g)) * (debt / 100);
    debt = debt + (snowball - p) * 100;
    debt = Math.max(0, debt);
  }
  return data;
}

export const FiscalCalculator = ({
  currentDebtGdp,
  currentPrimary,
}: FiscalCalculatorProps) => {
  const [gdpGrowth, setGdpGrowth] = useState(2.0);
  const [realRate, setRealRate] = useState(6.0);
  const [primaryTarget, setPrimaryTarget] = useState(currentPrimary);
  const [years, setYears] = useState(10);
  const [showScenarios, setShowScenarios] = useState(false);

  /* ─── Main projection ─── */
  const mainProjection = useMemo(
    () => computeProjection(currentDebtGdp, gdpGrowth, realRate, primaryTarget, years),
    [currentDebtGdp, gdpGrowth, realRate, primaryTarget, years]
  );

  /* ─── Multi-scenario projections ─── */
  const scenarioData = useMemo(() => {
    if (!showScenarios) return null;
    const scenarios: Record<ScenarioKey, number[]> = {
      base: computeProjection(currentDebtGdp, FISCAL_SCENARIOS.base.gdp, FISCAL_SCENARIOS.base.rate, FISCAL_SCENARIOS.base.primary, years),
      optimista: computeProjection(currentDebtGdp, FISCAL_SCENARIOS.optimista.gdp, FISCAL_SCENARIOS.optimista.rate, FISCAL_SCENARIOS.optimista.primary, years),
      pessimista: computeProjection(currentDebtGdp, FISCAL_SCENARIOS.pessimista.gdp, FISCAL_SCENARIOS.pessimista.rate, FISCAL_SCENARIOS.pessimista.primary, years),
    };
    return Array.from({ length: years + 1 }, (_, i) => ({
      year: `${2026 + i}`,
      base: scenarios.base[i],
      optimista: scenarios.optimista[i],
      pessimista: scenarios.pessimista[i],
    }));
  }, [currentDebtGdp, years, showScenarios]);

  const chartData = useMemo(() => {
    return mainProjection.map((debt, i) => ({
      year: `${2026 + i}`,
      debt,
      sustainable: 80,
    }));
  }, [mainProjection]);

  /* ─── Sensitivity heatmap: r × g ─── */
  const sensitivityGrid = useMemo(() => {
    const rates = [4, 5, 6, 7, 8];
    const growths = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0];
    return rates.map(r => ({
      rate: r,
      values: growths.map(g => {
        const proj = computeProjection(currentDebtGdp, g, r, primaryTarget, years);
        return proj[proj.length - 1];
      }),
    }));
  }, [currentDebtGdp, primaryTarget, years]);

  const sensitivityGrowths = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0];

  const finalDebt = mainProjection[mainProjection.length - 1] ?? 0;
  const isExplosive = finalDebt > 90;
  const isStable = Math.abs(finalDebt - currentDebtGdp) < 5;

  /* ─── Heatmap color ─── */
  function heatColor(val: number): string {
    if (val > 100) return "bg-red-600/40 text-red-300";
    if (val > 80) return "bg-red-500/20 text-red-400";
    if (val > 70) return "bg-amber-500/20 text-amber-400";
    if (val > 60) return "bg-amber-500/10 text-amber-300";
    return "bg-emerald-500/10 text-emerald-400";
  }

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Landmark className="w-4 h-4 text-[#0B6C3E]" />
          <h3 className="text-xs font-medium text-zinc-400 font-mono">
            Calculadora Sustentabilidade Fiscal
          </h3>
        </div>
        <button
          onClick={() => setShowScenarios(!showScenarios)}
          className={`text-[9px] font-mono px-2 py-0.5 rounded border transition-colors ${
            showScenarios
              ? "text-[#0B6C3E] border-[#0B6C3E]/30 bg-[#0B6C3E]/10"
              : "text-zinc-600 border-zinc-800/50 hover:text-zinc-400"
          }`}
        >
          {showScenarios ? "Cenários ✓" : "Comparar cenários"}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <div>
          <label className="text-[9px] text-zinc-600 font-mono block mb-1">Cresc. PIB real (%)</label>
          <input
            type="number"
            step={0.5}
            value={gdpGrowth}
            onChange={(e) => setGdpGrowth(Number(e.target.value))}
            className="w-full bg-[#0a0a0a] border border-zinc-800/50 rounded px-2 py-1.5 text-[11px] text-zinc-300 font-mono"
          />
        </div>
        <div>
          <label className="text-[9px] text-zinc-600 font-mono block mb-1">Juro real (%)</label>
          <input
            type="number"
            step={0.5}
            value={realRate}
            onChange={(e) => setRealRate(Number(e.target.value))}
            className="w-full bg-[#0a0a0a] border border-zinc-800/50 rounded px-2 py-1.5 text-[11px] text-zinc-300 font-mono"
          />
        </div>
        <div>
          <label className="text-[9px] text-zinc-600 font-mono block mb-1">Primário (%PIB)</label>
          <input
            type="number"
            step={0.25}
            value={primaryTarget}
            onChange={(e) => setPrimaryTarget(Number(e.target.value))}
            className="w-full bg-[#0a0a0a] border border-zinc-800/50 rounded px-2 py-1.5 text-[11px] text-zinc-300 font-mono"
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
            className="w-full bg-[#0a0a0a] border border-zinc-800/50 rounded px-2 py-1.5 text-[11px] text-zinc-300 font-mono"
          />
        </div>
      </div>

      {/* ─── Main chart OR scenario comparison ─── */}
      {showScenarios && scenarioData ? (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={scenarioData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
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
              width={50}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              contentStyle={{ background: "#0f0f0f", border: "1px solid #2a2a2a", borderRadius: 6, fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
              formatter={(v: number) => [`${v.toFixed(1)}%`]}
            />
            <ReferenceLine y={80} stroke="#EF4444" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="optimista" name="Otimista" stroke={FISCAL_SCENARIOS.optimista.color} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="base" name="Base" stroke={FISCAL_SCENARIOS.base.color} strokeWidth={2} strokeDasharray="6 3" dot={false} />
            <Line type="monotone" dataKey="pessimista" name="Pessimista" stroke={FISCAL_SCENARIOS.pessimista.color} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
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
              width={50}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              contentStyle={{ background: "#0f0f0f", border: "1px solid #2a2a2a", borderRadius: 6, fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
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
      )}

      {/* ─── Scenario legend (when active) ─── */}
      {showScenarios && scenarioData && (
        <div className="flex items-center gap-4 mt-2 text-[9px] font-mono">
          {(Object.keys(FISCAL_SCENARIOS) as ScenarioKey[]).map(k => {
            const s = FISCAL_SCENARIOS[k];
            const finalVal = scenarioData[scenarioData.length - 1]?.[k] ?? 0;
            return (
              <span key={k} className="flex items-center gap-1" style={{ color: s.color }}>
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: s.color }} />
                {s.label}: {finalVal.toFixed(1)}% (g={s.gdp}%, r={s.rate}%, p={s.primary}%)
              </span>
            );
          })}
        </div>
      )}

      {/* ─── Status badge ─── */}
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

      {/* ─── Sensitivity heatmap r × g ─── */}
      <div className="mt-4">
        <h4 className="text-[10px] text-zinc-500 font-mono mb-2">
          Sensibilidade: Dívida/PIB final por Juro Real × Crescimento
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-[9px] font-mono">
            <thead>
              <tr>
                <th className="text-left text-zinc-600 p-1.5">r \ g</th>
                {sensitivityGrowths.map(g => (
                  <th key={g} className="text-center text-zinc-500 p-1.5">{g}%</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sensitivityGrid.map(row => (
                <tr key={row.rate}>
                  <td className="text-zinc-500 p-1.5 font-semibold">{row.rate}%</td>
                  {row.values.map((val, j) => (
                    <td key={j} className={`text-center p-1.5 rounded ${heatColor(val)}`}>
                      {val.toFixed(0)}%
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
