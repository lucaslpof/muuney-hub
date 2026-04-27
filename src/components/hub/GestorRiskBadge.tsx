import { useState } from "react";
import { Shield, ShieldAlert, ChevronDown, ExternalLink } from "lucide-react";
import { useGestorSancoes } from "@/hooks/useHubFundos";

/**
 * GestorRiskBadge — banner cross-ref de processos sancionadores CVM via
 * fuzzy match (pg_trgm) com gestor_nome ou admin_nome.
 *
 * LIMITAÇÃO crítica: acusados PAS são em maioria pessoas físicas (diretores).
 * Match fuzzy pode pegar falsos positivos. Sempre exibir como "indício", não
 * como acusação direta. Cliente clica no NUP para verificar.
 *
 * Renderiza nada quando sem matches ou nome inválido.
 */

interface Props {
  /** Nome do gestor ou administrador (PJ). */
  nome: string | null;
  /** Tipo do nome — "gestor" ou "admin" (apenas label visual). */
  tipo?: "gestor" | "admin";
  /** Threshold de similarity (0-1). Default 0.45. */
  minSimilarity?: number;
}

function formatDate(dt: string): string {
  const [y, m, d] = dt.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

export function GestorRiskBadge({ nome, tipo = "gestor", minSimilarity = 0.45 }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useGestorSancoes(nome, { minSimilarity });

  if (isLoading || !data || data.length === 0) return null;

  // Stats agregados
  const exactMatches = data.filter((d) => d.match_type === "exato");
  const totalEmCurso = data.reduce((s, d) => s + d.em_curso, 0);
  const totalTlts = data.reduce((s, d) => s + d.tlts, 0);
  const hasEmCurso = totalEmCurso > 0;

  // Severidade
  const severityColor = hasEmCurso
    ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
    : exactMatches.length > 0
    ? "border-zinc-700 bg-zinc-900/40 text-zinc-400"
    : "border-zinc-800 bg-zinc-900/30 text-zinc-500";

  const Icon = hasEmCurso ? ShieldAlert : Shield;

  return (
    <div
      className={`rounded-md border ${severityColor} p-3 space-y-2`}
      role="region"
      aria-label="Processos administrativos sancionadores CVM relacionados ao gestor"
    >
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between gap-2 text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5" />
          <h3 className="text-[10px] font-mono uppercase tracking-wide font-semibold">
            Risco regulatório — CVM PAS
          </h3>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono">
          <span>
            {data.length} pessoa(s) com nome similar ·{" "}
            {totalEmCurso > 0 && <span className="text-amber-300">{totalEmCurso} em curso</span>}
            {totalEmCurso > 0 && totalTlts > 0 && " · "}
            {totalTlts > 0 && <span>{totalTlts} TLT(s)</span>}
          </span>
          <ChevronDown
            className={`w-3 h-3 transition-transform ${expanded ? "rotate-0" : "-rotate-90"}`}
          />
        </div>
      </button>

      {expanded && (
        <div className="space-y-2 pt-2 border-t border-zinc-800/40">
          <p className="text-[9px] font-mono text-zinc-600 leading-relaxed">
            <strong>Como interpretar:</strong> CVM publica acusados nominalmente (sem CNPJ).
            Match é por similaridade textual com {tipo === "gestor" ? "nome do gestor" : "nome do administrador"} (
            {nome}). PAS pode envolver pessoas físicas (diretores) e não a PJ. Use o NUP para
            verificar caso a caso no portal CVM.
          </p>

          <ul className="space-y-1.5">
            {data.slice(0, 5).map((d, i) => {
              const portalLink = `https://www.gov.br/cvm/pt-br/assuntos/regulados/comissao-de-valores-mobiliarios/processos-administrativos-sancionadores`;
              return (
                <li key={i} className="flex items-baseline justify-between gap-2 text-[10px] font-mono py-1 border-t border-zinc-800/30 first:border-0 first:pt-0">
                  <div className="flex-1 min-w-0">
                    <div className="text-zinc-300 truncate">{d.nome_acusado}</div>
                    <div className="text-[9px] text-zinc-600 truncate">
                      {d.match_type === "exato" ? (
                        <span className="text-emerald-400">match exato</span>
                      ) : (
                        <span>similaridade {(d.similarity * 100).toFixed(0)}%</span>
                      )}
                      {" · "}
                      {d.total_processos} proc.
                      {d.em_curso > 0 && <> · <span className="text-amber-300">{d.em_curso} em curso</span></>}
                      {d.tlts > 0 && <> · {d.tlts} TLT</>}
                      {d.ultima_movimentacao && <> · últ. mov. {formatDate(d.ultima_movimentacao)}</>}
                    </div>
                  </div>
                  <a
                    href={portalLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-500 hover:text-zinc-300 shrink-0 inline-flex items-center gap-0.5"
                    aria-label="Consultar processos CVM"
                    title={`NUP: ${d.nups[0] ?? "—"}`}
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
              );
            })}
            {data.length > 5 && (
              <li className="text-[9px] font-mono text-zinc-600 italic pt-1">
                + {data.length - 5} outros nomes com similaridade ≥ {(minSimilarity * 100).toFixed(0)}%
              </li>
            )}
          </ul>

          <p className="text-[9px] font-mono text-zinc-600 mt-1">
            Fonte: CVM Processos Administrativos Sancionadores · refresh semanal.
          </p>
        </div>
      )}
    </div>
  );
}
