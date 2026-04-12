// HubPortfolio — V4 Fase 4 Portfolio Tracker
// Multi-portfolio management: list, holdings table, allocation chart, target tracking
// Route: /portfolio (authenticated, available to all tiers — premium features gated inline)

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { SkeletonPage } from "@/components/hub/SkeletonLoader";
import {
  Briefcase,
  Plus,
  Trash2,
  Search,
  X,
  PieChart as PieIcon,
  Target,
  TrendingUp,
  Edit3,
  Check,
  AlertCircle,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import { useAuth } from "@/hooks/useAuth";
import {
  usePortfolios,
  usePortfolioHoldings,
  useCreatePortfolio,
  useDeletePortfolio,
  useAddHolding,
  useDeleteHolding,
  useUpdateHolding,
  usePortfolioSummary,
  useFormatBRL,
  classeColor,
  type Portfolio,
  type PortfolioHolding,
  type NewHoldingInput,
} from "@/hooks/usePortfolios";
import { useFundSearch, type FundSearchResult } from "@/hooks/useHubFundos";
import { MacroSection, MacroSidebar } from "@/components/hub/MacroSection";
import { SectionErrorBoundary } from "@/components/hub/SectionErrorBoundary";
import { Link } from "react-router-dom";

/* ─────────────── Constants ─────────────── */

const SECTIONS = [
  { id: "overview", label: "Visão Geral", icon: Briefcase },
  { id: "holdings", label: "Holdings", icon: TrendingUp },
  { id: "allocation", label: "Alocação", icon: PieIcon },
  { id: "targets", label: "Metas", icon: Target },
] as const;

const PORTFOLIO_COLORS = ["#0B6C3E", "#3B82F6", "#22C55E", "#EC4899", "#F59E0B", "#8B5CF6"];

/* ─────────────── Page ─────────────── */

export default function HubPortfolio() {
  const { user, loading: authLoading } = useAuth();
  const { data: portfolios, isLoading: loadingPortfolios } = usePortfolios();

  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>("overview");

  const createPortfolio = useCreatePortfolio();
  const deletePortfolio = useDeletePortfolio();

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  /* Auto-select first portfolio when list loads */
  useEffect(() => {
    if (!selectedPortfolioId && portfolios && portfolios.length > 0) {
      const def = portfolios.find((p) => p.is_default) ?? portfolios[0];
      setSelectedPortfolioId(def.id);
    }
  }, [portfolios, selectedPortfolioId]);

  const selectedPortfolio = useMemo(
    () => portfolios?.find((p) => p.id === selectedPortfolioId) ?? null,
    [portfolios, selectedPortfolioId]
  );

  const { data: holdings, isLoading: loadingHoldings } = usePortfolioHoldings(
    selectedPortfolioId ?? undefined
  );

  const summary = usePortfolioSummary(holdings);

  const handleNavigate = (id: string) => {
    setActiveSection(id);
    const el = sectionRefs.current[id];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleCreatePortfolio = async () => {
    const name = prompt("Nome do novo portfólio:", "Meu Portfólio");
    if (!name?.trim()) return;
    const isDefault = !portfolios || portfolios.length === 0;
    try {
      await createPortfolio.mutateAsync({
        name: name.trim(),
        is_default: isDefault,
        color: PORTFOLIO_COLORS[(portfolios?.length ?? 0) % PORTFOLIO_COLORS.length],
      });
    } catch (e) {
      alert(`Erro ao criar portfólio: ${(e as Error).message}`);
    }
  };

  const handleDeletePortfolio = async () => {
    if (!selectedPortfolio) return;
    if (!confirm(`Excluir portfólio "${selectedPortfolio.name}"? Todos os holdings serão removidos.`)) return;
    try {
      await deletePortfolio.mutateAsync(selectedPortfolio.id);
      setSelectedPortfolioId(null);
    } catch (e) {
      alert(`Erro ao excluir: ${(e as Error).message}`);
    }
  };

  /* ─── Not authenticated ─── */
  if (authLoading || loadingPortfolios) {
    return <SkeletonPage />;
  }

  if (!user) {
    return (
      <div className="w-full p-6 text-center">
        <p className="text-zinc-400 text-sm">Faça login para acessar seus portfólios.</p>
      </div>
    );
  }

  /* ─── Empty state ─── */
  if (!portfolios || portfolios.length === 0) {
    return (
      <div className="w-full min-h-[60vh] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md text-center space-y-4"
        >
          <div className="w-14 h-14 mx-auto rounded-xl bg-[#0B6C3E]/10 flex items-center justify-center">
            <Briefcase className="w-7 h-7 text-[#0B6C3E]" />
          </div>
          <h2 className="text-lg font-bold text-zinc-200 font-mono">Crie seu primeiro portfólio</h2>
          <p className="text-sm text-zinc-500 leading-relaxed">
            Acompanhe suas posições, compare alocação atual vs. meta e receba alertas quando algo mudar.
          </p>
          <button
            onClick={handleCreatePortfolio}
            disabled={createPortfolio.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#0B6C3E] hover:bg-[#0A5D36] text-white rounded-md text-sm font-mono transition-colors disabled:opacity-60"
          >
            <Plus className="w-4 h-4" />
            {createPortfolio.isPending ? "Criando..." : "Novo portfólio"}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* ─── Top bar: portfolio switcher + actions ─── */}
      <div className="border-b border-[#141414] bg-[#0a0a0a] sticky top-14 z-20">
        <div className="px-4 lg:px-6 py-3 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Briefcase className="w-4 h-4 text-[#0B6C3E] flex-shrink-0" />
            <h1 className="text-sm font-bold text-zinc-200 font-mono truncate">
              Portfolio Tracker
            </h1>
            <span className="text-[8px] bg-[#0B6C3E]/20 text-[#0B6C3E] px-1 py-0.5 rounded font-mono">
              BETA
            </span>
          </div>

          <div className="flex items-center gap-1.5 ml-auto flex-wrap">
            {portfolios.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPortfolioId(p.id)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-mono transition-all border flex items-center gap-1.5 ${
                  p.id === selectedPortfolioId
                    ? "bg-[#0B6C3E]/10 text-[#0B6C3E] border-[#0B6C3E]/30"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-[#111] border-transparent"
                }`}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: p.color ?? "#0B6C3E" }}
                />
                {p.name}
                {p.is_default && (
                  <span className="text-[8px] bg-zinc-800 text-zinc-500 px-1 rounded">DEFAULT</span>
                )}
              </button>
            ))}
            <button
              onClick={handleCreatePortfolio}
              disabled={createPortfolio.isPending}
              className="p-1.5 rounded-md text-zinc-500 hover:text-[#0B6C3E] hover:bg-[#0B6C3E]/10 transition-colors disabled:opacity-60"
              title="Novo portfólio"
            >
              <Plus className="w-4 h-4" />
            </button>
            {selectedPortfolio && (
              <button
                onClick={handleDeletePortfolio}
                disabled={deletePortfolio.isPending}
                className="p-1.5 rounded-md text-zinc-600 hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-60"
                title="Excluir portfólio"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Main layout: sidebar + sections ─── */}
      <div className="px-4 lg:px-6 py-4 grid grid-cols-1 md:grid-cols-[160px_1fr] gap-4">
        <MacroSidebar
          items={SECTIONS.map((s) => ({ id: s.id, label: s.label, icon: s.icon }))}
          activeId={activeSection}
          onNavigate={handleNavigate}
        />

        <div className="space-y-6 min-w-0">
          <SectionErrorBoundary sectionName="Visão Geral">
            <div ref={(el) => (sectionRefs.current.overview = el)}>
              <MacroSection
                id="overview"
                title="Visão Geral"
                subtitle={selectedPortfolio?.name ?? "—"}
                icon={Briefcase}
              >
                <OverviewBlock
                  portfolio={selectedPortfolio}
                  holdings={holdings ?? []}
                  summary={summary}
                  loading={loadingHoldings}
                />
              </MacroSection>
            </div>
          </SectionErrorBoundary>

          <SectionErrorBoundary sectionName="Holdings">
            <div ref={(el) => (sectionRefs.current.holdings = el)}>
              <MacroSection
                id="holdings"
                title="Holdings"
                subtitle="Posições do portfólio"
                icon={TrendingUp}
                seriesCount={holdings?.length}
              >
                <HoldingsBlock
                  portfolioId={selectedPortfolioId}
                  holdings={holdings ?? []}
                  loading={loadingHoldings}
                />
              </MacroSection>
            </div>
          </SectionErrorBoundary>

          <SectionErrorBoundary sectionName="Alocação">
            <div ref={(el) => (sectionRefs.current.allocation = el)}>
              <MacroSection
                id="allocation"
                title="Alocação por Classe"
                subtitle="Distribuição atual do portfólio"
                icon={PieIcon}
              >
                <AllocationBlock summary={summary} holdings={holdings ?? []} />
              </MacroSection>
            </div>
          </SectionErrorBoundary>

          <SectionErrorBoundary sectionName="Metas">
            <div ref={(el) => (sectionRefs.current.targets = el)}>
              <MacroSection
                id="targets"
                title="Metas de Alocação"
                subtitle="Atual vs. alvo (target rebalancing)"
                icon={Target}
              >
                <TargetsBlock holdings={holdings ?? []} summary={summary} />
              </MacroSection>
            </div>
          </SectionErrorBoundary>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════ Overview Block ═══════════════════ */

function OverviewBlock({
  portfolio,
  holdings,
  summary,
  loading,
}: {
  portfolio: Portfolio | null;
  holdings: PortfolioHolding[];
  summary: ReturnType<typeof usePortfolioSummary>;
  loading: boolean;
}) {
  const fmt = useFormatBRL();

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="w-5 h-5 mx-auto rounded-full border-2 border-[#0B6C3E] border-t-transparent animate-spin" />
      </div>
    );
  }

  const topHoldings = [...holdings]
    .sort((a, b) => (Number(b.initial_investment) || 0) - (Number(a.initial_investment) || 0))
    .slice(0, 5);

  return (
    <div className="space-y-3">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <KPICard label="Investido" value={fmt(summary.totalInvested)} icon={TrendingUp} />
        <KPICard label="Holdings" value={String(summary.totalHoldings)} icon={Briefcase} />
        <KPICard
          label="Classes"
          value={String(Object.keys(summary.byClasse).length)}
          icon={PieIcon}
        />
        <KPICard
          label="Cobertura Meta"
          value={`${summary.withTarget}/${summary.totalHoldings}`}
          icon={Target}
        />
      </div>

      {/* Top holdings snapshot */}
      {topHoldings.length > 0 && (
        <div className="bg-[#0d0d0d] border border-[#141414] rounded-md p-3">
          <h3 className="text-[10px] font-mono text-zinc-500 uppercase mb-2">Top 5 Posições</h3>
          <div className="space-y-1.5">
            {topHoldings.map((h) => {
              const pct =
                summary.totalInvested > 0
                  ? ((Number(h.initial_investment) || 0) / summary.totalInvested) * 100
                  : 0;
              return (
                <div key={h.id} className="flex items-center gap-2 text-[11px] font-mono">
                  <div
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: classeColor(h.classe_rcvm175) }}
                  />
                  <span className="flex-1 truncate text-zinc-300">{h.fund_name}</span>
                  <span className="text-zinc-500 w-20 text-right">
                    {fmt(h.initial_investment)}
                  </span>
                  <span className="text-zinc-600 w-12 text-right">{pct.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {holdings.length === 0 && portfolio && (
        <div className="bg-[#0d0d0d] border border-dashed border-[#1a1a1a] rounded-md p-6 text-center">
          <p className="text-xs text-zinc-500 font-mono">
            Nenhuma posição no portfólio ainda. Adicione um fundo na aba Holdings.
          </p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════ Holdings Block ═══════════════════ */

function HoldingsBlock({
  portfolioId,
  holdings,
  loading,
}: {
  portfolioId: string | null;
  holdings: PortfolioHolding[];
  loading: boolean;
}) {
  const fmt = useFormatBRL();
  const [adding, setAdding] = useState(false);
  const deleteHolding = useDeleteHolding();

  if (!portfolioId) {
    return (
      <div className="p-6 text-center text-xs text-zinc-500 font-mono">
        Selecione um portfólio.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-mono text-zinc-500">
          {loading ? "Carregando..." : `${holdings.length} posições`}
        </p>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-[#0B6C3E]/10 hover:bg-[#0B6C3E]/20 text-[#0B6C3E] rounded-md text-[11px] font-mono border border-[#0B6C3E]/20 transition-colors"
        >
          <Plus className="w-3 h-3" />
          Adicionar fundo
        </button>
      </div>

      {adding && (
        <AddHoldingForm
          portfolioId={portfolioId}
          onClose={() => setAdding(false)}
        />
      )}

      {holdings.length === 0 && !adding ? (
        <div className="bg-[#0d0d0d] border border-dashed border-[#1a1a1a] rounded-md p-6 text-center">
          <p className="text-xs text-zinc-500 font-mono">
            Nenhum holding adicionado. Clique em "Adicionar fundo" para começar.
          </p>
        </div>
      ) : (
        <div className="bg-[#0d0d0d] border border-[#141414] rounded-md overflow-x-auto">
          <table className="w-full text-[11px] font-mono">
            <thead>
              <tr className="border-b border-[#141414] text-zinc-600">
                <th className="text-left px-3 py-2 font-normal">Fundo</th>
                <th className="text-left px-2 py-2 font-normal">Classe</th>
                <th className="text-right px-2 py-2 font-normal">Investido</th>
                <th className="text-right px-2 py-2 font-normal">Qtd.</th>
                <th className="text-right px-2 py-2 font-normal">Meta %</th>
                <th className="text-center px-2 py-2 font-normal">Ações</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => (
                <HoldingRow
                  key={h.id}
                  holding={h}
                  fmt={fmt}
                  onDelete={() =>
                    deleteHolding.mutate({ id: h.id, portfolioId: h.portfolio_id })
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function HoldingRow({
  holding,
  fmt,
  onDelete,
}: {
  holding: PortfolioHolding;
  fmt: (v: number | null | undefined) => string;
  onDelete: () => void;
}) {
  const updateHolding = useUpdateHolding();
  const [editing, setEditing] = useState(false);
  const [draftInvested, setDraftInvested] = useState<string>(
    holding.initial_investment != null ? String(holding.initial_investment) : ""
  );
  const [draftQty, setDraftQty] = useState<string>(
    holding.quantity != null ? String(holding.quantity) : ""
  );
  const [draftTarget, setDraftTarget] = useState<string>(
    holding.target_allocation != null ? String(holding.target_allocation) : ""
  );

  const handleSave = async () => {
    try {
      await updateHolding.mutateAsync({
        id: holding.id,
        patch: {
          initial_investment: draftInvested ? Number(draftInvested) : null,
          quantity: draftQty ? Number(draftQty) : null,
          target_allocation: draftTarget ? Number(draftTarget) : null,
        },
      });
      setEditing(false);
    } catch (e) {
      alert(`Erro ao salvar: ${(e as Error).message}`);
    }
  };

  const row = (
    <>
      <td className="px-3 py-2 max-w-[240px]">
        <div className="flex items-center gap-1.5">
          <div
            className="w-1 h-4 rounded-sm flex-shrink-0"
            style={{ backgroundColor: classeColor(holding.classe_rcvm175) }}
          />
          <div className="min-w-0">
            <div className="truncate text-zinc-300">{holding.fund_name}</div>
            {holding.fund_slug ? (
              <Link
                to={`/fundos/${holding.fund_slug}`}
                className="text-[9px] text-zinc-600 hover:text-[#0B6C3E] truncate block"
              >
                /{holding.fund_slug}
              </Link>
            ) : (
              <div className="text-[9px] text-zinc-700 truncate">{holding.cnpj_fundo_classe}</div>
            )}
          </div>
        </div>
      </td>
      <td className="px-2 py-2 text-zinc-400">{holding.classe_rcvm175 ?? "—"}</td>
    </>
  );

  if (editing) {
    return (
      <tr className="border-b border-[#141414] bg-[#0B6C3E]/5">
        {row}
        <td className="px-2 py-2 text-right">
          <input
            type="number"
            value={draftInvested}
            onChange={(e) => setDraftInvested(e.target.value)}
            className="w-20 bg-[#111] border border-[#222] rounded px-1.5 py-0.5 text-right text-zinc-200 text-[11px]"
            placeholder="0"
          />
        </td>
        <td className="px-2 py-2 text-right">
          <input
            type="number"
            value={draftQty}
            onChange={(e) => setDraftQty(e.target.value)}
            className="w-16 bg-[#111] border border-[#222] rounded px-1.5 py-0.5 text-right text-zinc-200 text-[11px]"
            placeholder="0"
          />
        </td>
        <td className="px-2 py-2 text-right">
          <input
            type="number"
            value={draftTarget}
            onChange={(e) => setDraftTarget(e.target.value)}
            className="w-14 bg-[#111] border border-[#222] rounded px-1.5 py-0.5 text-right text-zinc-200 text-[11px]"
            placeholder="0"
            max="100"
          />
        </td>
        <td className="px-2 py-2 text-center">
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={handleSave}
              disabled={updateHolding.isPending}
              className="p-1 text-[#0B6C3E] hover:bg-[#0B6C3E]/10 rounded transition-colors disabled:opacity-60"
              title="Salvar"
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              onClick={() => setEditing(false)}
              className="p-1 text-zinc-600 hover:bg-[#111] rounded transition-colors"
              title="Cancelar"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-[#141414] hover:bg-[#111] transition-colors">
      {row}
      <td className="px-2 py-2 text-right text-zinc-300">{fmt(holding.initial_investment)}</td>
      <td className="px-2 py-2 text-right text-zinc-400">
        {holding.quantity != null ? holding.quantity.toLocaleString("pt-BR") : "—"}
      </td>
      <td className="px-2 py-2 text-right text-zinc-400">
        {holding.target_allocation != null ? `${holding.target_allocation.toFixed(1)}%` : "—"}
      </td>
      <td className="px-2 py-2 text-center">
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => setEditing(true)}
            className="p-1 text-zinc-600 hover:text-[#0B6C3E] hover:bg-[#0B6C3E]/10 rounded transition-colors"
            title="Editar"
          >
            <Edit3 className="w-3 h-3" />
          </button>
          <button
            onClick={() => {
              if (confirm(`Remover "${holding.fund_name}" do portfólio?`)) onDelete();
            }}
            className="p-1 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
            title="Remover"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ═══════════════════ Add Holding Form ═══════════════════ */

function AddHoldingForm({
  portfolioId,
  onClose,
}: {
  portfolioId: string;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<FundSearchResult | null>(null);
  const [invested, setInvested] = useState("");
  const [quantity, setQuantity] = useState("");
  const [target, setTarget] = useState("");

  const { data: searchData, isLoading: searching } = useFundSearch(query, {
    enabled: !selected && query.trim().length >= 2,
    limit: 10,
  });
  const addHolding = useAddHolding();

  const handleAdd = async () => {
    if (!selected) return;
    const cnpjClass = selected.cnpj_fundo_classe ?? selected.cnpj_fundo;
    if (!cnpjClass) {
      alert("Fundo sem CNPJ válido.");
      return;
    }
    const payload: NewHoldingInput = {
      portfolio_id: portfolioId,
      cnpj_fundo_classe: cnpjClass,
      fund_slug: selected.slug ?? null,
      fund_name: selected.denom_social,
      classe_rcvm175: selected.classe_rcvm175 ?? null,
      initial_investment: invested ? Number(invested) : null,
      quantity: quantity ? Number(quantity) : null,
      target_allocation: target ? Number(target) : null,
    };
    try {
      await addHolding.mutateAsync(payload);
      onClose();
    } catch (e) {
      alert(`Erro ao adicionar: ${(e as Error).message}`);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#0d0d0d] border border-[#0B6C3E]/30 rounded-md p-3 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-zinc-200 font-mono">Adicionar Holding</h3>
        <button
          onClick={onClose}
          className="p-1 text-zinc-500 hover:text-zinc-300 rounded hover:bg-[#111]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {!selected ? (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar fundo por nome ou CNPJ..."
              className="w-full bg-[#111] border border-[#1a1a1a] rounded-md pl-8 pr-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 font-mono focus:outline-none focus:border-[#0B6C3E]/40"
            />
          </div>
          {query.length >= 2 && (
            <div className="max-h-60 overflow-y-auto border border-[#141414] rounded-md bg-[#0a0a0a] divide-y divide-[#141414]">
              {searching && (
                <div className="p-3 text-center text-[10px] text-zinc-600 font-mono">
                  Buscando...
                </div>
              )}
              {!searching && (!searchData || searchData.results.length === 0) && (
                <div className="p-3 text-center text-[10px] text-zinc-600 font-mono">
                  Nenhum fundo encontrado
                </div>
              )}
              {!searching &&
                searchData?.results.map((f) => (
                  <button
                    key={`${f.cnpj_fundo_classe ?? f.cnpj_fundo}-${f.slug ?? ""}`}
                    onClick={() => setSelected(f)}
                    className="w-full text-left px-3 py-2 hover:bg-[#0B6C3E]/5 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-1 h-3 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: classeColor(f.classe_rcvm175) }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] text-zinc-200 truncate">{f.denom_social}</div>
                        <div className="text-[9px] text-zinc-600 font-mono truncate">
                          {f.classe_rcvm175 ?? f.classe ?? "—"} · {f.gestor_nome ?? "—"}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start gap-2 bg-[#0B6C3E]/5 border border-[#0B6C3E]/20 rounded p-2">
            <div
              className="w-1 h-8 rounded-sm flex-shrink-0"
              style={{ backgroundColor: classeColor(selected.classe_rcvm175) }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-zinc-200 truncate font-mono">
                {selected.denom_social}
              </div>
              <div className="text-[9px] text-zinc-500 font-mono">
                {selected.classe_rcvm175 ?? "—"} · {selected.gestor_nome ?? "—"}
              </div>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="text-zinc-600 hover:text-zinc-300 text-[9px] underline font-mono"
            >
              trocar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Field label="Investido (R$)">
              <input
                type="number"
                value={invested}
                onChange={(e) => setInvested(e.target.value)}
                placeholder="10000"
                className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2 py-1.5 text-[11px] text-zinc-200 font-mono focus:outline-none focus:border-[#0B6C3E]/40"
              />
            </Field>
            <Field label="Quantidade (cotas)">
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2 py-1.5 text-[11px] text-zinc-200 font-mono focus:outline-none focus:border-[#0B6C3E]/40"
              />
            </Field>
            <Field label="Meta alocação (%)">
              <input
                type="number"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="20"
                max="100"
                className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2 py-1.5 text-[11px] text-zinc-200 font-mono focus:outline-none focus:border-[#0B6C3E]/40"
              />
            </Field>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-[11px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleAdd}
              disabled={addHolding.isPending}
              className="px-3 py-1.5 bg-[#0B6C3E] hover:bg-[#0A5D36] text-white rounded-md text-[11px] font-mono transition-colors disabled:opacity-60 flex items-center gap-1.5"
            >
              {addHolding.isPending ? "Salvando..." : (
                <>
                  <Plus className="w-3 h-3" />
                  Adicionar
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

/* ═══════════════════ Allocation Block ═══════════════════ */

function AllocationBlock({
  summary,
  holdings,
}: {
  summary: ReturnType<typeof usePortfolioSummary>;
  holdings: PortfolioHolding[];
}) {
  const fmt = useFormatBRL();

  const pieData = useMemo(
    () =>
      Object.entries(summary.byClasse)
        .map(([classe, v]) => ({
          name: classe,
          value: v.invested,
          count: v.count,
          pct: v.pct,
        }))
        .sort((a, b) => b.value - a.value),
    [summary]
  );

  if (holdings.length === 0) {
    return (
      <div className="bg-[#0d0d0d] border border-dashed border-[#1a1a1a] rounded-md p-6 text-center">
        <p className="text-xs text-zinc-500 font-mono">
          Adicione holdings para ver a alocação por classe.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="bg-[#0d0d0d] border border-[#141414] rounded-md p-3">
        <h3 className="text-[10px] font-mono text-zinc-500 uppercase mb-2">
          Distribuição por Classe
        </h3>
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={45}
                paddingAngle={2}
              >
                {pieData.map((d) => (
                  <Cell key={d.name} fill={classeColor(d.name)} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0a0a0a",
                  border: "1px solid #1a1a1a",
                  borderRadius: "4px",
                  fontSize: "11px",
                  fontFamily: "monospace",
                }}
                formatter={(v: number, _n, p) => [
                  `${fmt(v)} (${(p.payload as { pct: number }).pct.toFixed(1)}%)`,
                  p.payload.name,
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-[#0d0d0d] border border-[#141414] rounded-md p-3">
        <h3 className="text-[10px] font-mono text-zinc-500 uppercase mb-2">Breakdown</h3>
        <div className="space-y-1.5">
          {pieData.map((d) => (
            <div key={d.name} className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-[11px] font-mono">
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: classeColor(d.name) }}
                />
                <span className="flex-1 text-zinc-300">{d.name}</span>
                <span className="text-zinc-500">{d.count} fundo(s)</span>
                <span className="text-zinc-200 w-20 text-right">{fmt(d.value)}</span>
                <span className="text-zinc-600 w-12 text-right">{d.pct.toFixed(1)}%</span>
              </div>
              <div className="h-1 bg-[#111] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${d.pct}%`,
                    backgroundColor: classeColor(d.name),
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════ Targets Block ═══════════════════ */

function TargetsBlock({
  holdings,
  summary,
}: {
  holdings: PortfolioHolding[];
  summary: ReturnType<typeof usePortfolioSummary>;
}) {
  const withTarget = holdings.filter((h) => h.target_allocation != null);

  const rows = useMemo(
    () =>
      withTarget.map((h) => {
        const actual =
          summary.totalInvested > 0
            ? ((Number(h.initial_investment) || 0) / summary.totalInvested) * 100
            : 0;
        const target = Number(h.target_allocation) || 0;
        const diff = actual - target;
        return {
          id: h.id,
          name: h.fund_name,
          classe: h.classe_rcvm175,
          actual,
          target,
          diff,
        };
      }),
    [withTarget, summary.totalInvested]
  );

  if (withTarget.length === 0) {
    return (
      <div className="bg-[#0d0d0d] border border-dashed border-[#1a1a1a] rounded-md p-6 text-center">
        <AlertCircle className="w-5 h-5 text-zinc-600 mx-auto mb-2" />
        <p className="text-xs text-zinc-500 font-mono">
          Nenhum holding tem meta de alocação definida.
        </p>
        <p className="text-[10px] text-zinc-600 font-mono mt-1">
          Edite um holding e defina uma meta % para rastrear desvios.
        </p>
      </div>
    );
  }

  const totalTarget = summary.targetSum;
  const targetWarning = Math.abs(totalTarget - 100) > 0.5;

  const chartData = rows.map((r) => ({
    name: r.name.length > 22 ? r.name.slice(0, 22) + "…" : r.name,
    Atual: Number(r.actual.toFixed(2)),
    Meta: Number(r.target.toFixed(2)),
  }));

  return (
    <div className="space-y-3">
      {targetWarning && (
        <div className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/20 rounded-md p-2.5 text-[11px] font-mono">
          <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-amber-400">
            Soma das metas = {totalTarget.toFixed(1)}% (esperado: 100%). Ajuste as metas para rebalancear corretamente.
          </p>
        </div>
      )}

      <div className="bg-[#0d0d0d] border border-[#141414] rounded-md p-3">
        <h3 className="text-[10px] font-mono text-zinc-500 uppercase mb-2">
          Atual vs. Meta (%)
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 40 }}>
              <CartesianGrid stroke="#141414" strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 9, fill: "#6b7280", fontFamily: "monospace" }}
                angle={-25}
                textAnchor="end"
                height={50}
                interval={0}
              />
              <YAxis
                tick={{ fontSize: 9, fill: "#6b7280", fontFamily: "monospace" }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0a0a0a",
                  border: "1px solid #1a1a1a",
                  borderRadius: "4px",
                  fontSize: "11px",
                  fontFamily: "monospace",
                }}
                formatter={(v: number) => `${v.toFixed(2)}%`}
              />
              <Legend wrapperStyle={{ fontSize: "10px", fontFamily: "monospace" }} />
              <Bar dataKey="Atual" fill="#0B6C3E" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Meta" fill="#3B82F6" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-[#0d0d0d] border border-[#141414] rounded-md overflow-x-auto">
        <table className="w-full text-[11px] font-mono">
          <thead>
            <tr className="border-b border-[#141414] text-zinc-600">
              <th className="text-left px-3 py-2 font-normal">Fundo</th>
              <th className="text-right px-2 py-2 font-normal">Atual</th>
              <th className="text-right px-2 py-2 font-normal">Meta</th>
              <th className="text-right px-2 py-2 font-normal">Desvio</th>
              <th className="text-center px-2 py-2 font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const absDiff = Math.abs(r.diff);
              const status =
                absDiff < 1 ? "aligned" : absDiff < 3 ? "minor" : "rebalance";
              const statusConfig = {
                aligned: { color: "text-[#22C55E]", label: "Alinhado" },
                minor: { color: "text-amber-400", label: "Ajustar" },
                rebalance: { color: "text-red-400", label: "Rebalancear" },
              }[status];
              return (
                <tr key={r.id} className="border-b border-[#141414] hover:bg-[#111]">
                  <td className="px-3 py-2 max-w-[240px]">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-1 h-4 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: classeColor(r.classe) }}
                      />
                      <span className="truncate text-zinc-300">{r.name}</span>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right text-zinc-300">{r.actual.toFixed(1)}%</td>
                  <td className="px-2 py-2 text-right text-zinc-400">{r.target.toFixed(1)}%</td>
                  <td
                    className={`px-2 py-2 text-right ${
                      r.diff > 0 ? "text-amber-400" : r.diff < 0 ? "text-blue-400" : "text-zinc-500"
                    }`}
                  >
                    {r.diff > 0 ? "+" : ""}
                    {r.diff.toFixed(1)}pp
                  </td>
                  <td className={`px-2 py-2 text-center ${statusConfig.color}`}>
                    {statusConfig.label}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════ KPI Card ═══════════════════ */

function KPICard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#0d0d0d] border border-[#141414] rounded-md p-2.5 flex items-center gap-2"
    >
      <div className="w-7 h-7 rounded-md bg-[#0B6C3E]/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-3.5 h-3.5 text-[#0B6C3E]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[9px] font-mono text-zinc-600 uppercase truncate">{label}</div>
        <div className="text-sm font-bold text-zinc-200 font-mono truncate">{value}</div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════ Field helper ═══════════════════ */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[9px] font-mono text-zinc-600 uppercase">{label}</span>
      {children}
    </label>
  );
}
