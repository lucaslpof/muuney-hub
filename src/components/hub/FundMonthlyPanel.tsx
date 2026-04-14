import { useState, useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, ComposedChart, Cell,
} from "recharts";
import { motion } from "framer-motion";
import { Trophy, TrendingDown, ArrowUpDown } from "lucide-react";
import {
  useMonthlyRankings, useMonthlyOverview, useFundMonthly,
  formatPL, shortCnpj,
  type MonthlyRankingItem, type FundMonthly,
} from "@/hooks/useHubFundos";

/* ─── Tooltip ─── */
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-2 shadow-xl">
      <div className="text-[9px] text-zinc-500 font-mono mb-1">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="text-[10px] font-mono">
          <span style={{ color: p.color }}>{p.name}:</span>{" "}
          <span className="text-zinc-100 font-bold">
            {typeof p.value === "number" ? (p.dataKey?.includes("pl") || p.dataKey?.includes("captacao") ? formatPL(p.value) : `${p.value.toFixed(2)}%`) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── Monthly Overview Chart (avg/median return + PL evolution) ─── */
export const MonthlyOverviewChart = ({ months = 12 }: { months?: number }) => {
  const { data, isLoading } = useMonthlyOverview(months);

  const chartData = useMemo(() =>
    (data?.months || []).map((m) => ({
      month: new Date(m.month).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      avg_rentab: m.avg_rentab,
      median_rentab: m.median_rentab,
      total_pl: m.total_pl,
      captacao_liquida: m.total_captacao_liquida,
      funds: m.funds,
    })),
    [data]
  );

  if (isLoading) {
    return <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4 animate-pulse"><div className="h-48 bg-[#1a1a1a] rounded" /></div>;
  }

  if (chartData.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Return distribution */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-3">
        <h3 className="text-[11px] text-zinc-400 uppercase tracking-wider font-mono mb-3">
          Rentabilidade Média vs Mediana (mensal)
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="month" tick={{ fontSize: 9, fill: "#52525b" }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "#52525b" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v.toFixed(1)}%`} width={40} />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine y={0} stroke="#333" strokeDasharray="3 3" />
            <Bar dataKey="avg_rentab" name="Média" fill="#0B6C3E" fillOpacity={0.6} radius={[2, 2, 0, 0]} />
            <Line type="monotone" dataKey="median_rentab" name="Mediana" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3, fill: "#F59E0B" }} />
          </ComposedChart>
        </ResponsiveContainer>
      </motion.div>

      {/* PL + captação líquida */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-3">
        <h3 className="text-[11px] text-zinc-400 uppercase tracking-wider font-mono mb-3">
          Captação Líquida Mensal
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="month" tick={{ fontSize: 9, fill: "#52525b" }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "#52525b" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatPL(v)} width={55} />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine y={0} stroke="#333" strokeDasharray="3 3" />
            <Bar dataKey="captacao_liquida" name="Captação Líq." radius={[2, 2, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.captacao_liquida >= 0 ? "#0B6C3E" : "#EF4444"} fillOpacity={0.7} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  );
};

/* ─── Monthly Rankings Table ─── */
export const MonthlyRankingsTable = ({
  onSelectFund,
}: {
  onSelectFund?: (cnpj: string) => void;
}) => {
  const now = new Date();
  // Default to previous month (latest likely available)
  const defaultMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth.toISOString().split("T")[0]);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  const { data, isLoading } = useMonthlyRankings(selectedMonth, { limit: 30, order: sortOrder });

  // Generate last 12 months for selector
  const monthOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    for (let i = 1; i <= 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      opts.push({
        value: d.toISOString().split("T")[0],
        label: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
      });
    }
    return opts;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-800/50">
        <div className="flex items-center gap-2">
          {sortOrder === "desc" ? <Trophy className="w-3.5 h-3.5 text-[#0B6C3E]" /> : <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
          <h3 className="text-[11px] text-zinc-400 uppercase tracking-wider font-mono">
            {sortOrder === "desc" ? "Top Performers" : "Piores Performers"}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
            className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono text-zinc-500 hover:text-zinc-300 border border-zinc-800/50 rounded hover:border-[#0B6C3E]/30 transition-colors"
          >
            <ArrowUpDown className="w-2.5 h-2.5" />
            {sortOrder === "desc" ? "Top" : "Bottom"}
          </button>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="text-[10px] font-mono bg-[#0a0a0a] border border-zinc-800/50 rounded px-2 py-0.5 text-zinc-400 focus:border-[#0B6C3E]/40 focus:outline-none"
          >
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="p-4 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-6 bg-[#1a1a1a] rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto scrollbar-none">
          <table className="w-full text-[10px] font-mono min-w-[600px]">
            <thead>
              <tr className="border-b border-zinc-800/50 text-zinc-600">
                <th className="text-left px-3 py-2 w-8">#</th>
                <th className="text-left px-3 py-2">Fundo</th>
                <th className="text-right px-3 py-2">Rentab.</th>
                <th className="text-right px-3 py-2 hidden sm:table-cell">Benchmark</th>
                <th className="text-right px-3 py-2 hidden sm:table-cell">Alpha</th>
                <th className="text-right px-3 py-2">PL</th>
                <th className="text-right px-3 py-2 hidden md:table-cell">Captação Líq.</th>
              </tr>
            </thead>
            <tbody>
              {(data?.funds || []).map((f: MonthlyRankingItem, i: number) => {
                const alpha = f.rentab_fundo != null && f.rentab_benchmark != null
                  ? f.rentab_fundo - f.rentab_benchmark
                  : null;
                return (
                  <tr
                    key={f.cnpj_fundo}
                    onClick={() => onSelectFund?.(f.cnpj_fundo)}
                    className="border-b border-zinc-800/30 hover:bg-[#0B6C3E]/5 cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-1.5 text-zinc-700">{i + 1}</td>
                    <td className="px-3 py-1.5">
                      <div className="text-zinc-300 truncate max-w-[200px]">{f.denom_social || shortCnpj(f.cnpj_fundo)}</div>
                      <div className="text-[8px] text-zinc-700">{f.classe_anbima || f.classe || ""}</div>
                    </td>
                    <td className={`px-3 py-1.5 text-right font-bold ${(f.rentab_fundo ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {f.rentab_fundo != null ? `${f.rentab_fundo >= 0 ? "+" : ""}${f.rentab_fundo.toFixed(2)}%` : "—"}
                    </td>
                    <td className="px-3 py-1.5 text-right text-zinc-500 hidden sm:table-cell">
                      {f.rentab_benchmark != null ? `${f.rentab_benchmark.toFixed(2)}%` : "—"}
                    </td>
                    <td className={`px-3 py-1.5 text-right hidden sm:table-cell ${alpha != null ? (alpha >= 0 ? "text-emerald-400" : "text-red-400") : "text-zinc-700"}`}>
                      {alpha != null ? `${alpha >= 0 ? "+" : ""}${alpha.toFixed(2)}%` : "—"}
                    </td>
                    <td className="px-3 py-1.5 text-right text-zinc-400">{formatPL(f.vl_patrim_liq)}</td>
                    <td className={`px-3 py-1.5 text-right hidden md:table-cell ${(f.captc_liquida_mes ?? 0) >= 0 ? "text-zinc-400" : "text-red-400"}`}>
                      {f.captc_liquida_mes != null ? formatPL(f.captc_liquida_mes) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
};

/* ─── Single Fund Monthly Performance ─── */
export const FundMonthlyDetail = ({ cnpj }: { cnpj: string }) => {
  const { data, isLoading } = useFundMonthly(cnpj, 24);

  const chartData = useMemo(() =>
    (data?.months || []).map((m: FundMonthly) => ({
      month: new Date(m.dt_comptc).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      rentab: m.rentab_fundo,
      benchmark: m.rentab_benchmark,
      pl: m.vl_patrim_liq,
      captacao: m.captc_liquida_mes,
    })),
    [data]
  );

  if (isLoading) {
    return <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4 animate-pulse"><div className="h-40 bg-[#1a1a1a] rounded" /></div>;
  }

  if (chartData.length === 0) return null;

  // Compute summary metrics
  const months = data?.months || [];
  const avgReturn = months.filter((m: FundMonthly) => m.rentab_fundo != null).reduce((sum: number, m: FundMonthly) => sum + (m.rentab_fundo || 0), 0) / (months.filter((m: FundMonthly) => m.rentab_fundo != null).length || 1);
  const positiveMonths = months.filter((m: FundMonthly) => (m.rentab_fundo ?? 0) > 0).length;
  const cumReturn = months.filter((m: FundMonthly) => m.rentab_fundo != null).reduce((cum: number, m: FundMonthly) => cum * (1 + (m.rentab_fundo || 0) / 100), 1);

  return (
    <div className="space-y-3">
      {/* Summary KPIs */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Retorno acum.", value: `${((cumReturn - 1) * 100).toFixed(2)}%`, color: cumReturn >= 1 ? "text-emerald-400" : "text-red-400" },
          { label: "Retorno médio/mês", value: `${avgReturn.toFixed(2)}%`, color: avgReturn >= 0 ? "text-emerald-400" : "text-red-400" },
          { label: "Meses positivos", value: `${positiveMonths}/${months.length}`, color: "text-zinc-300" },
          { label: "Meses cobertos", value: String(months.length), color: "text-zinc-300" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-zinc-900/50 border border-zinc-800/50 rounded-md px-2.5 py-2">
            <div className="text-[8px] text-zinc-600 uppercase tracking-wider font-mono mb-0.5">{kpi.label}</div>
            <div className={`text-sm font-bold font-mono ${kpi.color}`}>{kpi.value}</div>
          </div>
        ))}
      </motion.div>

      {/* Return vs Benchmark */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-3">
        <h3 className="text-[11px] text-zinc-400 uppercase tracking-wider font-mono mb-3">
          Rentabilidade Mensal vs Benchmark
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="month" tick={{ fontSize: 9, fill: "#52525b" }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "#52525b" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v.toFixed(1)}%`} width={40} />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine y={0} stroke="#333" strokeDasharray="3 3" />
            <Bar dataKey="rentab" name="Fundo" fill="#0B6C3E" fillOpacity={0.7} radius={[2, 2, 0, 0]} />
            <Line type="monotone" dataKey="benchmark" name="Benchmark" stroke="#6366F1" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
          </ComposedChart>
        </ResponsiveContainer>
      </motion.div>

      {/* PL Evolution */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-3">
        <h3 className="text-[11px] text-zinc-400 uppercase tracking-wider font-mono mb-3">
          Evolução PL Mensal
        </h3>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="month" tick={{ fontSize: 9, fill: "#52525b" }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "#52525b" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatPL(v)} width={55} />
            <Tooltip content={<ChartTooltip />} />
            <Line type="monotone" dataKey="pl" name="PL" stroke="#0B6C3E" strokeWidth={2} dot={{ r: 2, fill: "#0B6C3E" }} />
          </LineChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  );
};
