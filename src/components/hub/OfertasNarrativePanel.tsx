/**
 * OfertasNarrativePanel.tsx — Capital markets intelligence panel
 *
 * Market regime detection + cross-signals for public offerings.
 * Follows the same pattern as MacroNarrativePanel, CreditNarrativePanel,
 * FixedIncomeNarrativePanel, FundNarrativePanel.
 */

import { useMemo } from "react";
import {
  Brain,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  Scale,
  Eye,
  Shield,
} from "lucide-react";
import { fmtNum, formatBRL, formatCount } from "@/lib/format";

/* ─── Types ─── */
interface MarketRegime {
  name: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: typeof Brain;
}

interface Signal {
  label: string;
  message: string;
  severity: "alert" | "watch" | "positive";
}

interface TimelineBucket {
  month: string;
  count: number;
  valor_total: number;
}

interface TipoAtivoBreakdown {
  tipo: string;
  count: number;
  valor: number;
}

interface StatusBreakdown {
  status: string;
  count: number;
}

export interface OfertasNarrativePanelProps {
  totalOfertas: number;
  totalValor: number;
  emAnalise: number;
  emDistribuicao: number;
  timeline: TimelineBucket[];
  byTipoAtivo: TipoAtivoBreakdown[];
  byStatus: StatusBreakdown[];
  bySegmento: Array<{ segmento: string; count: number; valor: number }>;
}

/* ─── Regime Detection ─── */
const REGIMES: Record<string, MarketRegime> = {
  boom: {
    name: "Boom de Emissões",
    description:
      "Volume crescente acelerado com pipeline robusto. Mercado primário aquecido — janela de captação aberta.",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
    icon: TrendingUp,
  },
  expansao: {
    name: "Expansão Moderada",
    description:
      "Volume e contagem em tendência de alta, com diversificação de classes. Condições favoráveis para novas emissões.",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/20",
    icon: Activity,
  },
  estavel: {
    name: "Mercado Estável",
    description:
      "Volume e contagem próximos das médias recentes. Pipeline saudável sem sinais de stress.",
    color: "text-zinc-400",
    bgColor: "bg-zinc-500/10",
    borderColor: "border-zinc-500/20",
    icon: Scale,
  },
  contracao: {
    name: "Contração",
    description:
      "Queda no volume de emissões com pipeline encolhendo. Janela de captação pode estar se fechando.",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/20",
    icon: TrendingDown,
  },
  seletivo: {
    name: "Mercado Seletivo",
    description:
      "Volume concentrado em poucas classes ou emissores. Apetite de risco reduzido — apenas emissões de alta qualidade prosperam.",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
    icon: Eye,
  },
  stress: {
    name: "Stress no Primário",
    description:
      "Volume em queda com alta proporção de cancelamentos/suspensões. Investidores retraídos — dificuldade de colocação.",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/20",
    icon: AlertTriangle,
  },
  transicao: {
    name: "Transição",
    description:
      "Sinais mistos — volume oscilando sem tendência definida. Mercado em fase de ajuste.",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/20",
    icon: Zap,
  },
};

function detectRegime(props: OfertasNarrativePanelProps): MarketRegime {
  const { timeline, byTipoAtivo, byStatus, totalOfertas } = props;

  // Compute MoM volume trend from last 6 months
  const recent = timeline.slice(0, 6);
  const firstHalf = recent.slice(3, 6); // older 3 months
  const secondHalf = recent.slice(0, 3); // newer 3 months

  const avgOld =
    firstHalf.length > 0
      ? firstHalf.reduce((s, b) => s + b.valor_total, 0) / firstHalf.length
      : 0;
  const avgNew =
    secondHalf.length > 0
      ? secondHalf.reduce((s, b) => s + b.valor_total, 0) / secondHalf.length
      : 0;
  const volumeTrend = avgOld > 0 ? ((avgNew - avgOld) / avgOld) * 100 : 0;

  const countOld =
    firstHalf.length > 0
      ? firstHalf.reduce((s, b) => s + b.count, 0) / firstHalf.length
      : 0;
  const countNew =
    secondHalf.length > 0
      ? secondHalf.reduce((s, b) => s + b.count, 0) / secondHalf.length
      : 0;
  const countTrend = countOld > 0 ? ((countNew - countOld) / countOld) * 100 : 0;

  // Concentration: top 1 class share
  const topClassShare =
    byTipoAtivo.length > 0 && props.totalValor > 0
      ? (byTipoAtivo[0].valor / props.totalValor) * 100
      : 0;

  // Stress signals: cancelados + suspensos
  const cancelSuspenso =
    byStatus
      .filter((s) => s.status === "cancelado" || s.status === "suspenso")
      .reduce((s, x) => s + x.count, 0);
  const stressRatio = totalOfertas > 0 ? (cancelSuspenso / totalOfertas) * 100 : 0;

  // Active classes count
  const activeClasses = byTipoAtivo.filter((t) => t.count >= 2).length;

  // Decision tree
  if (stressRatio > 15 && volumeTrend < -10) return REGIMES.stress;
  if (volumeTrend > 30 && countTrend > 20) return REGIMES.boom;
  if (volumeTrend > 10 && activeClasses >= 3) return REGIMES.expansao;
  if (volumeTrend < -20 && countTrend < -15) return REGIMES.contracao;
  if (topClassShare > 60 && activeClasses <= 2) return REGIMES.seletivo;
  if (Math.abs(volumeTrend) <= 10 && Math.abs(countTrend) <= 10) return REGIMES.estavel;
  return REGIMES.transicao;
}

/* ─── Signal Generation ─── */
function generateSignals(props: OfertasNarrativePanelProps): Signal[] {
  const signals: Signal[] = [];
  const { timeline, byTipoAtivo, byStatus, bySegmento, totalOfertas, totalValor, emAnalise, emDistribuicao } = props;

  // 1. Volume Momentum
  if (timeline.length >= 3) {
    const recent3 = timeline.slice(0, 3);
    const avgRecent = recent3.reduce((s, b) => s + b.valor_total, 0) / 3;
    const older3 = timeline.slice(3, 6);
    if (older3.length >= 2) {
      const avgOlder = older3.reduce((s, b) => s + b.valor_total, 0) / older3.length;
      const delta = avgOlder > 0 ? ((avgRecent - avgOlder) / avgOlder) * 100 : 0;
      if (delta > 20) {
        signals.push({
          label: "Aceleração de Volume",
          message: `Volume médio dos últimos 3 meses cresceu ${fmtNum(delta, 1)}% vs trimestre anterior. Janela de captação ampliando.`,
          severity: "positive",
        });
      } else if (delta < -20) {
        signals.push({
          label: "Desaceleração de Volume",
          message: `Volume médio caiu ${fmtNum(Math.abs(delta), 1)}% vs trimestre anterior. Apetite por novas emissões pode estar reduzindo.`,
          severity: "alert",
        });
      }
    }
  }

  // 2. Pipeline Health (ratio em_analise / total)
  if (totalOfertas > 0) {
    const pipelineRatio = (emAnalise / totalOfertas) * 100;
    if (pipelineRatio > 30) {
      signals.push({
        label: "Pipeline Robusto",
        message: `${fmtNum(pipelineRatio, 1)}% das ofertas ainda em análise na CVM. Pipeline sólido de novas emissões.`,
        severity: "positive",
      });
    } else if (pipelineRatio < 5 && totalOfertas > 20) {
      signals.push({
        label: "Pipeline Seco",
        message: `Apenas ${fmtNum(pipelineRatio, 1)}% em análise. Poucas novas ofertas entrando no sistema — possível contração futura.`,
        severity: "watch",
      });
    }
  }

  // 3. Distribution Velocity
  if (totalOfertas > 10) {
    const distribRatio = (emDistribuicao / totalOfertas) * 100;
    if (distribRatio > 20) {
      signals.push({
        label: "Alta Velocidade de Distribuição",
        message: `${formatCount(emDistribuicao)} ofertas em distribuição ativa (${fmtNum(distribRatio, 1)}% do total). Mercado absorvendo bem as emissões.`,
        severity: "positive",
      });
    } else if (distribRatio < 3) {
      signals.push({
        label: "Distribuição Lenta",
        message: `Apenas ${fmtNum(distribRatio, 1)}% em distribuição ativa. Demanda do mercado pode estar fraca.`,
        severity: "watch",
      });
    }
  }

  // 4. Concentration Risk (HHI-inspired)
  if (byTipoAtivo.length > 0 && totalValor > 0) {
    const shares = byTipoAtivo.map((t) => (t.valor / totalValor) * 100);
    const hhi = shares.reduce((s, sh) => s + sh * sh, 0);
    if (hhi > 5000) {
      signals.push({
        label: "Alta Concentração por Classe",
        message: `HHI ${formatCount(Math.round(hhi))} — ${byTipoAtivo[0].tipo} concentra ${fmtNum(shares[0], 1)}% do volume. Diversificação limitada.`,
        severity: "alert",
      });
    } else if (hhi < 2500 && byTipoAtivo.length >= 4) {
      signals.push({
        label: "Diversificação Saudável",
        message: `HHI ${formatCount(Math.round(hhi))} com ${byTipoAtivo.length} classes ativas. Mercado diversificado — menor risco de concentração.`,
        severity: "positive",
      });
    }
  }

  // 5. Cancellation/Suspension Rate
  if (totalOfertas > 20) {
    const cancelSuspenso = byStatus
      .filter((s) => s.status === "cancelado" || s.status === "suspenso")
      .reduce((s, x) => s + x.count, 0);
    const rate = (cancelSuspenso / totalOfertas) * 100;
    if (rate > 10) {
      signals.push({
        label: "Taxa de Cancelamento Elevada",
        message: `${fmtNum(rate, 1)}% das ofertas canceladas ou suspensas (${formatCount(cancelSuspenso)} de ${formatCount(totalOfertas)}). Dificuldade de colocação no mercado.`,
        severity: "alert",
      });
    }
  }

  // 6. Segment Concentration
  if (bySegmento.length > 0) {
    const topSeg = bySegmento[0];
    const segShare = totalValor > 0 ? (topSeg.valor / totalValor) * 100 : 0;
    if (segShare > 50 && bySegmento.length >= 3) {
      signals.push({
        label: "Concentração Setorial",
        message: `Segmento "${topSeg.segmento}" concentra ${fmtNum(segShare, 1)}% do volume total. Risco setorial elevado no pipeline.`,
        severity: "watch",
      });
    }
  }

  // 7. Ticket Médio trend
  if (timeline.length >= 2) {
    const recent = timeline[0];
    const prior = timeline[1];
    const ticketRecent = recent.count > 0 ? recent.valor_total / recent.count : 0;
    const ticketPrior = prior.count > 0 ? prior.valor_total / prior.count : 0;
    if (ticketPrior > 0) {
      const ticketDelta = ((ticketRecent - ticketPrior) / ticketPrior) * 100;
      if (Math.abs(ticketDelta) > 30) {
        signals.push({
          label:
            ticketDelta > 0
              ? "Ticket Médio em Alta"
              : "Ticket Médio em Queda",
          message: `Ticket médio ${ticketDelta > 0 ? "subiu" : "caiu"} ${fmtNum(Math.abs(ticketDelta), 1)}% no último mês (${formatBRL(ticketRecent)} vs ${formatBRL(ticketPrior)}). ${ticketDelta > 0 ? "Emissões maiores chegando ao mercado." : "Emissões menores ou fracionadas predominam."}`,
          severity: ticketDelta > 0 ? "positive" : "watch",
        });
      }
    }
  }

  return signals;
}

/* ─── Component ─── */
export default function OfertasNarrativePanel(props: OfertasNarrativePanelProps) {
  const regime = useMemo(() => detectRegime(props), [props]);
  const signals = useMemo(() => generateSignals(props), [props]);

  const RegimeIcon = regime.icon;

  const SEVERITY_STYLES = {
    alert: { bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-400", dot: "bg-red-400" },
    watch: { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-400", dot: "bg-amber-400" },
    positive: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400", dot: "bg-emerald-400" },
  };

  return (
    <div className="space-y-4">
      {/* Regime Card */}
      <div className={`${regime.bgColor} ${regime.borderColor} border rounded-lg p-4`}>
        <div className="flex items-center gap-2 mb-2">
          <RegimeIcon className={`w-4 h-4 ${regime.color}`} />
          <span className={`text-xs font-semibold font-mono ${regime.color}`}>
            {regime.name}
          </span>
          <span className="text-[9px] font-mono text-zinc-600 ml-auto flex items-center gap-1">
            <Brain className="w-3 h-3" />
            Regime Detection
          </span>
        </div>
        <p className="text-[11px] text-zinc-400 font-mono leading-relaxed">
          {regime.description}
        </p>
      </div>

      {/* Signals */}
      {signals.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono flex items-center gap-1.5">
            <Shield className="w-3 h-3" />
            Cross-Signals ({signals.length})
          </h4>
          {signals.map((signal) => {
            const style = SEVERITY_STYLES[signal.severity];
            return (
              <div
                key={signal.label}
                className={`${style.bg} ${style.border} border rounded-lg p-3`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                  <span className={`text-[10px] font-semibold font-mono ${style.text}`}>
                    {signal.label}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 font-mono leading-relaxed pl-3.5">
                  {signal.message}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
