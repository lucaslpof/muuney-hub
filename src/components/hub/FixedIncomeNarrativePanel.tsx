import { useMemo } from "react";
import {
  AlertTriangle, TrendingUp, TrendingDown, Minus,
  Activity, Zap, Scale, Shield,
} from "lucide-react";
import { fmtNum } from "@/lib/format";

/* ─── Monetary Regime Types ─── */
interface MonetaryRegime {
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

export interface FixedIncomeNarrativePanelProps {
  selicMeta?: number;
  focusSelic?: number;
  curveShort?: number;    // DI 30d
  curveMid?: number;      // DI 360d
  curveLong?: number;     // DI 1800d
  spreadAA?: number;
  breakeven1a?: number;
  breakeven5a?: number;
  ipca12m?: number;
  ntnb2029?: number;
  ntnb2035?: number;
  estoqueTD?: number;
  vendasTD?: number;
  estoqueTDPrev?: number;
}

/* ─── Regime Detection ─── */
const REGIMES: Record<string, MonetaryRegime> = {
  apertoAgressivo: {
    name: "Aperto Agressivo",
    description: "Selic acima de 13%, mercado espera mais alta, curva invertida. Ambiente de restrição monetária severa.",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/20",
    icon: AlertTriangle,
  },
  apertoModerado: {
    name: "Aperto Moderado",
    description: "Selic elevada com expectativas estáveis ou em alta. Ciclo de aperto em maturação.",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/20",
    icon: Zap,
  },
  neutro: {
    name: "Neutro",
    description: "Expectativas convergentes com Selic meta. Curva normal e sem pressão direcional significativa.",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
    icon: Scale,
  },
  afrouxamento: {
    name: "Afrouxamento Monetário",
    description: "Mercado precifica cortes de Selic. Curva normal com inclinação positiva moderada.",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/20",
    icon: TrendingDown,
  },
  stressCredito: {
    name: "Stress de Crédito",
    description: "Spreads privados elevados com inflação implícita desancorada. Risco de repricing generalizado.",
    color: "text-red-500",
    bgColor: "bg-red-600/10",
    borderColor: "border-red-600/20",
    icon: Shield,
  },
  transicao: {
    name: "Transição",
    description: "Sinais mistos entre indicadores monetários. Monitorar próximas decisões do COPOM.",
    color: "text-zinc-400",
    bgColor: "bg-zinc-500/10",
    borderColor: "border-zinc-500/20",
    icon: Activity,
  },
};

function detectCurveShape(short: number, mid: number, long: number): string {
  if (mid > short && long > mid) return "Normal";
  if (mid > short && long < mid) return "Corcova";
  if (mid < short && long < short) return "Invertida";
  return "Flat";
}

function detectMonetaryRegime(props: FixedIncomeNarrativePanelProps): MonetaryRegime {
  const {
    selicMeta = 14.25,
    focusSelic = 14.50,
    curveShort = 14.18,
    curveMid = 14.82,
    curveLong = 13.65,
    spreadAA = 1.35,
    breakeven1a = 5.82,
    ipca12m = 3.8,
  } = props;

  const curveShape = detectCurveShape(curveShort, curveMid, curveLong);

  // Stress crédito has priority
  if (spreadAA > 2.0 && breakeven1a > ipca12m + 1.5) return REGIMES.stressCredito;

  // Aperto agressivo
  if (selicMeta > 13 && focusSelic > selicMeta && curveShape === "Invertida") return REGIMES.apertoAgressivo;

  // Aperto moderado
  if (selicMeta > 11 && focusSelic >= selicMeta) return REGIMES.apertoModerado;

  // Neutro
  if (Math.abs(focusSelic - selicMeta) < 0.5 && curveShape === "Normal") return REGIMES.neutro;

  // Afrouxamento
  if (focusSelic < selicMeta - 1.0 && curveShape === "Normal") return REGIMES.afrouxamento;

  return REGIMES.transicao;
}

/* ─── Cross-Signals Generator ─── */
function generateFixedIncomeSignals(props: FixedIncomeNarrativePanelProps): Signal[] {
  const signals: Signal[] = [];
  const {
    curveShort = 14.18,
    curveMid = 14.82,
    curveLong = 13.65,
    breakeven1a = 5.82,
    breakeven5a = 5.10,
    ipca12m = 3.8,
    spreadAA = 1.35,
    selicMeta = 14.25,
    focusSelic = 14.50,
    ntnb2029 = 7.25,
    vendasTD = 3.85,
  } = props;

  const curveShape = detectCurveShape(curveShort, curveMid, curveLong);

  // 1. Curva × Inflação: curva invertida + breakeven rising
  if (curveShape === "Invertida" && breakeven1a > 5.0) {
    signals.push({
      label: "Curva × Inflação",
      message: `Curva invertida com breakeven 1a em ${fmtNum(breakeven1a, 2)}% — sinal recessivo com inflação persistente. Risco de estagflação.`,
      severity: "alert",
    });
  } else if (curveShape === "Normal" && breakeven1a < 4.0) {
    signals.push({
      label: "Curva × Inflação",
      message: `Curva normal com breakeven 1a em ${fmtNum(breakeven1a, 2)}% — expectativas ancoradas. Ambiente construtivo para renda fixa.`,
      severity: "positive",
    });
  }

  // 2. Spread × Selic: spreadAA comprimindo enquanto Selic sobe
  if (spreadAA < 1.0 && selicMeta > 12) {
    signals.push({
      label: "Spread × Selic",
      message: `Spread AA (${fmtNum(spreadAA, 2)} p.p.) comprimido com Selic em ${fmtNum(selicMeta, 2)}% — possível subprecificação de risco de crédito privado.`,
      severity: "alert",
    });
  } else if (spreadAA > 2.0) {
    signals.push({
      label: "Spreads Privados Elevados",
      message: `Spread AA em ${fmtNum(spreadAA, 2)} p.p. — acima do p90 histórico. Aversão a risco no crédito privado.`,
      severity: "watch",
    });
  }

  // 3. NTN-B Breakeven vs IPCA realizado
  const beiVsIpca = breakeven1a - ipca12m;
  if (beiVsIpca > 1.5) {
    signals.push({
      label: "Breakeven vs IPCA",
      message: `Breakeven 1a (${fmtNum(breakeven1a, 2)}%) supera IPCA 12m (${fmtNum(ipca12m, 1)}%) em ${fmtNum(beiVsIpca, 2)} p.p. — mercado precifica aceleração inflacionária.`,
      severity: "alert",
    });
  } else if (beiVsIpca < 0) {
    signals.push({
      label: "Breakeven vs IPCA",
      message: `Breakeven 1a abaixo do IPCA 12m — mercado precifica desinflação. Títulos IPCA+ podem ter ganho real menor que o esperado.`,
      severity: "watch",
    });
  }

  // 4. Fluxo Tesouro Direto
  if (vendasTD < 0) {
    signals.push({
      label: "Fluxo TD Negativo",
      message: `Vendas líquidas TD negativas (${fmtNum(vendasTD, 2)} R$ bi) — sinal de aversão a risco no varejo. Investidores resgatando posições.`,
      severity: "alert",
    });
  } else if (vendasTD > 5) {
    signals.push({
      label: "Fluxo TD Forte",
      message: `Vendas líquidas de ${fmtNum(vendasTD, 2)} R$ bi — apetite forte do varejo por renda fixa. Ambiente favorável.`,
      severity: "positive",
    });
  }

  // 5. Convergência DI × Focus
  const di360 = curveMid;
  const diVsFocus = Math.abs(di360 - focusSelic);
  if (diVsFocus < 0.3) {
    signals.push({
      label: "DI × Focus Alinhados",
      message: `Vértice 360d (${fmtNum(di360, 2)}%) convergente com Focus Selic (${fmtNum(focusSelic, 2)}%) — mercado alinhado ao consenso.`,
      severity: "positive",
    });
  } else if (diVsFocus > 1.0) {
    signals.push({
      label: "DI × Focus Divergência",
      message: `Vértice 360d (${fmtNum(di360, 2)}%) diverge ${fmtNum(diVsFocus, 2)} p.p. do Focus Selic (${fmtNum(focusSelic, 2)}%) — dissenso entre mercado e analistas.`,
      severity: "watch",
    });
  }

  // 6. Term Premium (spread 5a-1a)
  const termPremium = curveLong - curveMid;
  if (termPremium < -1.0) {
    signals.push({
      label: "Term Premium Comprimido",
      message: `Spread 5a-1a em ${fmtNum(termPremium, 2)} p.p. — inversão significativa. Mercado precifica cortes agressivos ou recessão.`,
      severity: "watch",
    });
  } else if (termPremium > 0.5) {
    signals.push({
      label: "Term Premium Saudável",
      message: `Spread 5a-1a em +${fmtNum(termPremium, 2)} p.p. — curva inclinada positivamente. Prêmio de prazo adequado.`,
      severity: "positive",
    });
  }

  // 7. NTN-B real rates very high
  if (ntnb2029 > 7.0) {
    signals.push({
      label: "Juro Real Elevado",
      message: `NTN-B 2029 em ${fmtNum(ntnb2029, 2)}% a.a. — juro real acima de 7% reflete prêmio fiscal e/ou credibilidade monetária em teste.`,
      severity: "watch",
    });
  }

  // 8. Breakeven 5a diverging from 1a
  const beiSpread = breakeven1a - breakeven5a;
  if (beiSpread > 1.0) {
    signals.push({
      label: "Breakeven Desancorando",
      message: `BEI 1a (${fmtNum(breakeven1a, 2)}%) supera BEI 5a (${fmtNum(breakeven5a, 2)}%) em ${fmtNum(beiSpread, 2)} p.p. — inflação curta pressionada mas longo ancorado.`,
      severity: "watch",
    });
  }

  return signals;
}

/* ─── Component ─── */
export const FixedIncomeNarrativePanel = (props: FixedIncomeNarrativePanelProps) => {
  const {
    selicMeta = 14.25,
    focusSelic = 14.50,
    curveShort = 14.18,
    curveMid = 14.82,
    curveLong = 13.65,
    spreadAA = 1.35,
    breakeven1a = 5.82,
  } = props;

  const regime = useMemo(() => detectMonetaryRegime(props), [props]);
  const signals = useMemo(() => generateFixedIncomeSignals(props), [props]);

  const RegimeIcon = regime.icon;
  const curveShape = detectCurveShape(curveShort, curveMid, curveLong);

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
                { label: "Selic", value: `${fmtNum(selicMeta, 2)}%` },
                { label: "Focus", value: `${fmtNum(focusSelic, 2)}%` },
                { label: "Curva", value: curveShape },
                { label: "BEI 1a", value: `${fmtNum(breakeven1a, 2)}%` },
                { label: "Spread AA", value: `${fmtNum(spreadAA, 2)} p.p.` },
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
