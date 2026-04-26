import { AlertTriangle, FileText, ExternalLink } from "lucide-react";
import { useFundEvents } from "@/hooks/useHubFundos";

/**
 * FundEventsBanner — banner Tech-Noir compacto exibindo eventos relevantes
 * recentes (últimos 30 dias) do fundo. Apenas atenção/crítico (severidade != info).
 *
 * Fonte: hub_fundos_eventos via useFundEvents hook.
 *
 * Renderiza nada quando sem eventos relevantes — silent footer.
 */

const TP_DOC_LABELS: Record<string, string> = {
  "FATO RELEV": "Fato Relevante",
  "REGUL FDO": "Alteração Regulamento",
  "EDITAL AGO": "Edital AGO",
  "EDITAL AED": "Edital AED",
  "AGO PROPOST ADM": "Proposta AGO",
  "AGE PROPOST ADM": "Proposta AGE",
  "AGO/AGE PROPADM": "Proposta AGO/AGE",
  "PROPOSTA ADMINI": "Proposta Administrador",
  "REL. RATING": "Mudança de Rating",
};

const SEV_COLORS: Record<string, string> = {
  attention: "border-amber-600/40 bg-amber-500/5 text-amber-400",
  critical: "border-red-600/40 bg-red-500/5 text-red-400",
};

interface Props {
  /** CNPJ_FUNDO_CLASSE — chave em hub_fundos_eventos */
  cnpj: string | null;
  /** Mostra mesmo eventos info (tp_doc=AGO, AVISO MERCADO etc). Default false. */
  includeInfo?: boolean;
  /** Janela em dias. Default 30. */
  days?: number;
  /** Max eventos exibidos. Default 5. */
  limit?: number;
}

function formatDate(dt: string): string {
  const [y, m, d] = dt.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

export function FundEventsBanner({ cnpj, includeInfo = false, days = 30, limit = 5 }: Props) {
  const { data, isLoading } = useFundEvents(cnpj, { days, limit: limit * 2 }); // fetch a bit more for filtering

  if (isLoading || !data) return null;

  const filtered = data.filter((e) => includeInfo || e.severidade !== "info").slice(0, limit);
  if (filtered.length === 0) return null;

  const hasCritical = filtered.some((e) => e.severidade === "critical");
  const hasAttention = filtered.some((e) => e.severidade === "attention");
  const wrapperColor = hasCritical
    ? SEV_COLORS.critical
    : hasAttention
    ? SEV_COLORS.attention
    : "border-zinc-800 bg-zinc-900/40 text-zinc-400";

  return (
    <div className={`rounded-md border ${wrapperColor} p-3`} role="region" aria-label="Eventos relevantes do fundo">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-3.5 h-3.5" />
        <h3 className="text-[10px] font-mono uppercase tracking-wide font-semibold">
          Eventos relevantes — últimos {days}d ({filtered.length})
        </h3>
      </div>
      <ul className="space-y-1.5">
        {filtered.map((e) => {
          const label = TP_DOC_LABELS[e.tp_doc] || e.tp_doc;
          return (
            <li key={e.id} className="flex items-baseline gap-2 text-[10px] font-mono">
              <span className="text-zinc-600 tabular-nums shrink-0">{formatDate(e.dt_receb)}</span>
              <FileText className="w-3 h-3 mt-0.5 shrink-0 text-zinc-500" />
              <span className="text-zinc-300 truncate flex-1">{label}</span>
              {e.link_arq && (
                <a
                  href={e.link_arq}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-500 hover:text-zinc-300 shrink-0 inline-flex items-center gap-0.5"
                  aria-label="Abrir documento CVM"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-[9px] font-mono text-zinc-600 mt-2">
        Fonte: CVM Eventual FI · severidade derivada por tp_doc.
      </p>
    </div>
  );
}
