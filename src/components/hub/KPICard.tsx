import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useMemo } from "react";
import { motion } from "framer-motion";

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

/* Tiny inline SVG sparkline — no deps, 30-point max */
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

/* Loading skeleton — Bloomberg-dense */
const KPICardSkeleton = () => (
  <div className="bg-[#111111] border border-[#1a1a1a] rounded-md px-3 py-2.5 animate-pulse">
    <div className="h-2.5 bg-[#1a1a1a] rounded w-2/3 mb-2" />
    <div className="flex items-end justify-between">
      <div>
        <div className="h-5 bg-[#1a1a1a] rounded w-16 mb-1.5" />
        <div className="h-2 bg-[#1a1a1a] rounded w-10" />
      </div>
      <div className="h-5 bg-[#1a1a1a] rounded w-16" />
    </div>
  </div>
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
      className={`group bg-[#111111] border border-[#1a1a1a] hover:border-[#0B6C3E]/40 rounded-md px-3 py-2.5 transition-all duration-150 ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      {/* Title row */}
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono truncate mb-1.5">
        {title}
      </p>

      {/* Value + Sparkline row */}
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          {/* Value */}
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold text-zinc-100 font-mono leading-none">{value}</span>
            {unit && <span className="text-[10px] text-zinc-600">{unit}</span>}
          </div>

          {/* Change badge + date */}
          <div className="flex items-center gap-1.5 mt-1">
            {change !== undefined && (
              <span
                className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-mono ${trendColor} ${trendBg}`}
              >
                <TrendIcon className="w-2.5 h-2.5" />
                {change > 0 ? "+" : ""}
                {change.toFixed(2)}%
              </span>
            )}
            {lastDate && (
              <span className="text-[9px] text-zinc-700 font-mono">{lastDate}</span>
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
