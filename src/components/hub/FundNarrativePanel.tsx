/**
 * FundNarrativePanel.tsx — Fund market intelligence panel (H1.4 Fase D)
 *
 * Regime detection + cross-module signals for the fund market.
 * Follows the same pattern as MacroNarrativePanel, CreditNarrativePanel,
 * FixedIncomeNarrativePanel.
 */

import { useMemo } from "react";
import { Brain, AlertTriangle, TrendingUp, TrendingDown, Activity, Shield, Zap } from "lucide-react";

/* ─── Types ─── */
interface FundMarketRegime {
  regime: string;
  color: string;
  icon: typeof Brain;
  description: string;
}

interface Signal {
  type: "bullish" | "bearish" | "neutral" | "warning";
  title: string;
  description: string;
  strength: number; // 0–100
}

interface FundNarrativeProps {
  totalFunds?: number;
  totalPL?: number;
  avgRentab?: number | null;
  netFlow?: number | null;
  selicMeta?: number;
  ipcaAccum?: number;
  avgTaxaAdm?: number | null;
  fidcInadim?: number | null;
  fiiAvgDY?: number | null;
  concentracaoTop10?: number | null; // % PL in top 10
}

/* ─── Regime detection ─── */
function detectFundMarketRegime(props: FundNarrativeProps): FundMarketRegime {
  const { avgRentab, netFlow, selicMeta = 14.15, fidcInadim, fiiAvgDY } = props;

  const strongInflows = netFlow != null && netFlow > 0;
  const outflows = netFlow != null && netFlow < 0;
  const highRentab = avgRentab != null && avgRentab > 1.0;
  const negativeRentab = avgRentab != null && avgRentab < 0;
  const highInadim = fidcInadim != null && fidcInadim > 5.0;
  const highSelic = selicMeta > 12.0;
  const compressedDY = fiiAvgDY != null && fiiAvgDY < 0.5;

  // Stress: outflows + negative returns + high FIDC default
  if (outflows && negativeRentab && highInadim) {
    return {
      regime: "Stress Sistêmico",
      color: "#EF4444",
      icon: AlertTriangle,
      description: "Resgates líquidos + rentabilidade negativa + inadimplência FIDC elevada. Mercado em pressão generalizada.",
    };
  }

  // Contração: outflows + weak returns
  if (outflows && !highRentab) {
    return {
      regime: "Contração",
      color: "#F97316",
      icon: TrendingDown,
      description: "Captação líquida negativa com rentabilidade abaixo do benchmark. Investidores reduzindo exposição.",
    };
  }

  // Expansão acelerada: strong inflows + high returns
  if (strongInflows && highRentab) {
    return {
      regime: "Expansão Acelerada",
      color: "#22C55E",
      icon: TrendingUp,
      description: "Captação líquida positiva + rentabilidade acima do benchmark. Momentum favorável para a indústria.",
    };
  }

  // Rotação Selic: high Selic + compressed FII DY
  if (highSelic && compressedDY) {
    return {
      regime: "Rotação p/ RF",
      color: "#8B5CF6",
      icon: Activity,
      description: "Selic elevada comprimindo DY de FII. Fluxo migrando para renda fixa e pós-fixados.",
    };
  }

  // Aperto Monetário: high Selic + outflows
  if (highSelic && outflows) {
    return {
      regime: "Aperto Monetário",
      color: "#F59E0B",
      icon: Shield,
      description: "Selic restritiva + resgates. Fundos com duration longa e multimercados sob pressão.",
    };
  }

  // Normalização
  if (strongInflows && !negativeRentab) {
    return {
      regime: "Normalização",
      color: "#3B82F6",
      icon: Zap,
      description: "Fluxos positivos com retornos moderados. Mercado em equilíbrio com perspectiva construtiva.",
    };
  }

  return {
    regime: "Transição",
    color: "#6B7280",
    icon: Brain,
    description: "Sinais mistos no mercado de fundos. Sem tendência clara definida entre os indicadores.",
  };
}

/* ─── Cross-module signals ─── */
function generateFundSignals(props: FundNarrativeProps): Signal[] {
  const signals: Signal[] = [];
  const { avgRentab, netFlow, selicMeta = 14.15, ipcaAccum = 5.0, avgTaxaAdm, fidcInadim, fiiAvgDY, concentracaoTop10 } = props;

  // 1. Real return signal
  if (avgRentab != null) {
    const realReturn = avgRentab - (ipcaAccum / 12); // monthly comparison
    if (realReturn < 0) {
      signals.push({
        type: "bearish",
        title: "Retorno real negativo",
        description: `Rentabilidade média (${avgRentab.toFixed(2)}%) abaixo da inflação mensal (~${(ipcaAccum / 12).toFixed(2)}%). Fundos perdendo poder de compra.`,
        strength: 70,
      });
    } else if (realReturn > 0.5) {
      signals.push({
        type: "bullish",
        title: "Retorno real expressivo",
        description: `Rentabilidade média superando inflação em ${realReturn.toFixed(2)}pp. Geração de valor real positiva.`,
        strength: 65,
      });
    }
  }

  // 2. Flow momentum
  if (netFlow != null) {
    if (netFlow > 0) {
      signals.push({
        type: "bullish",
        title: "Captação líquida positiva",
        description: "Fluxo líquido positivo indica confiança dos investidores na indústria.",
        strength: 60,
      });
    } else {
      signals.push({
        type: "bearish",
        title: "Resgates líquidos",
        description: "Saída líquida de recursos. Monitorar pressão sobre PL e liquidez dos fundos.",
        strength: 65,
      });
    }
  }

  // 3. FIDC stress
  if (fidcInadim != null) {
    if (fidcInadim > 5.0) {
      signals.push({
        type: "warning",
        title: "Inadimplência FIDC elevada",
        description: `Taxa de inadimplência FIDC em ${fidcInadim.toFixed(2)}% — acima do limiar de stress (5%).`,
        strength: 80,
      });
    } else if (fidcInadim < 2.0) {
      signals.push({
        type: "bullish",
        title: "Crédito estruturado saudável",
        description: `Inadimplência FIDC controlada (${fidcInadim.toFixed(2)}%). Qualidade de crédito favorável.`,
        strength: 55,
      });
    }
  }

  // 4. FII DY vs Selic
  if (fiiAvgDY != null) {
    const selicMensal = Math.pow(1 + selicMeta / 100, 1 / 12) - 1;
    const dyMensal = fiiAvgDY / 100;
    if (dyMensal < selicMensal * 0.8) {
      signals.push({
        type: "bearish",
        title: "DY FII comprimido vs Selic",
        description: `DY médio FII (${fiiAvgDY.toFixed(2)}%) abaixo de 80% da Selic mensal. Migração para RF provável.`,
        strength: 70,
      });
    }
  }

  // 5. Concentration risk
  if (concentracaoTop10 != null && concentracaoTop10 > 60) {
    signals.push({
      type: "warning",
      title: "Concentração elevada",
      description: `Top 10 fundos detêm ${concentracaoTop10.toFixed(0)}% do PL total. Risco de concentração sistêmica.`,
      strength: 55,
    });
  }

  // 6. Cost efficiency
  if (avgTaxaAdm != null) {
    if (avgTaxaAdm > 2.0) {
      signals.push({
        type: "neutral",
        title: "Taxas de administração elevadas",
        description: `Média de taxa de adm (${avgTaxaAdm.toFixed(2)}%) acima do benchmark de mercado (2.0%). Pressão sobre retorno líquido.`,
        strength: 45,
      });
    }
  }

  return signals.sort((a, b) => b.strength - a.strength);
}

/* ─── Component ─── */
export const FundNarrativePanel = (props: FundNarrativeProps) => {
  const regime = useMemo(() => detectFundMarketRegime(props), [props]);
  const signals = useMemo(() => generateFundSignals(props), [props]);

  const Icon = regime.icon;

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg overflow-hidden">
      {/* Regime header */}
      <div className="px-4 py-3 border-b border-zinc-800/50" style={{ borderLeftColor: regime.color, borderLeftWidth: 3 }}>
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center"
            style={{ backgroundColor: regime.color + "15" }}
          >
            <Icon className="w-4 h-4" style={{ color: regime.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-mono">
                Regime de Mercado
              </span>
              <span
                className="text-[10px] font-bold font-mono px-2 py-0.5 rounded"
                style={{ color: regime.color, backgroundColor: regime.color + "15" }}
              >
                {regime.regime}
              </span>
            </div>
            <p className="text-[9px] text-zinc-600 mt-0.5 leading-relaxed">{regime.description}</p>
          </div>
        </div>
      </div>

      {/* Signals */}
      {signals.length > 0 && (
        <div className="px-4 py-3 space-y-2">
          <h4 className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono mb-2">
            Sinais Cross-Module ({signals.length})
          </h4>
          {signals.map((signal, i) => {
            const signalColor =
              signal.type === "bullish" ? "#22C55E" :
              signal.type === "bearish" ? "#EF4444" :
              signal.type === "warning" ? "#F59E0B" :
              "#6B7280";
            return (
              <div key={i} className="flex items-start gap-2 bg-[#0a0a0a] rounded p-2">
                <div
                  className="w-1 h-full rounded-full flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: signalColor, minHeight: "20px" }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-300 font-mono font-medium">{signal.title}</span>
                    <span className="text-[8px] text-zinc-700 font-mono">
                      {signal.strength}%
                    </span>
                  </div>
                  <p className="text-[9px] text-zinc-600 leading-relaxed mt-0.5">{signal.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
