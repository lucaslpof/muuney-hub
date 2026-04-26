import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useFipCotistasBreakdown } from "@/hooks/useHubFundos";
import { EmptyState } from "@/components/hub/EmptyState";

/**
 * FipCotistasPanel — Breakdown de cotistas subscritores por categoria (15 tipos).
 * Donut + tabela com nº cotistas + % cotas. Indica perfil do investidor:
 * institucional pesado (EFPC/EAPC/RPPS), pulverizado (PF), wholesale (Banco/Corretora).
 */

const COLOR_MAP: Record<string, string> = {
  pf: "#06B6D4",
  pj_nao_financ: "#10B981",
  pj_financ: "#0EA5E9",
  banco: "#3B82F6",
  corretora_distrib: "#6366F1",
  distrib: "#8B5CF6",
  eapc: "#EC4899",
  efpc: "#F43F5E",
  rpps: "#F97316",
  segur: "#F59E0B",
  capitaliz: "#EAB308",
  fi: "#A3A3A3",
  fii: "#737373",
  invnr: "#525252",
  outro: "#404040",
};

interface Props {
  identifier: string;
}

export function FipCotistasPanel({ identifier }: Props) {
  const { data, isLoading } = useFipCotistasBreakdown(identifier);

  const chartData = useMemo(
    () =>
      (data?.breakdown ?? [])
        .filter((b) => (b.pct_cota ?? 0) > 0)
        .map((b) => ({
          name: b.label,
          value: b.pct_cota ?? 0,
          color: COLOR_MAP[b.key] || "#525252",
          nr: b.nr_cotistas,
        })),
    [data?.breakdown]
  );

  const dominantCategory = chartData[0]?.name ?? null;
  const dominantPct = chartData[0]?.value ?? 0;

  if (isLoading) {
    return <div className="h-64 bg-zinc-900/50 rounded-md animate-pulse" />;
  }

  if (!data || data.breakdown.length === 0) {
    return (
      <EmptyState
        variant="no-data"
        title="Cotistas não declarados"
        description="Gestor não preencheu breakdown de cotistas subscritores neste quadrimestre."
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary header */}
      <div className="rounded-md border border-zinc-800/60 bg-zinc-900/40 p-3">
        <div className="flex items-baseline gap-3 flex-wrap">
          <div>
            <div className="text-[9px] font-mono uppercase text-zinc-500">Total subscritores</div>
            <div className="text-base text-zinc-200 font-mono">
              {data.nr_total_cotistas_subscr ?? "—"}
            </div>
          </div>
          {dominantCategory && (
            <div>
              <div className="text-[9px] font-mono uppercase text-zinc-500">Categoria dominante</div>
              <div className="text-base text-zinc-200 font-mono">
                {dominantCategory} ({dominantPct.toFixed(1)}%)
              </div>
            </div>
          )}
          <div>
            <div className="text-[9px] font-mono uppercase text-zinc-500">Categorias presentes</div>
            <div className="text-base text-zinc-200 font-mono">{data.breakdown.length} / 15</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Donut chart */}
        <div className="rounded-md border border-zinc-800/60 bg-zinc-900/40 p-3">
          <h4 className="text-[10px] font-mono uppercase tracking-wide text-zinc-500 mb-2">
            % de cotas subscritas por categoria
          </h4>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={85}
                paddingAngle={1}
                dataKey="value"
                label={(e: { value?: number }) => (e.value && e.value > 8 ? `${e.value.toFixed(0)}%` : "")}
                labelLine={false}
              >
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#09090b", border: "1px solid #27272a", fontSize: 11 }}
                labelStyle={{ color: "#a1a1aa" }}
                formatter={(v: number, _n, p: { payload?: { nr?: number | null } }) =>
                  `${v.toFixed(2)}% · ${p?.payload?.nr ?? "?"} cotista(s)`
                }
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Tabela */}
        <div className="rounded-md border border-zinc-800/60 bg-zinc-900/40 p-3 overflow-auto max-h-[260px]">
          <table className="w-full text-[10px] font-mono">
            <thead className="sticky top-0 bg-zinc-900/95">
              <tr className="text-zinc-500 uppercase">
                <th className="text-left py-1 pr-2">Categoria</th>
                <th className="text-right py-1 px-2">Cotistas</th>
                <th className="text-right py-1 pl-2">% Cotas</th>
              </tr>
            </thead>
            <tbody>
              {data.breakdown.map((b) => {
                const color = COLOR_MAP[b.key] || "#525252";
                return (
                  <tr key={b.key} className="border-t border-zinc-800/40">
                    <td className="py-1.5 pr-2 text-zinc-300">
                      <span
                        className="inline-block w-2 h-2 rounded-sm align-middle mr-1.5"
                        style={{ background: color }}
                      />
                      {b.label}
                    </td>
                    <td className="py-1.5 px-2 text-right text-zinc-400">
                      {b.nr_cotistas ?? "—"}
                    </td>
                    <td className="py-1.5 pl-2 text-right text-zinc-200">
                      {b.pct_cota != null ? `${b.pct_cota.toFixed(2)}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-[9px] font-mono text-zinc-600 leading-relaxed">
        <strong className="text-zinc-500">Leitura:</strong> &gt; 50% em EFPC/EAPC/RPPS indica fundo
        institucional voltado a previdência. &gt; 50% PF sugere fundo pulverizado. Investidor Não
        Residente alto (≥ 50%) indica capital estrangeiro.
      </div>
    </div>
  );
}
