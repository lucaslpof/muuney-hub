import { useState, useMemo } from "react";
import { TrendingUp } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

interface YieldCurveSimulatorProps {
  currentSelic: number;
  focusSelic2026?: number;
  focusSelic2027?: number;
}

/* ─── Scenario presets ─── */
const SCENARIOS = [
  { label: "Hawkish", bps: 150, color: "text-red-400", desc: "+150bps — aperto monetário" },
  { label: "Neutro", bps: 0, color: "text-zinc-400", desc: "Cenário base" },
  { label: "Dovish", bps: -150, color: "text-emerald-400", desc: "−150bps — afrouxamento" },
] as const;

/* ─── Shape analysis ─── */
function analyzeShape(points: number[]): { shape: string; description: string; color: string } {
  if (points.length < 3) return { shape: "Indefinida", description: "Dados insuficientes", color: "text-zinc-500" };

  const mid = points.slice(2, 5);
  const back = points.slice(5);

  const backSlope = back.length > 1 ? (back[back.length - 1] - back[0]) / back.length : 0;
  const midMax = Math.max(...mid);
  const endVal = points[points.length - 1];
  const startVal = points[0];

  if (startVal > endVal + 0.5) {
    return { shape: "Invertida", description: "Taxas curtas acima das longas — sinal recessivo", color: "text-red-400" };
  }
  if (midMax > Math.max(startVal, endVal) + 0.3 && backSlope < -0.05) {
    return { shape: "Corcova", description: "Pico no médio prazo — expectativa de corte futuro", color: "text-amber-400" };
  }
  if (Math.abs(startVal - endVal) < 0.3) {
    return { shape: "Flat", description: "Taxas uniformes — incerteza sobre direção da política", color: "text-zinc-400" };
  }
  return { shape: "Normal", description: "Ascendente — prêmio de prazo saudável", color: "text-emerald-400" };
}

export const YieldCurveSimulator = ({
  currentSelic,
  focusSelic2026 = 12.5,
  focusSelic2027 = 10.5,
}: YieldCurveSimulatorProps) => {
  const [deltaBps, setDeltaBps] = useState(0);

  const curveData = useMemo(() => {
    const shift = deltaBps / 100;
    const tenors = [
      { label: "ON", months: 0, base: currentSelic },
      { label: "3M", months: 3, base: currentSelic - 0.15 },
      { label: "6M", months: 6, base: currentSelic - 0.25 },
      { label: "1A", months: 12, base: (currentSelic + focusSelic2026) / 2 },
      { label: "2A", months: 24, base: focusSelic2027 },
      { label: "3A", months: 36, base: focusSelic2027 - 0.5 },
      { label: "5A", months: 60, base: focusSelic2027 - 0.8 },
      { label: "10A", months: 120, base: focusSelic2027 - 0.3 },
    ];
    return tenors.map((t) => ({
      tenor: t.label,
      base: Math.round(t.base * 100) / 100,
      shifted: Math.round((t.base + shift * (1 + t.months / 120)) * 100) / 100,
    }));
  }, [currentSelic, focusSelic2026, focusSelic2027, deltaBps]);

  const shiftedValues = curveData.map(d => d.shifted);
  const shapeAnalysis = useMemo(() => analyzeShape(shiftedValues), [shiftedValues]);

  /* ─── Y-axis nice domain ─── */
  const allRates = curveData.flatMap(d => [d.base, d.shifted]);
  const yMin = Math.floor(Math.min(...allRates) - 0.5);
  const yMax = Math.ceil(Math.max(...allRates) + 0.5);

  return (
    <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#0B6C3E]" />
          <h3 className="text-xs font-medium text-zinc-400 font-mono">
            Simulador Curva de Rendimento
          </h3>
        </div>
        {/* Shape badge */}
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${shapeAnalysis.color} border-current/20 bg-current/5`}>
          {shapeAnalysis.shape}
        </span>
      </div>

      {/* Scenario presets */}
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-[9px] text-zinc-600 font-mono mr-1">Cenários:</span>
        {SCENARIOS.map((s) => (
          <button
            key={s.label}
            onClick={() => setDeltaBps(s.bps)}
            className={`px-2 py-0.5 rounded text-[9px] font-mono transition-colors border ${
              deltaBps === s.bps
                ? `${s.color} border-current/30 bg-current/10`
                : "text-zinc-600 border-[#1a1a1a] hover:text-zinc-400 hover:border-[#2a2a2a]"
            }`}
            title={s.desc}
          >
            {s.label}
          </button>
        ))}
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={-300}
            max={300}
            step={25}
            value={deltaBps}
            onChange={(e) => setDeltaBps(Number(e.target.value))}
            className="w-20 accent-[#0B6C3E]"
          />
          <span className={`text-[10px] font-mono font-bold w-14 text-right ${deltaBps > 0 ? "text-red-400" : deltaBps < 0 ? "text-emerald-400" : "text-zinc-500"}`}>
            {deltaBps > 0 ? "+" : ""}{deltaBps}bps
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={curveData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#141414" vertical={false} />
          <XAxis
            dataKey="tenor"
            tick={{ fill: "#52525b", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
            axisLine={{ stroke: "#1a1a1a" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#52525b", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
            axisLine={false}
            tickLine={false}
            width={50}
            domain={[yMin, yMax]}
            tickFormatter={(v: number) => `${v.toFixed(1)}%`}
          />
          <Tooltip
            contentStyle={{
              background: "#0f0f0f",
              border: "1px solid #2a2a2a",
              borderRadius: 6,
              fontSize: 11,
              fontFamily: "JetBrains Mono, monospace",
            }}
            labelStyle={{ color: "#71717a" }}
            formatter={(v: number) => [`${v.toFixed(2)}%`]}
          />
          <ReferenceLine y={currentSelic} stroke="#3f3f46" strokeDasharray="4 4" />
          <Line type="monotone" dataKey="base" name="Atual" stroke="#52525b" strokeWidth={1.5} dot={{ r: 3 }} strokeDasharray="4 4" />
          <Line type="monotone" dataKey="shifted" name="Simulado" stroke="#0B6C3E" strokeWidth={2} dot={{ r: 4, fill: "#0B6C3E" }} />
        </LineChart>
      </ResponsiveContainer>

      {/* Footer: shape description + legend */}
      <div className="flex items-center justify-between mt-2">
        <span className={`text-[9px] font-mono ${shapeAnalysis.color}`}>
          {shapeAnalysis.description}
        </span>
        <div className="flex items-center gap-4 text-[9px] text-zinc-600 font-mono">
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 inline-block border-t border-dashed border-zinc-500" /> Atual
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-[#0B6C3E] inline-block" /> Simulado
          </span>
        </div>
      </div>
    </div>
  );
};
