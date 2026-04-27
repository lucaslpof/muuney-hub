import { useState } from "react";
import { ScrollText, ChevronDown, AlertTriangle } from "lucide-react";
import { useFundLamina } from "@/hooks/useHubFundos";

/**
 * FundLaminaPolicyPanel — política de investimento, taxas, limites,
 * alavancagem e classe de risco extraídos da Lâmina mensal CVM.
 *
 * Fonte: hub_fundos_lamina (CVM lamina_fi_YYYYMM.zip — main CSV).
 * Renderiza nada quando sem dado para o fundo.
 */

interface Props {
  /** CNPJ_FUNDO_CLASSE — chave em hub_fundos_lamina */
  cnpj: string | null;
  /** Accent color hex (para borders, ex #0B6C3E, #F97316, #EC4899, #06B6D4). */
  accent?: string;
}

function fmtPct(v: number | null | undefined, digits = 2): string {
  if (v == null || !isFinite(v)) return "—";
  return `${v.toFixed(digits)}%`;
}

function fmtMoney(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e6) return `R$ ${(v / 1e6).toFixed(1)} mi`;
  if (abs >= 1e3) return `R$ ${(v / 1e3).toFixed(0)} k`;
  return `R$ ${v.toFixed(2)}`;
}

function fmtDays(v: number | null | undefined, tipo: string | null = null): string {
  if (v == null) return "—";
  const sufix = tipo?.toUpperCase().includes("UTEIS") || tipo?.toLowerCase().includes("útil")
    ? "dias úteis"
    : tipo?.toUpperCase().includes("CORRIDOS") || tipo?.toLowerCase().includes("corrido")
    ? "dias corridos"
    : "dias";
  return `${v} ${sufix}`;
}

export function FundLaminaPolicyPanel({ cnpj, accent = "#0B6C3E" }: Props) {
  const { data: lam, isLoading } = useFundLamina(cnpj);
  const [showFullPolitica, setShowFullPolitica] = useState(false);

  if (isLoading) {
    return <div className="h-32 bg-zinc-900/50 rounded-md animate-pulse" />;
  }

  if (!lam) {
    return null; // Lâmina não disponível para este fundo (fundo fechado/exclusivo/sem registro)
  }

  // Risco perda se não declarado, default zinc
  const riscoPerdaColor =
    lam.risco_perda?.toUpperCase() === "S"
      ? "text-amber-400"
      : lam.risco_perda?.toUpperCase() === "N"
      ? "text-zinc-500"
      : "text-zinc-400";

  return (
    <div
      className="rounded-md border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-4"
      role="region"
      aria-label="Lâmina CVM — política e taxas"
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ScrollText className="w-3.5 h-3.5" style={{ color: accent }} />
          <h3 className="text-[10px] font-mono uppercase tracking-wide text-zinc-300 font-semibold">
            Lâmina CVM — Política & Taxas
          </h3>
        </div>
        <span className="text-[9px] font-mono text-zinc-600">
          competência {lam.dt_comptc.split("-").reverse().join("/")}
        </span>
      </div>

      {/* KPI strip — Taxas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <KpiBox
          label="Taxa Adm."
          value={lam.taxa_adm != null ? fmtPct(lam.taxa_adm) : "—"}
          sub={
            lam.taxa_adm_min != null && lam.taxa_adm_max != null && lam.taxa_adm_max !== lam.taxa_adm_min
              ? `${fmtPct(lam.taxa_adm_min)}–${fmtPct(lam.taxa_adm_max)}`
              : lam.tp_taxa_adm || undefined
          }
        />
        <KpiBox
          label="Taxa Performance"
          value={lam.taxa_perfm ? "Sim" : "—"}
          sub={lam.taxa_perfm ? lam.taxa_perfm.slice(0, 50) + (lam.taxa_perfm.length > 50 ? "…" : "") : undefined}
        />
        <KpiBox
          label="Aplic. mín."
          value={fmtMoney(lam.invest_inicial_min)}
          sub={lam.resgate_min ? `Resg. mín.: ${fmtMoney(lam.resgate_min)}` : undefined}
        />
        <KpiBox
          label="Resgate"
          value={fmtDays(lam.qt_dia_pagto_resgate, lam.tp_dia_pagto_resgate)}
          sub={lam.qt_dia_conversao_cota_resgate != null ? `Conv. cota: ${lam.qt_dia_conversao_cota_resgate}d` : undefined}
        />
      </div>

      {/* Limites & Alavancagem */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <KpiBox label="Crédito Privado %" value={fmtPct(lam.pr_pl_ativo_cred_priv)} sub="máx do PL" small />
        <KpiBox label="Ativo Exterior %" value={fmtPct(lam.pr_pl_ativo_exterior)} sub="máx do PL" small />
        <KpiBox label="Alavancagem %" value={fmtPct(lam.pr_pl_alavanc)} sub="máx do PL" small />
        <KpiBox
          label="Concentração emissor"
          value={fmtPct(lam.pr_ativo_emissor)}
          sub="máx por emissor"
          small
        />
      </div>

      {/* Risco + benchmarks */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[10px] font-mono">
        <InfoRow label="Classe de risco" value={lam.classe_risco_admin || "—"} />
        <InfoRow
          label="Risco de perda"
          value={
            <span className={riscoPerdaColor}>
              {lam.risco_perda === "S" ? (
                <>
                  <AlertTriangle className="w-2.5 h-2.5 inline-block mr-0.5" />
                  Sim
                  {lam.risco_perda_negativo === "S" && " (saldo negativo)"}
                </>
              ) : lam.risco_perda === "N" ? (
                "Não"
              ) : (
                "—"
              )}
            </span>
          }
        />
        <InfoRow
          label="Benchmark"
          value={
            lam.indice_refer
              ? lam.indice_refer.length > 30
                ? lam.indice_refer.slice(0, 30) + "…"
                : lam.indice_refer
              : "—"
          }
        />
      </div>

      {/* Política de Investimento (collapsible) */}
      {(lam.objetivo || lam.polit_invest || lam.restr_invest) && (
        <div className="border-t border-zinc-800/40 pt-3">
          <button
            onClick={() => setShowFullPolitica((s) => !s)}
            className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wide text-zinc-400 hover:text-zinc-200 transition-colors"
            aria-expanded={showFullPolitica}
          >
            <ChevronDown
              className={`w-3 h-3 transition-transform ${showFullPolitica ? "rotate-0" : "-rotate-90"}`}
            />
            Política de investimento
          </button>
          {showFullPolitica && (
            <div className="mt-3 space-y-3 text-[11px] font-mono leading-relaxed text-zinc-400">
              {lam.objetivo && (
                <div>
                  <div className="text-[9px] uppercase text-zinc-600 mb-1">Objetivo</div>
                  <p className="whitespace-pre-wrap">{lam.objetivo}</p>
                </div>
              )}
              {lam.polit_invest && (
                <div>
                  <div className="text-[9px] uppercase text-zinc-600 mb-1">Política</div>
                  <p className="whitespace-pre-wrap">{lam.polit_invest}</p>
                </div>
              )}
              {lam.restr_invest && (
                <div>
                  <div className="text-[9px] uppercase text-zinc-600 mb-1">Restrições</div>
                  <p className="whitespace-pre-wrap">{lam.restr_invest}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <p className="text-[9px] font-mono text-zinc-600">
        Fonte: CVM Lâmina mensal · refresh mensal.
      </p>
    </div>
  );
}

function KpiBox({
  label,
  value,
  sub,
  small,
}: {
  label: string;
  value: string;
  sub?: string;
  small?: boolean;
}) {
  return (
    <div className="rounded-md border border-zinc-800/40 bg-zinc-900/30 p-2">
      <div className="text-[9px] font-mono uppercase text-zinc-600 truncate">{label}</div>
      <div className={`font-mono text-zinc-200 mt-0.5 ${small ? "text-xs" : "text-sm"}`}>{value}</div>
      {sub && <div className="text-[9px] font-mono text-zinc-600 truncate">{sub}</div>}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 px-2 py-1.5 rounded bg-zinc-900/30 border border-zinc-800/40">
      <span className="text-[9px] uppercase text-zinc-600 truncate">{label}</span>
      <span className="text-zinc-300 truncate">{value}</span>
    </div>
  );
}
