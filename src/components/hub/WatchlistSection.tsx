/**
 * WatchlistSection — "Minhas Acompanhadas" (V2 Sprint Beta)
 *
 * Lista as ofertas que o AAI marcou como acompanhadas (hub_user_watchlist_ofertas)
 * com join client-side em hub_ofertas_publicas para mostrar detalhes (emissor,
 * tipo, status, volume).
 *
 * Reutilizada como:
 *   - Página dedicada /ofertas/watchlist (OfertasWatchlist.tsx)
 *   - Section "Watchlist" dentro de OfertasRadar (após reorganização V2-4)
 */

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, ExternalLink, Trash2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  useWatchlistOfertas,
  useToggleWatch,
} from "@/hooks/useOfertasV2";
import type { OfertaPublica } from "@/hooks/useHubFundos";
import { formatBRL, formatDate } from "@/lib/format";
import { EmptyState } from "@/components/hub/EmptyState";
import { SkeletonTableRow } from "@/components/hub/SkeletonLoader";

const ACCENT = "#0B6C3E";

const STATUS_COLORS: Record<
  string,
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

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_COLORS[status] ?? STATUS_COLORS.arquivado;
  return (
    <span className={`px-2 py-0.5 text-[9px] font-mono border rounded ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

/** Hook: fetch ofertas details for a list of protocolos */
function useOfertasByProtocolos(protocolos: string[]) {
  return useQuery({
    queryKey: ["ofertas_by_protocolos", protocolos.slice().sort().join(",")],
    queryFn: async (): Promise<OfertaPublica[]> => {
      if (protocolos.length === 0) return [];
      const { data, error } = await supabase
        .from("hub_ofertas_publicas")
        .select("id, protocolo, numero_oferta, emissor_cnpj, emissor_nome, tipo_oferta, tipo_ativo, status, modalidade, valor_total, volume_final, data_protocolo, data_registro, data_inicio, data_encerramento, coordenador_lider, rating, serie, segmento, observacoes, source_url")
        .in("protocolo", protocolos);
      if (error) throw error;
      return (data as OfertaPublica[]) ?? [];
    },
    enabled: protocolos.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

/** Status priority: distribuição em curso > análise/concedido > histórico */
const STATUS_PRIORITY: Record<string, number> = {
  em_distribuicao: 0,
  em_analise: 1,
  concedido: 2,
  suspenso: 3,
  encerrado: 4,
  arquivado: 5,
  cancelado: 6,
};

export interface WatchlistSectionProps {
  /** Show heading + framing (default true). False = embed-only mode. */
  withHeader?: boolean;
  /** Limit visible rows (e.g. dashboard preview). Default: no limit. */
  limit?: number;
  className?: string;
}

export function WatchlistSection({
  withHeader = true,
  limit,
  className = "",
}: WatchlistSectionProps) {
  const {
    data: watchlist,
    isLoading: watchlistLoading,
    error: watchlistError,
  } = useWatchlistOfertas();

  const protocolos = useMemo(
    () => (watchlist ?? []).map((w) => w.protocolo),
    [watchlist],
  );

  const {
    data: ofertas,
    isLoading: ofertasLoading,
  } = useOfertasByProtocolos(protocolos);

  const { mutate: toggleWatch, isPending: removing } = useToggleWatch();

  /* Merge watchlist + ofertas + sort */
  const rows = useMemo(() => {
    if (!watchlist || !ofertas) return [];
    const ofertasMap = new Map(ofertas.map((o) => [o.protocolo, o]));
    const merged = watchlist
      .map((w) => {
        const oferta = ofertasMap.get(w.protocolo);
        return oferta ? { watchlist: w, oferta } : null;
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    merged.sort((a, b) => {
      const pa = STATUS_PRIORITY[a.oferta.status] ?? 99;
      const pb = STATUS_PRIORITY[b.oferta.status] ?? 99;
      if (pa !== pb) return pa - pb;
      return (b.watchlist.added_at ?? "").localeCompare(a.watchlist.added_at ?? "");
    });

    return limit ? merged.slice(0, limit) : merged;
  }, [watchlist, ofertas, limit]);

  const isLoading = watchlistLoading || (protocolos.length > 0 && ofertasLoading);

  /* ─── Loading ─── */
  if (isLoading) {
    return (
      <section
        className={`bg-[#0a0a0a] border rounded-lg p-5 ${className}`}
        style={{ borderColor: `${ACCENT}33` }}
      >
        {withHeader && (
          <header className="flex items-center gap-2 mb-4">
            <Bookmark className="w-4 h-4" style={{ color: ACCENT }} />
            <h2 className="text-sm font-semibold text-zinc-200">Minhas ofertas acompanhadas</h2>
          </header>
        )}
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonTableRow key={i} cols={5} />
          ))}
        </div>
      </section>
    );
  }

  /* ─── Error ─── */
  if (watchlistError) {
    return (
      <section
        className={`bg-[#0a0a0a] border rounded-lg p-5 ${className}`}
        style={{ borderColor: `${ACCENT}33` }}
      >
        {withHeader && (
          <header className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <h2 className="text-sm font-semibold text-zinc-200">Erro ao carregar watchlist</h2>
          </header>
        )}
        <p className="text-[11px] font-mono text-red-400">
          Não foi possível carregar suas ofertas acompanhadas. Recarregue a página ou tente novamente em instantes.
        </p>
      </section>
    );
  }

  /* ─── Empty ─── */
  if (rows.length === 0) {
    return (
      <section
        className={`bg-[#0a0a0a] border rounded-lg p-5 ${className}`}
        style={{ borderColor: `${ACCENT}33` }}
      >
        {withHeader && (
          <header className="flex items-center gap-2 mb-4">
            <Bookmark className="w-4 h-4" style={{ color: ACCENT }} />
            <h2 className="text-sm font-semibold text-zinc-200">Minhas ofertas acompanhadas</h2>
          </header>
        )}
        <EmptyState
          variant="no-data"
          title="Nenhuma oferta acompanhada ainda"
          description="Abra a ficha de uma oferta e clique em 'Acompanhar' para começar a montar sua lista. Você também pode definir regras de alerta automático em /ofertas/alertas."
          ctaLabel="Ver ofertas em distribuição"
          ctaTo="/ofertas?status=em_distribuicao"
        />
      </section>
    );
  }

  /* ─── Render rows ─── */
  return (
    <section
      className={`bg-[#0a0a0a] border rounded-lg p-5 ${className}`}
      style={{ borderColor: `${ACCENT}33` }}
    >
      {withHeader && (
        <header className="flex items-center gap-2 mb-4 flex-wrap">
          <Bookmark className="w-4 h-4" style={{ color: ACCENT }} />
          <h2 className="text-sm font-semibold text-zinc-200">Minhas ofertas acompanhadas</h2>
          <span className="text-[9px] font-mono text-zinc-500 ml-1">
            {rows.length}{limit && rows.length === limit && watchlist && watchlist.length > limit ? ` de ${watchlist.length}` : ""}
          </span>
        </header>
      )}

      <ul className="divide-y divide-[#1a1a1a]">
        {rows.map(({ watchlist: w, oferta: o }) => (
          <li key={o.protocolo} className="py-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">
                    {o.tipo_ativo ?? "—"}
                  </span>
                  <StatusBadge status={o.status} />
                  {o.data_encerramento && (
                    <span className="text-[9px] font-mono text-zinc-600">
                      Encerrou em {formatDate(o.data_encerramento)}
                    </span>
                  )}
                </div>
                <Link
                  to={`/ofertas/${encodeURIComponent(o.protocolo)}`}
                  className="text-[12px] font-medium text-zinc-200 hover:text-[#0B6C3E] transition-colors block truncate"
                  title={o.emissor_nome ?? undefined}
                >
                  {o.emissor_nome ?? o.protocolo}
                </Link>
                <div className="mt-1 flex items-baseline gap-3 text-[10px] font-mono text-zinc-500 flex-wrap">
                  <span>Volume: <span className="text-zinc-300">{o.valor_total ? formatBRL(o.valor_total) : "—"}</span></span>
                  {o.coordenador_lider && (
                    <span>Coord.: <span className="text-zinc-400 truncate">{o.coordenador_lider}</span></span>
                  )}
                  <span>Adicionada {formatDate(w.added_at)}</span>
                </div>
                {w.notes && (
                  <p className="mt-1.5 text-[10px] font-mono text-zinc-500 italic line-clamp-2">
                    {w.notes}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Link
                  to={`/ofertas/${encodeURIComponent(o.protocolo)}`}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono border border-zinc-800 text-zinc-400 rounded hover:border-[#0B6C3E]/40 hover:text-[#0B6C3E] transition-colors"
                  aria-label={`Abrir ficha da oferta ${o.protocolo}`}
                >
                  Abrir
                  <ExternalLink className="w-2.5 h-2.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => toggleWatch({ protocolo: o.protocolo, currentlyWatched: true })}
                  disabled={removing}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono border border-zinc-800 text-zinc-500 rounded hover:border-red-500/40 hover:text-red-400 transition-colors disabled:opacity-50"
                  aria-label={`Remover ${o.protocolo} da watchlist`}
                  title="Remover da watchlist"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {limit && watchlist && watchlist.length > limit && (
        <footer className="mt-3 pt-3 border-t border-[#1a1a1a]">
          <Link
            to="/ofertas/watchlist"
            className="text-[10px] font-mono text-[#0B6C3E] hover:underline"
          >
            Ver todas {watchlist.length} ofertas acompanhadas →
          </Link>
        </footer>
      )}
    </section>
  );
}

export default WatchlistSection;
