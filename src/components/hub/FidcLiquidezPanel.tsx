import { useMemo } from "react";
import { Droplet } from "lucide-react";
import type { FidcMonthlyItem } from "@/hooks/useHubFundos";

/**
 * FidcLiquidezPanel — distribuição da liquidez por bucket temporal.
 *
 * Fonte: hub_fidc_mensal.vl_liquidez_{0d,30d,60d,90d,180d,360d,maior_360d}
 * (Tab V do CVM Inf Mensal — disponibilidade de caixa por horizonte de saque).
 *
 * Leitura: cotistas seniores típicos têm direito de saque com prazo X.
 * Concentração em "0d" = caixa imediato (saudável). Concentração em ">360d"
 * = recursos travados em direitos de longo prazo (risco de mismatch).
 */

const ACCENT = "#F97316";

const BUCKETS = [
  { key: "vl_liquidez_0d" as const, label: "Imediato (0d)", color: "#10B981" },
  { key: "vl_liquidez_30d" as const, label: "1-30d", color: "#22C55E" },
  { key: "vl_liquidez_60d" as const, label: "31-60d", color: "#84CC16" },
  { key: "vl_liquidez_90d" as const, label: "61-90d", color: "#FBBF24" },
  { key: "vl_liquidez_180d" as const, label: "91-180d", color: "#F59E0B" },
  { key: "vl_liquidez_360d" as const, label: "181-360d", color: "#F97316" },
  { key: "vl_liquidez_maior_360d" as const, label: "> 360d", color: "#EF4444" },
] as const;

interface Props {
  latest: FidcMonthlyItem | null | undefined;
}

function fmtBRL(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  if (Math.abs(v) >= 1e9) return `R$ ${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `R$ ${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `R$ ${(v / 1e3).toFixed(0)}k`;
  return `R$ ${v.toFixed(0)}`;
}

export function FidcLiquidezPanel({ latest }: Props) {
  const data = useMemo(() => {
    if (!latest) return null;
    const buckets = BUCKETS.map((b) => ({
      label: b.label,
      color: b.color,
      val: (latest[b.key] as number | null | undefined) ?? null,
    }));
    const total = buckets.reduce((s, b) => s + (b.val ?? 0), 0);
    if (total <= 0) return null;
    const max = Math.max(...buckets.map((b) => b.val ?? 0));

    // Score de mismatch: % imediato + 1-30d (saudável) vs >360d (travado)
    const liquidoImediato = (buckets[0].val ?? 0) + (buckets[1].val ?? 0);
    const travadoLongo = buckets[6].val ?? 0;
    const pctImediato = total > 0 ? (liquidoImediato / total) * 100 : 0;
    const pctTravado = total > 0 ? (travadoLongo / total) * 100 : 0;

    return { buckets, total, max, pctImediato, pctTravado };
  }, [latest]);

  if (!data) {
    return null; // silent — Tab V não declarada (FIDCs PME / cessão única omitem)
  }

  const score =
    data.pctTravado > 50
      ? { label: "alto travamento", color: "text-red-400" }
      : data.pctTravado > 25
        ? { label: "alguma concentração longa", color: "text-amber-400" }
        : data.pctImediato > 50
          ? { label: "alta liquidez", color: "text-emerald-400" }
          : { label: "perfil intermediário", color: "text-zinc-300" };

  return (
    <div
      className="bg-[#0a0a0a] border rounded-lg p-4 space-y-3"
      style={{ borderColor: `${ACCENT}33` }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <Droplet className="w-4 h-4" style={{ color: ACCENT }} />
        <h3 className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
          Liquidez por horizonte de saque
        </h3>
        <span className="text-[9px] font-mono text-zinc-600">
          Tab V CVM · cotas senior
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <KPI label="Total disponível" value={fmtBRL(data.total)} />
        <KPI
          label="Líquido até 30d"
          value={`${data.pctImediato.toFixed(1)}%`}
          color="text-emerald-400"
        />
        <KPI
          label="Travado > 360d"
          value={`${data.pctTravado.toFixed(1)}%`}
          color={
            data.pctTravado > 50
              ? "text-red-400"
              : data.pctTravado > 25
                ? "text-amber-400"
                : "text-zinc-300"
          }
        />
      </div>

      <div className="bg-[#111] border border-[#1a1a1a] rounded p-3">
        <div className="space-y-1.5">
          {data.buckets.map((b) => {
            const val = b.val ?? 0;
            const pct = data.total > 0 ? (val / data.total) * 100 : 0;
            const w = data.max > 0 ? (val / data.max) * 100 : 0;
            return (
              <div key={b.label} className="flex items-center gap-2 text-[10px] font-mono">
                <span className="text-zinc-500 w-20 flex-shrink-0">{b.label}</span>
                <div className="flex-1 bg-[#0a0a0a] rounded h-3 overflow-hidden">
                  <div
                    className="h-full rounded transition-all"
                    style={{ width: `${Math.max(w, 0.5)}%`, backgroundColor: b.color }}
                  />
                </div>
                <span className="text-zinc-300 w-20 text-right">
                  {val > 0 ? fmtBRL(val) : "—"}
                </span>
                <span className="text-zinc-500 w-12 text-right">
                  {val > 0 ? `${pct.toFixed(1)}%` : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[9px] font-mono text-zinc-600 leading-relaxed">
        <strong className={score.color}>{score.label}</strong>
        {" — "}
        Distribuição da liquidez disponível para resgates por bucket de horizonte (CVM Tab V).
        Concentração em &gt; 360d sinaliza descasamento entre prazo das cotas seniores e
        liquidez do fundo. FIDCs senior-de-curto-prazo devem ter &gt; 50% até 30 dias.
      </p>
    </div>
  );
}

interface KPIProps {
  label: string;
  value: string;
  color?: string;
}

function KPI({ label, value, color = "text-zinc-200" }: KPIProps) {
  return (
    <div className="bg-[#111] border border-[#1a1a1a] rounded p-2.5 sm:p-2">
      <div className="text-[8px] font-mono uppercase tracking-wider text-zinc-600 mb-1 truncate">
        {label}
      </div>
      <div className={`text-sm font-semibold font-mono ${color}`}>{value}</div>
    </div>
  );
}

