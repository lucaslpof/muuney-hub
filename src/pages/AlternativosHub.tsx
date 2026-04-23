import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Gem, Sparkles, Grid3x3, Inbox, Info } from "lucide-react";
import {
  useAltOpportunities,
  useAltOpportunityStats,
  useAltOpportunityFilters,
  useAltMyInterests,
  CLASSE_COLORS,
  INTEREST_STATUS_LABELS,
  formatMoney,
  type AltClasse,
  type AltStatus,
  type AltInterest,
} from "@/hooks/useAlternativos";
import { SuitabilityGate } from "@/components/alternativos/SuitabilityGate";
import { OpportunityCard } from "@/components/alternativos/OpportunityCard";
import {
  OpportunityFilters,
  EMPTY_ALT_FILTERS,
  type AltFilterState,
} from "@/components/alternativos/OpportunityFilters";
import { HubSEO } from "@/lib/seo";
import { Breadcrumbs } from "@/components/hub/Breadcrumbs";
import { SkeletonKPI } from "@/components/hub/SkeletonLoader";
import { EmptyState } from "@/components/hub/EmptyState";
import { pickFromListOrNull } from "@/lib/queryParams";

/**
 * Ativos Alternativos — Hub (catálogo de oportunidades).
 *
 * Rota: /alternativos · Pro-only (gated em App.tsx via ProRoute).
 *
 * Antes de renderizar o catálogo, SuitabilityGate verifica se o AAI aceitou
 * a versão atual dos termos. Se não, renderiza modal bloqueador.
 *
 * Layout: stats hero + filter sidebar + grid de OpportunityCard + seção
 * "Meus interesses" (dropdown expandível).
 */
export default function AlternativosHub() {
  return (
    <>
      <HubSEO
        title="Ativos Alternativos"
        description="Vitrine curada de oportunidades alternativas para AAIs — private credit, private equity, real estate, ofertas restritas, club deals e offshore."
        path="/alternativos"
      />
      <SuitabilityGate>
        <AlternativosHubContent />
      </SuitabilityGate>
    </>
  );
}

function AlternativosHubContent() {
  const [searchParams, setSearchParams] = useSearchParams();

  /* ─── Filters state (with URL persistence) ─── */
  const initialClasse = pickFromListOrNull<AltClasse>(
    searchParams.get("classe"),
    [
      "private_credit",
      "private_equity",
      "real_estate",
      "ofertas_restritas",
      "club_deals",
      "offshore",
      "alt_liquidos",
    ],
  );
  const initialStatus = pickFromListOrNull<AltStatus>(
    searchParams.get("status"),
    ["em_breve", "captando", "encerrada", "pausada"],
  );
  const initialSearch = searchParams.get("q") ?? "";
  const initialDestaque = searchParams.get("destaque") === "1";

  const [filters, setFilters] = useState<AltFilterState>({
    ...EMPTY_ALT_FILTERS,
    search: initialSearch,
    classe: initialClasse,
    status: initialStatus,
    destaque: initialDestaque,
  });

  /* ─── Persist filters to URL ─── */
  useEffect(() => {
    const next: Record<string, string> = {};
    if (filters.search) next.q = filters.search;
    if (filters.classe) next.classe = filters.classe;
    if (filters.status) next.status = filters.status;
    if (filters.destaque) next.destaque = "1";
    setSearchParams(next, { replace: true });
  }, [filters.search, filters.classe, filters.status, filters.destaque, setSearchParams]);

  /* ─── Data ─── */
  const { data: statsData, isLoading: statsLoading } = useAltOpportunityStats();
  const { data: filtersData } = useAltOpportunityFilters();
  const { data: listData, isLoading: listLoading } = useAltOpportunities({
    classe: filters.classe,
    status: filters.status,
    publico_alvo: filters.publico_alvo,
    perfil_risco: filters.perfil_risco,
    setor: filters.setor || undefined,
    geografia: filters.geografia || undefined,
    search: filters.search || undefined,
    destaque: filters.destaque || undefined,
    orderBy: "destaque",
    order: "desc",
    limit: 60,
    offset: 0,
  });
  const { data: myInterestsData } = useAltMyInterests();

  const opportunities = listData?.data ?? [];
  const total = listData?.count ?? 0;
  const hasAnyFilter = useMemo(() => {
    return !!(
      filters.search ||
      filters.classe ||
      filters.status ||
      filters.publico_alvo ||
      filters.perfil_risco ||
      filters.setor ||
      filters.geografia ||
      filters.destaque
    );
  }, [filters]);

  const myInterests = myInterestsData?.data ?? [];

  /* ─── Stats derived ─── */
  const destaques = useMemo(
    () => opportunities.filter((o) => o.destaque).length,
    [opportunities],
  );

  return (
    <div className="flex flex-col gap-5 px-4 md:px-8 py-6">
      <Breadcrumbs items={[{ label: "Ativos Alternativos" }]} />

      {/* ─── Hero ─── */}
      <header className="rounded-lg border border-zinc-800/60 bg-gradient-to-br from-[#0c0c0c] via-[#0a0a0a] to-[#0c0c0c] p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[#0B6C3E]/10 border border-[#0B6C3E]/30">
            <Gem className="w-5 h-5 text-[#0B6C3E]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-mono uppercase tracking-wider text-[#0B6C3E]">
              Módulo · muuney.hub Pro
            </div>
            <h1 className="text-lg font-semibold text-zinc-100 mt-0.5">
              Ativos Alternativos
            </h1>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed max-w-2xl">
              Vitrine curada de oportunidades para AAIs — private credit, private equity,
              real estate, ofertas restritas, club deals e offshore. Cadastre interesse
              anonimizado e deixe que a gestora conduza a formalização com seu cliente.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <StatCard
            loading={statsLoading}
            label="Oportunidades ativas"
            value={statsData?.total?.toString() ?? "—"}
            sub={
              statsData?.captando != null
                ? `${statsData.captando} captando`
                : undefined
            }
            accent="#0B6C3E"
          />
          <StatCard
            loading={statsLoading}
            label="Volume agregado"
            value={formatMoney(statsData?.total_volume_captacao)}
            sub="Captação em andamento"
            accent="#F59E0B"
          />
          <StatCard
            loading={statsLoading}
            label="Classes disponíveis"
            value={String(statsData?.by_classe?.length ?? 0)}
            sub="Private credit, PE, real estate, …"
            accent="#8B5CF6"
          />
          <StatCard
            loading={false}
            label="Meus interesses"
            value={String(myInterests.length)}
            sub={
              myInterests.length > 0
                ? `${openInterests(myInterests)} em andamento`
                : "Nenhum ainda"
            }
            accent="#EC4899"
          />
        </div>
      </header>

      {/* ─── Meus interesses (strip) ─── */}
      {myInterests.length > 0 && (
        <MyInterestsStrip interests={myInterests} />
      )}

      {/* ─── Disclaimer regulatório ─── */}
      <div className="flex items-start gap-2 rounded-md border border-zinc-800/50 bg-[#0a0a0a] p-3">
        <Info className="w-3.5 h-3.5 text-zinc-500 mt-0.5 flex-shrink-0" />
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          A muuney.hub opera este módulo como <span className="text-zinc-300">vitrine informativa
          e canal de lead-gen</span> entre AAIs (CVM 35) e gestoras. A muuney não distribui valores
          mobiliários, não intermedeia ordens e não capta recursos. Ofertas restritas
          (CVM 160/476) são exibidas conforme enquadramento da gestora e filtro de público-alvo.
        </p>
      </div>

      {/* ─── Catalog ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        <div className="lg:sticky lg:top-4 lg:self-start">
          <OpportunityFilters
            filters={filters}
            onChange={setFilters}
            classesDisponiveis={filtersData?.classes}
            statusesDisponiveis={filtersData?.statuses}
            setoresDisponiveis={filtersData?.setores}
            geografiasDisponiveis={filtersData?.geografias}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Grid3x3 className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                {listLoading
                  ? "Carregando oportunidades…"
                  : `${opportunities.length} ${opportunities.length === 1 ? "oportunidade" : "oportunidades"}`}
                {total > opportunities.length && ` de ${total}`}
              </span>
              {destaques > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-400/80">
                  <Sparkles className="w-2.5 h-2.5" />
                  {destaques} destaque{destaques > 1 ? "s" : ""}
                </span>
              )}
            </div>
            {hasAnyFilter && (
              <button
                type="button"
                onClick={() => setFilters(EMPTY_ALT_FILTERS)}
                className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 hover:text-zinc-200"
              >
                Limpar filtros
              </button>
            )}
          </div>

          {listLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-zinc-800/60 bg-[#0c0c0c] p-4 h-[220px] animate-pulse"
                />
              ))}
            </div>
          ) : opportunities.length === 0 ? (
            <EmptyState
              variant={hasAnyFilter ? "no-results" : "no-data"}
              title={
                hasAnyFilter
                  ? "Nenhuma oportunidade com estes filtros"
                  : "Catálogo em construção"
              }
              description={
                hasAnyFilter
                  ? "Ajuste filtros ou limpe a seleção para ver mais resultados."
                  : "Primeiras oportunidades serão publicadas em breve. Volte depois ou entre em contato conosco para sugerir uma classe."
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {opportunities.map((o) => (
                <OpportunityCard key={o.id} opportunity={o} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function StatCard({
  label,
  value,
  sub,
  accent,
  loading,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: string;
  loading: boolean;
}) {
  if (loading) return <SkeletonKPI />;
  return (
    <div
      className="rounded-lg border border-zinc-800/60 bg-[#0a0a0a] p-3 border-l-2"
      style={{ borderLeftColor: accent }}
    >
      <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 mb-0.5">
        {label}
      </div>
      <div className="text-lg font-semibold text-zinc-100 font-mono">{value}</div>
      {sub && <div className="text-[10px] text-zinc-600 mt-0.5">{sub}</div>}
    </div>
  );
}

function MyInterestsStrip({ interests }: { interests: AltInterest[] }) {
  const [open, setOpen] = useState(false);
  const visible = open ? interests : interests.slice(0, 3);

  return (
    <section className="rounded-lg border border-zinc-800/60 bg-[#0c0c0c] p-3">
      <header className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <Inbox className="w-3.5 h-3.5 text-[#0B6C3E]" />
          <h2 className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
            Meus interesses registrados
          </h2>
          <span className="text-[10px] font-mono text-zinc-600">
            ({interests.length})
          </span>
        </div>
        {interests.length > 3 && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 hover:text-zinc-200"
          >
            {open ? "Recolher" : `Ver todos (${interests.length})`}
          </button>
        )}
      </header>
      <ul className="space-y-1.5">
        {visible.map((int) => (
          <li
            key={int.id}
            className="flex items-center gap-3 text-[11px] bg-[#0a0a0a] rounded-md border border-zinc-800/60 px-3 py-2"
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{
                background:
                  int.opportunity?.classe && CLASSE_COLORS[int.opportunity.classe]
                    ? CLASSE_COLORS[int.opportunity.classe]
                    : "#52525b",
              }}
            />
            <div className="min-w-0 flex-1">
              <div className="text-zinc-200 truncate">
                {int.opportunity?.titulo ?? "(oportunidade)"}
              </div>
              <div className="text-[10px] text-zinc-600 truncate">
                Cliente: {int.cliente_primeiro_nome} · Registrado em {formatDate(int.created_at)}
              </div>
            </div>
            <span className="text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-800/50 text-zinc-400 flex-shrink-0">
              {INTEREST_STATUS_LABELS[int.status] ?? int.status}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ─── Helpers ─── */

function openInterests(
  list: { status: string }[],
): number {
  return list.filter(
    (i) => !["fechado", "recusado", "desistiu"].includes(i.status),
  ).length;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return iso;
  }
}
