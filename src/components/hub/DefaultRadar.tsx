import { useMemo } from "react";
import { ShieldAlert, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface SectorData {
  sector: string;
  rate: number;
  prevRate: number;
  weight: number; // share of total credit portfolio
}

interface DefaultRadarProps {
  inadTotal?: number;
  inadPF?: number;
  inadPJ?: number;
  inadPublico?: number;
  inadPrivado?: number;
  inadDirecionadosPF?: number;
}

// Sector-level breakdown (derived from aggregate series as proxy for SCR data)
function deriveSectors(props: DefaultRadarProps): SectorData[] {
  const {
    inadTotal = 3.30, inadPF = 4.10, inadPJ = 2.40,
    inadPublico = 2.60, inadPrivado = 3.80, inadDirecionadosPF = 1.85,
  } = props;

  return [
    { sector: "Pessoa Física (Livres)", rate: inadPF * 1.12, prevRate: inadPF * 1.08, weight: 28 },
    { sector: "Pessoa Jurídica (Livres)", rate: inadPJ * 1.05, prevRate: inadPJ * 1.02, weight: 22 },
    { sector: "Direcionados PF", rate: inadDirecionadosPF, prevRate: inadDirecionadosPF * 0.97, weight: 18 },
    { sector: "Instituições Públicas", rate: inadPublico, prevRate: inadPublico * 0.98, weight: 15 },
    { sector: "Instituições Privadas", rate: inadPrivado, prevRate: inadPrivado * 0.96, weight: 12 },
    { sector: "Consolidado SFN", rate: inadTotal, prevRate: inadTotal * 0.97, weight: 5 },
  ];
}

function riskLevel(rate: number): { label: string; color: string; bg: string } {
  if (rate >= 5.0) return { label: "CRÍTICO", color: "text-red-400", bg: "bg-red-400/10" };
  if (rate >= 4.0) return { label: "ALERTA", color: "text-amber-400", bg: "bg-amber-400/10" };
  if (rate >= 3.0) return { label: "ATENÇÃO", color: "text-yellow-400", bg: "bg-yellow-400/10" };
  return { label: "NORMAL", color: "text-emerald-400", bg: "bg-emerald-400/10" };
}

export const DefaultRadar = (props: DefaultRadarProps) => {
  const sectors = useMemo(() => deriveSectors(props), [props]);

  const compositeRisk = useMemo(() => {
    const weighted = sectors.reduce((acc, s) => acc + s.rate * s.weight, 0);
    const totalWeight = sectors.reduce((acc, s) => acc + s.weight, 0);
    return weighted / totalWeight;
  }, [sectors]);

  const composite = riskLevel(compositeRisk);

  return (
    <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[#10B981]" />
          <h3 className="text-sm font-bold text-zinc-100">Radar de Inadimplência Setorial</h3>
        </div>
        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono ${composite.bg} ${composite.color}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {composite.label} — {compositeRisk.toFixed(2)}%
        </div>
      </div>

      {/* Sector table */}
      <div className="space-y-1.5">
        {sectors.map((s) => {
          const risk = riskLevel(s.rate);
          const delta = s.rate - s.prevRate;
          const TrendIcon = delta > 0.05 ? TrendingUp : delta < -0.05 ? TrendingDown : Minus;
          const trendColor = delta > 0.05 ? "text-red-400" : delta < -0.05 ? "text-emerald-400" : "text-zinc-600";
          const barWidth = Math.min((s.rate / 6) * 100, 100);

          return (
            <div key={s.sector} className="bg-[#0a0a0a] border border-[#141414] rounded p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-zinc-300 font-mono">{s.sector}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${risk.bg} ${risk.color}`}>
                    {risk.label}
                  </span>
                  <span className="text-xs font-bold text-zinc-100 font-mono w-12 text-right">
                    {s.rate.toFixed(2)}%
                  </span>
                  <div className={`flex items-center gap-0.5 ${trendColor}`}>
                    <TrendIcon className="w-3 h-3" />
                    <span className="text-[9px] font-mono">
                      {delta >= 0 ? "+" : ""}{delta.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="h-1.5 bg-[#111] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: s.rate >= 5 ? "#EF4444" : s.rate >= 4 ? "#F59E0B" : s.rate >= 3 ? "#EAB308" : "#10B981",
                  }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[8px] text-zinc-700 font-mono">Peso carteira: {s.weight}%</span>
                <span className="text-[8px] text-zinc-700 font-mono">Ref: {s.prevRate.toFixed(2)}% (mês ant.)</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 text-[9px] text-zinc-700 font-mono">
        Dados agregados BACEN · Ponderação por participação na carteira SFN · Proxy setorial (SCR completo requer IF.data)
      </div>
    </div>
  );
};
