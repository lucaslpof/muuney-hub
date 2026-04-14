import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { fmtNum } from "@/lib/format";

interface SparklinePoint {
  value: number;
}

interface KPICardProps {
  title: string;
  value: string;
  change?: number;
  trend?: "up" | "down" | "stable";
  unit?: string;
  lastDate?: string;
  loading?: boolean;
  sparklineData?: SparklinePoint[];
  onClick?: () => void;
}

/* Tiny inline SVG sparkline - no deps, 30-point max */
const Sparkline = ({ data, trend }: { data: SparklinePoint[]; trend?: string }) => {
  const { path, areaPath } = useMemo(() => {
    if (!data.length) return { path: "", areaPath: "" };
    const vals = data.map((d) => d.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    const w = 80;
    const h = 24;
    const step = w / (vals.length - 1);

    const points = vals.map((v, i) => ({
      x: i * step,
      y: h - ((v - min) / range) * h,
    }));

    const linePath = points.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(" ");
    const area = `${linePath} L${points[points.length - 1].x},${h} L0,${h} Z`;
    return { path: linePath, areaPath: area };
  }, [data]);

  const color = trend === "up" ? "#34d399" : trend === "down" ? "#f87171" : "#71717a";
  const fillColor = trend === "up" ? "#34d399" : trend === "down" ? "#f87171" : "#71717a";

  return (
    <svg width="80" height="24" viewBox="0 0 80 24" className="flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
      <path d={areaPath} fill={fillColor} opacity={0.1} />
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

/* Loading skeleton - Bloomberg-dense */
const KPICardSkeleton = () => (
  <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-md px-3 py-2.5 animate-pulse">
    <div className="h-2.5 bg-zinc-800 rounded w-2/3 mb-2" />
    <div className="flex items-end justify-between">
      <div>
        <div className="h-5 bg-zinc-800 rounded w-16 mb-1.5" />
        <div className="h-2 bg-zinc-800 rounded w-10" />
      </div>
      <div className="h-5 bg-zinc-800 rounded w-16" />
    </div>
  </div>
);

/* --- Simple KPI Card - compact variant for deep modules (FIDC, FII, FIP) --- */
export interface SimpleKPICardProps {
  label: string;
  value: string | number;
  unit?: string;
  color?: string;
  sublabel?: string;
}

export const SimpleKPICard = ({
  label,
  value,
  unit = "",
  color = "text-zinc-400",
  sublabel,
}: SimpleKPICardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-3"
    role="status"
    aria-label={`${label}: ${value}${unit}`}
  >
    <div className="text-xs text-zinc-500 uppercase tracking-wider font-mono mb-1">{label}</div>
    <div className={`text-sm font-semibold font-mono ${color}`}>
      {value}{unit && <span className="text-xs ml-0.5">{unit}</span>}
    </div>
    {sublabel && (
      <div className="text-[9px] text-zinc-600 mt-0.5 font-mono">{sublabel}</div>
    )}
  </motion.div>
);

export const KPICard = ({
  title,
  value,
  change,
  trend,
  unit,
  lastDate,
  loading,
  sparklineData,
  onClick,
}: KPICardProps) => {
  if (loading) return <KPICardSkeleton />;

  const trendColor =
    trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-zinc-500";
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendBg =
    trend === "up"
      ? "bg-emerald-400/10"
      : trend === "down"
      ? "bg-red-400/10"
      : "bg-zinc-500/10";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      onClick={onClick}
      className={`group bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700 rounded-md px-3 py-2.5 transition-all duration-150 ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      {/* Title row */}
      <p className="text-xs text-zinc-500 uppercase tracking-wider font-mono truncate mb-1.5">
        {title}
      </p>

      {/* Value + Sparkline row */}
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          {/* Value */}
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold text-zinc-100 font-mono leading-none">{value}</span>
            {unit && <span className="text-[10px] text-zinc-600 font-mono">{unit}</span>}
          </div>

          {/* Change badge + date */}
          <div className="flex items-center gap-1.5 mt-1">
            {change !== undefined && (
              <span
                className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-mono ${trendColor} ${trendBg}`}
              >
                <TrendIcon className="w-2.5 h-2.5" />
                {change > 0 ? "+" : ""}
                {fmtNum(change, 2)}%
              </span>
            )}
            {lastDate && (
              <span className="text-[8px] text-zinc-600 font-mono">{lastDate}</span>
            )}
          </div>
        </div>

        {/* Sparkline */}
        {sparklineData && sparklineData.length > 2 && (
          <Sparkline data={sparklineData} trend={trend} />
        )}
      </div>
    </motion.div>
  );
};
