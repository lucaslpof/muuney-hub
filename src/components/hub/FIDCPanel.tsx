import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from "recharts";
import {
  useFidcRankings, useFidcOverview,
  formatPL, formatPct, shortCnpj,
} from "@/hooks/useHubFundos";
import { KPICard } from "@/components/hub/KPICard";
import {
  Shield, BarChart3, Filter, ArrowUpDown,
} from "lucide-react";

/* ─── Metric columns for FIDC ranking table ─── */
const SORT_OPTIONS = [
  { key: "vl_pl_total", label: "PL Total" },
  { key: "rentab_fundo", label: "Rentabilidade" },
  { key: "taxa_inadimplencia", label: "Inadimplência" },
  { key: "indice_subordinacao", label: "Subordinação" },
  { key: "indice_pdd_cobertura", label: "Cobertura PDD" },
] as const;

/* ─── Risk color scale ─── */
const inadimColor = (v: number | null) => {
  if (v == null) return "text-zinc-600";
  if (v <= 2) return "text-emerald-400";
  if (v <= 5) return "text-yellow-400";
  if (v <= 15) return "text-orange-400";
  return "text-red-400";
};

const subColor = (v: number | null) => {
  if (v == null) return "text-zinc-600";
  if (v >= 30) return "text-emerald-400";
  if (v >= 15) return "text-yellow-400";
  if (v >= 5) return "text-orange-400";
  return "text-red-400";
};

const pddColor = (v: number | null) => {
  if (v == null) return "text-zinc-600";
  if (v >= 100) return "text-emerald-400";
  if (v >= 50) return "text-yellow-400";
  return "text-red-400";
};

/* ─── FIDC Market Overview KPIs ─── */
export const FIDCOverviewKPIs = () => {
  const { data, isLoading } = useFidcOverview();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      <KPICard
        title="Total FIDCs"
        value={data?.total_fidcs?.toLocaleString("pt-BR") || "—"}
        loading={isLoading}
      />
      <KPICard
        title="PL Total"
        value={data ? formatPL(data.total_pl) : "—"}
        loading={isLoading}
      />
      <KPICard
        title="Inadimplência Média"
        value={data?.avg_inadimplencia != null ? `${data.avg_inadimplencia.toFixed(2)}%` : "—"}
        trend={data?.avg_inadimplencia != null ? (data.avg_inadimplencia > 5 ? "down" : "up") : undefined}
        loading={isLoading}
      />
      <KPICard
        title="Subordinação Média"
        value={data?.avg_subordinacao != null ? `${data.avg_subordinacao.toFixed(1)}%` : "—"}
        loading={isLoading}
      />
      <KPICard
        title="Rentab. Média"
        value={data?.avg_rentab != null ? formatPct(data.avg_rentab) : "—"}
        trend={data?.avg_rentab != null ? (data.avg_rentab >= 0 ? "up" : "down") : undefined}
        loading={isLoading}
      />
      <KPICard
        title="Cobertura PDD"
        value={data?.avg_pdd_cobertura != null ? `${data.avg_pdd_cobertura.toFixed(0)}%` : "—"}
        loading={isLoading}
      />
    </div>
  );
};

/* ─── FIDC Ranking Table ─── */
export const FIDCRankingTable = ({
  onSelectFund,
}: {
  onSelectFund?: (cnpj: string) => void;
}) => {
  const [sortBy, setSortBy] = useState<string>("vl_pl_total");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [minPl, setMinPl] = useState(0);

  const { data, isLoading } = useFidcRankings({
    orderBy: sortBy,
    order: sortOrder,
    limit: 50,
    minPl,
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
      {/* Header with filters */}
      <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center gap-3 flex-wrap">
        <BarChart3 className="w-3.5 h-3.5 text-[#0B6C3E]" />
        <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          Ranking FIDCs
        </span>
        <span className="text-[10px] text-zinc-600 font-mono">{funds.length} fundos</span>

        {/* PL Filter */}
        <div className="ml-auto flex items-center gap-2">
          <Filter className="w-3 h-3 text-zinc-600" />
          <select
            value={minPl}
            onChange={(e) => setMinPl(Number(e.target.value))}
            className="bg-[#0a0a0a] border border-[#1a1a1a] rounded text-[10px] text-zinc-400 px-2 py-1 font-mono"
          >
            <option value={0}>Todos</option>
            <option value={1000000}>PL &gt; R$1M</option>
            <option value={10000000}>PL &gt; R$10M</option>
            <option value={100000000}>PL &gt; R$100M</option>
            <option value={1000000000}>PL &gt; R$1B</option>
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
                  <div className="text-zinc-300 truncate text-[10px]">{f.denom_social}</div>
                  <div className="text-[8px] text-zinc-700 font-mono">{shortCnpj(f.cnpj_fundo)}</div>
                </td>
                <td className="px-3 py-1.5 text-right text-zinc-200 font-mono">
                  {formatPL(f.vl_pl_total)}
                </td>
                <td className={`px-3 py-1.5 text-right font-mono ${(f.rentab_fundo ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {f.rentab_fundo != null ? formatPct(f.rentab_fundo) : "—"}
                </td>
                <td className={`px-3 py-1.5 text-right font-mono ${inadimColor(f.taxa_inadimplencia)}`}>
                  {f.taxa_inadimplencia != null ? `${f.taxa_inadimplencia.toFixed(2)}%` : "—"}
                </td>
                <td className={`px-3 py-1.5 text-right font-mono ${subColor(f.indice_subordinacao)}`}>
                  {f.indice_subordinacao != null ? `${f.indice_subordinacao.toFixed(1)}%` : "—"}
                </td>
                <td className={`px-3 py-1.5 text-right font-mono ${pddColor(f.indice_pdd_cobertura)}`}>
                  {f.indice_pdd_cobertura != null ? `${f.indice_pdd_cobertura.toFixed(0)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

/* ─── FIDC Risk Radar (for single fund) ─── */
export const FIDCRiskRadar = ({
  inadimplencia,
  subordinacao,
  pddCobertura,
  concentracao,
  rentabilidade,
}: {
  inadimplencia: number | null;
  subordinacao: number | null;
  pddCobertura: number | null;
  concentracao: number | null;
  rentabilidade: number | null;
}) => {
  const radarData = useMemo(() => {
    // Normalize to 0-100 scale (higher = better)
    const normalize = (v: number | null, max: number, invert = false) => {
      if (v == null) return 50;
      const n = Math.min(Math.max(v / max, 0), 1) * 100;
      return invert ? 100 - n : n;
    };

    return [
      { metric: "Inadimpl.", value: normalize(inadimplencia, 20, true), raw: inadimplencia },
      { metric: "Subordin.", value: normalize(subordinacao, 100), raw: subordinacao },
      { metric: "PDD Cob.", value: normalize(pddCobertura, 200), raw: pddCobertura },
      { metric: "Diversif.", value: normalize(concentracao, 100, true), raw: concentracao },
      { metric: "Rentab.", value: normalize(rentabilidade, 3), raw: rentabilidade },
    ];
  }, [inadimplencia, subordinacao, pddCobertura, concentracao, rentabilidade]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <Shield className="w-3.5 h-3.5 text-[#0B6C3E]" />
        <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Radar de Risco</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <RadarChart data={radarData}>
          <PolarGrid stroke="#1a1a1a" />
          <PolarAngleAxis
            dataKey="metric"
            tick={{ fill: "#71717A", fontSize: 9 }}
          />
          <Radar
            dataKey="value"
            stroke="#0B6C3E"
            fill="#0B6C3E"
            fillOpacity={0.2}
            strokeWidth={2}
          />
          <Tooltip
            content={({ payload }) => {
              if (!payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-[10px]">
                  <div className="text-zinc-300 font-semibold">{d.metric}</div>
                  <div className="text-zinc-500">
                    {d.raw != null ? `${d.raw.toFixed(2)}%` : "N/D"} (score: {d.value.toFixed(0)})
                  </div>
                </div>
              );
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </motion.div>
  );
};

/* ─── FIDC Subordination Distribution Chart ─── */
export const FIDCSubordinationChart = () => {
  const { data } = useFidcRankings({ orderBy: "indice_subordinacao", order: "desc", limit: 30, minPl: 10000000 });

  const chartData = useMemo(() => {
    if (!data?.funds) return [];
    return data.funds
      .filter((f) => f.indice_subordinacao != null && f.indice_subordinacao > 0)
      .map((f) => ({
        name: f.denom_social?.substring(0, 20) || shortCnpj(f.cnpj_fundo),
        subordinacao: f.indice_subordinacao,
        inadimplencia: f.taxa_inadimplencia,
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
        <Shield className="w-3.5 h-3.5 text-[#0B6C3E]" />
        <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          Top 30 — Índice de Subordinação (PL &gt; R$10M)
        </span>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
            <XAxis type="number" tick={{ fill: "#71717A", fontSize: 9 }} domain={[0, "auto"]} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: "#52525B", fontSize: 8 }}
              width={120}
            />
            <Tooltip
              content={({ payload }) => {
                if (!payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2.5 py-2 text-[10px]">
                    <div className="text-zinc-300 font-semibold mb-1">{d.name}</div>
                    <div className="text-emerald-400">Subordinação: {d.subordinacao?.toFixed(1)}%</div>
                    {d.inadimplencia != null && (
                      <div className="text-orange-400">Inadimpl.: {d.inadimplencia?.toFixed(2)}%</div>
                    )}
                  </div>
                );
              }}
            />
            <Bar dataKey="subordinacao" radius={[0, 4, 4, 0]}>
              {chartData.map((d, i) => (
                <Cell
                  key={i}
                  fill={(d.subordinacao || 0) >= 20 ? "#0B6C3E" : (d.subordinacao || 0) >= 10 ? "#F59E0B" : "#EF4444"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};
