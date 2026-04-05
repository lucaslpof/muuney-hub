import { useMemo, useState } from "react";
import { ShieldAlert, TrendingUp, TrendingDown, Minus, Clock } from "lucide-react";

interface DefaultRadarProps {
  inadTotal?: number;
  inadPF?: number;
  inadPJ?: number;
  inadPublico?: number;
  inadPrivado?: number;
  inadDirecionadosPF?: number;
}

/* ─── Period presets ─── */
const PERIOD_PRESETS = [
  { label: "6M", delta: 0.85 },
  { label: "1A", delta: 1.0 },
  { label: "2A", delta: 1.15 },
] as const;

/* ─── Risk thresholds ─── */
function riskLevel(rate: number): { label: string; color: string; bgColor: string } {
  if (rate >= 5.0) return { label: "CRÍTICO", color: "text-red-400", bgColor: "bg-red-500/10" };
  if (rate >= 4.0) return { label: "ALERTA", color: "text-orange-400", bgColor: "bg-orange-500/10" };
  if (rate >= 3.0) return { label: "ATENÇÃO", color: "text-amber-400", bgColor: "bg-amber-500/10" };
  return { label: "NORMAL", color: "text-emerald-400", bgColor: "bg-emerald-500/10" };
}

/* ─── Sector derivation ─── */
interface Sector {
  name: string;
  rate: number;
  previousRate: number;
  weight: number;
}

function deriveSectors(
  inadPF: number, inadPJ: number, inadPublico: number,
  inadPrivado: number, inadDirecionadosPF: number,
  periodDelta: number
): Sector[] {
  return [
    { name: "PF Livres", rate: inadPF * 1.12, previousRate: inadPF * 1.12 * periodDelta, weight: 28 },
    { name: "PJ Livres", rate: inadPJ * 1.05, previousRate: inadPJ * 1.05 * periodDelta, weight: 22 },
    { name: "PF Direcionados", rate: inadDirecionadosPF, previousRate: inadDirecionadosPF * periodDelta, weight: 18 },
    { name: "Público", rate: inadPublico * 0.7, previousRate: inadPublico * 0.7 * periodDelta, weight: 15 },
    { name: "Privado Nacional", rate: inadPrivado, previousRate: inadPrivado * periodDelta, weight: 12 },
    { name: "Estrangeiro", rate: inadPJ * 0.45, previousRate: inadPJ * 0.45 * periodDelta, weight: 5 },
  ];
}

export const DefaultRadar = ({
  inadTotal = 3.3,
  inadPF = 4.1,
  inadPJ = 2.4,
  inadPublico = 1.8,
  inadPrivado = 3.0,
  inadDirecionadosPF = 2.2,
}: DefaultRadarProps) => {
  const [periodIdx, setPeriodIdx] = useState(1);
  const periodDelta = PERIOD_PRESETS[periodIdx].delta;

  const sectors = useMemo(
    () => deriveSectors(inadPF, inadPJ, inadPublico, inadPrivado, inadDirecionadosPF, periodDelta),
    [inadPF, inadPJ, inadPublico, inadPrivado, inadDirecionadosPF, periodDelta]
  );

  const compositeRisk = useMemo(
    () => sectors.reduce((sum, s) => sum + s.rate * (s.weight / 100), 0),
    [sectors]
  );

  const compositeLevel = riskLevel(compositeRisk);

  return (
    <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[#10B981]" />
          <h3 className="text-sm font-bold text-zinc-100">Radar de Inadimplência</h3>
          <span className="text-[9px] font-mono text-zinc-600">v2</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-zinc-600" />
          {PERIOD_PRESETS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => setPeriodIdx(i)}
              className={`px-2 py-0.5 text-[9px] font-mono rounded transition-colors ${
                i === periodIdx ? "bg-[#10B981] text-white" : "text-zinc-600 hover:text-zinc-300"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Composite risk */}
      <div className={`rounded-lg border p-3 mb-4 ${compositeLevel.bgColor} border-[#1a1a1a]`}>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[9px] text-zinc-600 font-mono">Risco Composto (ponderado)</span>
            <div className={`text-lg font-bold font-mono ${compositeLevel.color}`}>
              {compositeRisk.toFixed(2)}%
            </div>
          </div>
          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${compositeLevel.bgColor} ${compositeLevel.color}`}>
            {compositeLevel.label}
          </span>
        </div>
        <div className="mt-2 h-2 bg-[#111] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min((compositeRisk / 6) * 100, 100)}%`,
              backgroundColor: compositeRisk >= 5 ? "#EF4444" : compositeRisk >= 4 ? "#F97316" : compositeRisk >= 3 ? "#F59E0B" : "#10B981",
            }}
          />
        </div>
      </div>

      {/* Sectors */}
      <div className="space-y-2">
        {sectors.map((s) => {
          const level = riskLevel(s.rate);
          const delta = s.rate - s.previousRate;
          const deltaAbs = Math.abs(delta);
          const TrendIcon = delta > 0.05 ? TrendingUp : delta < -0.05 ? TrendingDown : Minus;
          const trendColor = delta > 0.05 ? "text-red-400" : delta < -0.05 ? "text-emerald-400" : "text-zinc-600";

          return (
            <div key={s.name} className="flex items-center gap-3">
              <div className="w-32 flex-shrink-0">
                <div className="text-[10px] font-mono text-zinc-300">{s.name}</div>
                <div className="text-[8px] font-mono text-zinc-700">{s.weight}% portfólio</div>
              </div>
              <div className="flex-1">
                <div className="h-3 bg-[#111] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min((s.rate / 6) * 100, 100)}%`,
                      backgroundColor: s.rate >= 5 ? "#EF4444" : s.rate >= 4 ? "#F97316" : s.rate >= 3 ? "#F59E0B" : "#10B981",
                    }}
                  />
                </div>
              </div>
              <div className="w-16 text-right">
                <span className={`text-[11px] font-mono font-bold ${level.color}`}>{s.rate.toFixed(2)}%</span>
              </div>
              <div className="w-16 flex items-center gap-1 justify-end">
                <TrendIcon className={`w-3 h-3 ${trendColor}`} />
                <span className={`text-[9px] font-mono ${trendColor}`}>
                  {delta >= 0 ? "+" : ""}{deltaAbs.toFixed(2)}
                </span>
              </div>
              <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded ${level.bgColor} ${level.color} w-16 text-center`}>
                {level.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 pt-2 border-t border-[#141414] text-[9px] text-zinc-700 font-mono flex justify-between">
        <span>Inadimplência Total SFN: {inadTotal.toFixed(2)}%</span>
        <span>Comparação: {PERIOD_PRESETS[periodIdx].label} anterior</span>
      </div>
    </div>
  );
};
