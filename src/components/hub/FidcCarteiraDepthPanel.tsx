/**
 * FidcCarteiraDepthPanel — Painel de profundidade da carteira FIDC.
 *
 * Renderiza 4 visualizações usando dados da v5 do ingest-cvm-data:
 *   1. KPIs prazo médio + duration + concentração (top 1/5 cedentes)
 *   2. Breakdown vencimento (6 buckets) — bar chart horizontal
 *   3. Rating SCR (BACEN 2682) — donut chart, devedor + operação
 *   4. Top 5 cedentes — tabela compacta
 *
 * Fonte: hub_fidc_mensal (V5 fields) + hub_fidc_concentracao.
 */

import { useMemo, useEffect, useState } from "react";
import { Clock, BarChart3, ShieldAlert, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { FidcMonthlyItem } from "@/hooks/useHubFundos";
import { fmtNum } from "@/lib/format";
import { InlineEmpty } from "@/components/hub/EmptyState";

const ACCENT_FIDC = "#F97316";

interface FidcCarteiraDepthPanelProps {
  latest: FidcMonthlyItem | null | undefined;
  cnpjFundo: string | null;
}

/* ─── Helpers ─────────────────────────────────────────────────────── */

function fmtDias(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (v >= 365) return `${fmtNum(v / 365, 2)} anos`;
  return `${fmtNum(v, 0)} dias`;
}

const VENC_BUCKETS_UI = [
  { key: "pct_vencimento_0_30d" as const, label: "0–30d", color: "#EF4444" },
  { key: "pct_vencimento_31_60d" as const, label: "31–60d", color: "#F59E0B" },
  { key: "pct_vencimento_61_180d" as const, label: "61–180d", color: "#FBBF24" },
  { key: "pct_vencimento_181_360d" as const, label: "181–360d", color: "#84CC16" },
  { key: "pct_vencimento_361_720d" as const, label: "361–720d", color: "#22C55E" },
  { key: "pct_vencimento_acima_720d" as const, label: "> 720d", color: "#10B981" },
] as const;

const SCR_BUCKETS = [
  { rating: "AA", color: "#10B981", devedor: "scr_devedor_aa_pct" as const, oper: "scr_oper_aa_pct" as const },
  { rating: "A",  color: "#22C55E", devedor: "scr_devedor_a_pct"  as const, oper: "scr_oper_a_pct"  as const },
  { rating: "B",  color: "#84CC16", devedor: "scr_devedor_b_pct"  as const, oper: "scr_oper_b_pct"  as const },
  { rating: "C",  color: "#FBBF24", devedor: "scr_devedor_c_pct"  as const, oper: "scr_oper_c_pct"  as const },
  { rating: "D",  color: "#F59E0B", devedor: "scr_devedor_d_pct"  as const, oper: "scr_oper_d_pct"  as const },
  { rating: "E",  color: "#F97316", devedor: "scr_devedor_e_pct"  as const, oper: "scr_oper_e_pct"  as const },
  { rating: "F",  color: "#EF4444", devedor: "scr_devedor_f_pct"  as const, oper: "scr_oper_f_pct"  as const },
  { rating: "G",  color: "#DC2626", devedor: "scr_devedor_g_pct"  as const, oper: "scr_oper_g_pct"  as const },
  { rating: "H",  color: "#991B1B", devedor: "scr_devedor_h_pct"  as const, oper: "scr_oper_h_pct"  as const },
] as const;

/* ─── Panel ───────────────────────────────────────────────────────── */

export function FidcCarteiraDepthPanel({ latest, cnpjFundo }: FidcCarteiraDepthPanelProps) {
  /* ─ Top 5 cedentes via supabase direct query ─ */
  const [cedentes, setCedentes] = useState<Array<{ rank: number; pct_pl: number | null }>>([]);
  useEffect(() => {
    if (!cnpjFundo || !latest?.dt_comptc) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("hub_fidc_concentracao")
        .select("rank, pct_pl")
        .eq("cnpj_fundo", cnpjFundo)
        .eq("dt_comptc", latest.dt_comptc)
        .eq("tipo", "cedente")
        .order("rank", { ascending: true });
      if (cancelled) return;
      setCedentes((data ?? []) as any);
    })();
    return () => {
      cancelled = true;
    };
  }, [cnpjFundo, latest?.dt_comptc]);

  /* ─ Vencimento bars ─ */
  const vencData = useMemo(() => {
    if (!latest) return null;
    const items = VENC_BUCKETS_UI.map((b) => ({
      label: b.label,
      pct: (latest[b.key] as number | null | undefined) ?? null,
      color: b.color,
    }));
    const hasAny = items.some((i) => i.pct != null);
    if (!hasAny) return null;
    const max = Math.max(...items.map((i) => i.pct ?? 0), 1);
    return { items, max };
  }, [latest]);

  /* ─ SCR data ─ */
  const scrData = useMemo(() => {
    if (!latest) return null;
    const devedor = SCR_BUCKETS.map((s) => ({
      rating: s.rating,
      pct: (latest[s.devedor] as number | null | undefined) ?? null,
      color: s.color,
    }));
    const oper = SCR_BUCKETS.map((s) => ({
      rating: s.rating,
      pct: (latest[s.oper] as number | null | undefined) ?? null,
      color: s.color,
    }));
    const devTotal = devedor.reduce((acc, x) => acc + (x.pct ?? 0), 0);
    const operTotal = oper.reduce((acc, x) => acc + (x.pct ?? 0), 0);
    if (devTotal <= 0 && operTotal <= 0) return null;
    return { devedor, oper, devTotal, operTotal };
  }, [latest]);

  /* ─ Concentração de cedentes (top 5 stacked bar) ─ */
  const cedentesData = useMemo(() => {
    if (!latest) return null;
    const top1 = latest.pct_top1_cedente ?? null;
    const top5 = latest.pct_top5_cedentes ?? null;
    if (top1 == null && top5 == null && cedentes.length === 0) return null;
    const remaining = top5 != null && top1 != null ? top5 - top1 : null;
    return {
      top1,
      top5,
      remaining,
      list: cedentes.map((c) => ({ rank: c.rank, pct: c.pct_pl ?? 0 })),
    };
  }, [latest, cedentes]);

  /* ─ KPIs row ─ */
  const prazo = latest?.prazo_medio_dias ?? null;
  const duration = latest?.duration_dias ?? null;
  const top1 = latest?.pct_top1_cedente ?? null;
  const top5 = latest?.pct_top5_cedentes ?? null;

  const hasAnyData = prazo != null || duration != null || top1 != null || vencData || scrData;

  if (!hasAnyData) {
    return (
      <div
        className="bg-[#0a0a0a] border rounded-lg p-4"
        style={{ borderColor: `${ACCENT_FIDC}33` }}
      >
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-4 h-4" style={{ color: ACCENT_FIDC }} />
          <h3 className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
            Profundidade da Carteira
          </h3>
        </div>
        <InlineEmpty text="Sem dados de prazo/duration/SCR/cedentes para este FIDC. Esses campos vêm da Tab V/X/I do CVM Inf Mensal — alguns FIDCs (cessão única, fundos novos) não preenchem." />
      </div>
    );
  }

  return (
    <div
      className="bg-[#0a0a0a] border rounded-lg p-4 space-y-4"
      style={{ borderColor: `${ACCENT_FIDC}33` }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <BarChart3 className="w-4 h-4" style={{ color: ACCENT_FIDC }} />
        <h3 className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
          Profundidade da Carteira
        </h3>
        <span className="text-[9px] font-mono text-zinc-600">
          Tab V · Tab X · Tab I (CVM Inf Mensal)
        </span>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <KPI label="Prazo médio" value={fmtDias(prazo)} icon={Clock} color="text-zinc-200" />
        <KPI label="Duration (proxy)" value={fmtDias(duration)} icon={Clock} color="text-zinc-200" />
        <KPI
          label="Top 1 cedente"
          value={top1 != null ? `${fmtNum(top1, 1)}%` : "—"}
          icon={Building2}
          color={
            top1 == null
              ? "text-zinc-500"
              : top1 > 50
                ? "text-red-400"
                : top1 > 30
                  ? "text-amber-400"
                  : "text-emerald-400"
          }
          sublabel={top1 != null && top1 > 50 ? "concentração alta" : undefined}
        />
        <KPI
          label="Top 5 cedentes"
          value={top5 != null ? `${fmtNum(top5, 1)}%` : "—"}
          icon={Building2}
          color={
            top5 == null
              ? "text-zinc-500"
              : top5 > 80
                ? "text-red-400"
                : top5 > 60
                  ? "text-amber-400"
                  : "text-emerald-400"
          }
          sublabel={top5 != null && top5 > 80 ? "fonte concentrada" : undefined}
        />
      </div>

      {/* Breakdown Vencimento */}
      {vencData && (
        <div className="bg-[#111] border border-[#1a1a1a] rounded p-3">
          <h4 className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-2 flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            Breakdown vencimento (% PL a vencer)
          </h4>
          <div className="space-y-1.5">
            {vencData.items.map((b) => {
              const pct = b.pct ?? 0;
              const w = (pct / vencData.max) * 100;
              return (
                <div key={b.label} className="flex items-center gap-2 text-[10px] font-mono">
                  <span className="text-zinc-500 w-16 flex-shrink-0">{b.label}</span>
                  <div className="flex-1 bg-[#0a0a0a] rounded h-3 overflow-hidden">
                    <div
                      className="h-full rounded transition-all"
                      style={{ width: `${Math.max(w, 0.5)}%`, backgroundColor: b.color }}
                    />
                  </div>
                  <span className="text-zinc-300 w-12 text-right">
                    {b.pct != null ? `${fmtNum(b.pct, 1)}%` : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Rating SCR (BACEN 2682) */}
      {scrData && (
        <div className="bg-[#111] border border-[#1a1a1a] rounded p-3">
          <h4 className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-2 flex items-center gap-1.5">
            <ShieldAlert className="w-3 h-3" />
            Rating SCR (BACEN 2682) — % do PL
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ScrBar title="Por devedor" buckets={scrData.devedor} total={scrData.devTotal} />
            <ScrBar title="Por operação" buckets={scrData.oper} total={scrData.operTotal} />
          </div>
          <p className="text-[8px] font-mono text-zinc-700 mt-2 leading-relaxed">
            Resolução BACEN 2682 — AA (mínimo risco) → H (perda total). FIDC saudável tipicamente
            tem &gt;70% em AA-A. Acumulação em D-H sinaliza deterioração da carteira.
          </p>
        </div>
      )}

      {/* Top 5 Cedentes */}
      {cedentesData && cedentesData.list.length > 0 && (
        <div className="bg-[#111] border border-[#1a1a1a] rounded p-3">
          <h4 className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-2 flex items-center gap-1.5">
            <Building2 className="w-3 h-3" />
            Concentração — Top 5 Cedentes (% PL)
          </h4>
          <div className="space-y-1.5">
            {cedentesData.list.map((c) => {
              const pct = c.pct ?? 0;
              const w = Math.min((pct / 100) * 100, 100);
              const color =
                pct > 50 ? "#EF4444" : pct > 30 ? "#F59E0B" : "#22C55E";
              return (
                <div key={c.rank} className="flex items-center gap-2 text-[10px] font-mono">
                  <span className="text-zinc-500 w-12 flex-shrink-0">#{c.rank}</span>
                  <div className="flex-1 bg-[#0a0a0a] rounded h-3 overflow-hidden">
                    <div
                      className="h-full rounded transition-all"
                      style={{ width: `${Math.max(w, 0.5)}%`, backgroundColor: color }}
                    />
                  </div>
                  <span className="text-zinc-300 w-14 text-right">
                    {fmtNum(pct, 2)}%
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-[8px] font-mono text-zinc-700 mt-2 leading-relaxed">
            CVM Inf Mensal Tab I — apenas % nominais (sem nome do cedente).
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────────── */

interface KPIProps {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
  sublabel?: string;
}

function KPI({ label, value, icon: Icon, color = "text-zinc-200", sublabel }: KPIProps) {
  return (
    <div className="bg-[#111] border border-[#1a1a1a] rounded p-2.5">
      <div className="flex items-center gap-1 mb-1">
        <Icon className="w-2.5 h-2.5 text-zinc-600" />
        <span className="text-[8px] font-mono uppercase tracking-wider text-zinc-600">
          {label}
        </span>
      </div>
      <div className={`text-sm font-semibold font-mono ${color}`}>{value}</div>
      {sublabel && (
        <div className="text-[8px] font-mono text-zinc-700 mt-0.5">{sublabel}</div>
      )}
    </div>
  );
}

interface ScrBarProps {
  title: string;
  buckets: Array<{ rating: string; pct: number | null; color: string }>;
  total: number;
}

function ScrBar({ title, buckets, total }: ScrBarProps) {
  if (total <= 0) return <div className="text-[10px] font-mono text-zinc-700">{title}: sem dados</div>;
  return (
    <div>
      <div className="text-[9px] font-mono text-zinc-600 mb-1.5">
        {title} <span className="text-zinc-700">— {fmtNum(total, 1)}% mapeado</span>
      </div>
      <div className="flex h-4 rounded overflow-hidden border border-[#1a1a1a]">
        {buckets.map((b) => {
          const pct = b.pct ?? 0;
          if (pct <= 0) return null;
          const w = (pct / Math.max(total, 1)) * 100;
          return (
            <div
              key={b.rating}
              className="h-full"
              style={{ width: `${w}%`, backgroundColor: b.color }}
              title={`${b.rating}: ${fmtNum(pct, 2)}%`}
            />
          );
        })}
      </div>
      <div className="grid grid-cols-9 gap-0.5 mt-1.5">
        {buckets.map((b) => {
          const pct = b.pct ?? 0;
          return (
            <div
              key={b.rating}
              className="text-center"
              title={`${b.rating}: ${fmtNum(pct, 2)}%`}
            >
              <div
                className="text-[8px] font-mono"
                style={{ color: pct > 0 ? b.color : "#3F3F46" }}
              >
                {b.rating}
              </div>
              <div className="text-[8px] font-mono text-zinc-500">
                {pct > 0 ? `${fmtNum(pct, 0)}` : "·"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
