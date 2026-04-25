/**
 * OfertaDetalhe — Ficha individual de oferta pública (V2 Sprint Beta 25-30/04/2026)
 *
 * Rota: /ofertas/:protocolo
 *
 * 6 blocos:
 *   1. Header           — emissor / tipo / status / volume / CTA Acompanhar
 *   2. Pricing          — cupom indicativo / spread / benchmark / remuneração
 *   3. Estrutura        — lastro / série / rating / garantias / subordinação
 *   4. Calendário       — protocolo → registro → book → reserva → liquidação
 *   5. Coordenador      — coordenador líder + mailto template
 *   6. Prospecto        — link CVM + summary placeholder (V3 LLM extract)
 *
 * Estado V2: hub_oferta_detalhes está vazio. Maioria dos campos render
 * empty states. V3 (post-beta) backfilla via LLM.
 */

import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Mail,
  ExternalLink,
  Calendar,
  Building2,
  TrendingUp,
  ShieldCheck,
  FileText,
  Info,
} from "lucide-react";
import { Breadcrumbs } from "@/components/hub/Breadcrumbs";
import { HubSEO } from "@/lib/seo";
import { SectionErrorBoundary } from "@/components/hub/SectionErrorBoundary";
import { EmptyState, InlineEmpty } from "@/components/hub/EmptyState";
import {
  useOfertaDetail,
  useOfertaFundLink,
  type OfertaPublica,
} from "@/hooks/useHubFundos";
import {
  useOfertaDetalhes,
  useIsWatched,
  useToggleWatch,
} from "@/hooks/useOfertasV2";
import { useAuth } from "@/hooks/useAuth";
import { formatBRL, formatDate } from "@/lib/format";

const ACCENT = "#0B6C3E";

/* ─── Status badge ─────────────────────────────────────────────────────── */

const STATUS_COLORS: Record<
  OfertaPublica["status"],
  { bg: string; text: string; label: string }
> = {
  em_analise: { bg: "bg-amber-500/10 border-amber-500/30", text: "text-amber-400", label: "Em análise" },
  concedido: { bg: "bg-cyan-500/10 border-cyan-500/30", text: "text-cyan-400", label: "Concedido" },
  em_distribuicao: { bg: "bg-emerald-500/10 border-emerald-500/30", text: "text-emerald-400", label: "Em distribuição" },
  encerrado: { bg: "bg-zinc-500/10 border-zinc-500/30", text: "text-zinc-400", label: "Encerrado" },
  cancelado: { bg: "bg-red-500/10 border-red-500/30", text: "text-red-400", label: "Cancelado" },
  arquivado: { bg: "bg-zinc-500/10 border-zinc-500/30", text: "text-zinc-500", label: "Arquivado" },
  suspenso: { bg: "bg-orange-500/10 border-orange-500/30", text: "text-orange-400", label: "Suspenso" },
};

function StatusBadge({ status }: { status: OfertaPublica["status"] }) {
  const cfg = STATUS_COLORS[status] ?? STATUS_COLORS.arquivado;
  return (
    <span className={`px-2 py-0.5 text-[10px] font-mono border rounded ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

/* ─── Block helpers ────────────────────────────────────────────────────── */

function Block({
  icon: Icon,
  title,
  subtitle,
  accent = ACCENT,
  children,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  subtitle?: string;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="bg-[#0a0a0a] border rounded-lg p-5"
      style={{ borderColor: `${accent}33` }}
    >
      <header className="flex items-center gap-2 mb-4 flex-wrap">
        <Icon className="w-4 h-4" style={{ color: accent }} aria-hidden="true" />
        <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>
        {subtitle && (
          <span className="text-[10px] font-mono text-zinc-500 ml-1">
            {subtitle}
          </span>
        )}
      </header>
      {children}
    </section>
  );
}

function FieldRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline gap-3 py-1.5 border-b border-[#1a1a1a] last:border-0">
      <div className="w-44 text-[10px] font-mono text-zinc-500 uppercase tracking-wider flex-shrink-0">
        {label}
      </div>
      <div className="flex-1 text-[12px] text-zinc-200 font-mono">
        {value !== null && value !== undefined && value !== "" ? value : (
          <span className="text-zinc-600 italic">— sem dados</span>
        )}
      </div>
      {hint && (
        <div className="text-[9px] font-mono text-zinc-700 max-w-[180px]">
          {hint}
        </div>
      )}
    </div>
  );
}

/* ─── Watch toggle button ──────────────────────────────────────────────── */

function WatchToggleButton({ protocolo }: { protocolo: string }) {
  const { user } = useAuth();
  const isWatched = useIsWatched(protocolo);
  const { mutate, isPending } = useToggleWatch();

  if (!user) return null;

  const Icon = isWatched ? BookmarkCheck : Bookmark;
  const label = isWatched ? "Acompanhando" : "Acompanhar";

  return (
    <button
      type="button"
      onClick={() => mutate({ protocolo, currentlyWatched: isWatched })}
      disabled={isPending}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono border rounded transition-colors disabled:opacity-50 ${
        isWatched
          ? "bg-[#0B6C3E]/15 border-[#0B6C3E]/40 text-[#0B6C3E] hover:bg-[#0B6C3E]/25"
          : "bg-zinc-900/40 border-zinc-700 text-zinc-300 hover:border-[#0B6C3E]/40"
      }`}
      aria-pressed={isWatched}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

/* ─── Calendar timeline ────────────────────────────────────────────────── */

interface CalendarEvent {
  label: string;
  date: string | null;
  done: boolean;
}

function CalendarTimeline({ events }: { events: CalendarEvent[] }) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <ol className="relative pl-6 space-y-3">
      {events.map((evt, idx) => {
        const isPast = evt.date && evt.date <= today;
        const dotColor = isPast ? "bg-emerald-500" : evt.date ? "bg-amber-500" : "bg-zinc-700";
        return (
          <li key={idx} className="relative">
            <div
              className={`absolute -left-[18px] top-1 w-2 h-2 rounded-full ${dotColor}`}
              aria-hidden="true"
            />
            {idx < events.length - 1 && (
              <div className="absolute -left-[14px] top-3 bottom-[-8px] w-px bg-zinc-800" />
            )}
            <div className="flex items-baseline gap-3">
              <span className="text-[11px] font-mono text-zinc-300 w-44">
                {evt.label}
              </span>
              <span className="text-[11px] font-mono text-zinc-500">
                {evt.date ? formatDate(evt.date) : <span className="italic text-zinc-700">— pendente</span>}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ─── Coordenador mailto template ──────────────────────────────────────── */

function buildMailtoTemplate(oferta: OfertaPublica): string {
  const subject = encodeURIComponent(
    `Interesse em participar da oferta ${oferta.numero_oferta ?? oferta.protocolo} — ${oferta.emissor_nome}`,
  );
  const body = encodeURIComponent(
    `Prezados,

Identifiquei a oferta pública abaixo via muuney.hub e gostaria de obter mais informações sobre as condições de participação:

  • Emissor: ${oferta.emissor_nome ?? "—"}
  • CNPJ: ${oferta.emissor_cnpj ?? "—"}
  • Tipo: ${oferta.tipo_ativo ?? "—"} (${oferta.tipo_oferta ?? "—"})
  • Protocolo CVM: ${oferta.protocolo}
  • Volume alvo: ${oferta.valor_total ? formatBRL(oferta.valor_total) : "—"}

Solicito o envio do prospecto, calendário detalhado de bookbuilding e indicativos de remuneração.

Atenciosamente,
[seu nome]
[seu escritório / código AAI]`,
  );
  return `mailto:?subject=${subject}&body=${body}`;
}

/* ─── Page ─────────────────────────────────────────────────────────────── */

export default function OfertaDetalhe() {
  const { protocolo } = useParams<{ protocolo: string }>();
  const protocoloDecoded = protocolo ? decodeURIComponent(protocolo) : null;

  const { data: detail, isLoading, error } = useOfertaDetail(protocoloDecoded);
  const { data: detalhes } = useOfertaDetalhes(protocoloDecoded);

  const oferta = detail?.oferta ?? null;
  const related = detail?.related ?? [];

  const { link: issuerFundLink } = useOfertaFundLink(
    oferta
      ? {
          tipo_ativo: oferta.tipo_ativo,
          emissor_nome: oferta.emissor_nome,
          emissor_cnpj: oferta.emissor_cnpj,
        }
      : null,
  );

  const calendarEvents = useMemo<CalendarEvent[]>(() => {
    if (!oferta) return [];
    return [
      { label: "Protocolo CVM", date: oferta.data_protocolo, done: !!oferta.data_protocolo },
      { label: "Registro CVM", date: oferta.data_registro, done: !!oferta.data_registro },
      { label: "Book — início", date: detalhes?.data_book_inicio ?? null, done: false },
      { label: "Book — fim", date: detalhes?.data_book_fim ?? null, done: false },
      { label: "Data reserva", date: detalhes?.data_reserva ?? null, done: false },
      { label: "Início distribuição", date: oferta.data_inicio, done: !!oferta.data_inicio },
      { label: "Liquidação", date: detalhes?.data_liquidacao ?? null, done: false },
      { label: "Encerramento", date: oferta.data_encerramento, done: !!oferta.data_encerramento },
    ];
  }, [oferta, detalhes]);

  /* ─── Loading / error / not-found ─── */
  if (isLoading) {
    return (
      <div className="px-4 md:px-8 py-6 max-w-6xl mx-auto">
        <Breadcrumbs items={[{ label: "Ofertas", to: "/ofertas" }, { label: "Carregando..." }]} />
        <div className="mt-6 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-32 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !oferta) {
    return (
      <div className="px-4 md:px-8 py-6 max-w-6xl mx-auto">
        <Breadcrumbs items={[{ label: "Ofertas", to: "/ofertas" }, { label: "Não encontrada" }]} />
        <div className="mt-12">
          <EmptyState
            variant="no-data"
            title="Oferta não encontrada"
            description={`Protocolo ${protocoloDecoded} não está disponível na base. Pode ter sido arquivado ou o link está incorreto.`}
            ctaLabel="Voltar para Ofertas"
            ctaTo="/ofertas"
          />
        </div>
      </div>
    );
  }

  const tipoLabel = oferta.tipo_ativo ?? "Oferta";

  return (
    <>
      <HubSEO
        title={`${oferta.emissor_nome ?? "Oferta"} — ${tipoLabel}`}
        description={`Ficha da oferta pública ${oferta.numero_oferta ?? oferta.protocolo} — ${oferta.emissor_nome ?? "emissor"} (${tipoLabel}). Volume ${oferta.valor_total ? formatBRL(oferta.valor_total) : "—"}, status ${STATUS_COLORS[oferta.status]?.label ?? oferta.status}.`}
        path={`/ofertas/${encodeURIComponent(oferta.protocolo)}`}
      />

      <div className="px-4 md:px-8 py-6 max-w-6xl mx-auto space-y-6">
        {/* Breadcrumbs + back link */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Breadcrumbs
            items={[
              { label: "Ofertas", to: "/ofertas" },
              { label: oferta.emissor_nome ?? oferta.protocolo },
            ]}
          />
          <Link
            to="/ofertas"
            className="inline-flex items-center gap-1.5 text-[11px] font-mono text-zinc-500 hover:text-[#0B6C3E] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            voltar
          </Link>
        </div>

        {/* ─── BLOCO 1: HEADER ─── */}
        <SectionErrorBoundary sectionName="Header">
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#0a0a0a] border rounded-lg p-6"
            style={{ borderColor: `${ACCENT}55` }}
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                    {oferta.tipo_ativo ?? "Oferta"} · {oferta.tipo_oferta ?? "—"}
                  </span>
                  <StatusBadge status={oferta.status} />
                  {issuerFundLink && (
                    <Link
                      to={issuerFundLink.href}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono border border-[#0B6C3E]/40 text-[#0B6C3E] rounded hover:bg-[#0B6C3E]/15"
                    >
                      Lâmina do fundo
                      <ExternalLink className="w-2.5 h-2.5" />
                    </Link>
                  )}
                </div>
                <h1 className="text-xl font-semibold text-zinc-100 mb-1 break-words">
                  {oferta.emissor_nome ?? "Emissor não identificado"}
                </h1>
                <p className="text-[11px] font-mono text-zinc-500">
                  Protocolo: <span className="text-zinc-300">{oferta.protocolo}</span>
                  {oferta.numero_oferta && (
                    <> · Nº oferta: <span className="text-zinc-300">{oferta.numero_oferta}</span></>
                  )}
                  {oferta.serie && (
                    <> · Série: <span className="text-zinc-300">{oferta.serie}</span></>
                  )}
                </p>
              </div>

              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <WatchToggleButton protocolo={oferta.protocolo} />
                <div className="text-right">
                  <div className="text-[9px] font-mono text-zinc-600 uppercase tracking-wider mb-1">
                    Volume alvo
                  </div>
                  <div className="text-2xl font-semibold font-mono text-[#0B6C3E]">
                    {oferta.valor_total ? formatBRL(oferta.valor_total) : "—"}
                  </div>
                  {oferta.volume_final !== null && oferta.volume_final !== oferta.valor_total && (
                    <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
                      Final: {formatBRL(oferta.volume_final)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.section>
        </SectionErrorBoundary>

        {/* ─── BLOCO 2: PRICING ─── */}
        <SectionErrorBoundary sectionName="Pricing">
          <Block icon={TrendingUp} title="Pricing" subtitle="Cupom · spread · benchmark">
            {detalhes ? (
              <div>
                <FieldRow label="Cupom indicativo" value={detalhes.cupom_indicativo} />
                <FieldRow label="Cupom mínimo" value={detalhes.cupom_min} />
                <FieldRow label="Cupom máximo" value={detalhes.cupom_max} />
                <FieldRow
                  label="Spread"
                  value={detalhes.spread_indicativo ? `${detalhes.spread_indicativo} bps` : null}
                />
                <FieldRow label="Remuneração" value={detalhes.remuneracao_tipo} />
                <FieldRow label="Indexador" value={detalhes.remuneracao_indice} />
                {detalhes.cupom_fechado && (
                  <FieldRow
                    label="Cupom fechado"
                    value={<span className="text-[#0B6C3E]">{detalhes.cupom_fechado}</span>}
                    hint={detalhes.pricing_fechado_at ? `Pricing em ${formatDate(detalhes.pricing_fechado_at)}` : undefined}
                  />
                )}
              </div>
            ) : (
              <InlineEmpty
                icon={<TrendingUp size={16} />}
                text="Pricing ainda não disponível — dados do prospecto serão extraídos via pipeline LLM (pós-launch)."
              />
            )}
          </Block>
        </SectionErrorBoundary>

        {/* ─── BLOCO 3: ESTRUTURA ─── */}
        <SectionErrorBoundary sectionName="Estrutura">
          <Block icon={ShieldCheck} title="Estrutura" subtitle="Lastro · garantias · rating · subordinação">
            <div>
              <FieldRow label="Tipo de oferta" value={oferta.tipo_oferta} />
              <FieldRow label="Modalidade" value={oferta.modalidade} />
              <FieldRow label="Segmento" value={oferta.segmento} />
              <FieldRow label="Série" value={oferta.serie} />
              <FieldRow
                label="Rating (CVM)"
                value={oferta.rating}
                hint={detalhes?.rating_agencia ? `Agência: ${detalhes.rating_agencia}` : undefined}
              />
              {detalhes && (
                <>
                  <FieldRow label="Lastro detalhado" value={detalhes.lastro_detalhe} />
                  <FieldRow label="Garantias" value={detalhes.garantias} />
                  <FieldRow
                    label="Subordinação"
                    value={detalhes.subordinacao_pct !== null ? `${detalhes.subordinacao_pct.toFixed(1)}%` : null}
                  />
                  <FieldRow
                    label="Prazo"
                    value={detalhes.prazo_meses ? `${detalhes.prazo_meses} meses` : null}
                  />
                  <FieldRow label="Amortização" value={detalhes.amortizacao} />
                  <FieldRow
                    label="Carência"
                    value={detalhes.carencia_meses ? `${detalhes.carencia_meses} meses` : null}
                  />
                </>
              )}
              {!detalhes && (
                <p className="mt-3 text-[10px] font-mono text-zinc-600 italic">
                  Lastro detalhado, garantias, prazo e amortização serão extraídos do prospecto via pipeline LLM (V3 — pós-launch).
                </p>
              )}
            </div>
          </Block>
        </SectionErrorBoundary>

        {/* ─── BLOCO 4: CALENDÁRIO ─── */}
        <SectionErrorBoundary sectionName="Calendário">
          <Block icon={Calendar} title="Calendário operacional" subtitle="Datas-chave do ciclo de vida da oferta">
            <CalendarTimeline events={calendarEvents} />
            <p className="mt-4 text-[9px] font-mono text-zinc-600 leading-snug">
              Datas de book, reserva e liquidação serão extraídas do prospecto na V3.
              Datas de protocolo / registro / início / encerramento vêm direto do registro CVM.
            </p>
          </Block>
        </SectionErrorBoundary>

        {/* ─── BLOCO 5: COORDENADOR ─── */}
        <SectionErrorBoundary sectionName="Coordenador">
          <Block icon={Building2} title="Coordenador & Distribuição">
            {oferta.coordenador_lider ? (
              <div className="space-y-3">
                <FieldRow label="Coordenador líder" value={oferta.coordenador_lider} />
                <FieldRow label="CNPJ emissor" value={oferta.emissor_cnpj} />
                <div className="pt-3 border-t border-[#1a1a1a] flex items-center gap-2 flex-wrap">
                  <a
                    href={buildMailtoTemplate(oferta)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono bg-[#0B6C3E]/15 border border-[#0B6C3E]/40 text-[#0B6C3E] rounded hover:bg-[#0B6C3E]/25 transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Gerar email para coordenador
                  </a>
                  <span className="text-[9px] font-mono text-zinc-600">
                    Abre cliente de email com template pré-preenchido — você adiciona o destinatário.
                  </span>
                </div>
              </div>
            ) : (
              <InlineEmpty
                icon={<Building2 size={16} />}
                text="Coordenador não informado — o registro CVM ainda não traz o coordenador líder desta oferta."
              />
            )}
          </Block>
        </SectionErrorBoundary>

        {/* ─── BLOCO 6: PROSPECTO ─── */}
        <SectionErrorBoundary sectionName="Prospecto">
          <Block icon={FileText} title="Prospecto & documentos">
            <div className="space-y-3">
              {oferta.source_url ? (
                <a
                  href={oferta.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[11px] font-mono text-zinc-300 hover:text-[#0B6C3E] transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Abrir registro CVM
                </a>
              ) : (
                <p className="text-[10px] font-mono text-zinc-600">
                  URL do registro CVM não disponível.
                </p>
              )}
              {detalhes?.prospecto_url && (
                <a
                  href={detalhes.prospecto_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[11px] font-mono text-zinc-300 hover:text-[#0B6C3E] transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Prospecto (PDF)
                </a>
              )}
              {detalhes?.anuncio_inicio_url && (
                <a
                  href={detalhes.anuncio_inicio_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[11px] font-mono text-zinc-300 hover:text-[#0B6C3E] transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Anúncio de início (PDF)
                </a>
              )}
              {!detalhes?.prospecto_url && !detalhes?.anuncio_inicio_url && (
                <div className="pt-2 text-[10px] font-mono text-zinc-600 italic">
                  PDF do prospecto / anúncio de início não foi indexado ainda.
                  Disponível no portal de Ofertas Públicas da CVM (gov.br).
                </div>
              )}
            </div>
          </Block>
        </SectionErrorBoundary>

        {/* ─── Related ofertas ─── */}
        {related.length > 0 && (
          <SectionErrorBoundary sectionName="Ofertas relacionadas">
            <Block icon={Info} title="Ofertas relacionadas" subtitle={`Mesmo emissor — ${related.length}`}>
              <ul className="divide-y divide-[#1a1a1a]">
                {related.map((r) => (
                  <li key={r.id} className="py-2 flex items-center gap-3">
                    <Link
                      to={`/ofertas/${encodeURIComponent(r.protocolo)}`}
                      className="flex-1 min-w-0 text-[11px] font-mono text-zinc-300 hover:text-[#0B6C3E] truncate"
                    >
                      {r.tipo_ativo} · {r.protocolo}
                    </Link>
                    <StatusBadge status={r.status} />
                    <span className="text-[10px] font-mono text-zinc-500 flex-shrink-0">
                      {r.valor_total ? formatBRL(r.valor_total) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </Block>
          </SectionErrorBoundary>
        )}
      </div>
    </>
  );
}
