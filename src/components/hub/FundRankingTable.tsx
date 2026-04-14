import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowUpDown, ArrowUp, ArrowDown, Search, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import type { FundRankingItem } from "@/hooks/useHubFundos";
import { formatPL, shortCnpj } from "@/hooks/useHubFundos";
import { ClasseBadge } from "@/lib/rcvm175";

type SortKey = "vl_patrim_liq" | "taxa_adm" | "nr_cotistas" | "denom_social";

interface FundRankingTableProps {
  funds: FundRankingItem[];
  loading?: boolean;
  onSelectFund?: (cnpj: string) => void;
  title?: string;
}

export const FundRankingTable = ({ funds, loading, onSelectFund, title }: FundRankingTableProps) => {
  const [sortKey, setSortKey] = useState<SortKey>("vl_patrim_liq");
  const [sortAsc, setSortAsc] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let list = [...funds];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (f) =>
          f.denom_social?.toLowerCase().includes(q) ||
          f.cnpj_fundo?.includes(q) ||
          f.gestor_nome?.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (typeof av === "string" && typeof bv === "string") return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return list;
  }, [funds, sortKey, sortAsc, search]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-zinc-700" />;
    return sortAsc ? <ArrowUp className="w-3 h-3 text-[#0B6C3E]" /> : <ArrowDown className="w-3 h-3 text-[#0B6C3E]" />;
  };

  if (loading) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4 animate-pulse">
        <div className="h-4 bg-[#1a1a1a] rounded w-1/3 mb-4" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-8 bg-[#1a1a1a] rounded mb-2" />
        ))}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/50">
        <h3 className="text-[11px] text-zinc-400 uppercase tracking-wider font-mono">
          {title || "Rankings"} <span className="text-zinc-700">({filtered.length})</span>
        </h3>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600" />
          <input
            type="text"
            placeholder="Buscar fundo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-6 pr-2 py-1 text-[10px] bg-[#0a0a0a] border border-zinc-800/50 rounded text-zinc-300 placeholder-zinc-700 focus:border-[#0B6C3E]/40 focus:outline-none w-40 font-mono"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto scrollbar-none">
        <table className="w-full text-[10px] font-mono min-w-[600px]">
          <thead>
            <tr className="border-b border-zinc-800/50 text-zinc-600">
              <th className="text-left px-3 py-2 w-8">#</th>
              <th
                className="text-left px-3 py-2 cursor-pointer hover:text-zinc-400 transition-colors"
                onClick={() => handleSort("denom_social")}
              >
                <span className="flex items-center gap-1">Fundo <SortIcon col="denom_social" /></span>
              </th>
              <th
                className="text-right px-3 py-2 cursor-pointer hover:text-zinc-400 transition-colors"
                onClick={() => handleSort("vl_patrim_liq")}
              >
                <span className="flex items-center justify-end gap-1">PL <SortIcon col="vl_patrim_liq" /></span>
              </th>
              <th
                className="text-right px-3 py-2 cursor-pointer hover:text-zinc-400 transition-colors"
                onClick={() => handleSort("taxa_adm")}
              >
                <span className="flex items-center justify-end gap-1">Tx Adm <SortIcon col="taxa_adm" /></span>
              </th>
              <th
                className="text-right px-3 py-2 cursor-pointer hover:text-zinc-400 transition-colors"
                onClick={() => handleSort("nr_cotistas")}
              >
                <span className="flex items-center justify-end gap-1">Cotistas <SortIcon col="nr_cotistas" /></span>
              </th>
              <th className="text-left px-3 py-2">Gestor</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((fund, idx) => {
              const fundPath = `/fundos/${fund.slug || fund.cnpj_fundo_classe || fund.cnpj_fundo}`;
              return (
              <tr
                key={fund.cnpj_fundo}
                onClick={() => onSelectFund?.(fund.cnpj_fundo)}
                className="border-b border-zinc-800/30 hover:bg-[#0B6C3E]/5 cursor-pointer transition-colors group"
              >
                <td className="px-3 py-2 text-zinc-700">{idx + 1}</td>
                <td className="px-3 py-2 max-w-[280px]">
                  <Link
                    to={fundPath}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1.5 hover:no-underline"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-zinc-300 truncate group-hover:text-[#0B6C3E] transition-colors">
                        {fund.denom_social || shortCnpj(fund.cnpj_fundo)}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <ClasseBadge classe={fund.classe_rcvm175 || fund.classe} size="sm" />
                        <span className="text-[8px] text-zinc-700">{shortCnpj(fund.cnpj_fundo)}</span>
                      </div>
                    </div>
                    <ExternalLink className="w-3 h-3 text-zinc-800 group-hover:text-[#0B6C3E] flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all" />
                  </Link>
                </td>
                <td className="px-3 py-2 text-right text-zinc-300 whitespace-nowrap">
                  {formatPL(fund.vl_patrim_liq)}
                </td>
                <td className="px-3 py-2 text-right text-zinc-400">
                  {fund.taxa_adm != null ? `${fund.taxa_adm.toFixed(2)}%` : "—"}
                </td>
                <td className="px-3 py-2 text-right text-zinc-400">
                  {fund.nr_cotistas != null ? fund.nr_cotistas.toLocaleString("pt-BR") : "—"}
                </td>
                <td className="px-3 py-2 text-zinc-600 truncate max-w-[150px]">
                  {fund.gestor_nome || "—"}
                </td>
              </tr>
            );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-zinc-700">
                  Nenhum fundo encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};
