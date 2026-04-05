/**
 * FundScoreCard.tsx — Muuney Fund Score™ visual card (H1.4 Fase C)
 * Displays composite score with 4-pillar radar breakdown.
 */

import type { FundScoreResult } from "@/lib/fundScore";

interface FundScoreCardProps {
  score: FundScoreResult;
  fundName?: string;
  compact?: boolean;
}

export const FundScoreCard = ({ score, fundName, compact }: FundScoreCardProps) => {
  const pilares = [
    { key: "rentabilidade", label: "Rentab.", value: score.pilares.rentabilidade },
    { key: "risco", label: "Risco", value: score.pilares.risco },
    { key: "liquidez", label: "Liquid.", value: score.pilares.liquidez },
    { key: "custos", label: "Custos", value: score.pilares.custos },
  ];

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold font-mono"
          style={{ backgroundColor: score.color + "20", color: score.color, border: `1.5px solid ${score.color}40` }}
        >
          {Math.round(score.score)}
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-mono font-medium" style={{ color: score.color }}>
            {score.label}
          </div>
          {fundName && (
            <div className="text-[8px] text-zinc-600 font-mono truncate max-w-[120px]">{fundName}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-0.5">
            Muuney Fund Score™
          </div>
          {fundName && (
            <div className="text-[11px] text-zinc-300 font-mono truncate max-w-[200px]">{fundName}</div>
          )}
        </div>
        <div className="text-right">
          <div
            className="text-2xl font-bold font-mono"
            style={{ color: score.color }}
          >
            {score.score.toFixed(0)}
          </div>
          <div
            className="text-[10px] font-mono font-medium"
            style={{ color: score.color }}
          >
            {score.label}
          </div>
        </div>
      </div>

      {/* Score bar */}
      <div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden mb-4">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score.score}%`, backgroundColor: score.color }}
        />
      </div>

      {/* Pillar breakdown */}
      <div className="grid grid-cols-4 gap-2">
        {pilares.map((p) => (
          <div key={p.key} className="text-center">
            <div className="text-[8px] text-zinc-600 uppercase font-mono mb-1">{p.label}</div>
            <div className="relative h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden mb-0.5">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${p.value}%`,
                  backgroundColor: p.value >= 70 ? "#22C55E" : p.value >= 50 ? "#F59E0B" : "#EF4444",
                }}
              />
            </div>
            <div className="text-[10px] font-bold font-mono text-zinc-300">{p.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
