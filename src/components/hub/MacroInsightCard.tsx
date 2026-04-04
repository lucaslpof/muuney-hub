import { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { motion } from "framer-motion";
import type { SeriesDataPoint } from "@/hooks/useHubData";

/* ─── Types ─── */
export interface InsightInput {
  code: string;
  label: string;
  data: SeriesDataPoint[];
  unit?: string;
  /** If provided, anomaly detection compares current vs target */
  target?: number;
  /** Band around target (e.g., ±1.5 for inflation) */
  band?: number;
  /** For some indicators, lower is better (e.g., unemployment, debt) */
  lowerIsBetter?: boolean;
}

interface ComputedInsight {
  id: string;
  severity: "positive" | "warning" | "negative" | "neutral";
  headline: string;
  detail: string;
  metric: string;
  value: string;
  trend: "up" | "down" | "stable";
  trendMagnitude: number; // absolute % change
}

/* ─── Computation engine ─── */
function computeTrend(data: SeriesDataPoint[], lookback = 3): { direction: "up" | "down" | "stable"; magnitude: number } {
  if (data.length < lookback + 1) return { direction: "stable", magnitude: 0 };
  const recent = data.slice(-lookback);
  const prior = data.slice(-(lookback * 2), -lookback);
  if (prior.length === 0) return { direction: "stable", magnitude: 0 };

  const avgRecent = recent.reduce((s, d) => s + d.value, 0) / recent.length;
  const avgPrior = prior.reduce((s, d) => s + d.value, 0) / prior.length;
  const pctChange = avgPrior === 0 ? 0 : ((avgRecent - avgPrior) / Math.abs(avgPrior)) * 100;

  if (Math.abs(pctChange) < 0.5) return { direction: "stable", magnitude: Math.abs(pctChange) };
  return { direction: pctChange > 0 ? "up" : "down", magnitude: Math.abs(pctChange) };
}

function detectAnomaly(data: SeriesDataPoint[], windowSize = 12): { isAnomaly: boolean; zScore: number } {
  if (data.length < windowSize + 1) return { isAnomaly: false, zScore: 0 };
  const window = data.slice(-windowSize - 1, -1).map(d => d.value);
  const current = data[data.length - 1].value;
  const mean = window.reduce((s, v) => s + v, 0) / window.length;
  const std = Math.sqrt(window.reduce((s, v) => s + (v - mean) ** 2, 0) / window.length);
  if (std === 0) return { isAnomaly: false, zScore: 0 };
  const z = (current - mean) / std;
  return { isAnomaly: Math.abs(z) > 1.8, zScore: Math.round(z * 100) / 100 };
}

function generateInsight(input: InsightInput): ComputedInsight | null {
  const { code, label, data, unit = "", target, band, lowerIsBetter } = input;
  if (data.length < 3) return null;

  const current = data[data.length - 1].value;
  const trend = computeTrend(data);
  const anomaly = detectAnomaly(data);
  const formattedValue = `${current.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}`;

  // Determine severity and generate narrative
  let severity: ComputedInsight["severity"] = "neutral";
  let headline = "";
  let detail = "";

  const trendWord = trend.direction === "up" ? "alta" : trend.direction === "down" ? "queda" : "estável";
  const trendAdverb = trend.magnitude > 5 ? "forte " : trend.magnitude > 2 ? "" : "leve ";

  // Target-based insight (e.g., IPCA vs meta)
  if (target !== undefined && band !== undefined) {
    const gap = current - target;
    const inBand = Math.abs(gap) <= band;
    const above = gap > band;
    const below = gap < -band;

    if (inBand) {
      severity = "positive";
      headline = `${label} dentro da meta`;
      detail = `Em ${formattedValue}, dentro da banda de ${(target - band).toFixed(1)} a ${(target + band).toFixed(1)}${unit}. Tendência de ${trendAdverb}${trendWord}.`;
    } else if ((above && !lowerIsBetter) || (below && lowerIsBetter)) {
      severity = anomaly.isAnomaly ? "negative" : "warning";
      headline = `${label} ${above ? "acima" : "abaixo"} da meta`;
      detail = `Em ${formattedValue}, ${above ? "acima" : "abaixo"} do teto de ${(target + band).toFixed(1)}${unit}. ${trend.direction === (above ? "down" : "up") ? "Tendência de convergência." : "Sem sinal de reversão."}`;
    } else {
      severity = "positive";
      headline = `${label} ${below ? "abaixo" : "acima"} da meta — favorável`;
      detail = `Em ${formattedValue}, em patamar ${lowerIsBetter ? "saudável" : "favorável"}. Tendência de ${trendAdverb}${trendWord}.`;
    }
  }
  // Anomaly-based insight
  else if (anomaly.isAnomaly) {
    const direction = anomaly.zScore > 0 ? "acima" : "abaixo";
    severity = (anomaly.zScore > 0 && !lowerIsBetter) || (anomaly.zScore < 0 && lowerIsBetter) ? "warning" : "positive";
    headline = `${label} — desvio significativo`;
    detail = `Em ${formattedValue}, ${Math.abs(anomaly.zScore).toFixed(1)}σ ${direction} da média recente. Tendência de ${trendAdverb}${trendWord}.`;
  }
  // Trend-based insight
  else {
    const goodTrend = lowerIsBetter ? trend.direction === "down" : trend.direction === "up";
    const badTrend = lowerIsBetter ? trend.direction === "up" : trend.direction === "down";
    severity = goodTrend ? "positive" : badTrend ? "warning" : "neutral";
    headline = `${label} em ${trendAdverb}${trendWord}`;
    detail = `Atual: ${formattedValue}. Variação de ${trend.magnitude.toFixed(1)}% no período recente.`;
  }

  return {
    id: code,
    severity,
    headline,
    detail,
    metric: label,
    value: formattedValue,
    trend: trend.direction,
    trendMagnitude: trend.magnitude,
  };
}

/* ─── Visual configs ─── */
const severityStyles = {
  positive: {
    bg: "bg-emerald-500/5", border: "border-emerald-500/15",
    icon: CheckCircle2, iconColor: "text-emerald-400",
    headlineColor: "text-emerald-300", badge: "bg-emerald-500/15 text-emerald-400",
  },
  warning: {
    bg: "bg-amber-500/5", border: "border-amber-500/15",
    icon: AlertTriangle, iconColor: "text-amber-400",
    headlineColor: "text-amber-300", badge: "bg-amber-500/15 text-amber-400",
  },
  negative: {
    bg: "bg-red-500/5", border: "border-red-500/15",
    icon: AlertTriangle, iconColor: "text-red-400",
    headlineColor: "text-red-300", badge: "bg-red-500/15 text-red-400",
  },
  neutral: {
    bg: "bg-zinc-800/30", border: "border-zinc-700/30",
    icon: Info, iconColor: "text-zinc-500",
    headlineColor: "text-zinc-300", badge: "bg-zinc-700/30 text-zinc-500",
  },
};

/* ─── Component ─── */
export const MacroInsightCard = ({ inputs }: { inputs: InsightInput[] }) => {
  const insights = useMemo(
    () => inputs.map(generateInsight).filter((i): i is ComputedInsight => i !== null)
      .sort((a, b) => {
        const order = { negative: 0, warning: 1, positive: 2, neutral: 3 };
        return order[a.severity] - order[b.severity];
      }),
    [inputs]
  );

  if (insights.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {insights.map((insight, i) => {
        const style = severityStyles[insight.severity];
        const Icon = style.icon;
        const TrendIcon = insight.trend === "up" ? TrendingUp : insight.trend === "down" ? TrendingDown : Minus;

        return (
          <motion.div
            key={insight.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.05 }}
            className={`${style.bg} border ${style.border} rounded-lg px-3.5 py-3 transition-all`}
          >
            <div className="flex items-start gap-2.5">
              <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${style.iconColor}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className={`text-[11px] font-medium font-mono leading-tight ${style.headlineColor}`}>
                    {insight.headline}
                  </h4>
                </div>
                <p className="text-[10px] text-zinc-500 font-mono leading-relaxed">{insight.detail}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`text-[10px] font-mono font-bold ${style.badge} px-1.5 py-0.5 rounded`}>
                    {insight.value}
                  </span>
                  <span className={`flex items-center gap-0.5 text-[9px] font-mono ${
                    insight.trend === "up" ? "text-emerald-500" : insight.trend === "down" ? "text-red-400" : "text-zinc-600"
                  }`}>
                    <TrendIcon className="w-2.5 h-2.5" />
                    {insight.trendMagnitude.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export { generateInsight, computeTrend, detectAnomaly };
