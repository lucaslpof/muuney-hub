import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Sparkles,
  Target,
  TrendingUp,
  Clock,
  Lock,
  Calendar,
  Globe,
  Factory,
  Building2,
  Wallet,
  ShieldCheck,
  Info,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import {
  useAltOpportunityDetail,
  useLogOpportunityView,
  CLASSE_LABELS,
  CLASSE_COLORS,
  STATUS_LABELS,
  STATUS_COLORS,
  PUBLICO_ALVO_LABELS,
  PERFIL_RISCO_LABELS,
  INTEREST_STATUS_LABELS,
  FAIXA_PATRIMONIO_LABELS,
  formatMoney,
  formatHorizonte,
  type AltOpportunityFull,
  type AltInterest,
} from "@/hooks/useAlternativos";
import { useAuth } from "@/hooks/useAuth";
import { SuitabilityGate } from "@/components/alternativos/SuitabilityGate";
import { MaterialsSection } from "@/components/alternativos/MaterialsSection";
import { InterestForm } from "@/components/alternativos/InterestForm";
import { HubSEO } from "@/lib/seo";
import { Breadcrumbs } from "@/components/hub/Breadcrumbs";
import { EmptyState } from "@/components/hub/EmptyState";
import { SkeletonPage } from "@/components/hub/SkeletonLoader";

/**
 * Ativos Alternativos — Lâmina de uma oportunidade.
 *
 * Rota: /alternativos/:slug · Pro-only (gated em App.tsx via ProRoute).
 *
 * Composição:
 *  - Header com classe/status badges + accent line colorida por classe
 *  - Grid de metadados (ticket, horizonte, rentab alvo, público, perfil, setor, geografia, etc.)
 *  - Descrição longa + estratégia (prose)
 *  - MaterialsSection (gated por tier de acesso + interesse registrado)
 *  - InterestForm modal (trigger via CTA "Registrar interesse")
 *  - Meus interesses prévios nesta oportunidade
 *
 * Logging: view é registrada via useLogOpportunityView (fire-and-forget).
 */
export default function AlternativosDetail() {
  const { slug } = useParams<{ slug: string }>();

  return (
    <>
      <HubSEO
        title="Oportunidade Alternativa"
        description="Lâmina de oportunidade alternativa — ticket, horizonte, perfil, materiais gated e registro de interesse."
        path={slug ? `/alternativos/${slug}` : "/alternativos"}
        isProtected
      />
      <SuitabilityGate>
        <AlternativosDetailContent slug={slug} />
      </SuitabilityGate>
    </>
  );
}

function AlternativosDetailContent({ slug }: { slug: string | undefined }) {
  const { user } = useAuth();
  const { data, isLoading, isError, error, refetch } = useAltOpportunityDetail(slug);
  const logView = useLogOpportunityView();

  const [interestFormOpen, setInterestFormOpen] = useState(false);

  /* Fire-and-forget view logging on mount when opportunity loads */
  useEffect(() => {
    const id = data?.opportunity?.id;
    if (!id) return;
    logView.mutate({ opportunity_id: id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.opportunity?.id]);

  if (isLoading) {
    return (
      <div className="px-4 md:px-8 py-6">
        <SkeletonPage />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="px-4 md:px-8 py-6 flex flex-col items-center gap-4">
        <EmptyState
          variant="section-error"
          title="Não foi possível carregar a oportunidade"
          description={
            error instanceof Error
              ? error.message
              : "Verifique sua conexão e tente novamente. Se o problema persistir, avise a equipe muuney."
          }
        />
        <button
          type="button"
          onClick={() => refetch()}
          className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider rounded border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const { opportunity, materials, my_interests, has_interest_registered } = data;
  const accent = CLASSE_COLORS[opportunity.classe] ?? "#0B6C3E";
  const statusColor = STATUS_COLORS[opportunity.status] ?? "#6B7280";

  return (
    <div className="flex flex-col gap-5 px-4 md:px-8 py-6">
      <Breadcrumbs
        items={[
          { label: "Ativos Alternativos", to: "/alternativos" },
          { label: opportunity.titulo },
        ]}
      />

      {/* Back link (mobile-friendly) */}
      <Link
        to="/alternativos"
        className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-500 hover:text-zinc-200 w-fit"
      >
        <ArrowLeft className="w-3 h-3" />
        Voltar ao catálogo
      </Link>

      {/* ─── Header ─── */}
      <header
        className="relative rounded-lg border border-zinc-800/60 bg-[#0c0c0c] overflow-hidden"
        style={{ boxShadow: `inset 0 1px 0 0 ${accent}30` }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: accent }}
          aria-hidden
        />
        <div className="p-5 md:p-6">
          {/* Badges row */}
          <div className="flex items-center flex-wrap gap-2 mb-3">
            <span
              className="text-[9px] font-mono uppercase tracking-wider rounded px-1.5 py-0.5"
              style={{
                background: `${accent}20`,
                color: accent,
                border: `1px solid ${accent}40`,
              }}
            >
              {CLASSE_LABELS[opportunity.classe]}
            </span>
            <span
              className="text-[9px] font-mono uppercase tracking-wider rounded px-1.5 py-0.5"
              style={{
                background: `${statusColor}15`,
                color: statusColor,
                border: `1px solid ${statusColor}35`,
              }}
            >
              {STATUS_LABELS[opportunity.status]}
            </span>
            {opportunity.destaque && (
              <span className="flex items-center gap-0.5 rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-amber-400 border border-amber-500/30">
                <Sparkles className="w-2.5 h-2.5" />
                Destaque
              </span>
            )}
            {opportunity.subclasse && (
              <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 rounded border border-zinc-800 px-1.5 py-0.5">
                {opportunity.subclasse}
              </span>
            )}
          </div>

          {/* Title + subtitle */}
          <h1 className="text-xl md:text-2xl font-semibold text-zinc-100 leading-tight">
            {opportunity.titulo}
          </h1>
          {opportunity.subtitulo && (
            <p className="mt-1 text-xs md:text-sm text-zinc-400">{opportunity.subtitulo}</p>
          )}

          {/* Partner line */}
          {opportunity.partner?.nome && (
            <div className="mt-3 flex items-center gap-2 text-[11px] text-zinc-500">
              <Building2 className="w-3 h-3 text-zinc-600" />
              <span className="font-mono uppercase tracking-wider text-zinc-400">
                {opportunity.partner.nome}
              </span>
              {opportunity.partner.tipo_gestora && (
                <span className="text-zinc-700">· {opportunity.partner.tipo_gestora}</span>
              )}
              {opportunity.partner.website && (
                <a
                  href={opportunity.partner.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-[#0B6C3E] hover:underline"
                >
                  website <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>
          )}

          {/* Resumo */}
          {opportunity.resumo && (
            <p className="mt-4 text-xs md:text-[13px] text-zinc-400 leading-relaxed max-w-3xl">
              {opportunity.resumo}
            </p>
          )}

          {/* CTA row */}
          <div className="mt-5 flex items-center flex-wrap gap-2">
            {has_interest_registered ? (
              <div className="inline-flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 text-emerald-300 text-[11px] font-mono uppercase tracking-wider px-3 py-2">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Interesse já registrado
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setInterestFormOpen(true)}
                disabled={opportunity.status === "encerrada"}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#0B6C3E] hover:bg-[#0B6C3E]/90 text-white text-xs font-medium px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Wallet className="w-3.5 h-3.5" />
                Registrar interesse
              </button>
            )}
            {opportunity.status === "encerrada" && (
              <span className="text-[10px] font-mono text-zinc-600">
                · Captação encerrada — não é mais possível registrar interesse
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ─── Metrics grid ─── */}
      <section
        aria-labelledby="metrics-heading"
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
      >
        <h2 id="metrics-heading" className="sr-only">
          Indicadores da oportunidade
        </h2>
        <Metric
          icon={<Target className="w-3 h-3 text-zinc-500" />}
          label="Ticket mínimo"
          value={formatMoney(opportunity.ticket_minimo, opportunity.moeda)}
        />
        <Metric
          icon={<Target className="w-3 h-3 text-zinc-500" />}
          label="Ticket máximo"
          value={formatMoney(opportunity.ticket_maximo, opportunity.moeda)}
        />
        <Metric
          icon={<TrendingUp className="w-3 h-3 text-zinc-500" />}
          label="Rentabilidade alvo"
          value={opportunity.rentabilidade_alvo ?? "—"}
        />
        <Metric
          icon={<Clock className="w-3 h-3 text-zinc-500" />}
          label="Horizonte"
          value={formatHorizonte(opportunity.horizonte_meses)}
        />
        <Metric
          icon={<Lock className="w-3 h-3 text-zinc-500" />}
          label="Público alvo"
          value={PUBLICO_ALVO_LABELS[opportunity.publico_alvo]}
        />
        <Metric
          icon={<ShieldCheck className="w-3 h-3 text-zinc-500" />}
          label="Perfil de risco"
          value={
            opportunity.perfil_risco
              ? PERFIL_RISCO_LABELS[opportunity.perfil_risco]
              : "—"
          }
        />
        <Metric
          icon={<Factory className="w-3 h-3 text-zinc-500" />}
          label="Setor"
          value={opportunity.setor ?? "—"}
        />
        <Metric
          icon={<Globe className="w-3 h-3 text-zinc-500" />}
          label="Geografia"
          value={opportunity.geografia ?? "—"}
        />
        <Metric
          icon={<Wallet className="w-3 h-3 text-zinc-500" />}
          label="Volume captação"
          value={formatMoney(opportunity.volume_captacao, opportunity.moeda)}
        />
        <Metric
          icon={<Calendar className="w-3 h-3 text-zinc-500" />}
          label="Abertura"
          value={formatDateLong(opportunity.data_abertura)}
        />
        <Metric
          icon={<Calendar className="w-3 h-3 text-zinc-500" />}
          label="Encerramento"
          value={formatDateLong(opportunity.data_encerramento)}
        />
        <Metric
          icon={<Info className="w-3 h-3 text-zinc-500" />}
          label="Moeda"
          value={opportunity.moeda}
        />
      </section>

      {/* ─── Tags ─── */}
      {opportunity.tags && opportunity.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {opportunity.tags.map((tag) => (
            <span
              key={tag}
              className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 rounded border border-zinc-800 px-1.5 py-0.5"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* ─── Grid: overview + sidebar ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
        {/* Left: descrição + estratégia + materiais */}
        <div className="space-y-4">
          <DescriptionPanel opportunity={opportunity} />

          <MaterialsSection
            materials={materials}
            hasInterestRegistered={has_interest_registered}
            onRequestInterest={() => setInterestFormOpen(true)}
          />
        </div>

        {/* Right: meus interesses + disclaimer */}
        <aside className="space-y-4">
          {my_interests.length > 0 && (
            <MyInterestsPanel interests={my_interests} />
          )}

          <RegulatoryPanel />
        </aside>
      </div>

      {/* ─── Interest form modal ─── */}
      <InterestForm
        open={interestFormOpen}
        onClose={() => setInterestFormOpen(false)}
        opportunity={{
          id: opportunity.id,
          titulo: opportunity.titulo,
          ticket_minimo: opportunity.ticket_minimo,
          moeda: opportunity.moeda,
        }}
        defaults={{
          aai_email: user?.email ?? undefined,
        }}
        onSubmitted={() => {
          setInterestFormOpen(false);
        }}
      />
    </div>
  );
}

/* ─── Sub-components ─── */

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800/60 bg-[#0c0c0c] p-3">
      <div className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-zinc-500 mb-1">
        {icon}
        {label}
      </div>
      <div className="text-xs font-semibold text-zinc-100 truncate">{value}</div>
    </div>
  );
}

function DescriptionPanel({ opportunity }: { opportunity: AltOpportunityFull }) {
  const hasDesc = !!opportunity.descricao_longa;
  const hasStrat = !!opportunity.estrategia;
  if (!hasDesc && !hasStrat) {
    return (
      <section className="rounded-lg border border-zinc-800/60 bg-[#0c0c0c] p-5">
        <h2 className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-2">
          Visão geral
        </h2>
        <p className="text-xs text-zinc-500 leading-relaxed">
          A gestora ainda não publicou descrição detalhada desta oportunidade. Registre
          interesse e receba materiais completos assim que disponíveis.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-zinc-800/60 bg-[#0c0c0c] p-5 space-y-4">
      {hasDesc && (
        <div>
          <h2 className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-2">
            Sobre a oportunidade
          </h2>
          <p className="text-xs md:text-[13px] text-zinc-300 leading-relaxed whitespace-pre-line">
            {opportunity.descricao_longa}
          </p>
        </div>
      )}
      {hasStrat && (
        <div>
          <h2 className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-2">
            Estratégia
          </h2>
          <p className="text-xs md:text-[13px] text-zinc-300 leading-relaxed whitespace-pre-line">
            {opportunity.estrategia}
          </p>
        </div>
      )}
    </section>
  );
}

function MyInterestsPanel({ interests }: { interests: AltInterest[] }) {
  const sorted = useMemo(
    () =>
      [...interests].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [interests],
  );

  return (
    <section className="rounded-lg border border-zinc-800/60 bg-[#0c0c0c] p-4">
      <header className="flex items-center gap-2 mb-3">
        <CheckCircle2 className="w-3.5 h-3.5 text-[#0B6C3E]" />
        <h2 className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
          Meus interesses nesta oportunidade
        </h2>
        <span className="text-[10px] font-mono text-zinc-600 ml-auto">
          {interests.length}
        </span>
      </header>
      <ul className="space-y-2">
        {sorted.map((int) => (
          <li
            key={int.id}
            className="rounded-md border border-zinc-800/60 bg-[#0a0a0a] p-2.5"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-semibold text-zinc-200 truncate">
                Cliente: {int.cliente_primeiro_nome}
              </span>
              <span className="ml-auto text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800/50 text-zinc-400">
                {INTEREST_STATUS_LABELS[int.status] ?? int.status}
              </span>
            </div>
            <div className="text-[10px] font-mono text-zinc-600">
              Faixa: {FAIXA_PATRIMONIO_LABELS[int.cliente_faixa_patrimonio]}
              {int.ticket_pretendido != null && (
                <>
                  {" · Ticket: "}
                  {formatMoney(int.ticket_pretendido)}
                </>
              )}
            </div>
            <div className="text-[10px] font-mono text-zinc-700 mt-0.5">
              Registrado {formatDateLong(int.created_at)}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RegulatoryPanel() {
  return (
    <section className="rounded-lg border border-zinc-800/50 bg-[#0a0a0a] p-4">
      <header className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400/80" />
        <h2 className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
          Aviso regulatório
        </h2>
      </header>
      <p className="text-[11px] text-zinc-500 leading-relaxed">
        A muuney.hub atua como <span className="text-zinc-300">vitrine informativa</span> e
        canal de lead-gen. Não distribuímos valores mobiliários nem captamos recursos. Ao
        registrar interesse, compartilhamos com a gestora apenas dados anonimizados (primeiro
        nome + faixa de patrimônio + ticket pretendido). Formalização e KYC/AML são
        conduzidos diretamente entre AAI e gestora.
      </p>
    </section>
  );
}

/* ─── Helpers ─── */

function formatDateLong(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
