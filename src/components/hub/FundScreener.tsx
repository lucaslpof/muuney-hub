/**
 * FundScreener.tsx — Multi-filter fund screener for Fundos V3 Fase 3
 * Filters: classe_rcvm175, publico_alvo, tributacao, PL range, taxa_adm max, search
 * Displays paginated results as sortable table with links to lâminas
 */

import { useState, useMemo, useCallback } from "react";
import { useDebouncedValue } from "@/hooks/useDebounce";
import { Link } from "react-router-dom";
import { SkeletonTableRow } from "./SkeletonLoader";
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Sliders, X } from "lucide-react";
import { EmptyState } from "./EmptyState";
import { motion, AnimatePresence } from "framer-motion";
import { exportCsv, csvFilename, type CsvColumn } from "@/lib/csvExport";
import { ExportButton } from "./ExportButton";

import { useFundCatalog, formatPL, fundDisplayName, primaryCnpj } from "@/hooks/useHubFundos";
import { ClasseBadge } from "@/lib/rcvm175";

type SortKey = "vl_patrim_liq" | "taxa_adm" | "nr_cotistas" | "denom_social";

const CLASSES_RCVM175 = [
  "Renda Fixa",
  "Ações",
  "Multimercado",
  "Cambial",
  "FII",
  "FIDC",
  "FIP",
];

const PUBLICO_ALVO_OPTIONS = ["Geral", "Qualificado", "Profissional"];
const TRIBUTACAO_OPTIONS = ["Longo Prazo", "Curto Prazo"];

interface FundScreenerProps {
  onSelectFund?: (slug: string) => void;
}

export function FundScreener({ onSelectFund }: FundScreenerProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [classe, setClasse] = useState<string | undefined>();
  const [publico, setPublico] = useState<string | undefined>();
  const [tributacao, setTributacao] = useState<string | undefined>();
  const [plMin, setPlMin] = useState<number | undefined>();
  const [plMax, setPlMax] = useState<number | undefined>();
  const [taxaAdmMax, setTaxaAdmMax] = useState<number | undefined>();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [sortKey, setSortKey] = useState<SortKey>("vl_patrim_liq");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);

  const ITEMS_PER_PAGE = 25;

  // Fetch data with active filters (debounced search)
  const { data: catalogData, isLoading } = useFundCatalog({
    limit: 100, // fetch more to allow client-side filtering
    offset: 0,
    classe: classe,
    search: debouncedSearch || undefined,
    orderBy: sortKey,
  });

  // Client-side filtering and sorting
  const filtered = useMemo(() => {
    let list = catalogData?.funds || [];

    // Filter by PL range
    if (plMin != null) {
      list = list.filter((f) => (f.vl_patrim_liq ?? 0) >= plMin);
    }
    if (plMax != null) {
      list = list.filter((f) => (f.vl_patrim_liq ?? 0) <= plMax);
    }

    // Filter by taxa_adm max
    if (taxaAdmMax != null) {
      list = list.filter((f) => (f.taxa_adm ?? 0) <= taxaAdmMax);
    }

    // Filter by público-alvo
    if (publico) {
      list = list.filter((f) => f.publico_alvo === publico);
    }

    // Filter by tributação
    if (tributacao) {
      list = list.filter((f) => f.tributacao === tributacao);
    }

    // Sort
    list.sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (typeof av === "string" && typeof bv === "string") {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });

    return list;
  }, [catalogData, plMin, plMax, taxaAdmMax, publico, tributacao, sortKey, sortAsc]);

  const pageCount = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const pageData = filtered.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const clearFilters = () => {
    setClasse(undefined);
    setPublico(undefined);
    setTributacao(undefined);
    setPlMin(undefined);
    setPlMax(undefined);
    setTaxaAdmMax(undefined);
    setSearch("");
    setPage(0);
  };

  const hasActiveFilters = !!(classe || publico || tributacao || plMin || plMax || taxaAdmMax || search);

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-zinc-700" />;
    return sortAsc ? <ArrowUp className="w-3 h-3 text-[#0B6C3E]" /> : <ArrowDown className="w-3 h-3 text-[#0B6C3E]" />;
  };

  const handleExportResults = useCallback(() => {
    if (!filtered.length) return;
    const columns: CsvColumn<typeof filtered[0]>[] = [
      { header: "Fundo", accessor: (row) => fundDisplayName(row) },
      { header: "Classe RCVM 175", accessor: (row) => row.classe_rcvm175 || row.classe || "—" },
      { header: "CNPJ", accessor: (row) => primaryCnpj(row) },
      { header: "PL (R$ M)", accessor: (row) => (row.vl_patrim_liq ? (row.vl_patrim_liq / 1e6).toFixed(1) : "0") },
      { header: "Taxa Adm (%)", accessor: (row) => row.taxa_adm != null ? row.taxa_adm.toFixed(2) : "—" },
      { header: "Cotistas", accessor: (row) => row.nr_cotistas ? String(row.nr_cotistas) : "—" },
    ];
    exportCsv(filtered, columns, csvFilename("fundos", "screener"));
  }, [filtered]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Header + Filter Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-[#0B6C3E]" />
          <h3 className="text-sm font-semibold text-zinc-300">Screener de Fundos</h3>
          {hasActiveFilters && (
            <span className="text-[9px] px-2 py-1 rounded bg-[#0B6C3E]/10 text-[#0B6C3E] font-mono">
              {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1.5 px-2 py-1.5 text-[9px] font-mono rounded hover:bg-[#1a1a1a] transition-colors group"
        >
          <Sliders className="w-3 h-3 text-zinc-600 group-hover:text-[#0B6C3E]" />
          <span className="text-zinc-400 group-hover:text-zinc-300">Filtros</span>
        </button>
      </div>

      {/* Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4 space-y-4"
          >
            {/* Search */}
            <div>
              <label className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono block mb-2">Buscar</label>
              <input
                type="text"
                placeholder="Nome ou CNPJ..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className="w-full px-3 py-1.5 text-[10px] bg-[#0a0a0a] border border-[#1a1a1a] rounded text-zinc-300 placeholder-zinc-700 focus:border-[#0B6C3E]/40 focus:outline-none font-mono"
              />
            </div>

            {/* Classe RCVM 175 */}
            <div>
              <label className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono block mb-2">Classe RCVM 175</label>
              <div className="flex flex-wrap gap-2">
                {CLASSES_RCVM175.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setClasse(classe === c ? undefined : c);
                      setPage(0);
                    }}
                    className={`px-2 py-1 text-[8px] font-mono rounded transition-all border ${
                      classe === c
                        ? "bg-[#0B6C3E] text-white border-[#0B6C3E]"
                        : "bg-[#0a0a0a] text-zinc-400 border-[#1a1a1a] hover:border-[#0B6C3E]/30"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Public + Tributação */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono block mb-2">Público-Alvo</label>
                <select
                  value={publico || ""}
                  onChange={(e) => {
                    setPublico(e.target.value || undefined);
                    setPage(0);
                  }}
                  className="w-full px-2 py-1.5 text-[9px] bg-[#0a0a0a] border border-[#1a1a1a] rounded text-zinc-300 focus:border-[#0B6C3E]/40 focus:outline-none font-mono"
                >
                  <option value="">Todos</option>
                  {PUBLICO_ALVO_OPTIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono block mb-2">Tributação</label>
                <select
                  value={tributacao || ""}
                  onChange={(e) => {
                    setTributacao(e.target.value || undefined);
                    setPage(0);
                  }}
                  className="w-full px-2 py-1.5 text-[9px] bg-[#0a0a0a] border border-[#1a1a1a] rounded text-zinc-300 focus:border-[#0B6C3E]/40 focus:outline-none font-mono"
                >
                  <option value="">Todos</option>
                  {TRIBUTACAO_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* PL Range + Taxa Adm */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono block mb-2">PL Mín (M)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={plMin ?? ""}
                  onChange={(e) => {
                    setPlMin(e.target.value ? Number(e.target.value) * 1e6 : undefined);
                    setPage(0);
                  }}
                  className="w-full px-2 py-1.5 text-[9px] bg-[#0a0a0a] border border-[#1a1a1a] rounded text-zinc-300 placeholder-zinc-700 focus:border-[#0B6C3E]/40 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono block mb-2">PL Máx (M)</label>
                <input
                  type="number"
                  placeholder="999"
                  value={plMax ? plMax / 1e6 : ""}
                  onChange={(e) => {
                    setPlMax(e.target.value ? Number(e.target.value) * 1e6 : undefined);
                    setPage(0);
                  }}
                  className="w-full px-2 py-1.5 text-[9px] bg-[#0a0a0a] border border-[#1a1a1a] rounded text-zinc-300 placeholder-zinc-700 focus:border-[#0B6C3E]/40 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono block mb-2">Tx Adm Máx (%)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="2.0"
                  value={taxaAdmMax ?? ""}
                  onChange={(e) => {
                    setTaxaAdmMax(e.target.value ? Number(e.target.value) : undefined);
                    setPage(0);
                  }}
                  className="w-full px-2 py-1.5 text-[9px] bg-[#0a0a0a] border border-[#1a1a1a] rounded text-zinc-300 placeholder-zinc-700 focus:border-[#0B6C3E]/40 focus:outline-none font-mono"
                />
              </div>
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-[9px] font-mono rounded bg-[#1a1a1a]/50 text-zinc-500 hover:bg-[#1a1a1a] hover:text-zinc-400 transition-colors"
              >
                <X className="w-3 h-3" />
                Limpar Filtros
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results Table */}
      {isLoading ? (
        <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
          <div className="h-4 bg-zinc-800/50 rounded w-1/3 mb-4 animate-pulse" />
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonTableRow key={i} cols={6} />
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#111111] border border-[#1a1a1a] rounded-lg overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-[#1a1a1a] flex items-center justify-between bg-[#0a0a0a]">
            <span className="text-[10px] text-zinc-600 font-mono">{filtered.length} fundos encontrados</span>
            <ExportButton onClick={handleExportResults} disabled={!filtered.length} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] font-mono">
              <thead>
                <tr className="border-b border-[#1a1a1a] text-zinc-600">
                  <th className="text-left px-3 py-2 w-8">#</th>
                  <th
                    className="text-left px-3 py-2 cursor-pointer hover:text-zinc-400 transition-colors"
                    onClick={() => handleSort("denom_social")}
                  >
                    <span className="flex items-center gap-1">Fundo <SortIcon col="denom_social" /></span>
                  </th>
                  <th className="text-left px-3 py-2">Classe</th>
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
                </tr>
              </thead>
              <tbody>
                {pageData.length > 0 ? (
                  pageData.map((fund, idx) => {
                    const fundPath = `/fundos/${fund.slug || fund.cnpj_fundo_classe || fund.cnpj_fundo}`;
                    return (
                      <tr
                        key={fund.cnpj_fundo}
                        className="border-b border-[#141414] hover:bg-[#0B6C3E]/5 transition-colors group"
                      >
                        <td className="px-3 py-2 text-zinc-700">{page * ITEMS_PER_PAGE + idx + 1}</td>
                        <td className="px-3 py-2 max-w-[200px]">
                          <Link
                            to={fundPath}
                            onClick={(e) => {
                              onSelectFund?.(fund.slug || primaryCnpj(fund));
                              e.preventDefault();
                            }}
                            className="block text-zinc-300 group-hover:text-[#0B6C3E] transition-colors truncate hover:underline"
                          >
                            {fundDisplayName(fund)}
                          </Link>
                        </td>
                        <td className="px-3 py-2">
                          <ClasseBadge classe={fund.classe_rcvm175 || fund.classe} size="sm" />
                        </td>
                        <td className="px-3 py-2 text-right text-zinc-300 whitespace-nowrap">
                          {formatPL(fund.vl_patrim_liq)}
                        </td>
                        <td className="px-3 py-2 text-right text-zinc-400">
                          {fund.taxa_adm != null ? `${fund.taxa_adm.toFixed(2)}%` : "—"}
                        </td>
                        <td className="px-3 py-2 text-right text-zinc-400">
                          {fund.nr_cotistas ? fund.nr_cotistas.toLocaleString("pt-BR") : "—"}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState variant="no-funds" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="flex items-center justify-between px-3 py-3 border-t border-[#1a1a1a]">
              <span className="text-[8px] text-zinc-600 font-mono">
                Página {page + 1} de {pageCount} • {filtered.length} total
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="px-2 py-1 text-[8px] font-mono rounded bg-[#0a0a0a] text-zinc-600 border border-[#1a1a1a] hover:border-[#0B6C3E]/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  ← Anterior
                </button>
                <button
                  onClick={() => setPage(Math.min(pageCount - 1, page + 1))}
                  disabled={page === pageCount - 1}
                  className="px-2 py-1 text-[8px] font-mono rounded bg-[#0a0a0a] text-zinc-600 border border-[#1a1a1a] hover:border-[#0B6C3E]/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Próxima →
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
