import { useMemo } from "react";
import {
  AlertTriangle, TrendingUp, TrendingDown, Minus,
  Activity, Zap, Scale,
} from "lucide-react";
import { fmtNum } from "@/lib/format";

/* ─── Credit Regime Types ─── */
interface CreditRegime {
  name: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: typeof AlertTriangle;
}

interface Signal {
  label: string;
  message: string;
  severity: "alert" | "watch" | "positive";
}

interface CreditNarrativePanelProps {
  /** Latest KPI values */
  inadTotal?: number;
  spreadMedio?: number;
  concessoesMoM?: number;
  creditoPib?: number;
  selic?: number;
  taxaPF?: number;
  taxaPJ?: number;
  inadPF?: number;
  inadPJ?: number;
  ipca12m?: number;
}

/* ─── Regime Detection ─── */
const REGIMES: Record<string, CreditRegime> = {
  stress: {
    name: "Stress Sistêmico",
    description: "Inadimplência elevada com spreads acima da mediana histórica. Risco de contágio.",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/20",
    icon: AlertTriangle,
  },
  contracao: {
    name: "Contração de Crédito",
    description: "Queda nas concessões com inadimplência pressionada. Desalavancagem em curso.",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/20",
    icon: TrendingDown,
  },
  expansao: {
    name: "Expansão Acelerada",
    description: "Concessões em forte alta com crédito/PIB elevado. Monitorar alavancagem.",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
    icon: TrendingUp,
  },
  aperto: {
    name: "Aperto Monetário",
    description: "Selic elevada impactando concessões. Custo do crédito pressionado.",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/20",
    icon: Zap,
  },
  normalizacao: {
    name: "Normalização",
    description: "Indicadores próximos das médias históricas. Estabilidade no mercado de crédito.",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
    icon: Scale,
  },
  afrouxamento: {
    name: "Afrouxamento Monetário",
    description: "Selic em queda com expansão nas concessões. Ciclo favorável ao crédito.",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/20",
    icon: TrendingUp,
  },
  transicao: {
    name: "Transição",
    description: "Sinais mistos. Monitorar direção dos indicadores-chave.",
    color: "text-zinc-400",
    bgColor: "bg-zinc-500/10",
    borderColor: "border-zinc-500/20",
    icon: Activity,
  },
};

function detectCreditRegime(
  inadTotal: number,
  spreadMedio: number,
  concessoesMoM: number,
  creditoPib: number,
  selic: number
): CreditRegime {
  // Median 5Y spread ≈ 25 p.p.
  const spreadMediana5A = 25;

  if (inadTotal > 5.0 && spreadMedio > spreadMediana5A * 1.3) return REGIMES.stress;
  if (concessoesMoM < -2 && inadTotal > 4.0) return REGIMES.contracao;
  if (concessoesMoM > 5 && creditoPib > 55) return REGIMES.expansao;
  if (selic > 12 && concessoesMoM < 0) return REGIMES.aperto;
  if (Math.abs(concessoesMoM) < 2 && inadTotal < 4 && inadTotal > 2) return REGIMES.normalizacao;
  if (selic < 10 && concessoesMoM > 3) return REGIMES.afrouxamento;
  return REGIMES.transicao;
}

/* ─── Cross-Signals Generator ─── */
function generateCrossSignals(props: CreditNarrativePanelProps): Signal[] {
  const signals: Signal[] = [];
  const { inadTotal = 3.3, selic = 14.25, inadPF = 4.1, inadPJ = 2.4, spreadMedio = 30, creditoPib = 54, taxaPF = 52, ipca12m = 3.8, concessoesMoM = 0 } = props;

  // 1. Double squeeze: inadimplência + Selic ambas subindo
  if (inadTotal > 3.5 && selic > 12) {
    signals.push({
      label: "Double Squeeze",
      message: `Inadimplência (${fmtNum(inadTotal, 1)}%) e Selic (${fmtNum(selic, 1)}%) ambas elevadas — pressão dupla sobre tomadores de crédito.`,
      severity: "alert",
    });
  }

  // 2. Spread compression risk
  if (spreadMedio < 20) {
    signals.push({
      label: "Spread Compression",
      message: `Spread médio (${fmtNum(spreadMedio, 1)} p.p.) abaixo do p10 histórico — risco subprecificado.`,
      severity: "alert",
    });
  } else if (spreadMedio > 35) {
    signals.push({
      label: "Spreads Elevados",
      message: `Spread médio (${fmtNum(spreadMedio, 1)} p.p.) acima do p90 — custo excessivo para tomadores.`,
      severity: "watch",
    });
  }

  // 3. Concessões momentum
  if (concessoesMoM > 4) {
    signals.push({
      label: "Concessões Acelerando",
      message: `Variação MoM de ${fmtNum(concessoesMoM, 1)}% — momentum forte nas concessões.`,
      severity: "positive",
    });
  } else if (concessoesMoM < -3) {
    signals.push({
      label: "Concessões Desacelerando",
      message: `Variação MoM de ${fmtNum(concessoesMoM, 1)}% — contração significativa.`,
      severity: "alert",
    });
  }

  // 4. Crédito/PIB threshold
  if (creditoPib > 55) {
    signals.push({
      label: "Alavancagem Elevada",
      message: `Crédito/PIB em ${fmtNum(creditoPib, 1)}% — acima do threshold BCB (55%). Risco sistêmico monitorado.`,
      severity: "alert",
    });
  } else if (creditoPib > 50) {
    signals.push({
      label: "Crédito/PIB Saudável",
      message: `Crédito/PIB em ${fmtNum(creditoPib, 1)}% — dentro da faixa saudável, tendência de alta.`,
      severity: "positive",
    });
  }

  // 5. PF vs PJ divergência
  const pfPjDelta = Math.abs(inadPF - inadPJ);
  if (pfPjDelta > 2.5) {
    const maisRisco = inadPF > inadPJ ? "PF" : "PJ";
    signals.push({
      label: "Divergência PF×PJ",
      message: `Inadimplência ${maisRisco} (${fmtNum(maisRisco === "PF" ? inadPF : inadPJ, 1)}%) significativamente maior — risco setorial concentrado.`,
      severity: "watch",
    });
  }

  // 6. Taxa real do crédito
  const taxaReal = taxaPF - ipca12m;
  if (taxaReal > 50) {
    signals.push({
      label: "Custo Real Elevado",
      message: `Taxa real PF de ${fmtNum(taxaReal, 1)}% a.a. — custo efetivo muito acima da inflação.`,
      severity: "watch",
    });
  }

  // 7. Selic convergence
  if (selic > 13) {
    signals.push({
      label: "Selic Restritiva",
      message: `Selic em ${fmtNum(selic, 2)}% — patamar restritivo para concessões. Monitorar próximas decisões do COPOM.`,
      severity: "watch",
    });
  }

  return signals;
}

/* ─── Component ─── */
export const CreditNarrativePanel = (props: CreditNarrativePanelProps) => {
  const {
    inadTotal = 3.3,
    spreadMedio = 30,
    concessoesMoM = 0,
    creditoPib = 54,
    selic = 14.25,
  } = props;

  const regime = useMemo(
    () => detectCreditRegime(inadTotal, spreadMedio, concessoesMoM, creditoPib, selic),
    [inadTotal, spreadMedio, concessoesMoM, creditoPib, selic]
  );

  const signals = useMemo(() => generateCrossSignals(props), [props]);

  const RegimeIcon = regime.icon;

  const severityStyles: Record<string, { bg: string; border: string; text: string }> = {
    alert: { bg: "bg-red-500/5", border: "border-red-500/20", text: "text-red-400" },
    watch: { bg: "bg-amber-500/5", border: "border-amber-500/20", text: "text-amber-400" },
    positive: { bg: "bg-emerald-500/5", border: "border-emerald-500/20", text: "text-emerald-400" },
  };

  return (
    <div className="space-y-3">
      {/* Regime Card */}
      <div className={`rounded-lg border p-4 ${regime.bgColor} ${regime.borderColor}`}>
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-lg ${regime.bgColor} flex items-center justify-center flex-shrink-0`}>
            <RegimeIcon className={`w-4 h-4 ${regime.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-mono font-bold ${regime.color}`}>
                REGIME: {regime.name}
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">{regime.description}</p>

            {/* Key metrics strip */}
            <div className="flex flex-wrap gap-3 mt-2.5 pt-2.5 border-t border-[#1a1a1a]">
              {[
                { label: "Inadim.", value: `${fmtNum(inadTotal, 1)}%` },
                { label: "Spread", value: `${fmtNum(spreadMedio, 0)} p.p.` },
                { label: "Conc. MoM", value: `${concessoesMoM >= 0 ? "+" : ""}${fmtNum(concessoesMoM, 1)}%` },
                { label: "Créd/PIB", value: `${fmtNum(creditoPib, 1)}%` },
                { label: "Selic", value: `${fmtNum(selic, 2)}%` },
              ].map((m) => (
                <div key={m.label} className="text-[9px] font-mono">
                  <span className="text-zinc-600">{m.label}: </span>
                  <span className="text-zinc-300">{m.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Cross-Signals */}
      {signals.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {signals.map((signal) => {
            const style = severityStyles[signal.severity];
            return (
              <div key={signal.label} className={`rounded border p-3 ${style.bg} ${style.border}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  {signal.severity === "alert" && <AlertTriangle className="w-3 h-3 text-red-400" />}
                  {signal.severity === "watch" && <Minus className="w-3 h-3 text-amber-400" />}
                  {signal.severity === "positive" && <TrendingUp className="w-3 h-3 text-emerald-400" />}
                  <span className={`text-[10px] font-mono font-bold ${style.text}`}>{signal.label}</span>
                </div>
                <p className="text-[9px] text-zinc-500">{signal.message}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
