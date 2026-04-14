/**
 * FundCategoryRankings.tsx — Pre-configured category rankings for Fundos V3 Fase 3
 * Displays top funds by category (Renda Fixa, Multimercado, Ações, FII, FIDC, FIP)
 * Each card links to the fund lâmina
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { Zap } from "lucide-react";
import { motion } from "framer-motion";

import { useFundCatalog, formatPL, fundDisplayName } from "@/hooks/useHubFundos";
import { ClasseBadge } from "@/lib/rcvm175";

const CATEGORIES = [
  { id: "renda-fixa", label: "Top Renda Fixa", classe: "Renda Fixa" },
  { id: "multimercado", label: "Top Multimercado", classe: "Multimercado" },
  { id: "acoes", label: "Top Ações", classe: "Ações" },
  { id: "fii", label: "Top FII", classe: "FII" },
  { id: "fidc", label: "Top FIDC", classe: "FIDC" },
  { id: "fip", label: "Top FIP", classe: "FIP" },
];

export function FundCategoryRankings() {
  const [selectedCategory, setSelectedCategory] = useState<string>("renda-fixa");
  const category = CATEGORIES.find((c) => c.id === selectedCategory);

  const { data: catalogData, isLoading } = useFundCatalog({
    classe: category?.classe,
    limit: 10,
    orderBy: "vl_patrim_liq",
  });

  const funds = (catalogData?.funds || []).slice(0, 6);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Category Tabs */}
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-4 h-4 text-[#0B6C3E]" />
        <h3 className="text-sm font-semibold text-zinc-300">Top Fundos por Categoria</h3>
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1.5 text-[9px] font-mono rounded transition-all border ${
              selectedCategory === cat.id
                ? "bg-[#0B6C3E] text-white border-[#0B6C3E]"
                : "bg-zinc-900/50 text-zinc-400 border-zinc-800/50 hover:border-[#0B6C3E]/30 hover:text-zinc-300"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-3 animate-pulse">
              <div className="h-4 bg-[#1a1a1a] rounded w-3/4 mb-2" />
              <div className="h-3 bg-[#1a1a1a] rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <motion.div
          key={selectedCategory}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="grid grid-cols-2 md:grid-cols-3 gap-3"
        >
          {funds.length > 0 ? (
            funds.map((fund) => {
              const fundPath = `/fundos/${fund.slug || fund.cnpj_fundo_classe || fund.cnpj_fundo}`;
              return (
                <Link
                  key={fund.cnpj_fundo}
                  to={fundPath}
                  className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-3 hover:border-zinc-700 transition-all group"
                >
                  <div className="flex items-start gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[9px] font-semibold text-zinc-300 group-hover:text-[#0B6C3E] truncate transition-colors">
                        {fundDisplayName(fund)}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <ClasseBadge classe={fund.classe_rcvm175 || fund.classe} size="sm" />
                      </div>
                    </div>
                  </div>

                  <div className="text-[8px] font-mono text-zinc-500">
                    {formatPL(fund.vl_patrim_liq)}
                  </div>

                  {fund.taxa_adm != null && (
                    <div className="text-[8px] font-mono text-zinc-600 mt-1">
                      Tx: {fund.taxa_adm.toFixed(2)}%
                    </div>
                  )}
                </Link>
              );
            })
          ) : (
            <div className="col-span-full text-center py-6">
              <p className="text-[9px] text-zinc-600 font-mono">Nenhum fundo disponível nesta categoria</p>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
