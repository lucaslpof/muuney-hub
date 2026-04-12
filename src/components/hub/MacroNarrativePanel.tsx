import { useMemo } from "react";
import {
  Activity, TrendingUp, TrendingDown, AlertTriangle, Zap,
  Gauge, ThermometerSun,
} from "lucide-react";
import { fmtNum } from "@/lib/format";

/* ─── Types ─── */
interface MacroNarrativePanelProps {
  selic: number;        // % a.a.
  ipca12m: number;      // %
  desocupacao: number;  // %
  dividaPib: number;    // %
  pib?: number;         // YoY %
  ptax: number;         // R$/US$
  focusIpca?: number;   // % esperado
  focusSelic?: number;  // % esperado
}

/* ─── Regime detection ─── */
interface MacroRegime {
  label: string;
  description: string;
  color: string;
  bgColor: string;
  icon: typeof Activity;
}

function detectRegime(
  selic: number, ipca: number, desocupacao: number, dividaPib: number, pib?: number
): MacroRegime {
  const juroReal = selic - ipca;

  // Overheating: low unemployment + high inflation + high real rate
  if (desocupacao < 6 && ipca > 4.5 && juroReal > 5) {
    return {
      label: "Superaquecimento",
      description: "Desemprego baixo com inflação pressionada. Política monetária restritiva ativa.",
      color: "text-red-400",
      bgColor: "bg-red-500/5 border-red-500/15",
      icon: ThermometerSun,
    };
  }

  // Stagflation: high unemployment + high inflation
  if (desocupacao > 8 && ipca > 5) {
    return {
      label: "Estagflação",
      description: "Economia fraca com inflação persistente. Cenário desafiador para política monetária.",
      color: "text-red-400",
      bgColor: "bg-red-500/5 border-red-500/15",
      icon: AlertTriangle,
    };
  }

  // Expansion: improving employment + moderate inflation + positive growth
  if (desocupacao < 7.5 && ipca < 5 && (pib === undefined || pib > 1.5)) {
    return {
      label: "Expansão",
      description: "Crescimento saudável com inflação controlada e mercado de trabalho aquecido.",
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/5 border-emerald-500/15",
      icon: TrendingUp,
    };
  }

  // Contraction: rising unemployment + falling activity
  if (desocupacao > 9 && (pib !== undefined && pib < 0)) {
    return {
      label: "Contração",
      description: "Economia em retração com desemprego elevado. Possível ciclo de corte de juros.",
      color: "text-amber-400",
      bgColor: "bg-amber-500/5 border-amber-500/15",
      icon: TrendingDown,
    };
  }

  // Fiscal dominance: very high debt + rising rates
  if (dividaPib > 80 && juroReal > 6) {
    return {
      label: "Dominância Fiscal",
      description: "Dívida/PIB elevada com juros reais altos pressionando dinâmica fiscal.",
      color: "text-red-400",
      bgColor: "bg-red-500/5 border-red-500/15",
      icon: AlertTriangle,
    };
  }

  // Tightening: high rates to combat inflation
  if (juroReal > 7 && ipca > 4) {
    return {
      label: "Aperto Monetário",
      description: "Juros reais elevados para conter inflação. Economia em desaceleração controlada.",
      color: "text-amber-400",
      bgColor: "bg-amber-500/5 border-amber-500/15",
      icon: Gauge,
    };
  }

  // Default: moderate/neutral
  return {
    label: "Transição",
    description: "Economia em fase de ajuste sem tendência dominante clara.",
    color: "text-zinc-400",
    bgColor: "bg-zinc-800/30 border-zinc-700/30",
    icon: Activity,
  };
}

/* ─── Cross-module signals ─── */
interface Signal {
  id: string;
  severity: "alert" | "watch" | "positive";
  text: string;
}

function generateCrossSignals(props: MacroNarrativePanelProps): Signal[] {
  const signals: Signal[] = [];
  const { selic, ipca12m, desocupacao, dividaPib, ptax, focusIpca, focusSelic } = props;
  const juroReal = selic - ipca12m;

  // Juro real excessivo
  if (juroReal > 8) {
    signals.push({
      id: "juro-real-alto",
      severity: "alert",
      text: `Juro real em ${fmtNum(juroReal, 1)}% — nível restritivo extremo. Impacto negativo sobre investimento e crédito.`,
    });
  } else if (juroReal > 5) {
    signals.push({
      id: "juro-real-elevado",
      severity: "watch",
      text: `Juro real em ${fmtNum(juroReal, 1)}%, acima da média histórica (~4%). Peso sobre atividade econômica.`,
    });
  } else if (juroReal > 0) {
    signals.push({
      id: "juro-real-neutro",
      severity: "positive",
      text: `Juro real em ${fmtNum(juroReal, 1)}% — nível neutro/moderado para a atividade.`,
    });
  }

  // Desemprego em mínima + inflação acima da meta
  if (desocupacao < 6.5 && ipca12m > 4.5) {
    signals.push({
      id: "superaquecimento-risco",
      severity: "alert",
      text: `Desemprego em ${fmtNum(desocupacao, 1)}% (mínima) + IPCA em ${fmtNum(ipca12m, 1)}% (acima da meta) — risco de superaquecimento.`,
    });
  }

  // Fiscal stress
  if (dividaPib > 70) {
    signals.push({
      id: "fiscal-stress",
      severity: dividaPib > 80 ? "alert" : "watch",
      text: `Dívida/PIB em ${fmtNum(dividaPib, 1)}% — ${dividaPib > 80 ? "patamar de risco elevado" : "requer atenção fiscal"}. Pressão sobre prêmio de risco.`,
    });
  }

  // Câmbio depreciado
  if (ptax > 5.5) {
    signals.push({
      id: "cambio-depreciado",
      severity: ptax > 6 ? "alert" : "watch",
      text: `Dólar a R$${fmtNum(ptax, 2)} — ${ptax > 6 ? "depreciação significativa" : "pressão cambial"}. Impacto inflacionário via importados.`,
    });
  } else if (ptax < 4.8) {
    signals.push({
      id: "cambio-forte",
      severity: "positive",
      text: `Dólar a R$${fmtNum(ptax, 2)} — câmbio apreciado contribui para desinflação.`,
    });
  }

  // Focus divergence
  if (focusIpca !== undefined && Math.abs(focusIpca - ipca12m) > 1.5) {
    const dir = focusIpca > ipca12m ? "acima" : "abaixo";
    signals.push({
      id: "focus-diverge",
      severity: "watch",
      text: `Focus IPCA 2026 (${fmtNum(focusIpca, 1)}%) diverge ${dir} do IPCA atual (${fmtNum(ipca12m, 1)}%). Mercado precifica ${dir === "acima" ? "aceleração" : "desaceleração"}.`,
    });
  }

  // Selic convergence signal
  if (focusSelic !== undefined && selic > 0) {
    const diff = selic - focusSelic;
    if (diff > 2) {
      signals.push({
        id: "selic-corte-esperado",
        severity: "positive",
        text: `Focus Selic (${fmtNum(focusSelic, 1)}%) está ${fmtNum(diff, 1)}pp abaixo da atual (${fmtNum(selic, 1)}%). Mercado precifica ciclo de corte.`,
      });
    } else if (diff < -1) {
      signals.push({
        id: "selic-alta-esperada",
        severity: "watch",
        text: `Focus Selic (${fmtNum(focusSelic, 1)}%) está acima da atual (${fmtNum(selic, 1)}%). Mercado espera aperto adicional.`,
      });
    }
  }

  return signals.sort((a, b) => {
    const order = { alert: 0, watch: 1, positive: 2 };
    return order[a.severity] - order[b.severity];
  });
}

/* ─── Severity styles ─── */
const signalStyles = {
  alert: { dot: "bg-red-400", text: "text-red-300", bg: "bg-red-500/5" },
  watch: { dot: "bg-amber-400", text: "text-amber-300", bg: "bg-amber-500/5" },
  positive: { dot: "bg-emerald-400", text: "text-emerald-300", bg: "bg-emerald-500/5" },
};

/* ─── Component ─── */
export const MacroNarrativePanel = (props: MacroNarrativePanelProps) => {
  const regime = useMemo(
    () => detectRegime(props.selic, props.ipca12m, props.desocupacao, props.dividaPib, props.pib),
    [props.selic, props.ipca12m, props.desocupacao, props.dividaPib, props.pib]
  );

  const signals = useMemo(() => generateCrossSignals(props), [props]);
  const juroReal = props.selic - props.ipca12m;

  const RegimeIcon = regime.icon;

  return (
    <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4 space-y-4">
      {/* ─── Header ─── */}
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-[#0B6C3E]" />
        <h3 className="text-xs font-medium text-zinc-400 font-mono">
          Macro Intelligence
        </h3>
      </div>

      {/* ─── Regime card ─── */}
      <div className={`${regime.bgColor} border rounded-lg px-4 py-3`}>
        <div className="flex items-center gap-2 mb-1.5">
          <RegimeIcon className={`w-4 h-4 ${regime.color}`} />
          <span className={`text-sm font-bold font-mono ${regime.color}`}>
            Regime: {regime.label}
          </span>
        </div>
        <p className="text-[10px] text-zinc-400 font-mono leading-relaxed">
          {regime.description}
        </p>
        {/* Key metrics strip */}
        <div className="flex items-center gap-4 mt-2 text-[9px] font-mono">
          <span className="text-zinc-500">Selic <span className="text-zinc-300 font-bold">{fmtNum(props.selic, 1)}%</span></span>
          <span className="text-zinc-500">IPCA <span className="text-zinc-300 font-bold">{fmtNum(props.ipca12m, 1)}%</span></span>
          <span className="text-zinc-500">Juro Real <span className={`font-bold ${juroReal > 6 ? "text-red-400" : juroReal > 3 ? "text-amber-400" : "text-emerald-400"}`}>{fmtNum(juroReal, 1)}%</span></span>
          <span className="text-zinc-500">Desemp. <span className="text-zinc-300 font-bold">{fmtNum(props.desocupacao, 1)}%</span></span>
          <span className="text-zinc-500">Dív/PIB <span className="text-zinc-300 font-bold">{fmtNum(props.dividaPib, 1)}%</span></span>
        </div>
      </div>

      {/* ─── Cross-module signals ─── */}
      {signals.length > 0 && (
        <div>
          <h4 className="text-[10px] text-zinc-500 font-mono mb-2">
            Sinais Cross-Module ({signals.length})
          </h4>
          <div className="space-y-1.5">
            {signals.map(s => {
              const style = signalStyles[s.severity];
              return (
                <div key={s.id} className={`${style.bg} rounded-md px-3 py-2 flex items-start gap-2`}>
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${style.dot}`} />
                  <p className={`text-[10px] font-mono leading-relaxed ${style.text}`}>
                    {s.text}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export { detectRegime, generateCrossSignals };
