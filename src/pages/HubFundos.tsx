/**
 * HubFundos — V6 Reforma Screening-First (26/04/2026)
 *
 * Workflow primário: descoberta / screening (modelo ComDinheiro/Economática).
 * Antiga estrutura de 6 seções (Visão Geral / Estruturados / Gestoras &
 * Admins / Métricas & Mensal / Composição & Comparador / Analytics) foi
 * substituída por 3 modos:
 *
 *   • Screener  — tabela densa + filtros + métricas pré-computadas
 *   • Comparador — side-by-side de 2-6 fundos selecionados
 *   • Watchlist  — fundos favoritados (Pro-only via RLS)
 *
 * Deep modules (FidcHub, FiiHub, OfertasRadar) ficam intactos. Hero strip
 * mantém entry points para eles.
 *
 * Fallback: ?legacy=1 carrega HubFundosLegacy.tsx (rollback path).
 */

import { Suspense, lazy, useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, X, ArrowUp, ArrowDown,
  Filter as FilterIcon, Star, GitCompareArrows, Bookmark,
  Briefcase, ExternalLink, ChevronRight,
} from "lucide-react";

import { HubSEO } from "@/lib/seo";
import { Breadcrumbs } from "@/components/hub/Breadcrumbs";
import { DataAsOfStamp } from "@/components/hub/DataAsOfStamp";
import { SectionErrorBoundary } from "@/components/hub/SectionErrorBoundary";
import { EmptyState, InlineEmpty } from "@/components/hub/EmptyState";
import { SkeletonTableRow } from "@/components/hub/SkeletonLoader";
import { ClasseBadge } from "@/lib/rcvm175";
import { exportCsv, csvFilename, type CsvColumn } from "@/lib/csvExport";
import { ExportButton } from "@/components/hub/ExportButton";
import { useDebouncedValue } from "@/hooks/useDebounce";
import { formatCount, fmtNum } from "@/lib/format";
import { fmtSaldoBi } from "@/lib/unitNormalize";

import {
  useScreener,
  useFundWatchlist,
  useToggleFundWatch,
  ASSET_CLASS_CHIPS,
  type ScreenerFilters,
  type ScreenerRow,
  type ScreenerSortKey,
} from "@/hooks/useFundsV6";
import { useFundSearch, type FundSearchResult } from "@/hooks/useHubFundos";

const HubFundosLegacy = lazy(() => import("./HubFundosLegacy"));

/* ─── Helpers ──────────────────────────────────────────────────────────── */

/** Resolve route da lâmina baseado em classe + slug (mesmo que busca). */
function laminaPath(f: { classe_rcvm175: string | null; slug: string | null }): string | null {
  if (!f.slug) return null;
  const cls = (f.classe_rcvm175 || "").toUpperCase();
  if (cls.includes("FIDC")) return `/fundos/fidc/${f.slug}`;
  if (cls === "FII" || cls.includes("IMOBILI")) return `/fundos/fii/${f.slug}`;
  return `/fundos/${f.slug}`;
}

function fmtPLcompact(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return fmtSaldoBi(v / 1e9);
}

function fmtPctCell(
  v: number | null | undefined,
  digits = 2,
  options?: { highlight?: boolean },
): { text: string; color: string } {
  if (v == null || !Number.isFinite(v)) {
    return { text: "—", color: "text-zinc-700" };
  }
  const text = `${fmtNum(v, digits)}%`;
  if (!options?.highlight) return { text, color: "text-zinc-300" };
  if (v > 0) return { text, color: "text-emerald-400" };
  if (v < 0) return { text, color: "text-red-400" };
  return { text, color: "text-zinc-300" };
}

/* ─── Search bar com navegação para lâmina ─────────────────────────────── */

function GlobalFundSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const debounced = useDebouncedValue(query, 300);
  const { data, isLoading } = useFundSearch(debounced, { limit: 12 });
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = useCallback((f: FundSearchResult) => {
    setOpen(false);
    setQuery("");
    const p = laminaPath({ classe_rcvm175: f.classe_rcvm175, slug: f.slug });
    if (p) navigate(p);
  }, [navigate]);

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
      <input
        type="text"
        placeholder="Buscar fundo por nome ou CNPJ…"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => query.length >= 2 && setOpen(true)}
        className="w-full pl-8 pr-8 py-1.5 text-[11px] bg-[#0a0a0a] border border-[#1a1a1a] rounded-md text-zinc-300 placeholder-zinc-700 focus:border-[#0B6C3E]/40 focus:outline-none font-mono"
      />
      {query && (
        <button onClick={() => { setQuery(""); setOpen(false); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400">
          <X className="w-3 h-3" />
        </button>
      )}
      {open && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#111111] border border-[#1a1a1a] rounded-md shadow-xl z-30 max-h-64 overflow-y-auto">
          {isLoading && <div className="px-3 py-2 text-[10px] text-zinc-600 font-mono">Buscando…</div>}
          {data && data.results.length === 0 && (
            <InlineEmpty text="Nenhum fundo encontrado para esta busca." />
          )}
          {data?.results.map((f) => (
            <button
              key={f.cnpj_fundo_classe || f.cnpj_fundo}
              onClick={() => handleSelect(f)}
              className="w-full text-left px-3 py-2 hover:bg-[#0B6C3E]/5 border-b border-[#141414] last:border-0 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <ClasseBadge classe={f.classe_rcvm175 || f.classe || f.tp_fundo} size="sm" />
                <span className="text-[10px] text-zinc-200 font-mono truncate flex-1">{f.denom_social}</span>
                <span className="text-[10px] text-emerald-400/80 font-mono whitespace-nowrap">{fmtPLcompact(f.vl_patrim_liq)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Hero compact ─────────────────────────────────────────────────────── */

function ScreenerHero({
  selectedClasses,
  onToggleClass,
  onClearClasses,
}: {
  selectedClasses: string[];
  onToggleClass: (id: string) => void;
  onClearClasses: () => void;
}) {
  return (
    <header className="space-y-3">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-[#0B6C3E]" />
            Módulo Fundos
          </h1>
          <p className="text-[10px] font-mono text-zinc-500 mt-0.5">
            29.491 classes RCVM 175 · métricas pré-computadas (3m/6m/vol/Sharpe/MaxDD)
          </p>
        </div>
        <GlobalFundSearch />
      </div>

      {/* Asset class chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={onClearClasses}
          className={`px-2.5 py-1 text-[10px] font-mono rounded-md border transition-colors ${
            selectedClasses.length === 0
              ? "bg-[#0B6C3E]/15 border-[#0B6C3E]/40 text-[#0B6C3E]"
              : "bg-zinc-900/40 border-zinc-700 text-zinc-400 hover:border-zinc-600"
          }`}
        >
          Todos
        </button>
        {ASSET_CLASS_CHIPS.map((chip) => {
          const active = selectedClasses.includes(chip.id);
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => onToggleClass(chip.id)}
              className="px-2.5 py-1 text-[10px] font-mono rounded-md border transition-colors"
              style={{
                backgroundColor: active ? `${chip.color}22` : "rgba(24,24,27,0.4)",
                borderColor: active ? `${chip.color}66` : "rgb(63,63,70)",
                color: active ? chip.color : "rgb(161,161,170)",
              }}
            >
              {chip.label}
            </button>
          );
        })}
      </div>
    </header>
  );
}

/* ─── Deep module launchers strip ──────────────────────────────────────── */

function DeepModuleStrip() {
  const launchers = [
    { to: "/fundos/fidc", label: "FIDC", desc: "~4,3k FIDCs · subordinação · inadim", color: "#F97316", badge: "PRO" },
    { to: "/fundos/fii", label: "FII", desc: "~1,2k FIIs · DY · segmento", color: "#EC4899", badge: "PRO" },
    { to: "/ofertas", label: "Ofertas Públicas", desc: "CVM 160/476/400 · primárias", color: "#0B6C3E", badge: "PRO" },
  ];
  return (
    <nav aria-label="Deep modules" className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      {launchers.map((m) => (
        <Link
          key={m.to}
          to={m.to}
          className="group flex items-center justify-between px-3 py-2 bg-[#0a0a0a] border rounded-md hover:bg-[#111] transition-colors"
          style={{ borderColor: `${m.color}33` }}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-zinc-200">{m.label}</span>
              <span className="text-[8px] font-mono px-1 py-0.5 rounded border border-amber-400/20 text-amber-400 bg-amber-400/10">{m.badge}</span>
            </div>
            <div className="text-[9px] font-mono text-zinc-600 mt-0.5 truncate">{m.desc}</div>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-zinc-700 group-hover:text-[#0B6C3E]" style={{ color: undefined }} />
        </Link>
      ))}
    </nav>
  );
}

/* ─── Filtros sticky ───────────────────────────────────────────────────── */

interface FilterState {
  pl_min: number | "";
  pl_max: number | "";
  taxa_adm_max: number | "";
  publico: string;
  tributacao: string;
}

function FiltersBar({
  filters,
  onChange,
  onClear,
  totalResults,
}: {
  filters: FilterState;
  onChange: (next: Partial<FilterState>) => void;
  onClear: () => void;
  totalResults: number;
}) {
  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-md px-3 py-2.5 sticky top-2 z-10">
      <div className="flex items-center gap-3 flex-wrap">
        <FilterIcon className="w-3.5 h-3.5 text-zinc-600" />

        <div className="flex items-center gap-1">
          <label className="text-[9px] font-mono text-zinc-600 uppercase">PL min</label>
          <input
            type="number"
            min={0}
            step={1e8}
            placeholder="—"
            value={filters.pl_min}
            onChange={(e) => onChange({ pl_min: e.target.value ? Number(e.target.value) : "" })}
            className="w-24 bg-[#111] border border-zinc-800 rounded px-1.5 py-0.5 text-[10px] font-mono text-zinc-200 focus:outline-none focus:border-[#0B6C3E]/60"
          />
        </div>

        <div className="flex items-center gap-1">
          <label className="text-[9px] font-mono text-zinc-600 uppercase">Tx Adm máx</label>
          <input
            type="number"
            min={0}
            step={0.1}
            placeholder="2,0"
            value={filters.taxa_adm_max}
            onChange={(e) => onChange({ taxa_adm_max: e.target.value ? Number(e.target.value) : "" })}
            className="w-16 bg-[#111] border border-zinc-800 rounded px-1.5 py-0.5 text-[10px] font-mono text-zinc-200 focus:outline-none focus:border-[#0B6C3E]/60"
          />
          <span className="text-[9px] text-zinc-700">%</span>
        </div>

        <select
          value={filters.publico}
          onChange={(e) => onChange({ publico: e.target.value })}
          className="bg-[#111] border border-zinc-800 rounded px-1.5 py-0.5 text-[10px] font-mono text-zinc-300 focus:outline-none focus:border-[#0B6C3E]/60"
        >
          <option value="">Público alvo: todos</option>
          <option value="Geral">Geral / Varejo</option>
          <option value="Qualificado">Qualificado</option>
          <option value="Profissional">Profissional</option>
        </select>

        <select
          value={filters.tributacao}
          onChange={(e) => onChange({ tributacao: e.target.value })}
          className="bg-[#111] border border-zinc-800 rounded px-1.5 py-0.5 text-[10px] font-mono text-zinc-300 focus:outline-none focus:border-[#0B6C3E]/60"
        >
          <option value="">Tributação: todas</option>
          <option value="Curto Prazo">Curto Prazo</option>
          <option value="Longo Prazo">Longo Prazo</option>
          <option value="Ações">Ações</option>
        </select>

        <button
          type="button"
          onClick={onClear}
          className="px-2 py-0.5 text-[10px] font-mono text-zinc-500 hover:text-zinc-300 border border-transparent hover:border-zinc-800 rounded transition-colors"
        >
          Limpar
        </button>

        <div className="ml-auto text-[10px] font-mono text-zinc-500">
          {formatCount(totalResults)} fundo{totalResults !== 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
}

/* ─── Sortable column header ───────────────────────────────────────────── */

function SortHeader({
  children,
  active,
  dir,
  onClick,
  align = "right",
}: {
  children: React.ReactNode;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  align?: "left" | "right";
}) {
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 ${align === "right" ? "ml-auto" : ""} text-[9px] font-mono uppercase tracking-wider ${active ? "text-[#0B6C3E]" : "text-zinc-500 hover:text-zinc-300"} transition-colors`}
    >
      {children}
      {Icon && <Icon className="w-2.5 h-2.5" />}
    </button>
  );
}

/* ─── Tabela densa do screener ─────────────────────────────────────────── */

interface ScreenerTableProps {
  rows: ScreenerRow[];
  loading: boolean;
  sortBy: ScreenerSortKey;
  sortDir: "asc" | "desc";
  onSort: (key: ScreenerSortKey) => void;
  selected: Set<string>;
  onToggleSelect: (cnpj: string) => void;
}

function ScreenerTable({
  rows, loading, sortBy, sortDir, onSort, selected, onToggleSelect,
}: ScreenerTableProps) {
  const watchlistMut = useToggleFundWatch();
  const { data: watchlist } = useFundWatchlist();
  const watchedSet = useMemo(
    () => new Set((watchlist ?? []).map((w) => w.cnpj_fundo_classe)),
    [watchlist],
  );

  if (loading) {
    return (
      <div className="space-y-1" aria-busy="true">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonTableRow key={i} cols={9} />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        variant="no-funds"
        title="Nenhum fundo encontrado"
        description="Ajuste os filtros — diminua o PL mínimo, aumente a taxa máxima, ou troque a classe."
      />
    );
  }

  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-md overflow-x-auto">
      <table className="w-full min-w-[900px] text-[10px] font-mono">
        <thead className="bg-[#111] border-b border-[#1a1a1a]">
          <tr>
            <th className="px-2 py-1.5 w-6"></th>
            <th className="px-2 py-1.5 text-left text-zinc-500 uppercase tracking-wider w-[28%]">Nome</th>
            <th className="px-2 py-1.5 text-left text-zinc-500 uppercase tracking-wider">Classe</th>
            <th className="px-2 py-1.5 text-right">
              <SortHeader active={sortBy === "pl"} dir={sortDir} onClick={() => onSort("pl")}>PL</SortHeader>
            </th>
            <th className="px-2 py-1.5 text-right">
              <SortHeader active={sortBy === "ret_3m"} dir={sortDir} onClick={() => onSort("ret_3m")}>3m</SortHeader>
            </th>
            <th className="px-2 py-1.5 text-right">
              <SortHeader active={sortBy === "ret_6m"} dir={sortDir} onClick={() => onSort("ret_6m")}>6m</SortHeader>
            </th>
            <th className="px-2 py-1.5 text-right">
              <SortHeader active={sortBy === "vol"} dir={sortDir} onClick={() => onSort("vol")}>Vol</SortHeader>
            </th>
            <th className="px-2 py-1.5 text-right">
              <SortHeader active={sortBy === "sharpe"} dir={sortDir} onClick={() => onSort("sharpe")}>Sharpe</SortHeader>
            </th>
            <th className="px-2 py-1.5 text-right">
              <SortHeader active={sortBy === "max_dd"} dir={sortDir} onClick={() => onSort("max_dd")}>MaxDD</SortHeader>
            </th>
            <th className="px-2 py-1.5 text-right">
              <SortHeader active={sortBy === "taxa_adm"} dir={sortDir} onClick={() => onSort("taxa_adm")}>Tx Adm</SortHeader>
            </th>
            <th className="px-2 py-1.5 w-12"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isSel = selected.has(r.cnpj_fundo_classe);
            const isWatched = watchedSet.has(r.cnpj_fundo_classe);
            const path = laminaPath(r);
            const ret3m = fmtPctCell(r.retorno_3m_pct, 2, { highlight: true });
            const ret6m = fmtPctCell(r.retorno_6m_pct, 2, { highlight: true });
            const dd = fmtPctCell(r.max_dd_pct, 1, { highlight: true });
            return (
              <tr
                key={r.cnpj_fundo_classe}
                className="border-b border-[#1a1a1a] last:border-0 hover:bg-[#111] transition-colors group"
              >
                <td className="px-2 py-1.5 text-center">
                  <input
                    type="checkbox"
                    checked={isSel}
                    onChange={() => onToggleSelect(r.cnpj_fundo_classe)}
                    className="accent-[#0B6C3E] cursor-pointer"
                    aria-label={`Selecionar ${r.denom_social} para comparação`}
                  />
                </td>
                <td className="px-2 py-1.5">
                  {path ? (
                    <Link to={path} className="text-zinc-200 hover:text-[#0B6C3E] truncate inline-block max-w-[320px]" title={r.denom_social}>
                      {r.denom_social}
                    </Link>
                  ) : (
                    <span className="text-zinc-300 truncate inline-block max-w-[320px]" title={r.denom_social}>
                      {r.denom_social}
                    </span>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  <ClasseBadge classe={r.classe_rcvm175 || r.tp_fundo || ""} size="sm" />
                </td>
                <td className="px-2 py-1.5 text-right text-zinc-200">{fmtPLcompact(r.vl_patrim_liq)}</td>
                <td className={`px-2 py-1.5 text-right ${ret3m.color}`}>{ret3m.text}</td>
                <td className={`px-2 py-1.5 text-right ${ret6m.color}`}>{ret6m.text}</td>
                <td className="px-2 py-1.5 text-right text-zinc-400">
                  {r.vol_anual_pct != null ? `${fmtNum(r.vol_anual_pct, 2)}%` : "—"}
                </td>
                <td className="px-2 py-1.5 text-right">
                  {r.sharpe != null ? (
                    <span className={r.sharpe > 1 ? "text-emerald-400" : r.sharpe > 0 ? "text-zinc-300" : "text-red-400"}>
                      {fmtNum(r.sharpe, 2)}
                    </span>
                  ) : "—"}
                </td>
                <td className={`px-2 py-1.5 text-right ${dd.color}`}>{dd.text}</td>
                <td className="px-2 py-1.5 text-right text-zinc-400">
                  {r.taxa_adm != null ? `${fmtNum(r.taxa_adm, 2)}%` : "—"}
                </td>
                <td className="px-1 py-1.5">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => watchlistMut.mutate({ cnpj_fundo_classe: r.cnpj_fundo_classe, currentlyWatched: isWatched })}
                      disabled={watchlistMut.isPending}
                      className={`p-1 rounded transition-colors disabled:opacity-50 ${isWatched ? "text-amber-400" : "text-zinc-700 hover:text-amber-400"}`}
                      title={isWatched ? "Remover da watchlist" : "Adicionar à watchlist (Pro)"}
                      aria-label={isWatched ? "Remover da watchlist" : "Adicionar à watchlist"}
                    >
                      <Star className="w-3 h-3" fill={isWatched ? "currentColor" : "none"} />
                    </button>
                    {path && (
                      <Link
                        to={path}
                        className="p-1 rounded text-zinc-700 hover:text-[#0B6C3E] transition-colors"
                        title="Abrir lâmina completa"
                        aria-label="Abrir lâmina completa"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Comparador inline ────────────────────────────────────────────────── */

function CompareDrawer({
  rows,
  selectedSet,
  onClear,
  onRemove,
}: {
  rows: ScreenerRow[];
  selectedSet: Set<string>;
  onClear: () => void;
  onRemove: (cnpj: string) => void;
}) {
  const list = rows.filter((r) => selectedSet.has(r.cnpj_fundo_classe));
  if (list.length < 2) return null;

  const handleExport = () => {
    const cols: CsvColumn<ScreenerRow>[] = [
      { header: "Nome", accessor: (r) => r.denom_social },
      { header: "Classe", accessor: (r) => r.classe_rcvm175 ?? "" },
      { header: "PL (R$)", accessor: (r) => r.vl_patrim_liq ?? "" },
      { header: "Retorno 3m (%)", accessor: (r) => r.retorno_3m_pct ?? "" },
      { header: "Retorno 6m (%)", accessor: (r) => r.retorno_6m_pct ?? "" },
      { header: "Vol Anual (%)", accessor: (r) => r.vol_anual_pct ?? "" },
      { header: "Sharpe", accessor: (r) => r.sharpe ?? "" },
      { header: "Max DD (%)", accessor: (r) => r.max_dd_pct ?? "" },
      { header: "Taxa Adm (%)", accessor: (r) => r.taxa_adm ?? "" },
      { header: "Gestor", accessor: (r) => r.gestor_nome ?? "" },
    ];
    exportCsv(list, cols, csvFilename("fundos", "comparador"));
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#0a0a0a] border-2 border-[#0B6C3E]/40 rounded-md p-3 space-y-2"
    >
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold text-zinc-200 flex items-center gap-1.5">
          <GitCompareArrows className="w-3.5 h-3.5 text-[#0B6C3E]" />
          Comparador ({list.length})
        </h3>
        <div className="flex items-center gap-2">
          <ExportButton onClick={handleExport} label="CSV" />
          <button
            type="button"
            onClick={onClear}
            className="text-[9px] font-mono text-zinc-500 hover:text-zinc-300"
          >
            Limpar tudo
          </button>
        </div>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] font-mono">
          <thead className="border-b border-[#1a1a1a]">
            <tr>
              <th className="px-2 py-1 text-left text-zinc-500 uppercase">Métrica</th>
              {list.map((r) => (
                <th key={r.cnpj_fundo_classe} className="px-2 py-1 text-right text-zinc-300 max-w-[180px] truncate" title={r.denom_social}>
                  <div className="flex items-center justify-end gap-1">
                    <span className="truncate">{r.denom_social}</span>
                    <button
                      onClick={() => onRemove(r.cnpj_fundo_classe)}
                      className="text-zinc-700 hover:text-red-400"
                      aria-label={`Remover ${r.denom_social}`}
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <CompareRow label="Classe" cells={list.map((r) => r.classe_rcvm175 || "—")} />
            <CompareRow label="PL" cells={list.map((r) => fmtPLcompact(r.vl_patrim_liq))} />
            <CompareRow label="Retorno 3m" cells={list.map((r) => r.retorno_3m_pct != null ? `${fmtNum(r.retorno_3m_pct, 2)}%` : "—")} />
            <CompareRow label="Retorno 6m" cells={list.map((r) => r.retorno_6m_pct != null ? `${fmtNum(r.retorno_6m_pct, 2)}%` : "—")} />
            <CompareRow label="Vol Anual" cells={list.map((r) => r.vol_anual_pct != null ? `${fmtNum(r.vol_anual_pct, 2)}%` : "—")} />
            <CompareRow label="Sharpe" cells={list.map((r) => r.sharpe != null ? fmtNum(r.sharpe, 2) : "—")} />
            <CompareRow label="Max DD (6m)" cells={list.map((r) => r.max_dd_pct != null ? `${fmtNum(r.max_dd_pct, 1)}%` : "—")} />
            <CompareRow label="Taxa Adm" cells={list.map((r) => r.taxa_adm != null ? `${fmtNum(r.taxa_adm, 2)}%` : "—")} />
            <CompareRow label="Cotistas" cells={list.map((r) => r.nr_cotistas != null ? formatCount(r.nr_cotistas) : "—")} />
            <CompareRow label="Gestor" cells={list.map((r) => r.gestor_nome || "—")} truncate />
          </tbody>
        </table>
      </div>
    </motion.section>
  );
}

function CompareRow({ label, cells, truncate }: { label: string; cells: string[]; truncate?: boolean }) {
  return (
    <tr className="border-b border-[#141414] last:border-0">
      <td className="px-2 py-1 text-zinc-500 uppercase text-[9px] tracking-wider">{label}</td>
      {cells.map((c, i) => (
        <td key={i} className={`px-2 py-1 text-right text-zinc-300 ${truncate ? "truncate max-w-[180px]" : ""}`} title={truncate ? c : undefined}>
          {c}
        </td>
      ))}
    </tr>
  );
}

/* ─── Watchlist content (renderiza tabela filtrada por watchlist) ──────── */

function WatchlistContent({
  selected,
  onToggleSelect,
  sortBy,
  sortDir,
  onSort,
}: {
  selected: Set<string>;
  onToggleSelect: (cnpj: string) => void;
  sortBy: ScreenerSortKey;
  sortDir: "asc" | "desc";
  onSort: (k: ScreenerSortKey) => void;
}) {
  const { data: watchlist, isLoading: wlLoading } = useFundWatchlist();
  const cnpjs = useMemo(() => (watchlist ?? []).map((w) => w.cnpj_fundo_classe), [watchlist]);

  // Reuse useScreener with no filters but client-side filter to watchlist cnpjs.
  // (Backend não tem `cnpj_in` filter; pull all funds with relevant classes is too wide.)
  // Hack temporário: usa hub_fundos_meta direct via useFundDetail-like pattern...
  // For now: chamar endpoint catalog (limited) — we'll just show metadata-only
  // table without metrics overlay until we add a `cnpj_in` filter to screener.

  if (wlLoading) {
    return (
      <div className="space-y-1">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonTableRow key={i} cols={5} />)}
      </div>
    );
  }
  if (cnpjs.length === 0) {
    return (
      <EmptyState
        variant="no-data"
        title="Sua watchlist está vazia"
        description="Adicione fundos pelo screener — clique no ⭐ na coluna direita da tabela. Watchlist é Pro-only."
      />
    );
  }

  // Reuse: fetch screener with no class filters and high limit, then client-filter to cnpjs
  return <WatchlistTable cnpjs={cnpjs} selected={selected} onToggleSelect={onToggleSelect} sortBy={sortBy} sortDir={sortDir} onSort={onSort} />;
}

function WatchlistTable({
  cnpjs, selected, onToggleSelect, sortBy, sortDir, onSort,
}: {
  cnpjs: string[];
  selected: Set<string>;
  onToggleSelect: (cnpj: string) => void;
  sortBy: ScreenerSortKey;
  sortDir: "asc" | "desc";
  onSort: (k: ScreenerSortKey) => void;
}) {
  // Pull a generous slice and filter client-side to watchlist cnpjs
  const { data, isLoading } = useScreener({ limit: 500, sort_by: sortBy, sort_dir: sortDir });
  const filtered = useMemo(() => {
    if (!data?.funds) return [] as ScreenerRow[];
    const set = new Set(cnpjs);
    return data.funds.filter((f) => set.has(f.cnpj_fundo_classe));
  }, [data, cnpjs]);

  return (
    <ScreenerTable
      rows={filtered}
      loading={isLoading}
      sortBy={sortBy}
      sortDir={sortDir}
      onSort={onSort}
      selected={selected}
      onToggleSelect={onToggleSelect}
    />
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────── */

type ViewMode = "screener" | "compare" | "watchlist";

export default function HubFundos() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Legacy escape hatch
  if (searchParams.get("legacy") === "1") {
    return (
      <Suspense fallback={<div className="p-6 text-[11px] font-mono text-zinc-500">Carregando versão legacy…</div>}>
        <HubFundosLegacy />
      </Suspense>
    );
  }

  const initialMode = (searchParams.get("mode") as ViewMode) ?? "screener";
  const [mode, setMode] = useState<ViewMode>(["screener", "compare", "watchlist"].includes(initialMode) ? initialMode : "screener");

  const initialClasses = (searchParams.get("classes") ?? "").split(",").filter(Boolean);
  const [selectedClasses, setSelectedClasses] = useState<string[]>(initialClasses);

  const [filters, setFilters] = useState<FilterState>({
    pl_min: searchParams.get("pl_min") ? Number(searchParams.get("pl_min")) : "",
    pl_max: "",
    taxa_adm_max: "",
    publico: "",
    tributacao: "",
  });

  const [sortBy, setSortBy] = useState<ScreenerSortKey>(
    (searchParams.get("sort_by") as ScreenerSortKey) ?? "pl",
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">(
    (searchParams.get("sort_dir") as "asc" | "desc") ?? "desc",
  );

  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // Sync URL
  useEffect(() => {
    const next = new URLSearchParams();
    if (mode !== "screener") next.set("mode", mode);
    if (selectedClasses.length > 0) next.set("classes", selectedClasses.join(","));
    if (filters.pl_min) next.set("pl_min", String(filters.pl_min));
    if (sortBy !== "pl") next.set("sort_by", sortBy);
    if (sortDir !== "desc") next.set("sort_dir", sortDir);
    setSearchParams(next, { replace: true });
  }, [mode, selectedClasses, filters.pl_min, sortBy, sortDir, setSearchParams]);

  const screenerFilters: ScreenerFilters = useMemo(() => {
    const classes: string[] = [];
    for (const id of selectedClasses) {
      const chip = ASSET_CLASS_CHIPS.find((c) => c.id === id);
      if (chip) classes.push(...chip.classes);
    }
    return {
      classes: classes.length > 0 ? classes : undefined,
      pl_min: filters.pl_min || undefined,
      pl_max: filters.pl_max || undefined,
      taxa_adm_max: filters.taxa_adm_max || undefined,
      publico: filters.publico || undefined,
      tributacao: filters.tributacao || undefined,
      sort_by: sortBy,
      sort_dir: sortDir,
      limit: 100,
    };
  }, [selectedClasses, filters, sortBy, sortDir]);

  const { data: screener, isLoading: screenerLoading } = useScreener(
    mode === "screener" ? screenerFilters : { limit: 0 },
  );

  const handleToggleClass = (id: string) => {
    setSelectedClasses((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);
  };

  const handleSort = (k: ScreenerSortKey) => {
    if (sortBy === k) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortBy(k); setSortDir(k === "max_dd" || k === "vol" ? "asc" : "desc"); }
  };

  const handleToggleSelect = (cnpj: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(cnpj)) next.delete(cnpj);
      else if (next.size < 6) next.add(cnpj);
      return next;
    });
  };

  const handleClearFilters = () => {
    setFilters({ pl_min: "", pl_max: "", taxa_adm_max: "", publico: "", tributacao: "" });
    setSelectedClasses([]);
  };

  const handleExportCsv = () => {
    if (!screener?.funds) return;
    const cols: CsvColumn<ScreenerRow>[] = [
      { header: "Nome", accessor: (r) => r.denom_social },
      { header: "Classe", accessor: (r) => r.classe_rcvm175 ?? "" },
      { header: "Slug", accessor: (r) => r.slug ?? "" },
      { header: "PL (R$)", accessor: (r) => r.vl_patrim_liq ?? "" },
      { header: "Retorno 3m (%)", accessor: (r) => r.retorno_3m_pct ?? "" },
      { header: "Retorno 6m (%)", accessor: (r) => r.retorno_6m_pct ?? "" },
      { header: "Vol Anual (%)", accessor: (r) => r.vol_anual_pct ?? "" },
      { header: "Sharpe", accessor: (r) => r.sharpe ?? "" },
      { header: "Max DD (%)", accessor: (r) => r.max_dd_pct ?? "" },
      { header: "Taxa Adm (%)", accessor: (r) => r.taxa_adm ?? "" },
      { header: "Gestor", accessor: (r) => r.gestor_nome ?? "" },
      { header: "Admin", accessor: (r) => r.admin_nome ?? "" },
    ];
    exportCsv(screener.funds, cols, csvFilename("fundos", "screener"));
  };

  return (
    <>
      <HubSEO
        title="Módulo Fundos — Screening de fundos CVM"
        description="Screener de 29.491 classes RCVM 175 com métricas pré-computadas (retornos 3m/6m, Sharpe, volatilidade, drawdown). Filtre por classe, PL, taxa, público e tributação."
        path="/fundos"
        keywords="screener fundos CVM, RCVM 175, fundos investimento Brasil, screener de fundos, busca fundo CNPJ"
      />

      <div className="px-4 md:px-6 py-4 space-y-4">
        <Breadcrumbs items={[{ label: "Fundos" }]} className="mb-2" />

        <SectionErrorBoundary sectionName="Hero Fundos">
          <ScreenerHero
            selectedClasses={selectedClasses}
            onToggleClass={handleToggleClass}
            onClearClasses={() => setSelectedClasses([])}
          />
        </SectionErrorBoundary>

        <SectionErrorBoundary sectionName="Deep Modules">
          <DeepModuleStrip />
        </SectionErrorBoundary>

        {/* Mode tabs */}
        <div className="flex items-center gap-1 border-b border-[#1a1a1a]">
          {([
            { id: "screener" as const, label: "Screener", Icon: Search },
            { id: "compare" as const, label: `Comparador (${selectedRows.size})`, Icon: GitCompareArrows },
            { id: "watchlist" as const, label: "Watchlist", Icon: Bookmark },
          ]).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono border-b-2 transition-colors ${
                mode === id
                  ? "border-[#0B6C3E] text-[#0B6C3E]"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            {mode === "screener" && screener?.funds && screener.funds.length > 0 && (
              <ExportButton onClick={handleExportCsv} label="CSV" disabled={!screener.funds.length} />
            )}
          </div>
        </div>

        {/* Mode content */}
        <AnimatePresence mode="wait">
          {mode === "screener" && (
            <motion.div
              key="screener"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <FiltersBar
                filters={filters}
                onChange={(next) => setFilters((p) => ({ ...p, ...next }))}
                onClear={handleClearFilters}
                totalResults={screener?.count ?? 0}
              />
              <SectionErrorBoundary sectionName="Screener Table">
                <ScreenerTable
                  rows={screener?.funds ?? []}
                  loading={screenerLoading}
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={handleSort}
                  selected={selectedRows}
                  onToggleSelect={handleToggleSelect}
                />
              </SectionErrorBoundary>
              {selectedRows.size >= 2 && (
                <CompareDrawer
                  rows={screener?.funds ?? []}
                  selectedSet={selectedRows}
                  onClear={() => setSelectedRows(new Set())}
                  onRemove={(cnpj) => {
                    const next = new Set(selectedRows);
                    next.delete(cnpj);
                    setSelectedRows(next);
                  }}
                />
              )}
            </motion.div>
          )}

          {mode === "compare" && (
            <motion.div
              key="compare"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {selectedRows.size < 2 ? (
                <EmptyState
                  variant="no-data"
                  title="Selecione pelo menos 2 fundos"
                  description="Volte para o screener, marque os fundos que quer comparar (✓ na primeira coluna) e os números aparecem aqui side-by-side."
                  ctaLabel="Voltar ao screener"
                  ctaTo="/fundos?mode=screener"
                />
              ) : (
                <CompareDrawer
                  rows={screener?.funds ?? []}
                  selectedSet={selectedRows}
                  onClear={() => setSelectedRows(new Set())}
                  onRemove={(cnpj) => {
                    const next = new Set(selectedRows);
                    next.delete(cnpj);
                    setSelectedRows(next);
                  }}
                />
              )}
            </motion.div>
          )}

          {mode === "watchlist" && (
            <motion.div
              key="watchlist"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <WatchlistContent
                selected={selectedRows}
                onToggleSelect={handleToggleSelect}
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={handleSort}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer compact: cobertura + DataAsOfStamp */}
        <footer className="pt-4 border-t border-[#1a1a1a] flex items-center justify-between gap-4 flex-wrap text-[9px] font-mono text-zinc-700">
          <span>
            Fontes: CVM RCVM 175 · hub_fundos_meta · hub_fundos_diario · hub_fund_metrics_cache
            (refresh diário 04:30 UTC).
          </span>
          <DataAsOfStamp
            date={screener?.funds?.[0]?.metrics_last_dt ?? null}
            cadence="daily"
            source="hub_fund_metrics_cache"
            compact
          />
        </footer>
      </div>
    </>
  );
}
