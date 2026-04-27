import { useMemo } from "react";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, BarChart, Bar, ReferenceLine } from "recharts";
import { Activity, AlertCircle } from "lucide-react";
import { useFiiB3Ticker, useFiiB3Quotes, type FiiB3Quote } from "@/hooks/useHubFundos";
import { EmptyState } from "@/components/hub/EmptyState";

/**
 * FiiB3Panel — preço B3 vs VP/cota (CVM), histórico diário, P/VP, volume médio.
 *
 * Fonte: hub_fii_b3_diario (Yahoo Finance via ingest-b3-fii-quotes).
 * Cobertura: ~94 FIIs top PL (Apr/2026), 2 anos de histórico.
 *
 * Indicadores:
 *  - Preço atual (close último dia)
 *  - VP/cota (valor_patrimonial_cota CVM mensal — last)
 *  - P/VP = preço / VP/cota (>1 = ágio, <1 = deságio)
 *  - Variação 12m
 *  - Volume médio 30d
 *  - Market cap atual
 */

interface Props {
  cnpj: string | null;
  vpCota?: number | null;
  accent?: string;
  lookbackDays?: number;
}

function fmtBRL(v: number | null | undefined, digits = 2): string {
  if (v == null || !isFinite(v)) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtVolume(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  if (v >= 1e9) return `R$ ${(v / 1e9).toFixed(1)}bi`;
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(1)}mi`;
  if (v >= 1e3) return `R$ ${(v / 1e3).toFixed(0)}k`;
  return `R$ ${v.toFixed(0)}`;
}

function fmtMktCap(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  if (v >= 1e9) return `R$ ${(v / 1e9).toFixed(2)}bi`;
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(0)}mi`;
  return `R$ ${v.toFixed(0)}`;
}

export function FiiB3Panel({ cnpj, vpCota, accent = "#EC4899", lookbackDays = 730 }: Props) {
  const { data: ticker, isLoading: tickerLoading } = useFiiB3Ticker(cnpj);
  const { data: quotes, isLoading: quotesLoading } = useFiiB3Quotes(ticker?.cnpj_fundo ?? null, lookbackDays);

  const stats = useMemo(() => {
    if (!quotes || quotes.length === 0) return null;
    const last = quotes[quotes.length - 1];
    const first = quotes[0];

    // Variação 12m: usa última obs >= 365d antes do último ponto
    const cutoff12m = new Date(new Date(last.dt).getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const ref12m = quotes.find((q) => q.dt >= cutoff12m);
    const var12m = ref12m && ref12m.close && last.close ? ((last.close / ref12m.close) - 1) * 100 : null;

    // Variação ano (YTD)
    const yyyy = last.dt.slice(0, 4);
    const refYTD = quotes.find((q) => q.dt.slice(0, 4) === yyyy);
    const varYTD = refYTD && refYTD.close && last.close ? ((last.close / refYTD.close) - 1) * 100 : null;

    // Volume médio 30d (últimas 30 obs com volume)
    const last30 = quotes.slice(-30).filter((q) => q.volume != null);
    const volMedio30d = last30.length > 0
      ? last30.reduce((s, q) => s + (q.volume ?? 0), 0) / last30.length
      : null;
    // Volume financeiro 30d ≈ vol_medio_30d × close_medio_30d
    const closeMedio30d = last30.length > 0
      ? last30.reduce((s, q) => s + (q.close ?? 0), 0) / last30.length
      : null;
    const volFin30d = volMedio30d && closeMedio30d ? volMedio30d * closeMedio30d : null;

    // P/VP
    const pvp = last.close && vpCota ? last.close / vpCota : null;

    // Min/max no período
    const closes = quotes.map((q) => q.close ?? 0).filter((c) => c > 0);
    const max = closes.length ? Math.max(...closes) : null;
    const min = closes.length ? Math.min(...closes) : null;

    return {
      last,
      first,
      var12m,
      varYTD,
      volMedio30d,
      volFin30d,
      pvp,
      max,
      min,
      pricedAtPeak: last.close && max ? (last.close / max) * 100 : null,
    };
  }, [quotes, vpCota]);

  if (tickerLoading || quotesLoading) {
    return <div className="h-48 bg-zinc-900/50 rounded-md animate-pulse" />;
  }

  if (!ticker) {
    return (
      <div className="rounded-md border border-zinc-800/60 bg-zinc-900/40 p-3" style={{ borderLeft: `3px solid ${accent}66` }}>
        <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500">
          <AlertCircle className="w-3.5 h-3.5 text-zinc-600" />
          <span>Cotação B3 não disponível para este FII (não está no top 200 ou Yahoo Finance não cobre).</span>
        </div>
      </div>
    );
  }

  if (!quotes || quotes.length === 0 || !stats) {
    return (
      <EmptyState
        variant="no-data"
        title={`Sem cotações B3 para ${ticker.ticker}`}
        description="Yahoo Finance não retornou histórico — pode ser ativo recém-listado ou suspenso."
      />
    );
  }

  const var12mColor = (stats.var12m ?? 0) > 0 ? "text-emerald-400" : "text-red-400";
  const pvpColor = !stats.pvp
    ? "text-zinc-400"
    : stats.pvp > 1.05
    ? "text-amber-400"
    : stats.pvp < 0.95
    ? "text-emerald-400"
    : "text-zinc-300";
  const pvpLabel = !stats.pvp
    ? "—"
    : stats.pvp > 1.05
    ? "ágio"
    : stats.pvp < 0.95
    ? "deságio"
    : "neutro";

  // Volume bar chart — agrupa por mês (últimas 24 obs mensais)
  const monthlyVol = aggregateMonthlyVolume(quotes);

  return (
    <div className="space-y-3">
      {/* Header: ticker + KPIs */}
      <div
        className="rounded-md border border-zinc-800/60 bg-zinc-900/40 p-3 flex items-baseline gap-3 flex-wrap"
        style={{ borderLeft: `3px solid ${accent}66` }}
      >
        <Activity className="w-4 h-4 self-center" style={{ color: accent }} />
        <div className="flex-1 grid grid-cols-2 md:grid-cols-6 gap-3 text-[10px] font-mono">
          <div>
            <div className="text-zinc-600 uppercase">Ticker</div>
            <div className="text-sm font-bold" style={{ color: accent }}>
              {ticker.ticker}
            </div>
          </div>
          <div>
            <div className="text-zinc-600 uppercase">Preço</div>
            <div className="text-zinc-200 text-sm">{fmtBRL(stats.last.close)}</div>
          </div>
          <div>
            <div className="text-zinc-600 uppercase">VP/Cota</div>
            <div className="text-zinc-300 text-sm">{vpCota != null ? fmtBRL(vpCota) : "—"}</div>
          </div>
          <div>
            <div className="text-zinc-600 uppercase">P/VP</div>
            <div className={`text-sm ${pvpColor}`}>
              {stats.pvp != null ? stats.pvp.toFixed(2) : "—"}
              <span className="text-[9px] text-zinc-600 ml-1">{pvpLabel}</span>
            </div>
          </div>
          <div>
            <div className="text-zinc-600 uppercase">Var 12m</div>
            <div className={`text-sm ${var12mColor}`}>
              {stats.var12m != null ? `${stats.var12m >= 0 ? "+" : ""}${stats.var12m.toFixed(1)}%` : "—"}
            </div>
          </div>
          <div>
            <div className="text-zinc-600 uppercase">Mkt Cap</div>
            <div className="text-zinc-200 text-sm">{fmtMktCap(stats.last.market_cap)}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Chart preço */}
        <div className="md:col-span-2 rounded-md border border-zinc-800/60 bg-zinc-900/40 p-3">
          <h4 className="text-[10px] font-mono uppercase text-zinc-500 mb-2">
            Preço {ticker.ticker} — últimos {Math.round(lookbackDays / 30)} meses
          </h4>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={quotes.map((q) => ({ dt: q.dt, close: q.close }))} margin={{ top: 5, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="dt"
                tick={{ fontSize: 9, fill: "#71717a" }}
                tickFormatter={(v: string) => v.slice(2, 7).split("-").reverse().join("/")}
                tickLine={false}
                axisLine={{ stroke: "#27272a" }}
                interval="preserveStartEnd"
                minTickGap={50}
              />
              <YAxis
                tick={{ fontSize: 9, fill: "#71717a" }}
                axisLine={{ stroke: "#27272a" }}
                tickFormatter={(v: number) => v.toFixed(0)}
                domain={["auto", "auto"]}
                width={40}
              />
              <Tooltip
                contentStyle={{ background: "#09090b", border: "1px solid #27272a", fontSize: 11 }}
                labelFormatter={(v: string) => v.split("-").reverse().join("/")}
                formatter={(v: number) => [fmtBRL(v), "Preço"]}
              />
              {vpCota != null && (
                <ReferenceLine
                  y={vpCota}
                  stroke="#71717a"
                  strokeDasharray="4 2"
                  label={{ value: "VP", position: "right", fill: "#71717a", fontSize: 9 }}
                />
              )}
              <Line
                type="monotone"
                dataKey="close"
                stroke={accent}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Volume mensal */}
        <div className="rounded-md border border-zinc-800/60 bg-zinc-900/40 p-3">
          <h4 className="text-[10px] font-mono uppercase text-zinc-500 mb-2">
            Volume mensal (cotas)
          </h4>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyVol} margin={{ top: 5, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 9, fill: "#71717a" }}
                tickFormatter={(v: string) => v.slice(2)}
                tickLine={false}
                axisLine={{ stroke: "#27272a" }}
                interval="preserveStartEnd"
                minTickGap={20}
              />
              <YAxis
                tick={{ fontSize: 9, fill: "#71717a" }}
                axisLine={{ stroke: "#27272a" }}
                tickFormatter={(v: number) => (v > 1e6 ? `${(v / 1e6).toFixed(0)}M` : `${(v / 1e3).toFixed(0)}k`)}
                width={40}
              />
              <Tooltip
                contentStyle={{ background: "#09090b", border: "1px solid #27272a", fontSize: 11 }}
                formatter={(v: number) => [v.toLocaleString("pt-BR"), "Volume"]}
              />
              <Bar dataKey="volume" fill={accent} fillOpacity={0.5} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Footer: stats secundárias */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-[10px] font-mono">
        <StatBox label="Máx período" value={fmtBRL(stats.max)} sub={stats.pricedAtPeak != null ? `${stats.pricedAtPeak.toFixed(0)}% do topo` : undefined} />
        <StatBox label="Mín período" value={fmtBRL(stats.min)} />
        <StatBox label="Var YTD" value={stats.varYTD != null ? `${stats.varYTD >= 0 ? "+" : ""}${stats.varYTD.toFixed(1)}%` : "—"} highlight={(stats.varYTD ?? 0) > 0 ? "good" : "bad"} />
        <StatBox label="Vol médio 30d" value={stats.volMedio30d != null ? `${(stats.volMedio30d / 1e3).toFixed(0)}k cotas` : "—"} sub={stats.volFin30d != null ? `≈ ${fmtVolume(stats.volFin30d)}/dia` : undefined} />
        <StatBox label="Última cotação" value={stats.last.dt.split("-").reverse().join("/")} sub="fonte: Yahoo Finance" />
      </div>

      <p className="text-[9px] font-mono text-zinc-600">
        <strong>Leitura:</strong> P/VP &gt; 1 indica ágio (mercado paga acima do book CVM); &lt; 1 indica deságio (oportunidade ou risco percebido).
        Volume médio 30d separa FIIs líquidos (&gt; 1k cotas/dia) de ilíquidos. Fonte preço: Yahoo Finance · VP/cota: CVM informe mensal.
      </p>
    </div>
  );
}

function StatBox({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: "good" | "bad" | null;
}) {
  const valueColor =
    highlight === "good" ? "text-emerald-400" : highlight === "bad" ? "text-red-400" : "text-zinc-200";
  return (
    <div className="rounded-md border border-zinc-800/40 bg-zinc-900/30 p-2">
      <div className="text-[9px] font-mono uppercase text-zinc-600 truncate">{label}</div>
      <div className={`text-sm font-mono ${valueColor} mt-0.5`}>{value}</div>
      {sub && <div className="text-[9px] font-mono text-zinc-600 truncate">{sub}</div>}
    </div>
  );
}

function aggregateMonthlyVolume(quotes: FiiB3Quote[]): Array<{ month: string; volume: number }> {
  const byMonth = new Map<string, number>();
  for (const q of quotes) {
    if (q.volume == null) continue;
    const month = q.dt.slice(0, 7); // YYYY-MM
    byMonth.set(month, (byMonth.get(month) ?? 0) + q.volume);
  }
  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-24) // últimos 24 meses
    .map(([month, volume]) => ({ month, volume }));
}
