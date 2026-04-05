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

  return (
    <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#0B6C3E]" />
          <h3 className="text-xs font-medium text-zinc-400 font-mono">
            Simulador Curva de Rendimento
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-zinc-600 font-mono">Choque:</span>
          <input
            type="range"
            min={-300}
            max={300}
            step={25}
            value={deltaBps}
            onChange={(e) => setDeltaBps(Number(e.target.value))}
            className="w-24 accent-[#0B6C3E]"
          />
          <span className={`text-[11px] font-mono font-bold ${deltaBps > 0 ? "text-red-400" : deltaBps < 0 ? "text-emerald-400" : "text-zinc-500"}`}>
            {deltaBps > 0 ? "+" : ""}{deltaBps} bps
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
            width={45}
            domain={["auto", "auto"]}
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
          />
          <ReferenceLine y={currentSelic} stroke="#3f3f46" strokeDasharray="4 4" />
          <Line type="monotone" dataKey="base" name="Atual" stroke="#52525b" strokeWidth={1.5} dot={{ r: 3 }} strokeDasharray="4 4" />
          <Line type="monotone" dataKey="shifted" name="Simulado" stroke="#0B6C3E" strokeWidth={2} dot={{ r: 4, fill: "#0B6C3E" }} />
        </LineChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-4 mt-2 text-[9px] text-zinc-600 font-mono">
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-zinc-500 inline-block" style={{ borderTop: "1px dashed #52525b" }} /> Curva atual
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-[#0B6C3E] inline-block" /> Cenário simulado
        </span>
      </div>
    </div>
  );
};
