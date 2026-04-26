import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useFipPeMetrics, useFipJCurve } from "@/hooks/useHubFundos";
import { SimpleKPICard as KPICard } from "@/components/hub/KPICard";
import { EmptyState } from "@/components/hub/EmptyState";

/**
 * FipPerformancePanel — Métricas Private Equity (TVPI, vintage, call-down) + J-curve.
 *
 * IMPORTANTE: CVM não publica capital_distribuido para FIPs em CSV aberto.
 * Por isso DPI puro (Distribuído/Integralizado) é N/A. Métricas usadas:
 *   - TVPI = pl_atual / cap_integralizado (mistura realizado + unrealizado)
 *   - call_down_pct = cap_integralizado / cap_comprometido (% chamado)
 *   - dry_powder = cap_comprometido - cap_integralizado (capital ainda a chamar)
 *   - vintage_year = primeiro quadrimestre com cap_integralizado > 0
 *
 * Accent FIP (V2): #06B6D4 (cyan, mesma cor do FIP em rcvm175.ts).
 */

const FIP_ACCENT = "#06B6D4";

function fmtMoney(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e9) return `R$ ${(v / 1e9).toFixed(2)} B`;
  if (abs >= 1e6) return `R$ ${(v / 1e6).toFixed(1)} M`;
  if (abs >= 1e3) return `R$ ${(v / 1e3).toFixed(0)} k`;
  return `R$ ${v.toFixed(0)}`;
}

function fmtMonth(dt: string): string {
  const [y, m] = dt.split("-");
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${months[parseInt(m, 10) - 1]}/${y.slice(2)}`;
}

interface Props {
  identifier: string;
}

export function FipPerformancePanel({ identifier }: Props) {
  const { data: peData, isLoading: peLoading } = useFipPeMetrics(identifier);
  const { data: jcurveData, isLoading: jcurveLoading } = useFipJCurve(identifier);

  const metrics = peData?.metrics;
  const series = jcurveData?.series ?? [];

  const chartData = useMemo(
    () =>
      series.map((p) => ({
        ...p,
        label: fmtMonth(p.dt_comptc),
        pl_bn: p.pl / 1e9,
        cap_comprometido_bn: p.cap_comprometido / 1e9,
        cap_integralizado_bn: p.cap_integralizado / 1e9,
        dry_powder_bn: p.dry_powder / 1e9,
      })),
    [series]
  );

  if (peLoading || jcurveLoading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-zinc-900/50 rounded-md animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-zinc-900/50 rounded-md animate-pulse" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <EmptyState
        variant="no-data"
        title="Métricas PE indisponíveis"
        description="Capital comprometido ou integralizado não declarado pelo gestor neste quadrimestre."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <KPICard
          label="TVPI"
          value={metrics.tvpi != null ? `${metrics.tvpi.toFixed(2)}x` : "—"}
          sublabel={metrics.tvpi != null ? (metrics.tvpi >= 1 ? "Gerou valor" : "Abaixo de 1x") : "—"}
        />
        <KPICard
          label="Vintage"
          value={metrics.vintage_year != null ? String(metrics.vintage_year) : "—"}
          sublabel={metrics.age_years != null ? `${metrics.age_years.toFixed(1)} anos` : "—"}
        />
        <KPICard
          label="Call-down"
          value={metrics.call_down_pct != null ? `${metrics.call_down_pct.toFixed(1)}%` : "—"}
          sublabel="do comprometido"
        />
        <KPICard
          label="Dry powder"
          value={fmtMoney(metrics.dry_powder)}
          sublabel="capital a chamar"
        />
      </div>

      {/* J-curve chart */}
      {chartData.length > 0 && (
        <div className="bg-zinc-900/40 rounded-md border border-zinc-800/60 p-3">
          <h4 className="text-[10px] font-mono uppercase tracking-wide text-zinc-500 mb-2">
            J-curve — capital chamado vs PL (R$ bi)
          </h4>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#27272a" />
              <XAxis dataKey="label" tick={{ fill: "#71717a", fontSize: 10 }} />
              <YAxis
                tick={{ fill: "#71717a", fontSize: 10 }}
                tickFormatter={(v) => `${v.toFixed(1)}`}
              />
              <Tooltip
                contentStyle={{ background: "#09090b", border: "1px solid #27272a", fontSize: 11 }}
                labelStyle={{ color: "#a1a1aa" }}
                formatter={(v: number) => `R$ ${v.toFixed(2)} bi`}
              />
              <Legend wrapperStyle={{ fontSize: 10, color: "#a1a1aa" }} />
              <Line type="monotone" dataKey="pl_bn" name="PL atual" stroke={FIP_ACCENT} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="cap_integralizado_bn" name="Cap. integralizado" stroke="#22C55E" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="cap_comprometido_bn" name="Cap. comprometido" stroke="#a1a1aa" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="dry_powder_bn" name="Dry powder" stroke="#F59E0B" strokeWidth={1.5} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
          <div className="text-[9px] font-mono text-zinc-600 mt-2 leading-relaxed">
            <strong className="text-zinc-500">Limitação:</strong> CVM não publica capital_distribuído.
            DPI puro (Distribuído/Integralizado) não disponível. TVPI mostrado mistura
            realizado + unrealizado.
          </div>
        </div>
      )}

      {/* Quality flags */}
      {(metrics.calldown_anomaly || metrics.tvpi_anomaly || metrics.missing_comprometido) && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-[10px] font-mono text-amber-400">
          <strong>Aviso de qualidade:</strong>{" "}
          {metrics.missing_comprometido && "capital comprometido = 0 (declaração faltante)"}
          {metrics.calldown_anomaly && " call-down > 100% (possível reuso de capital)"}
          {metrics.tvpi_anomaly && " TVPI bruto fora de [0, 10x]"}
        </div>
      )}
    </div>
  );
}
