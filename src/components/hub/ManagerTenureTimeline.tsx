/**
 * ManagerTenureTimeline.tsx — Manager tenure visualization for FundLamina (P1-6)
 *
 * Shows a horizontal timeline from fund constitution date to today, with:
 *   - Current manager as the active segment (length = tenure)
 *   - Gestor change events (from hub_fundos_insights) marked as orange dots
 *   - Tenure stats: total days + years
 *
 * Data sources:
 *   - meta.dt_const (fund creation), meta.gestor_nome, meta.cnpj_gestor
 *   - useInsightsForFund() → filter type="gestor_change"
 *
 * Since we don't have a full manager history table yet, we treat the current
 * manager as holding tenure since the oldest "gestor_change" insight (if any)
 * OR since dt_const (as a proxy). This is a visual approximation — a proper
 * timeline requires ingesting RCVM175 gestor change filings historically.
 */

import { useMemo } from "react";
import { Users, AlertTriangle } from "lucide-react";
import { useInsightsForFund, type FundInsight } from "@/hooks/useHubFundos";

interface Props {
  cnpj?: string | null;
  dt_const?: string | null;
  gestor_nome?: string | null;
  /** Optional accent color (class-specific tint). */
  accent?: string;
}

function parseDate(d?: string | null): Date | null {
  if (!d) return null;
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("pt-BR", { year: "numeric", month: "short" });
}

export function ManagerTenureTimeline({
  cnpj,
  dt_const,
  gestor_nome,
  accent = "#0B6C3E",
}: Props) {
  const { data: insightsData } = useInsightsForFund(cnpj ?? null);

  const gestorChanges: FundInsight[] = useMemo(() => {
    const all = insightsData?.insights ?? [];
    return all
      .filter((i) => i.tipo === "gestor_change")
      .sort((a, b) => (a.referencia_data ?? "").localeCompare(b.referencia_data ?? ""));
  }, [insightsData]);

  const constDate = parseDate(dt_const);
  const today = new Date();

  // Tenure start = most recent gestor_change date, or fund constitution
  const lastChangeDate = gestorChanges.length
    ? parseDate(gestorChanges[gestorChanges.length - 1].referencia_data)
    : null;
  const tenureStart = lastChangeDate ?? constDate;

  if (!tenureStart) {
    return null; // No data to render
  }

  const totalDays = constDate ? daysBetween(constDate, today) : 0;
  const tenureDays = daysBetween(tenureStart, today);
  const tenureYears = tenureDays / 365.25;
  const tenurePct =
    totalDays > 0 ? Math.min(100, Math.max(5, (tenureDays / totalDays) * 100)) : 100;

  // Position markers for each gestor_change event (% along the timeline)
  const markers = constDate
    ? gestorChanges
        .map((chg) => {
          const d = parseDate(chg.referencia_data);
          if (!d) return null;
          const days = daysBetween(constDate, d);
          const pct = totalDays > 0 ? (days / totalDays) * 100 : 0;
          return {
            date: d,
            label: chg.titulo || "Mudança de gestor",
            detail: chg.detalhe || null,
            pct,
          };
        })
        .filter((m): m is NonNullable<typeof m> => m != null)
    : [];

  return (
    <div className="bg-[#111111] border border-[#1a1a1a] rounded p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Users className="w-3.5 h-3.5" style={{ color: accent }} />
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
            Timeline do Gestor
          </span>
        </div>
        <div className="flex items-center gap-3 text-[9px] font-mono">
          <span className="text-zinc-600">
            Tenure atual:{" "}
            <span className="text-zinc-300 font-semibold">
              {tenureYears >= 1
                ? `${tenureYears.toFixed(1)} anos`
                : `${tenureDays} dias`}
            </span>
          </span>
          {gestorChanges.length > 0 && (
            <span className="text-amber-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {gestorChanges.length} mudança{gestorChanges.length > 1 ? "s" : ""} histórica
              {gestorChanges.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Timeline bar */}
      <div className="relative">
        <div className="h-6 bg-[#0a0a0a] border border-[#1a1a1a] rounded relative overflow-hidden">
          {/* Current tenure segment (from right) */}
          <div
            className="absolute right-0 top-0 h-full"
            style={{
              width: `${tenurePct}%`,
              backgroundColor: `${accent}20`,
              borderLeft: `2px solid ${accent}`,
            }}
          />

          {/* Gestor change markers */}
          {markers.map((m, i) => (
            <div
              key={i}
              className="absolute top-0 h-full w-0.5 bg-amber-500"
              style={{ left: `${m.pct}%` }}
              title={`${m.label} — ${formatDate(m.date)}`}
              aria-label={`Mudança de gestor em ${formatDate(m.date)}`}
            />
          ))}
        </div>

        {/* Axis labels */}
        <div className="flex justify-between text-[9px] font-mono text-zinc-600 mt-1">
          <span>{constDate ? formatDate(constDate) : "—"}</span>
          <span>{formatDate(today)}</span>
        </div>
      </div>

      {/* Current gestor name */}
      <div className="flex items-center justify-between text-[10px] font-mono pt-2 border-t border-[#1a1a1a]">
        <div className="min-w-0 flex-1">
          <span className="text-zinc-600 uppercase tracking-wider">Gestor atual: </span>
          <span className="text-zinc-300 font-semibold truncate">
            {gestor_nome || "—"}
          </span>
        </div>
        <span className="text-zinc-600 shrink-0">
          desde {formatDate(tenureStart)}
        </span>
      </div>

      {/* Disclaimer if no change history */}
      {gestorChanges.length === 0 && (
        <div className="text-[9px] font-mono text-zinc-700 italic">
          Histórico de mudanças limitado à janela de coleta (sem eventos detectados).
        </div>
      )}
    </div>
  );
}
