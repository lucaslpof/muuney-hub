/**
 * FiiPvpPayoutPanel — plot VP/cota histórico + payout proxy + despesas adm trend.
 *
 * P2-10 (19/04/2026).
 *
 * Data source: hub_fii_mensal via hub-fii-api (FiiMonthlyItem).
 * Available fields used: valor_patrimonial_cota, dividend_yield_mes,
 *   rentabilidade_patrimonial_mes, pct_despesas_adm.
 *
 * Scope note: CVM does NOT publish absolute P/VP (requires market price of cota
 * from B3 daily quotes, which is not in hub_fii_mensal). We plot:
 *   1. VP/cota absoluto (valor_patrimonial_cota) — book value per cota, primary.
 *   2. Payout proxy (DY_mês / rentab_patrim_mês × 100) — fraction of book
 *      return distributed as DY. Clipped to [0, 200] to mute extreme spikes
 *      from near-zero rentab_patrim denominators.
 *   3. Despesas adm histórico (pct_despesas_adm) — cost drag trend.
 *
 * Absolute P/VP deferred until B3 daily quotes are ingested.
 */
import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, ReferenceLine,
} from "recharts";
import { Gauge } from "lucide-react";
import type { FiiMonthlyItem } from "@/hooks/useHubFundos";

interface FiiPvpPayoutPanelProps {
  monthly: FiiMonthlyItem[];
  accent?: string;
}

export function FiiPvpPayoutPanel({ monthly, accent = "#EC4899" }: FiiPvpPayoutPanelProps) {
  const sorted = useMemo(
    () => [...monthly].sort((a, b) => (a.dt_comptc ?? "").localeCompare(b.dt_comptc ?? "")),
    [monthly],
  );

  const vpcSeries = useMemo(() => {
    return sorted
      .map((m) => ({
        date: m.dt_comptc,
        vpc: m.valor_patrimonial_cota != null ? Number(m.valor_patrimonial_cota) : null,
      }))
      .filter((d) => d.vpc != null && Number.isFinite(d.vpc as number));
  }, [sorted]);

  const payoutSeries = useMemo(() => {
    return sorted
      .map((m) => {
        const dy = m.dividend_yield_mes != null ? Number(m.dividend_yield_mes) : null;
        const rp = m.rentabilidade_patrimonial_mes != null ? Number(m.rentabilidade_patrimonial_mes) : null;
        if (dy == null || rp == null || Math.abs(rp) < 0.05) return { date: m.dt_comptc, payout: null as number | null };
        // Payout as % — how much of book-month return is distributed as DY.
        // Clip to [-50, 200] to mute extreme spikes from near-zero rentab_patrim.
        const raw = (dy / rp) * 100;
        const clipped = Math.max(-50, Math.min(200, raw));
        return { date: m.dt_comptc, payout: clipped };
      })
      .filter((d) => d.payout != null);
  }, [sorted]);

  const despesasSeries = useMemo(() => {
    return sorted
      .map((m) => ({
        date: m.dt_comptc,
        despesas: m.pct_despesas_adm != null ? Number(m.pct_despesas_adm) : null,
      }))
      .filter((d) => d.despesas != null && Number.isFinite(d.despesas as number));
  }, [sorted]);

  const vpcStats = useMemo(() => {
    if (vpcSeries.length < 2) return null;
    const first = vpcSeries[0].vpc as number;
    const last = vpcSeries[vpcSeries.length - 1].vpc as number;
    const delta = first !== 0 ? ((last - first) / first) * 100 : null;
    return { first, last, delta };
  }, [vpcSeries]);

  const payoutAvg = useMemo(() => {
    if (!payoutSeries.length) return null;
    const vals = payoutSeries.map((p) => p.payout as number).filter(Number.isFinite);
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [payoutSeries]);

  const despesasLatest = useMemo(() => {
    if (!despesasSeries.length) return null;
    return despesasSeries[despesasSeries.length - 1].despesas as number;
  }, [despesasSeries]);

  if (!vpcSeries.length && !payoutSeries.length && !despesasSeries.length) return null;

  return (
    <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4" style={{ color: accent }} />
          <h3 className="text-[10px] text-zinc-400 uppercase tracking-wider font-mono">
            VP/Cota · Payout · Despesas
          </h3>
        </div>
        <div className="text-[8px] text-zinc-600 font-mono hidden sm:block">
          {vpcStats && `VP Δ ${vpcStats.delta != null ? (vpcStats.delta >= 0 ? "+" : "") + vpcStats.delta.toFixed(2) + "%" : "—"}`}
          {payoutAvg != null && ` · Payout médio ${payoutAvg.toFixed(0)}%`}
          {despesasLatest != null && ` · Despesas atual ${despesasLatest.toFixed(2)}%`}
        </div>
      </div>

      <p className="text-[9px] text-zinc-600 font-mono leading-relaxed">
        Valor patrimonial por cota, payout proxy (DY mensal ÷ rentab. patrimonial mensal) e evolução de despesas administrativas.
        P/VP absoluto requer preço de cota em bolsa (não disponível via CVM).
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* VP/Cota chart */}
        {vpcSeries.length > 1 && (
          <div>
            <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-2">
              VP/Cota (R$)
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={vpcSeries} margin={{ top: 5, right: 8, left: -22, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#71717a" }} tickLine={false} axisLine={{ stroke: "#1a1a1a" }} />
                <YAxis tick={{ fontSize: 9, fill: "#71717a" }} axisLine={{ stroke: "#1a1a1a" }} domain={["auto", "auto"]} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#111111", border: "1px solid #1a1a1a", borderRadius: 4, fontSize: 10 }}
                  labelStyle={{ color: "#d4d4d8" }}
                  formatter={(v: number | string) => `R$ ${Number(v).toFixed(2)}`}
                />
                <Line
                  type="monotone"
                  dataKey="vpc"
                  stroke={accent}
                  dot={false}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Payout proxy chart */}
        {payoutSeries.length > 1 && (
          <div>
            <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-2">
              Payout Proxy (%)
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={payoutSeries} margin={{ top: 5, right: 8, left: -22, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#71717a" }} tickLine={false} axisLine={{ stroke: "#1a1a1a" }} />
                <YAxis tick={{ fontSize: 9, fill: "#71717a" }} axisLine={{ stroke: "#1a1a1a" }} />
                <ReferenceLine y={100} stroke="#3f3f46" strokeDasharray="4 2" />
                <Tooltip
                  contentStyle={{ backgroundColor: "#111111", border: "1px solid #1a1a1a", borderRadius: 4, fontSize: 10 }}
                  labelStyle={{ color: "#d4d4d8" }}
                  formatter={(v: number | string) => `${Number(v).toFixed(1)}%`}
                />
                <Bar dataKey="payout" fill={accent} radius={[2, 2, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Despesas Adm chart */}
        {despesasSeries.length > 1 && (
          <div>
            <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-2">
              Despesas Adm (%)
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={despesasSeries} margin={{ top: 5, right: 8, left: -22, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#71717a" }} tickLine={false} axisLine={{ stroke: "#1a1a1a" }} />
                <YAxis tick={{ fontSize: 9, fill: "#71717a" }} axisLine={{ stroke: "#1a1a1a" }} domain={["auto", "auto"]} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#111111", border: "1px solid #1a1a1a", borderRadius: 4, fontSize: 10 }}
                  labelStyle={{ color: "#d4d4d8" }}
                  formatter={(v: number | string) => `${Number(v).toFixed(2)}%`}
                />
                <Line
                  type="monotone"
                  dataKey="despesas"
                  stroke="#F59E0B"
                  dot={false}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-[9px] text-zinc-500 font-mono pt-2 border-t border-[#1a1a1a]">
        {vpcStats && (
          <div>
            <span className="text-zinc-600">VP/Cota:</span>{" "}
            <span className="text-zinc-300">R$ {vpcStats.last.toFixed(2)}</span>
            {vpcStats.delta != null && (
              <span className={vpcStats.delta >= 0 ? "text-emerald-400" : "text-red-400"}>
                {" "}({vpcStats.delta >= 0 ? "+" : ""}{vpcStats.delta.toFixed(2)}% desde início)
              </span>
            )}
          </div>
        )}
        {payoutAvg != null && (
          <div>
            <span className="text-zinc-600">Payout médio:</span>{" "}
            <span className={payoutAvg > 100 ? "text-amber-400" : "text-zinc-300"}>{payoutAvg.toFixed(0)}%</span>
            <span className="text-zinc-600"> (DY/rentab. patrim)</span>
          </div>
        )}
        {despesasLatest != null && (
          <div>
            <span className="text-zinc-600">Despesas adm atual:</span>{" "}
            <span className="text-zinc-300">{despesasLatest.toFixed(2)}%</span>
          </div>
        )}
      </div>
    </div>
  );
}
