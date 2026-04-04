import { useMemo } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar,
} from "recharts";
import { motion } from "framer-motion";
import type { FundDaily } from "@/hooks/useHubFundos";
import { formatPL, shortCnpj } from "@/hooks/useHubFundos";

const COLORS = ["#0B6C3E", "#6366F1", "#F59E0B", "#EF4444", "#EC4899"];

/* ─── Tooltip ─── */
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-2 shadow-xl">
      <div className="text-[9px] text-zinc-500 font-mono mb-1">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="text-[10px] font-mono">
          <span style={{ color: p.color }}>{p.name}:</span>{" "}
          <span className="text-zinc-100 font-bold">
            {typeof p.value === "number" ? p.value.toFixed(2) + "%" : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── Quota Performance (indexed to 100) ─── */
interface FundSeriesInput {
  cnpj: string;
  name: string;
  daily: FundDaily[];
}

interface QuotaCompareChartProps {
  funds: FundSeriesInput[];
  title?: string;
  height?: number;
}

export const QuotaCompareChart = ({ funds, title, height = 280 }: QuotaCompareChartProps) => {
  const chartData = useMemo(() => {
    if (!funds.length) return [];
    // Collect all dates
    const allDates = new Set<string>();
    funds.forEach((f) => f.daily.forEach((d) => allDates.add(d.dt_comptc)));
    const dates = Array.from(allDates).sort();

    // Build index map per fund (base 100)
    return dates.map((date) => {
      const point: Record<string, any> = {
        date: new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
      };
      funds.forEach((f) => {
        const baseQuota = f.daily[0]?.vl_quota;
        const dayData = f.daily.find((d) => d.dt_comptc === date);
        if (dayData?.vl_quota && baseQuota) {
          point[f.cnpj] = ((dayData.vl_quota / baseQuota - 1) * 100);
        }
      });
      return point;
    });
  }, [funds]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-3"
    >
      <h3 className="text-[11px] text-zinc-400 uppercase tracking-wider font-mono mb-3">
        {title || "Rentabilidade Comparada"}
      </h3>
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-2">
        {funds.map((f, i) => (
          <div key={f.cnpj} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
            <span className="text-[9px] text-zinc-500 font-mono truncate max-w-[120px]">
              {f.name || shortCnpj(f.cnpj)}
            </span>
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#52525b" }} tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fontSize: 9, fill: "#52525b" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${v.toFixed(1)}%`}
            width={45}
          />
          <Tooltip content={<ChartTooltip />} />
          {funds.map((f, i) => (
            <Line
              key={f.cnpj}
              type="monotone"
              dataKey={f.cnpj}
              name={f.name || shortCnpj(f.cnpj)}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={1.5}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  );
};

/* ─── PL Evolution (Area chart for single fund) ─── */
interface PLEvolutionChartProps {
  daily: FundDaily[];
  title?: string;
  height?: number;
}

export const PLEvolutionChart = ({ daily, title, height = 220 }: PLEvolutionChartProps) => {
  const data = useMemo(() =>
    daily.map((d) => ({
      date: new Date(d.dt_comptc).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
      pl: d.vl_patrim_liq ? d.vl_patrim_liq / 1e9 : null,
    })), [daily]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-3"
    >
      <h3 className="text-[11px] text-zinc-400 uppercase tracking-wider font-mono mb-3">
        {title || "Patrimônio Líquido"}
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#52525b" }} tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fontSize: 9, fill: "#52525b" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${v.toFixed(0)}B`}
            width={40}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-2 shadow-xl">
                  <div className="text-[9px] text-zinc-500 font-mono mb-1">{label}</div>
                  <div className="text-[10px] font-mono text-zinc-100 font-bold">
                    R$ {(payload[0].value as number).toFixed(2)}B
                  </div>
                </div>
              );
            }}
          />
          <Line type="monotone" dataKey="pl" stroke="#0B6C3E" strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  );
};

/* ─── Fund Flow (Captação vs Resgate bar chart) ─── */
interface FlowChartProps {
  daily: FundDaily[];
  title?: string;
  height?: number;
}

export const FlowChart = ({ daily, title, height = 220 }: FlowChartProps) => {
  const data = useMemo(() =>
    daily.map((d) => ({
      date: new Date(d.dt_comptc).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
      captacao: d.captc_dia ? d.captc_dia / 1e6 : 0,
      resgate: d.resg_dia ? -(d.resg_dia / 1e6) : 0,
      net: ((d.captc_dia || 0) - (d.resg_dia || 0)) / 1e6,
    })), [daily]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-3"
    >
      <h3 className="text-[11px] text-zinc-400 uppercase tracking-wider font-mono mb-3">
        {title || "Captação vs Resgate"}
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#52525b" }} tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fontSize: 9, fill: "#52525b" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${v.toFixed(0)}M`}
            width={40}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-2 shadow-xl">
                  <div className="text-[9px] text-zinc-500 font-mono mb-1">{label}</div>
                  {payload.map((p: any, i: number) => (
                    <div key={i} className="text-[10px] font-mono">
                      <span style={{ color: p.color }}>{p.name}:</span>{" "}
                      <span className="text-zinc-100 font-bold">R$ {Math.abs(p.value).toFixed(1)}M</span>
                    </div>
                  ))}
                </div>
              );
            }}
          />
          <Bar dataKey="captacao" name="Captação" fill="#0B6C3E" radius={[2, 2, 0, 0]} />
          <Bar dataKey="resgate" name="Resgate" fill="#EF4444" radius={[0, 0, 2, 2]} />
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
};

/* ─── Classe Distribution (horizontal bar) ─── */
interface ClasseDistributionProps {
  byClasse: Record<string, { count: number; pl_total: number }>;
  mode?: "count" | "pl";
  title?: string;
}

export const ClasseDistribution = ({ byClasse, mode = "pl", title }: ClasseDistributionProps) => {
  const sorted = useMemo(() => {
    return Object.entries(byClasse)
      .map(([classe, data]) => ({ classe, ...data }))
      .sort((a, b) => (mode === "pl" ? b.pl_total - a.pl_total : b.count - a.count))
      .slice(0, 10);
  }, [byClasse, mode]);

  const maxVal = Math.max(...sorted.map((s) => (mode === "pl" ? s.pl_total : s.count)), 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-3"
    >
      <h3 className="text-[11px] text-zinc-400 uppercase tracking-wider font-mono mb-3">
        {title || "Distribuição por Classe"}
      </h3>
      <div className="space-y-2">
        {sorted.map((item, i) => {
          const pct = ((mode === "pl" ? item.pl_total : item.count) / maxVal) * 100;
          return (
            <div key={item.classe}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] text-zinc-400 font-mono truncate max-w-[180px]">
                  {item.classe}
                </span>
                <span className="text-[10px] text-zinc-300 font-mono font-bold">
                  {mode === "pl" ? formatPL(item.pl_total) : item.count}
                </span>
              </div>
              <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: COLORS[i % COLORS.length],
                    opacity: 0.7,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};
