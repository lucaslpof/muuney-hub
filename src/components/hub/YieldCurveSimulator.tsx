import { useState, useMemo } from "react";
import { TrendingUp, Activity } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

/* ═══════════════════════════════════════════════════════════════════════════
   YIELD CURVE SIMULATOR v2
   Parallel shift · Twist · Butterfly · DV01 estimado · Focus comparison
   ═══════════════════════════════════════════════════════════════════════════ */

interface YieldCurveSimulatorProps {
  currentSelic: number;
  focusSelic2026?: number;
  focusSelic2027?: number;
}

/* ─── Shift Mode ─── */
type ShiftMode = "parallel" | "twist" | "butterfly";

const SHIFT_MODES: { id: ShiftMode; label: string; desc: string }[] = [
  { id: "parallel", label: "Parallel", desc: "Desloca curva inteira uniformemente" },
  { id: "twist", label: "Twist", desc: "Steepening/flattening — curto vs longo" },
  { id: "butterfly", label: "Butterfly", desc: "Ventre da curva se move diferente das pontas" },
];

/* ─── Scenario presets ─── */
const PRESETS: Record<ShiftMode, { label: string; bps: number; color: string }[]> = {
  parallel: [
    { label: "Hawkish +150", bps: 150, color: "text-red-400" },
    { label: "Base", bps: 0, color: "text-zinc-400" },
    { label: "Dovish −150", bps: -150, color: "text-emerald-400" },
  ],
  twist: [
    { label: "Steepen +100", bps: 100, color: "text-red-400" },
    { label: "Flat", bps: 0, color: "text-zinc-400" },
    { label: "Flatten −100", bps: -100, color: "text-emerald-400" },
  ],
  butterfly: [
    { label: "Belly Up +100", bps: 100, color: "text-amber-400" },
    { label: "Flat", bps: 0, color: "text-zinc-400" },
    { label: "Belly Down −100", bps: -100, color: "text-indigo-400" },
  ],
};

/* ─── Shape analysis ─── */
function analyzeShape(points: number[]): { shape: string; description: string; color: string } {
  if (points.length < 3) return { shape: "Indefinida", description: "Dados insuficientes", color: "text-zinc-500" };
  const mid = points.slice(2, 5);
  const back = points.slice(5);
  const backSlope = back.length > 1 ? (back[back.length - 1] - back[0]) / back.length : 0;
  const midMax = Math.max(...mid);
  const endVal = points[points.length - 1];
  const startVal = points[0];
  if (startVal > endVal + 0.5) return { shape: "Invertida", description: "Taxas curtas acima das longas — sinal recessivo", color: "text-red-400" };
  if (midMax > Math.max(startVal, endVal) + 0.3 && backSlope < -0.05) return { shape: "Corcova", description: "Pico no médio prazo — expectativa de corte futuro", color: "text-amber-400" };
  if (Math.abs(startVal - endVal) < 0.3) return { shape: "Flat", description: "Taxas uniformes — incerteza sobre direção da política", color: "text-zinc-400" };
  return { shape: "Normal", description: "Ascendente — prêmio de prazo saudável", color: "text-emerald-400" };
}

/* ─── Shift functions by mode ─── */
function applyShift(mode: ShiftMode, baseRate: number, monthsNorm: number, deltaBps: number): number {
  const shift = deltaBps / 100;
  switch (mode) {
    case "parallel":
      return baseRate + shift;
    case "twist":
      // Short end moves opposite to long end
      // monthsNorm: 0 → 1 (0M → 120M)
      return baseRate + shift * (monthsNorm - 0.5) * 2;
    case "butterfly":
      // Belly (mid) moves, wings stay
      // Peak effect at monthsNorm ≈ 0.4 (≈2a)
      const bellyWeight = Math.exp(-Math.pow((monthsNorm - 0.4) / 0.3, 2));
      return baseRate + shift * bellyWeight;
  }
}

export const YieldCurveSimulator = ({
  currentSelic,
  focusSelic2026 = 12.5,
  focusSelic2027 = 10.5,
}: YieldCurveSimulatorProps) => {
  const [shiftMode, setShiftMode] = useState<ShiftMode>("parallel");
  const [deltaBps, setDeltaBps] = useState(0);

  const tenors = useMemo(() => [
    { label: "ON", months: 0, base: currentSelic },
    { label: "3M", months: 3, base: currentSelic - 0.15 },
    { label: "6M", months: 6, base: currentSelic - 0.25 },
    { label: "1A", months: 12, base: (currentSelic + focusSelic2026) / 2 },
    { label: "2A", months: 24, base: focusSelic2027 },
    { label: "3A", months: 36, base: focusSelic2027 - 0.5 },
    { label: "5A", months: 60, base: focusSelic2027 - 0.8 },
    { label: "10A", months: 120, base: focusSelic2027 - 0.3 },
  ], [currentSelic, focusSelic2026, focusSelic2027]);

  const curveData = useMemo(() => {
    const maxMonths = 120;
    return tenors.map((t) => {
      const norm = t.months / maxMonths;
      const shifted = applyShift(shiftMode, t.base, norm, deltaBps);
      return {
        tenor: t.label,
        base: Math.round(t.base * 100) / 100,
        shifted: Math.round(shifted * 100) / 100,
        focus: t.months <= 24
          ? Math.round((t.months <= 12 ? focusSelic2026 : focusSelic2027) * 100) / 100
          : undefined,
      };
    });
  }, [tenors, shiftMode, deltaBps, focusSelic2026, focusSelic2027]);

  const shiftedValues = curveData.map((d) => d.shifted);
  const shapeAnalysis = useMemo(() => analyzeShape(shiftedValues), [shiftedValues]);

  /* ─── DV01 estimated (per R$1000 notional) ─── */
  const dv01 = useMemo(() => {
    // Simple estimate: average modified duration across the curve × notional × 1bp
    // Approx: midpoint duration ≈ 3 years → DV01 ≈ 0.30 per R$1000
    const avgRate = shiftedValues.reduce((s, v) => s + v, 0) / shiftedValues.length / 100;
    const avgDuration = 3; // rough estimate in years for a medium-term portfolio
    return Math.round(avgDuration / (1 + avgRate) * 10) / 100; // per R$1000, per 1bp
  }, [shiftedValues]);

  /* ─── Y-axis nice domain ─── */
  const allRates = curveData.flatMap((d) => [d.base, d.shifted, ...(d.focus !== undefined ? [d.focus] : [])]);
  const yMin = Math.floor(Math.min(...allRates) - 0.5);
  const yMax = Math.ceil(Math.max(...allRates) + 0.5);

  const activePresets = PRESETS[shiftMode];

  return (
    <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#10B981]" />
          <h3 className="text-xs font-medium text-zinc-400 font-mono">Simulador Curva de Rendimento</h3>
          <span className="text-[9px] font-mono text-zinc-600">v2</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${shapeAnalysis.color} border-current/20 bg-current/5`}>
            {shapeAnalysis.shape}
          </span>
          {/* DV01 badge */}
          <span className="text-[9px] font-mono text-zinc-600 px-2 py-0.5 rounded border border-[#1a1a1a]">
            DV01 ≈ R$ {dv01.toFixed(2)}/1000
          </span>
        </div>
      </div>

      {/* Shift mode selector */}
      <div className="flex items-center gap-1 mb-3">
        <span className="text-[9px] text-zinc-600 font-mono mr-1">Modo:</span>
        {SHIFT_MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => { setShiftMode(m.id); setDeltaBps(0); }}
            className={`px-2 py-0.5 rounded text-[9px] font-mono transition-colors border ${
              shiftMode === m.id
                ? "text-[#10B981] border-[#10B981]/30 bg-[#10B981]/10"
                : "text-zinc-600 border-[#1a1a1a] hover:text-zinc-400"
            }`}
            title={m.desc}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Scenario presets + slider */}
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-[9px] text-zinc-600 font-mono mr-1">Cenários:</span>
        {activePresets.map((s) => (
          <button
            key={s.label}
            onClick={() => setDeltaBps(s.bps)}
            className={`px-2 py-0.5 rounded text-[9px] font-mono transition-colors border ${
              deltaBps === s.bps
                ? `${s.color} border-current/30 bg-current/10`
                : "text-zinc-600 border-[#1a1a1a] hover:text-zinc-400 hover:border-[#2a2a2a]"
            }`}
          >
            {s.label}
          </button>
        ))}
        <div className="flex-1" />
        <input
          type="range"
          min={-300}
          max={300}
          step={25}
          value={deltaBps}
          onChange={(e) => setDeltaBps(Number(e.target.value))}
          className="w-20 accent-[#10B981]"
        />
        <span className={`text-[10px] font-mono font-bold w-14 text-right ${deltaBps > 0 ? "text-red-400" : deltaBps < 0 ? "text-emerald-400" : "text-zinc-500"}`}>
          {deltaBps > 0 ? "+" : ""}{deltaBps}bps
        </span>
      </div>

      <ResponsiveContainer width="100%" height={240}>
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
          <Line type="monotone" dataKey="shifted" name="Simulado" stroke="#10B981" strokeWidth={2} dot={{ r: 4, fill: "#10B981" }} />
          <Line type="monotone" dataKey="focus" name="Focus" stroke="#6366F1" strokeWidth={1.5} dot={{ r: 3, fill: "#6366F1" }} strokeDasharray="6 3" connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>

      {/* Footer: shape + mode description + legend */}
      <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-3 h-3 text-zinc-600" />
          <span className={`text-[9px] font-mono ${shapeAnalysis.color}`}>
            {shapeAnalysis.description}
          </span>
        </div>
        <div className="flex items-center gap-4 text-[9px] text-zinc-600 font-mono">
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 inline-block border-t border-dashed border-zinc-500" /> Atual
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-[#10B981] inline-block" /> Simulado
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-[#6366F1] inline-block border-t border-dashed" /> Focus
          </span>
        </div>
      </div>
    </div>
  );
};
