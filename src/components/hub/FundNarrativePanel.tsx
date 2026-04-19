/**
 * FundNarrativePanel.tsx — Fund market intelligence panel (H1.4 Fase D)
 *
 * Two scopes:
 *   - scope="market" (default): aggregate market-wide regime + cross-module signals.
 *     Used in HubFundos Analytics section.
 *   - scope="fund": per-fund regime + fund-specific signals. Used in
 *     FundLamina / FidcLamina / FiiLamina so that the panel reflects the
 *     current fund's risk/return profile, not just the overall market.
 *
 * Follows the same pattern as MacroNarrativePanel, CreditNarrativePanel,
 * FixedIncomeNarrativePanel.
 */

import { useMemo } from "react";
import {
  Brain,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
  Shield,
  Zap,
} from "lucide-react";

/* ─── Shared types ─── */
interface RegimeBadge {
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

/* ─── Market-scope props ─── */
interface MarketScopeProps {
  scope?: "market";
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

/* ─── Fund-scope props ─── */
export interface FundScopeContext {
  /** Fund class (RF, Multi, Ações, FIDC, FII, FIP, ETF, Cambial, ...). */
  classe?: string | null;
  /** Fund display name (for subtitle). */
  nome?: string | null;

  /* Performance */
  returnPct?: number | null; // total return in the reference window (%)
  annualizedPct?: number | null; // annualized (for ≥12m windows)
  cdiPct?: number | null; // CDI in same window (%)
  vsCdiPP?: number | null; // excess over CDI in percentage points
  volAnnualPct?: number | null;
  sharpe?: number | null;
  maxDrawdownPct?: number | null; // negative number
  sortino?: number | null;

  /* Flow / size */
  plBRL?: number | null;
  plTrend?: "up" | "down" | "flat" | null;
  cotistasTrend?: "up" | "down" | "flat" | null;

  /* Class-specific */
  fidcSubordPct?: number | null;
  fidcInadimPct?: number | null;
  fiiDyMensal?: number | null;

  /* Costs */
  taxaAdmPct?: number | null;

  /* Macro reference */
  selicMeta?: number;
  ipcaAccum?: number;
}

interface FundScopeProps {
  scope: "fund";
  fundContext: FundScopeContext;
}

/* ─── Public props ─── */
export type FundNarrativeProps = MarketScopeProps | FundScopeProps;

/* ─── Market regime detection ─── */
function detectFundMarketRegime(props: MarketScopeProps): RegimeBadge {
  const { avgRentab, netFlow, selicMeta = 14.15, fidcInadim, fiiAvgDY } = props;

  const strongInflows = netFlow != null && netFlow > 0;
  const outflows = netFlow != null && netFlow < 0;
  const highRentab = avgRentab != null && avgRentab > 1.0;
  const negativeRentab = avgRentab != null && avgRentab < 0;
  const highInadim = fidcInadim != null && fidcInadim > 5.0;
  const highSelic = selicMeta > 12.0;
  const compressedDY = fiiAvgDY != null && fiiAvgDY < 0.5;

  if (outflows && negativeRentab && highInadim) {
    return {
      regime: "Stress Sistêmico",
      color: "#EF4444",
      icon: AlertTriangle,
      description:
        "Resgates líquidos + rentabilidade negativa + inadimplência FIDC elevada. Mercado em pressão generalizada.",
    };
  }
  if (outflows && !highRentab) {
    return {
      regime: "Contração",
      color: "#F97316",
      icon: TrendingDown,
      description:
        "Captação líquida negativa com rentabilidade abaixo do benchmark. Investidores reduzindo exposição.",
    };
  }
  if (strongInflows && highRentab) {
    return {
      regime: "Expansão Acelerada",
      color: "#22C55E",
      icon: TrendingUp,
      description:
        "Captação líquida positiva + rentabilidade acima do benchmark. Momentum favorável para a indústria.",
    };
  }
  if (highSelic && compressedDY) {
    return {
      regime: "Rotação p/ RF",
      color: "#8B5CF6",
      icon: Activity,
      description:
        "Selic elevada comprimindo DY de FII. Fluxo migrando para renda fixa e pós-fixados.",
    };
  }
  if (highSelic && outflows) {
    return {
      regime: "Aperto Monetário",
      color: "#F59E0B",
      icon: Shield,
      description:
        "Selic restritiva + resgates. Fundos com duration longa e multimercados sob pressão.",
    };
  }
  if (strongInflows && !negativeRentab) {
    return {
      regime: "Normalização",
      color: "#3B82F6",
      icon: Zap,
      description:
        "Fluxos positivos com retornos moderados. Mercado em equilíbrio com perspectiva construtiva.",
    };
  }
  return {
    regime: "Transição",
    color: "#6B7280",
    icon: Brain,
    description:
      "Sinais mistos no mercado de fundos. Sem tendência clara definida entre os indicadores.",
  };
}

/* ─── Market cross-module signals ─── */
function generateFundMarketSignals(props: MarketScopeProps): Signal[] {
  const signals: Signal[] = [];
  const {
    avgRentab,
    netFlow,
    selicMeta = 14.15,
    ipcaAccum = 5.0,
    avgTaxaAdm,
    fidcInadim,
    fiiAvgDY,
    concentracaoTop10,
  } = props;

  if (avgRentab != null) {
    const realReturn = avgRentab - ipcaAccum / 12;
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

  if (concentracaoTop10 != null && concentracaoTop10 > 60) {
    signals.push({
      type: "warning",
      title: "Concentração elevada",
      description: `Top 10 fundos detêm ${concentracaoTop10.toFixed(0)}% do PL total. Risco de concentração sistêmica.`,
      strength: 55,
    });
  }

  if (avgTaxaAdm != null && avgTaxaAdm > 2.0) {
    signals.push({
      type: "neutral",
      title: "Taxas de administração elevadas",
      description: `Média de taxa de adm (${avgTaxaAdm.toFixed(2)}%) acima do benchmark de mercado (2.0%). Pressão sobre retorno líquido.`,
      strength: 45,
    });
  }

  return signals.sort((a, b) => b.strength - a.strength);
}

/* ─── Per-fund regime detection ─── */
function detectFundRegime(ctx: FundScopeContext): RegimeBadge {
  const {
    vsCdiPP,
    sharpe,
    maxDrawdownPct,
    volAnnualPct,
    fidcInadimPct,
    fidcSubordPct,
    fiiDyMensal,
    selicMeta = 14.15,
    classe,
  } = ctx;

  const deepDD = maxDrawdownPct != null && maxDrawdownPct < -20;
  const severeDD = maxDrawdownPct != null && maxDrawdownPct < -10;
  const mildDD = maxDrawdownPct != null && maxDrawdownPct < -5;

  const stronglyOverCdi = vsCdiPP != null && vsCdiPP > 2;
  const underCdi = vsCdiPP != null && vsCdiPP < -1;
  const badlyUnderCdi = vsCdiPP != null && vsCdiPP < -5;

  const strongSharpe = sharpe != null && sharpe > 1;
  const weakSharpe = sharpe != null && sharpe < 0;
  const highVol = volAnnualPct != null && volAnnualPct > 25;

  // FIDC stress
  if (classe === "FIDC") {
    if (fidcInadimPct != null && fidcInadimPct > 10) {
      return {
        regime: "Stress de Crédito",
        color: "#EF4444",
        icon: AlertTriangle,
        description: `Inadimplência (${fidcInadimPct.toFixed(1)}%) em nível crítico. Risco elevado de perda na carteira cedida.`,
      };
    }
    if (fidcSubordPct != null && fidcSubordPct < 10) {
      return {
        regime: "Subordinação Fina",
        color: "#F97316",
        icon: Shield,
        description: `Colchão subordinado (${fidcSubordPct.toFixed(1)}%) abaixo de 10%. Sênior mais exposta a eventos adversos.`,
      };
    }
  }

  // FII compressed DY vs Selic
  if (classe === "FII" && fiiDyMensal != null) {
    const selicMensal = Math.pow(1 + selicMeta / 100, 1 / 12) - 1;
    if (fiiDyMensal / 100 < selicMensal * 0.7) {
      return {
        regime: "DY Comprimido",
        color: "#F59E0B",
        icon: Activity,
        description: `Dividend yield mensal (${fiiDyMensal.toFixed(2)}%) abaixo de 70% da Selic mensal. Desvantagem tributária parcialmente compensada.`,
      };
    }
  }

  if (badlyUnderCdi && deepDD) {
    return {
      regime: "Stress",
      color: "#EF4444",
      icon: AlertTriangle,
      description: "Underperformance severa vs CDI combinada com drawdown profundo. Reavaliação recomendada.",
    };
  }
  if (deepDD) {
    return {
      regime: "Drawdown Profundo",
      color: "#EF4444",
      icon: TrendingDown,
      description: `Máxima queda acumulada de ${maxDrawdownPct?.toFixed(1)}%. Fundo em processo de recuperação.`,
    };
  }
  if (stronglyOverCdi && strongSharpe) {
    return {
      regime: "Alpha Consistente",
      color: "#22C55E",
      icon: TrendingUp,
      description: `Excesso sobre CDI de ${vsCdiPP?.toFixed(1)}pp com Sharpe ${sharpe?.toFixed(2)}. Geração de alpha recorrente.`,
    };
  }
  if (stronglyOverCdi) {
    return {
      regime: "Outperformance",
      color: "#22C55E",
      icon: TrendingUp,
      description: `Retorno acima do CDI em ${vsCdiPP?.toFixed(1)}pp na janela observada. Performance relativa positiva.`,
    };
  }
  if (severeDD || weakSharpe) {
    return {
      regime: "Pressão",
      color: "#F97316",
      icon: TrendingDown,
      description: "Indicadores de risco/retorno deteriorados. Monitorar estabilização antes de novos aportes.",
    };
  }
  if (underCdi) {
    return {
      regime: "Aquém do CDI",
      color: "#F59E0B",
      icon: Activity,
      description: `Retorno ${vsCdiPP?.toFixed(1)}pp abaixo do CDI. Avaliar se o mandato justifica o desvio.`,
    };
  }
  if (highVol && !stronglyOverCdi) {
    return {
      regime: "Volatilidade Alta",
      color: "#8B5CF6",
      icon: Activity,
      description: `Volatilidade anualizada de ${volAnnualPct?.toFixed(1)}% sem prêmio de risco correspondente.`,
    };
  }
  if (mildDD) {
    return {
      regime: "Normalização",
      color: "#3B82F6",
      icon: Zap,
      description: "Correção contida dentro da dinâmica normal do mandato. Sem sinal de stress estrutural.",
    };
  }
  return {
    regime: "Estável",
    color: "#6B7280",
    icon: Brain,
    description: "Indicadores dentro da faixa normal para a classe. Sem alertas estruturais no momento.",
  };
}

/* ─── Per-fund signals ─── */
function generateFundScopeSignals(ctx: FundScopeContext): Signal[] {
  const signals: Signal[] = [];
  const {
    classe,
    annualizedPct,
    returnPct,
    cdiPct,
    vsCdiPP,
    sharpe,
    sortino,
    volAnnualPct,
    maxDrawdownPct,
    plTrend,
    cotistasTrend,
    fidcSubordPct,
    fidcInadimPct,
    fiiDyMensal,
    taxaAdmPct,
    selicMeta = 14.15,
    ipcaAccum = 5.0,
  } = ctx;

  // 1. vs CDI
  if (vsCdiPP != null && cdiPct != null) {
    if (vsCdiPP >= 2) {
      signals.push({
        type: "bullish",
        title: "Excesso sobre CDI",
        description: `Retorno acima do CDI em ${vsCdiPP.toFixed(2)}pp (fundo ${returnPct?.toFixed(2)}% × CDI ${cdiPct.toFixed(2)}%).`,
        strength: 75,
      });
    } else if (vsCdiPP <= -3) {
      signals.push({
        type: "bearish",
        title: "Underperformance vs CDI",
        description: `Retorno ${Math.abs(vsCdiPP).toFixed(2)}pp abaixo do CDI na janela. Avaliar consistência do mandato.`,
        strength: 80,
      });
    } else if (vsCdiPP < 0) {
      signals.push({
        type: "neutral",
        title: "Aquém do CDI",
        description: `Retorno ${Math.abs(vsCdiPP).toFixed(2)}pp abaixo do CDI. Diferença dentro de faixa de observação.`,
        strength: 45,
      });
    }
  }

  // 2. Real return
  if (annualizedPct != null) {
    const realReturn = annualizedPct - ipcaAccum;
    if (realReturn < -1) {
      signals.push({
        type: "bearish",
        title: "Retorno real negativo",
        description: `Anualizado (${annualizedPct.toFixed(1)}%) abaixo da inflação acumulada (~${ipcaAccum.toFixed(1)}%). Perda de poder de compra.`,
        strength: 65,
      });
    } else if (realReturn > 4) {
      signals.push({
        type: "bullish",
        title: "Retorno real expressivo",
        description: `Anualizado supera IPCA em ${realReturn.toFixed(1)}pp. Geração de valor real consistente.`,
        strength: 65,
      });
    }
  }

  // 3. Sharpe / Sortino
  if (sharpe != null) {
    if (sharpe > 1.0) {
      signals.push({
        type: "bullish",
        title: "Sharpe > 1.0",
        description: `Sharpe ratio de ${sharpe.toFixed(2)} indica remuneração adequada do risco assumido.`,
        strength: 70,
      });
    } else if (sharpe < 0) {
      signals.push({
        type: "bearish",
        title: "Sharpe negativo",
        description: `Sharpe de ${sharpe.toFixed(2)} — retorno não compensou o risco na janela.`,
        strength: 75,
      });
    }
  } else if (sortino != null && sortino < 0) {
    signals.push({
      type: "bearish",
      title: "Sortino negativo",
      description: `Sortino de ${sortino.toFixed(2)} sinaliza exposição elevada a downside sem compensação.`,
      strength: 60,
    });
  }

  // 4. Drawdown
  if (maxDrawdownPct != null) {
    if (maxDrawdownPct < -25) {
      signals.push({
        type: "warning",
        title: "Drawdown severo",
        description: `Máxima queda acumulada de ${maxDrawdownPct.toFixed(1)}%. Necessário plano de recuperação claro.`,
        strength: 85,
      });
    } else if (maxDrawdownPct < -10) {
      signals.push({
        type: "warning",
        title: "Drawdown relevante",
        description: `Drawdown de ${maxDrawdownPct.toFixed(1)}% na série observada. Monitorar tempo de recuperação.`,
        strength: 55,
      });
    }
  }

  // 5. Volatility
  if (volAnnualPct != null && volAnnualPct > 25 && (vsCdiPP == null || vsCdiPP < 3)) {
    signals.push({
      type: "warning",
      title: "Volatilidade não remunerada",
      description: `Vol anualizada de ${volAnnualPct.toFixed(1)}% sem prêmio de risco correspondente sobre o CDI.`,
      strength: 55,
    });
  }

  // 6. Flow signals
  if (plTrend === "down") {
    signals.push({
      type: "bearish",
      title: "PL em queda",
      description: "Patrimônio líquido em trajetória de queda. Monitorar resgates e eventos de liquidez.",
      strength: 55,
    });
  } else if (plTrend === "up") {
    signals.push({
      type: "bullish",
      title: "PL crescente",
      description: "Patrimônio líquido em expansão. Captação e/ou valorização sustentando o crescimento.",
      strength: 45,
    });
  }
  if (cotistasTrend === "down") {
    signals.push({
      type: "neutral",
      title: "Base de cotistas reduzindo",
      description: "Número de cotistas em queda. Acompanhar se reflete saída qualificada ou simples rebalanceamento.",
      strength: 35,
    });
  }

  // 7. Class-specific: FIDC
  if (classe === "FIDC") {
    if (fidcSubordPct != null) {
      if (fidcSubordPct < 10) {
        signals.push({
          type: "warning",
          title: "Subordinação abaixo do piso",
          description: `Colchão subordinado em ${fidcSubordPct.toFixed(1)}%. Sênior com margem limitada.`,
          strength: 75,
        });
      } else if (fidcSubordPct > 20) {
        signals.push({
          type: "bullish",
          title: "Subordinação confortável",
          description: `Colchão subordinado robusto (${fidcSubordPct.toFixed(1)}%). Proteção ampla para a sênior.`,
          strength: 55,
        });
      }
    }
    if (fidcInadimPct != null) {
      if (fidcInadimPct > 8) {
        signals.push({
          type: "bearish",
          title: "Inadimplência elevada",
          description: `Taxa de inadimplência em ${fidcInadimPct.toFixed(1)}%. Acima do limiar de stress (5%).`,
          strength: 80,
        });
      } else if (fidcInadimPct < 2) {
        signals.push({
          type: "bullish",
          title: "Crédito saudável",
          description: `Inadimplência controlada (${fidcInadimPct.toFixed(1)}%). Qualidade de crédito robusta.`,
          strength: 55,
        });
      }
    }
  }

  // 8. Class-specific: FII
  if (classe === "FII" && fiiDyMensal != null) {
    const selicMensal = Math.pow(1 + selicMeta / 100, 1 / 12) - 1;
    const ratio = fiiDyMensal / 100 / selicMensal;
    if (ratio > 1.1) {
      signals.push({
        type: "bullish",
        title: "DY acima da Selic mensal",
        description: `DY mensal (${fiiDyMensal.toFixed(2)}%) supera Selic mensal em ${((ratio - 1) * 100).toFixed(0)}%. Atratividade relativa elevada.`,
        strength: 65,
      });
    } else if (ratio < 0.7) {
      signals.push({
        type: "bearish",
        title: "DY comprimido vs Selic",
        description: `DY mensal (${fiiDyMensal.toFixed(2)}%) abaixo de 70% da Selic mensal. Vantagem tributária parcialmente erodida.`,
        strength: 65,
      });
    }
  }

  // 9. Cost
  if (taxaAdmPct != null) {
    if (taxaAdmPct > 2.5) {
      signals.push({
        type: "neutral",
        title: "Taxa de administração elevada",
        description: `Taxa de adm. de ${taxaAdmPct.toFixed(2)}% a.a. pressiona o retorno líquido do cotista.`,
        strength: 45,
      });
    } else if (taxaAdmPct > 0 && taxaAdmPct < 0.5) {
      signals.push({
        type: "bullish",
        title: "Taxa de administração enxuta",
        description: `Taxa de adm. de ${taxaAdmPct.toFixed(2)}% a.a. — estrutura de custos favorável ao cotista.`,
        strength: 40,
      });
    }
  }

  return signals.sort((a, b) => b.strength - a.strength);
}

/* ─── Component ─── */
export const FundNarrativePanel = (props: FundNarrativeProps) => {
  const isFundScope = props.scope === "fund";

  const regime = useMemo<RegimeBadge>(() => {
    if (props.scope === "fund") return detectFundRegime(props.fundContext);
    return detectFundMarketRegime(props);
  }, [props]);

  const signals = useMemo<Signal[]>(() => {
    if (props.scope === "fund") return generateFundScopeSignals(props.fundContext);
    return generateFundMarketSignals(props);
  }, [props]);

  const Icon = regime.icon;
  const headerLabel = isFundScope ? "Leitura do Fundo" : "Regime de Mercado";
  const sectionLabel = isFundScope ? "Sinais específicos" : "Sinais Cross-Module";
  const subtitle =
    props.scope === "fund" && props.fundContext.nome ? props.fundContext.nome : null;

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg overflow-hidden">
      {/* Regime header */}
      <div
        className="px-4 py-3 border-b border-zinc-800/50"
        style={{ borderLeftColor: regime.color, borderLeftWidth: 3 }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center"
            style={{ backgroundColor: regime.color + "15" }}
          >
            <Icon className="w-4 h-4" style={{ color: regime.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-mono">
                {headerLabel}
              </span>
              <span
                className="text-[10px] font-bold font-mono px-2 py-0.5 rounded"
                style={{ color: regime.color, backgroundColor: regime.color + "15" }}
              >
                {regime.regime}
              </span>
              {subtitle && (
                <span className="text-[9px] font-mono text-zinc-500 truncate max-w-[200px]">
                  · {subtitle}
                </span>
              )}
            </div>
            <p className="text-[9px] text-zinc-600 mt-0.5 leading-relaxed">
              {regime.description}
            </p>
          </div>
        </div>
      </div>

      {/* Signals */}
      {signals.length > 0 ? (
        <div className="px-4 py-3 space-y-2">
          <h4 className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono mb-2">
            {sectionLabel} ({signals.length})
          </h4>
          {signals.map((signal, i) => {
            const signalColor =
              signal.type === "bullish"
                ? "#22C55E"
                : signal.type === "bearish"
                ? "#EF4444"
                : signal.type === "warning"
                ? "#F59E0B"
                : "#6B7280";
            return (
              <div key={i} className="flex items-start gap-2 bg-[#0a0a0a] rounded p-2">
                <div
                  className="w-1 h-full rounded-full flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: signalColor, minHeight: "20px" }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-300 font-mono font-medium">
                      {signal.title}
                    </span>
                    <span className="text-[8px] text-zinc-700 font-mono">
                      {signal.strength}%
                    </span>
                  </div>
                  <p className="text-[9px] text-zinc-600 leading-relaxed mt-0.5">
                    {signal.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="px-4 py-3 text-[10px] text-zinc-600 font-mono">
          Sem sinais relevantes na janela avaliada.
        </div>
      )}
    </div>
  );
};
