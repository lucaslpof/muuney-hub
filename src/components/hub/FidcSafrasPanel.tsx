import { useMemo } from "react";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import { Sprout } from "lucide-react";
import type { FidcMonthlyItem } from "@/hooks/useHubFundos";
import { InlineEmpty } from "@/components/hub/EmptyState";

/**
 * FidcSafrasPanel — safras de concessão (vintage analysis).
 *
 * Mostra captação líquida por mês de competência (`vl_captacao_mes` da Tab I CVM).
 * Inspirado em fidcs.com.br: cada barra representa o "vintage" de uma safra mensal.
 *
 * Sem captação no mês = fundo fechado/sem chamada de capital. Padrão saudável:
 * captações episódicas em fundos abertos, ou pico inicial + amortizações posteriores.
 */

const ACCENT = "#F97316";
const POSITIVE = "#10B981"; // captação líquida positiva

interface Props {
  monthly: FidcMonthlyItem[];
  lookbackMonths?: number;
}

function fmtBRL(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  if (Math.abs(v) >= 1e9) return `R$ ${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `R$ ${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `R$ ${(v / 1e3).toFixed(0)}k`;
  return `R$ ${v.toFixed(0)}`;
}

function fmtMonth(dt: string): string {
  const m = dt.slice(5, 7);
  const y = dt.slice(2, 4);
  const labels = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${labels[parseInt(m, 10)] ?? m}/${y}`;
}

export function FidcSafrasPanel({ monthly, lookbackMonths = 24 }: Props) {
  const safras = useMemo(() => {
    if (!monthly || monthly.length === 0) return null;
    const sliced = monthly.slice(-lookbackMonths);

    const pts = sliced.map((m) => ({
      dt: m.dt_comptc,
      label: fmtMonth(m.dt_comptc),
      captacao: m.vl_captacao_mes ?? 0,
      qtCotas: m.qt_cotas_emitidas_mes ?? null,
      pl: m.vl_pl_total ?? null,
    }));

    const totalCaptado = pts.reduce((sum, p) => sum + (p.captacao > 0 ? p.captacao : 0), 0);
    const mesesComCaptacao = pts.filter((p) => p.captacao > 0).length;
    const mesesSemCaptacao = pts.filter((p) => p.captacao === 0).length;
    const mediaCaptacaoAtiva =
      mesesComCaptacao > 0 ? totalCaptado / mesesComCaptacao : 0;
    const ultimaCaptacao = [...pts].reverse().find((p) => p.captacao > 0);

    // % do PL atual representado por safras dos últimos 12m (proxy de "fundo aberto")
    const last12 = pts.slice(-12);
    const captadoUlt12 = last12.reduce((s, p) => s + (p.captacao > 0 ? p.captacao : 0), 0);
    const plAtual = pts[pts.length - 1]?.pl ?? null;
    const pctNovo12m = plAtual && plAtual > 0 ? (captadoUlt12 / plAtual) * 100 : null;

    return {
      pts,
      totalCaptado,
      mesesComCaptacao,
      mesesSemCaptacao,
      mediaCaptacaoAtiva,
      ultimaCaptacao,
      pctNovo12m,
    };
  }, [monthly, lookbackMonths]);

  if (!safras || !safras.pts.length) {
    return (
      <div
        className="bg-[#0a0a0a] border rounded-lg p-4"
        style={{ borderColor: `${ACCENT}33` }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Sprout className="w-4 h-4" style={{ color: ACCENT }} />
          <h3 className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
            Safras de Concessão (vintage)
          </h3>
        </div>
        <InlineEmpty text="Sem histórico mensal disponível para este FIDC." />
      </div>
    );
  }

  const todasZero = safras.totalCaptado === 0;

  return (
    <div
      className="bg-[#0a0a0a] border rounded-lg p-4 space-y-3"
      style={{ borderColor: `${ACCENT}33` }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <Sprout className="w-4 h-4" style={{ color: ACCENT }} />
        <h3 className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
          Safras de Concessão (vintage)
        </h3>
        <span className="text-[9px] font-mono text-zinc-600">
          Captação líquida mensal · CVM Inf Mensal Tab I
        </span>
      </div>

      {todasZero ? (
        <InlineEmpty text="FIDC fechado — sem captação no horizonte. Padrão típico de fundos com cessão única ou em amortização." />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <KPI label="Total captado" value={fmtBRL(safras.totalCaptado)} sub={`${lookbackMonths}m`} />
            <KPI label="Meses ativos" value={`${safras.mesesComCaptacao}`} sub={`${safras.mesesSemCaptacao} sem captação`} />
            <KPI
              label="Última safra"
              value={
                safras.ultimaCaptacao
                  ? safras.ultimaCaptacao.label
                  : "—"
              }
              sub={
                safras.ultimaCaptacao
                  ? fmtBRL(safras.ultimaCaptacao.captacao)
                  : undefined
              }
            />
            <KPI
              label="Novo capital ÷ PL (12m)"
              value={safras.pctNovo12m != null ? `${safras.pctNovo12m.toFixed(1)}%` : "—"}
              color={
                safras.pctNovo12m == null
                  ? "text-zinc-500"
                  : safras.pctNovo12m > 30
                    ? "text-emerald-400"
                    : safras.pctNovo12m > 5
                      ? "text-amber-400"
                      : "text-zinc-400"
              }
              sub={
                safras.pctNovo12m != null && safras.pctNovo12m > 30
                  ? "fundo em crescimento"
                  : safras.pctNovo12m != null && safras.pctNovo12m < 5
                    ? "fundo maduro"
                    : undefined
              }
            />
          </div>

          <div className="bg-[#111] border border-[#1a1a1a] rounded p-3">
            <h4 className="text-[10px] font-mono uppercase text-zinc-500 mb-2">
              Captação por mês — últimos {Math.min(lookbackMonths, safras.pts.length)} meses
            </h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={safras.pts} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: "#71717a" }}
                  axisLine={{ stroke: "#27272a" }}
                  interval="preserveStartEnd"
                  minTickGap={20}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "#71717a" }}
                  axisLine={{ stroke: "#27272a" }}
                  width={48}
                  tickFormatter={(v: number) =>
                    Math.abs(v) >= 1e9 ? `${(v / 1e9).toFixed(1)}B` : `${(v / 1e6).toFixed(0)}M`
                  }
                />
                <Tooltip
                  contentStyle={{ background: "#09090b", border: "1px solid #27272a", fontSize: 11 }}
                  formatter={(v: number) => [fmtBRL(v), "Captação"]}
                  labelFormatter={(label: string) => label}
                />
                <ReferenceLine y={0} stroke="#71717a" />
                <Bar
                  dataKey="captacao"
                  fill={POSITIVE}
                  fillOpacity={0.7}
                  stroke={POSITIVE}
                  strokeWidth={1}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      <p className="text-[8px] font-mono text-zinc-700 leading-relaxed">
        <strong>Leitura:</strong> Cada barra = "safra" mensal de concessão de novo capital ao fundo.
        Fundos fechados não captam (todas zero). Fundos abertos podem mostrar safras periódicas.
        Pico isolado em fundo maduro = nova chamada de capital. Fonte: Tab I do CVM Inf Mensal FIDC.
      </p>
    </div>
  );
}

interface KPIProps {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}

function KPI({ label, value, sub, color = "text-zinc-200" }: KPIProps) {
  return (
    <div className="bg-[#111] border border-[#1a1a1a] rounded p-2.5">
      <div className="text-[8px] font-mono uppercase tracking-wider text-zinc-600 mb-1">
        {label}
      </div>
      <div className={`text-sm font-semibold font-mono ${color}`}>{value}</div>
      {sub && <div className="text-[8px] font-mono text-zinc-700 mt-0.5">{sub}</div>}
    </div>
  );
}
