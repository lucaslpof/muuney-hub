import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import {
  useFiiRankings, useFiiOverview,
  formatPL, formatPct, shortCnpj,
} from "@/hooks/useHubFundos";
import { KPICard } from "@/components/hub/KPICard";
import {
  Building2, Filter, ArrowUpDown, TrendingUp,
} from "lucide-react";

/* ─── Sorting options ─── */
const SORT_OPTIONS = [
  { key: "patrimonio_liquido", label: "PL" },
  { key: "dividend_yield_mes", label: "DY Mês" },
  { key: "rentabilidade_efetiva_mes", label: "Rentab." },
  { key: "nr_cotistas", label: "Cotistas" },
  { key: "valor_patrimonial_cota", label: "VP/Cota" },
] as const;

const SEGMENTO_COLORS: Record<string, string> = {
  "Shoppings": "#0B6C3E",
  "Logística": "#3B82F6",
  "Lajes Corporativas": "#8B5CF6",
  "Híbrido": "#F59E0B",
  "Recebíveis": "#EC4899",
  "Residencial": "#06B6D4",
  "Hotéis": "#EF4444",
  "Multicategoria": "#6366F1",
  "Outros": "#71717A",
};

const getSegColor = (seg: string) => SEGMENTO_COLORS[seg] || SEGMENTO_COLORS["Outros"];

/* ─── FII Market Overview KPIs ─── */
export const FIIOverviewKPIs = () => {
  const { data, isLoading } = useFiiOverview();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      <KPICard
        title="Total FIIs"
        value={data?.total_fiis?.toLocaleString("pt-BR") || "—"}
        loading={isLoading}
      />
      <KPICard
        title="PL Total"
        value={data ? formatPL(data.total_pl) : "—"}
        loading={isLoading}
      />
      <KPICard
        title="Cotistas"
        value={data?.total_cotistas?.toLocaleString("pt-BR") || "—"}
        loading={isLoading}
      />
      <KPICard
        title="DY Médio"
        value={data?.avg_dividend_yield != null ? `${(data.avg_dividend_yield * 100).toFixed(2)}%` : "—"}
        loading={isLoading}
      />
      <KPICard
        title="Rentab. Média"
        value={data?.avg_rentabilidade != null ? formatPct(data.avg_rentabilidade * 100) : "—"}
        trend={data?.avg_rentabilidade != null ? (data.avg_rentabilidade >= 0 ? "up" : "down") : undefined}
        loading={isLoading}
      />
      <KPICard
        title="Segmentos"
        value={data?.by_segmento?.length?.toString() || "—"}
        loading={isLoading}
      />
    </div>
  );
};

/* ─── FII Ranking Table ─── */
export const FIIRankingTable = ({
  onSelectFund,
}: {
  onSelectFund?: (cnpj: string) => void;
}) => {
  const [sortBy, setSortBy] = useState<string>("patrimonio_liquido");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [segmento, setSegmento] = useState<string>("");

  const { data, isLoading } = useFiiRankings({
    orderBy: sortBy,
    order: sortOrder,
    limit: 50,
    segmento: segmento || undefined,
  });

  const toggleSort = (key: string) => {
    if (sortBy === key) {
      setSortOrder((o) => (o === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(key);
      setSortOrder("desc");
    }
  };

  if (isLoading) {
    return (
      <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4 animate-pulse">
        <div className="h-4 bg-[#1a1a1a] rounded w-1/4 mb-3" />
        <div className="space-y-2">
          {[...Array(10)].map((_, i) => <div key={i} className="h-7 bg-[#1a1a1a] rounded" />)}
        </div>
      </div>
    );
  }

  const funds = data?.funds || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#111111] border border-[#1a1a1a] rounded-lg overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center gap-3 flex-wrap">
        <Building2 className="w-3.5 h-3.5 text-[#0B6C3E]" />
        <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          Ranking FIIs
        </span>
        <span className="text-[10px] text-zinc-600 font-mono">{funds.length} fundos</span>

        <div className="ml-auto flex items-center gap-2">
          <Filter className="w-3 h-3 text-zinc-600" />
          <select
            value={segmento}
            onChange={(e) => setSegmento(e.target.value)}
            className="bg-[#0a0a0a] border border-[#1a1a1a] rounded text-[10px] text-zinc-400 px-2 py-1 font-mono"
          >
            <option value="">Todos Segmentos</option>
            <option value="Shoppings">Shoppings</option>
            <option value="Logística">Logística</option>
            <option value="Lajes Corporativas">Lajes Corporativas</option>
            <option value="Híbrido">Híbrido</option>
            <option value="Recebíveis">Recebíveis</option>
            <option value="Multicategoria">Multicategoria</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full text-[10px]">
          <thead className="sticky top-0 bg-[#111111] z-10">
            <tr className="text-zinc-600 uppercase border-b border-[#1a1a1a]">
              <th className="text-left px-3 py-2 font-medium">#</th>
              <th className="text-left px-3 py-2 font-medium max-w-[200px]">Fundo</th>
              <th className="text-left px-3 py-2 font-medium">Segmento</th>
              {SORT_OPTIONS.map((opt) => (
                <th
                  key={opt.key}
                  className="text-right px-3 py-2 font-medium cursor-pointer hover:text-zinc-400 transition-colors whitespace-nowrap"
                  onClick={() => toggleSort(opt.key)}
                >
                  <span className="inline-flex items-center gap-0.5">
                    {opt.label}
                    {sortBy === opt.key && (
                      <ArrowUpDown className="w-2.5 h-2.5 text-[#0B6C3E]" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {funds.map((f, i) => (
              <tr
                key={f.cnpj_fundo}
                className="border-t border-[#0a0a0a] hover:bg-[#0B6C3E]/5 cursor-pointer transition-colors"
                onClick={() => onSelectFund?.(f.cnpj_fundo)}
              >
                <td className="px-3 py-1.5 text-zinc-700 font-mono">{i + 1}</td>
                <td className="px-3 py-1.5 max-w-[200px]">
                  <div className="text-zinc-300 truncate text-[10px]">{f.nome_fundo}</div>
                  <div className="text-[8px] text-zinc-700 font-mono">{shortCnpj(f.cnpj_fundo)}</div>
                </td>
                <td className="px-3 py-1.5">
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded font-mono"
                    style={{
                      backgroundColor: getSegColor(f.segmento || "Outros") + "15",
                      color: getSegColor(f.segmento || "Outros"),
                    }}
                  >
                    {f.segmento || "—"}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right text-zinc-200 font-mono">
                  {formatPL(f.patrimonio_liquido)}
                </td>
                <td className={`px-3 py-1.5 text-right font-mono ${(f.dividend_yield_mes ?? 0) > 0 ? "text-emerald-400" : "text-zinc-500"}`}>
                  {f.dividend_yield_mes != null ? `${(f.dividend_yield_mes * 100).toFixed(2)}%` : "—"}
                </td>
                <td className={`px-3 py-1.5 text-right font-mono ${(f.rentabilidade_efetiva_mes ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {f.rentabilidade_efetiva_mes != null ? formatPct(f.rentabilidade_efetiva_mes * 100) : "—"}
                </td>
                <td className="px-3 py-1.5 text-right text-zinc-400 font-mono">
                  {f.nr_cotistas?.toLocaleString("pt-BR") || "—"}
                </td>
                <td className="px-3 py-1.5 text-right text-zinc-400 font-mono">
                  {f.valor_patrimonial_cota != null ? `R$ ${f.valor_patrimonial_cota.toFixed(2)}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

/* ─── FII Segmento Distribution (Pie + Bar) ─── */
export const FIISegmentoChart = () => {
  const { data } = useFiiOverview();

  const pieData = useMemo(() => {
    if (!data?.by_segmento) return [];
    return data.by_segmento.map((s) => ({
      name: s.segmento,
      value: s.pl,
      pct: s.pct_pl,
      count: s.count,
      color: getSegColor(s.segmento),
    }));
  }, [data]);

  if (!pieData.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#111111] border border-[#1a1a1a] rounded-lg overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center gap-2">
        <Building2 className="w-3.5 h-3.5 text-[#0B6C3E]" />
        <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          Distribuição por Segmento
        </span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
        {/* Pie */}
        <div className="p-4">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
              >
                {pieData.map((d, i) => (
                  <Cell key={i} fill={d.color} stroke="#0a0a0a" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip
                content={({ payload }) => {
                  if (!payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2.5 py-2 text-[10px]">
                      <div className="text-zinc-300 font-semibold mb-1">{d.name}</div>
                      <div className="text-zinc-400">PL: {formatPL(d.value)}</div>
                      <div className="text-zinc-500">{String(d.count ?? 0)} FIIs ({String(d.pct ?? 0)}%)</div>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* Legend */}
        <div className="p-4 flex flex-col justify-center gap-1.5">
          {pieData.map((d) => (
            <div key={d.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: d.color }} />
                <span className="text-[10px] text-zinc-400 font-mono">{d.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-zinc-300 font-mono">{formatPL(d.value)}</span>
                <span className="text-[9px] text-zinc-600 font-mono w-8 text-right">{String(d.pct ?? 0)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

/* ─── FII Top Performers Bar Chart ─── */
export const FIITopPerformers = () => {
  const { data } = useFiiRankings({ orderBy: "rentabilidade_efetiva_mes", order: "desc", limit: 15 });

  const chartData = useMemo(() => {
    if (!data?.funds) return [];
    return data.funds
      .filter((f) => f.rentabilidade_efetiva_mes != null)
      .map((f) => ({
        name: (f.nome_fundo || shortCnpj(f.cnpj_fundo)).substring(0, 25),
        rentab: (f.rentabilidade_efetiva_mes || 0) * 100,
        segmento: f.segmento || "Outros",
      }));
  }, [data]);

  if (!chartData.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#111111] border border-[#1a1a1a] rounded-lg overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center gap-2">
        <TrendingUp className="w-3.5 h-3.5 text-[#0B6C3E]" />
        <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          Top 15 — Rentabilidade Mensal
        </span>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
            <XAxis type="number" tick={{ fill: "#71717A", fontSize: 9 }} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: "#52525B", fontSize: 8 }}
              width={140}
            />
            <Tooltip
              content={({ payload }) => {
                if (!payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2.5 py-2 text-[10px]">
                    <div className="text-zinc-300 font-semibold mb-1">{d.name}</div>
                    <div className={d.rentab >= 0 ? "text-emerald-400" : "text-red-400"}>
                      Rentab: {d.rentab.toFixed(2)}%
                    </div>
                    <div className="text-zinc-500">{d.segmento}</div>
                  </div>
                );
              }}
            />
            <Bar dataKey="rentab" radius={[0, 4, 4, 0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.rentab >= 0 ? "#0B6C3E" : "#EF4444"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};
