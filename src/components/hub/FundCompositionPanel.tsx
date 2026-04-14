import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from "recharts";
import {
  useFundComposition, useFundCompositionSummary,
  formatPL,
} from "@/hooks/useHubFundos";
import { Layers, Package } from "lucide-react";

/* ─── Color palette for asset blocks ─── */
const BLOCO_COLORS: Record<string, string> = {
  titulo_publico: "#0B6C3E",
  cota_fi: "#10B981",
  swap: "#6366F1",
  ativo_codificado: "#F59E0B",
  deposito_titfi: "#3B82F6",
  agro_credpriv: "#EF4444",
  investimento_exterior: "#8B5CF6",
  ativo_nao_codificado: "#71717A",
};

const BLOCO_LABELS: Record<string, string> = {
  titulo_publico: "Títulos Públicos",
  cota_fi: "Cotas de FI",
  swap: "Swaps",
  ativo_codificado: "Ativos Codif.",
  deposito_titfi: "Depósitos/TF",
  agro_credpriv: "Agro/Créd. Priv.",
  investimento_exterior: "Investimento Ext.",
  ativo_nao_codificado: "Outros Ativos",
};

/* ─── Composition Summary (Treemap + Donut) ─── */
export const CompositionSummary = ({ cnpj }: { cnpj: string }) => {
  const { data, isLoading } = useFundCompositionSummary(cnpj);

  const chartData = useMemo(() => {
    if (!data?.summary) return [];
    return data.summary
      .filter((s) => s.vl_total > 0)
      .map((s) => ({
        name: BLOCO_LABELS[s.bloco] || s.bloco,
        value: s.vl_total,
        pct: s.pct_pl,
        color: BLOCO_COLORS[s.bloco] || "#71717A",
      }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  if (isLoading) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4 animate-pulse">
        <div className="h-4 bg-[#1a1a1a] rounded w-1/3 mb-4" />
        <div className="h-48 bg-[#1a1a1a] rounded" />
      </div>
    );
  }

  if (!chartData.length) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-6 text-center text-zinc-600 text-sm">
        Sem dados de composição disponíveis
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center gap-2">
        <Layers className="w-3.5 h-3.5 text-[#0B6C3E]" />
        <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Composição da Carteira</span>
        {data?.total_pl != null && (
          <span className="ml-auto text-[10px] text-zinc-600 font-mono">PL Total: {formatPL(data.total_pl)}</span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-0">
        {/* Donut chart */}
        <div className="p-4 flex items-center justify-center">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} stroke="#111111" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip
                content={({ payload }) => {
                  if (!payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-[10px]">
                      <div className="text-zinc-300 font-semibold">{d.name}</div>
                      <div className="text-zinc-500">{formatPL(d.value)} ({d.pct?.toFixed(1)}%)</div>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend table */}
        <div className="p-3 overflow-auto max-h-[220px]">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="text-zinc-600 uppercase">
                <th className="text-left py-1 font-medium">Bloco</th>
                <th className="text-right py-1 font-medium">Valor</th>
                <th className="text-right py-1 font-medium">%PL</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((d, i) => (
                <tr key={i} className="border-t border-zinc-800/50 hover:bg-[#0B6C3E]/5">
                  <td className="py-1.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                    <span className="text-zinc-400">{d.name}</span>
                  </td>
                  <td className="text-right text-zinc-300 font-mono">{formatPL(d.value)}</td>
                  <td className="text-right text-zinc-500 font-mono">{d.pct?.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};

/* ─── Asset-Level Detail Table ─── */
export const CompositionDetailTable = ({ cnpj }: { cnpj: string }) => {
  const { data, isLoading } = useFundComposition(cnpj);

  const sorted = useMemo(() => {
    if (!data?.assets) return [];
    return [...data.assets].sort(
      (a, b) => Math.abs(b.vl_merc_pos_final || 0) - Math.abs(a.vl_merc_pos_final || 0)
    );
  }, [data]);

  if (isLoading) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4 animate-pulse">
        <div className="h-4 bg-[#1a1a1a] rounded w-1/4 mb-3" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-6 bg-[#1a1a1a] rounded" />)}
        </div>
      </div>
    );
  }

  if (!sorted.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center gap-2">
        <Package className="w-3.5 h-3.5 text-[#0B6C3E]" />
        <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          Ativos ({sorted.length})
        </span>
      </div>

      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
        <table className="w-full text-[10px]">
          <thead className="sticky top-0 bg-zinc-900/50 z-10">
            <tr className="text-zinc-600 uppercase border-b border-zinc-800/50">
              <th className="text-left px-3 py-2 font-medium">Ativo</th>
              <th className="text-left px-3 py-2 font-medium">Tipo</th>
              <th className="text-left px-3 py-2 font-medium">Bloco</th>
              <th className="text-right px-3 py-2 font-medium">Valor Mercado</th>
              <th className="text-right px-3 py-2 font-medium">%PL</th>
              <th className="text-right px-3 py-2 font-medium">Vencimento</th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 100).map((a, i) => (
              <tr key={i} className="border-t border-[#0a0a0a] hover:bg-[#0B6C3E]/5 transition-colors">
                <td className="px-3 py-1.5 text-zinc-300 max-w-[180px] truncate" title={a.ds_ativo || a.cd_ativo}>
                  {a.ds_ativo || a.cd_ativo}
                </td>
                <td className="px-3 py-1.5 text-zinc-500 max-w-[120px] truncate">{a.tp_ativo}</td>
                <td className="px-3 py-1.5">
                  <span
                    className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono"
                    style={{
                      background: (BLOCO_COLORS[a.bloco] || "#71717A") + "20",
                      color: BLOCO_COLORS[a.bloco] || "#71717A",
                    }}
                  >
                    {BLOCO_LABELS[a.bloco] || a.bloco}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right text-zinc-200 font-mono">
                  {formatPL(a.vl_merc_pos_final)}
                </td>
                <td className="px-3 py-1.5 text-right text-zinc-500 font-mono">
                  {a.pct_pl != null ? `${a.pct_pl.toFixed(1)}%` : "—"}
                </td>
                <td className="px-3 py-1.5 text-right text-zinc-600 font-mono">
                  {a.dt_venc || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length > 100 && (
          <div className="text-center text-[10px] text-zinc-700 py-2">
            Mostrando 100 de {sorted.length} ativos
          </div>
        )}
      </div>
    </motion.div>
  );
};
