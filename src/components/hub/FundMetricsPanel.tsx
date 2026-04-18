import { useMemo } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line,
} from "recharts";
import { motion } from "framer-motion";
import type { FundDaily } from "@/hooks/useHubFundos";
import {
  computeFundMetrics, maxDrawdown, rollingVolatility,
  fmtMetric, fmtMetricSigned, metricColor, sharpeLabel,
  type FundMetricsResult,
} from "@/lib/fundMetrics";
import type { TooltipEntry } from "@/components/hub/ChartTooltip";

/* ─── Tooltip ─── */
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-2 shadow-xl">
      <div className="text-[9px] text-zinc-500 font-mono mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="text-[10px] font-mono">
          <span style={{ color: p.color }}>{p.name}:</span>{" "}
          <span className="text-zinc-100 font-bold">{typeof p.value === "number" ? p.value.toFixed(2) + "%" : p.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Metric Card (single KPI) ─── */
const MetricCard = ({
  label, value, sublabel, colorClass,
}: {
  label: string; value: string; sublabel?: string; colorClass?: string;
}) => (
  <div className="bg-[#0a0a0a] border border-zinc-800/50 rounded-md px-2.5 py-2">
    <div className="text-[8px] text-zinc-600 uppercase tracking-wider font-mono mb-0.5">{label}</div>
    <div className={`text-sm font-bold font-mono ${colorClass || "text-zinc-100"}`}>{value}</div>
    {sublabel && <div className="text-[8px] text-zinc-700 font-mono mt-0.5">{sublabel}</div>}
  </div>
);

/* ─── Main: Fund Metrics Summary ─── */
interface FundMetricsSummaryProps {
  daily: FundDaily[];
  title?: string;
}

export const FundMetricsSummary = ({ daily, title }: FundMetricsSummaryProps) => {
  const metrics = useMemo(() => computeFundMetrics(daily), [daily]);
  const sl = sharpeLabel(metrics.sharpe);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-3"
    >
      <h3 className="text-[11px] text-zinc-400 uppercase tracking-wider font-mono mb-3">
        {title || "Métricas de Risco-Retorno"}
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricCard
          label="Retorno (período)"
          value={`${fmtMetricSigned(metrics.return_period)}%`}
          colorClass={metricColor(metrics.return_period)}
        />
        <MetricCard
          label="Retorno anualizado"
          value={`${fmtMetricSigned(metrics.return_annualized)}%`}
          colorClass={metricColor(metrics.return_annualized)}
        />
        <MetricCard
          label="Volatilidade (a.a.)"
          value={`${fmtMetric(metrics.volatility)}%`}
          colorClass="text-zinc-300"
        />
        <MetricCard
          label="Sharpe Ratio"
          value={fmtMetric(metrics.sharpe)}
          sublabel={sl.label}
          colorClass={sl.color}
        />
        <MetricCard
          label="Sortino Ratio"
          value={fmtMetric(metrics.sortino)}
          colorClass={metricColor(metrics.sortino)}
        />
        <MetricCard
          label="Max Drawdown"
          value={`${fmtMetric(metrics.max_drawdown)}%`}
          colorClass={metricColor(metrics.max_drawdown, false)}
        />
        <MetricCard
          label="Calmar Ratio"
          value={fmtMetric(metrics.calmar)}
          colorClass={metricColor(metrics.calmar)}
        />
        <MetricCard
          label="Dias positivos"
          value={metrics.positive_days_pct != null ? `${fmtMetric(metrics.positive_days_pct, 1)}%` : "—"}
          sublabel={`${metrics.data_points} observações`}
          colorClass="text-zinc-300"
        />
      </div>
    </motion.div>
  );
};

/* ─── Drawdown Chart ─── */
interface DrawdownChartProps {
  daily: FundDaily[];
  title?: string;
  height?: number;
}

export const DrawdownChart = ({ daily, title, height = 200 }: DrawdownChartProps) => {
  const data = useMemo(() => {
    const dd = maxDrawdown(daily);
    return dd.drawdownSeries.map((d) => ({
      date: new Date(d.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
      drawdown: d.drawdown,
    }));
  }, [daily]);

  if (data.length < 2) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-3"
    >
      <h3 className="text-[11px] text-zinc-400 uppercase tracking-wider font-mono mb-3">
        {title || "Drawdown"}
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#52525b" }} tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fontSize: 9, fill: "#52525b" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${v.toFixed(1)}%`}
            width={40}
            domain={["dataMin", 0]}
          />
          <Tooltip content={<ChartTooltip />} />
          <Area
            type="monotone"
            dataKey="drawdown"
            name="Drawdown"
            stroke="#EF4444"
            fill="#EF4444"
            fillOpacity={0.15}
            strokeWidth={1.5}
          />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
};

/* ─── Rolling Volatility Chart ─── */
interface VolatilityChartProps {
  daily: FundDaily[];
  window?: number;
  title?: string;
  height?: number;
}

export const VolatilityChart = ({ daily, window = 21, title, height = 200 }: VolatilityChartProps) => {
  const data = useMemo(() =>
    rollingVolatility(daily, window).map((d) => ({
      date: new Date(d.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
      volatility: d.volatility,
    })), [daily, window]
  );

  if (data.length < 2) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-3"
    >
      <h3 className="text-[11px] text-zinc-400 uppercase tracking-wider font-mono mb-3">
        {title || `Volatilidade Rolling (${window}d)`}
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#52525b" }} tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fontSize: 9, fill: "#52525b" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${v.toFixed(0)}%`}
            width={35}
          />
          <Tooltip content={<ChartTooltip />} />
          <Line
            type="monotone"
            dataKey="volatility"
            name="Vol"
            stroke="#F59E0B"
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  );
};

/* ─── Metrics Comparison Table (for Comparador) ─── */
interface MetricsCompareTableProps {
  funds: {
    name: string;
    metrics: FundMetricsResult;
  }[];
}

export const MetricsCompareTable = ({ funds }: MetricsCompareTableProps) => {
  if (funds.length < 2) return null;

  const rows: { label: string; key: keyof FundMetricsResult; format: (v: number | null) => string; higher: boolean }[] = [
    { label: "Retorno período", key: "return_period", format: (v) => `${fmtMetricSigned(v)}%`, higher: true },
    { label: "Retorno anualizado", key: "return_annualized", format: (v) => `${fmtMetricSigned(v)}%`, higher: true },
    { label: "Volatilidade", key: "volatility", format: (v) => `${fmtMetric(v)}%`, higher: false },
    { label: "Sharpe", key: "sharpe", format: (v) => fmtMetric(v), higher: true },
    { label: "Sortino", key: "sortino", format: (v) => fmtMetric(v), higher: true },
    { label: "Max Drawdown", key: "max_drawdown", format: (v) => `${fmtMetric(v)}%`, higher: false },
    { label: "Calmar", key: "calmar", format: (v) => fmtMetric(v), higher: true },
    { label: "% Dias positivos", key: "positive_days_pct", format: (v) => `${fmtMetric(v, 1)}%`, higher: true },
  ];

  // Find best value per row
  const bestIdx = rows.map((row) => {
    const values = funds.map((f) => f.metrics[row.key] as number | null);
    let best = -1;
    let bestVal = row.higher ? -Infinity : Infinity;
    values.forEach((v, i) => {
      if (v == null) return;
      if (row.higher ? v > bestVal : v < bestVal) {
        bestVal = v;
        best = i;
      }
    });
    return best;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg overflow-x-auto"
    >
      <table className="w-full text-[10px] font-mono">
        <thead>
          <tr className="border-b border-zinc-800/50 text-zinc-600">
            <th className="text-left px-3 py-2">Métrica</th>
            {funds.map((f, i) => (
              <th key={i} className="text-right px-3 py-2 max-w-[150px] truncate">{f.name.slice(0, 22)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={row.key} className="border-b border-zinc-800/30">
              <td className="px-3 py-1.5 text-zinc-500">{row.label}</td>
              {funds.map((f, fi) => {
                const val = f.metrics[row.key] as number | null;
                const isBest = bestIdx[ri] === fi;
                return (
                  <td key={fi} className={`px-3 py-1.5 text-right ${isBest ? "text-emerald-400 font-bold" : metricColor(val, row.higher)}`}>
                    {row.format(val)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </motion.div>
  );
};
