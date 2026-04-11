import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import {
  useFipRankings, useFipOverview,
  formatPL, shortCnpj,
} from "@/hooks/useHubFundos";
import { KPICard } from "@/components/hub/KPICard";
import {
  Landmark, ArrowUpDown, DollarSign,
} from "lucide-react";

/* ─── Sorting options ─── */
const SORT_OPTIONS = [
  { key: "patrimonio_liquido", label: "PL" },
  { key: "vl_cap_comprom", label: "Cap. Comprom." },
  { key: "vl_cap_integr", label: "Cap. Integr." },
  { key: "nr_cotistas", label: "Cotistas" },
  { key: "valor_patrimonial_cota", label: "VP/Cota" },
] as const;

const TIPO_COLORS: Record<string, string> = {
  "CLASSES - FIP": "#0B6C3E",
  "FIP - Multiestratégia": "#3B82F6",
  "FIP - Infraestrutura": "#8B5CF6",
  "FIP - Capital Semente": "#F59E0B",
  "FIP - Empresas Emergentes": "#EC4899",
  "Outros": "#71717A",
};

const getTipoColor = (tp: string) => TIPO_COLORS[tp] || TIPO_COLORS["Outros"];

/* ─── FIP Market Overview KPIs ─── */
export const FIPOverviewKPIs = () => {
  const { data, isLoading } = useFipOverview();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      <KPICard
        title="Total FIPs"
        value={data?.total_fips?.toLocaleString("pt-BR") || "—"}
        loading={isLoading}
      />
      <KPICard
        title="PL Total"
        value={data ? formatPL(data.total_pl) : "—"}
        loading={isLoading}
      />
      <KPICard
        title="Cap. Comprometido"
        value={data ? formatPL(data.total_capital_comprometido) : "—"}
        loading={isLoading}
      />
      <KPICard
        title="Cap. Integralizado"
        value={data ? formatPL(data.total_capital_integralizado) : "—"}
        loading={isLoading}
      />
      <KPICard
        title="% Integralização"
        value={data?.pct_integralizacao != null ? `${data.pct_integralizacao}%` : "—"}
        loading={isLoading}
      />
      <KPICard
        title="Cap. Subscrito"
        value={data ? formatPL(data.total_capital_subscrito) : "—"}
        loading={isLoading}
      />
    </div>
  );
};

/* ─── FIP Ranking Table ─── */
export const FIPRankingTable = ({
  onSelectFund,
}: {
  onSelectFund?: (cnpj: string) => void;
}) => {
  const [sortBy, setSortBy] = useState<string>("patrimonio_liquido");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const { data, isLoading } = useFipRankings({
    orderBy: sortBy,
    order: sortOrder,
    limit: 50,
  });

  const toggleSort = (key: string) => {
    if (sortBy === key) {
      setSortOrder((o) => (o === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(key);
      setSortOrder("desc");
    }
  };

  // Compute integralização % per fund — must be called before any early return (Rules of Hooks)
  const fundsEnriched = useMemo(() => {
    const funds = data?.funds || [];
    return funds.map((f) => ({
      ...f,
      pct_integr: f.vl_cap_comprom && f.vl_cap_comprom > 0 && f.vl_cap_integr != null
        ? (f.vl_cap_integr / f.vl_cap_comprom) * 100
        : null,
    }));
  }, [data]);

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
        <Landmark className="w-3.5 h-3.5 text-[#0B6C3E]" />
        <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          Ranking FIPs
        </span>
        <span className="text-[10px] text-zinc-600 font-mono">{funds.length} fundos</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full text-[10px]">
          <thead className="sticky top-0 bg-[#111111] z-10">
            <tr className="text-zinc-600 uppercase border-b border-[#1a1a1a]">
              <th className="text-left px-3 py-2 font-medium">#</th>
              <th className="text-left px-3 py-2 font-medium max-w-[200px]">Fundo</th>
              <th className="text-left px-3 py-2 font-medium">Tipo</th>
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
              <th className="text-right px-3 py-2 font-medium whitespace-nowrap">% Integr.</th>
            </tr>
          </thead>
          <tbody>
            {fundsEnriched.map((f, i) => (
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
                  <span className="text-[9px] text-zinc-500 font-mono">
                    {f.tp_fundo_classe || "—"}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right text-zinc-200 font-mono">
                  {formatPL(f.patrimonio_liquido)}
                </td>
                <td className="px-3 py-1.5 text-right text-zinc-400 font-mono">
                  {formatPL(f.vl_cap_comprom)}
                </td>
                <td className="px-3 py-1.5 text-right text-zinc-400 font-mono">
                  {formatPL(f.vl_cap_integr)}
                </td>
                <td className="px-3 py-1.5 text-right text-zinc-400 font-mono">
                  {f.nr_cotistas?.toLocaleString("pt-BR") || "—"}
                </td>
                <td className="px-3 py-1.5 text-right text-zinc-400 font-mono">
                  {f.valor_patrimonial_cota != null ? `R$ ${f.valor_patrimonial_cota.toFixed(2)}` : "—"}
                </td>
                <td className="px-3 py-1.5 text-right font-mono">
                  {f.pct_integr != null ? (
                    <span className={f.pct_integr >= 80 ? "text-emerald-400" : f.pct_integr >= 50 ? "text-yellow-400" : "text-orange-400"}>
                      {f.pct_integr.toFixed(1)}%
                    </span>
                  ) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

/* ─── FIP Capital Pipeline Chart ─── */
export const FIPCapitalPipeline = () => {
  const { data } = useFipOverview();

  const chartData = useMemo(() => {
    if (!data) return [];
    return [
      { name: "Comprometido", value: data.total_capital_comprometido, color: "#3B82F6" },
      { name: "Subscrito", value: data.total_capital_subscrito, color: "#8B5CF6" },
      { name: "Integralizado", value: data.total_capital_integralizado, color: "#0B6C3E" },
    ];
  }, [data]);

  if (!chartData.length || !data) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#111111] border border-[#1a1a1a] rounded-lg overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center gap-2">
        <DollarSign className="w-3.5 h-3.5 text-[#0B6C3E]" />
        <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          Pipeline de Capital
        </span>
        <span className="text-[10px] text-zinc-600 font-mono ml-auto">
          Integralização: {data.pct_integralizacao}%
        </span>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
            <XAxis dataKey="name" tick={{ fill: "#71717A", fontSize: 10 }} />
            <YAxis
              tick={{ fill: "#71717A", fontSize: 9 }}
              tickFormatter={(v) => {
                if (v >= 1e12) return `${(v / 1e12).toFixed(0)}T`;
                if (v >= 1e9) return `${(v / 1e9).toFixed(0)}B`;
                return `${(v / 1e6).toFixed(0)}M`;
              }}
            />
            <Tooltip
              content={({ payload }) => {
                if (!payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2.5 py-2 text-[10px]">
                    <div className="text-zinc-300 font-semibold mb-1">{d.name}</div>
                    <div className="text-zinc-400">{formatPL(d.value)}</div>
                  </div>
                );
              }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};

/* ─── FIP Type Distribution ─── */
export const FIPTypeDistribution = () => {
  const { data } = useFipOverview();

  const pieData = useMemo(() => {
    if (!data?.by_tipo) return [];
    return data.by_tipo.map((t) => ({
      name: t.tp_fundo_classe,
      value: t.pl,
      pct: t.pct_pl,
      count: t.count,
      color: getTipoColor(t.tp_fundo_classe),
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
        <Landmark className="w-3.5 h-3.5 text-[#0B6C3E]" />
        <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          Distribuição por Tipo
        </span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
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
                      <div className="text-zinc-500">{String(d.count ?? 0)} FIPs ({String(d.pct ?? 0)}%)</div>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="p-4 flex flex-col justify-center gap-1.5">
          {pieData.map((d) => (
            <div key={d.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: d.color }} />
                <span className="text-[10px] text-zinc-400 font-mono truncate max-w-[140px]">{d.name}</span>
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
