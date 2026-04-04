import { useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from "recharts";
import { ShieldAlert, TrendingUp, AlertTriangle, Landmark } from "lucide-react";
import type { SeriesDataPoint } from "@/hooks/useHubData";

/* ═══════════════════════════════════════════════════════════════════════════
   SPREAD CRÉDITO PRIVADO — Debêntures vs DI · Análise de Risco
   ═══════════════════════════════════════════════════════════════════════════ */

interface SpreadCreditoPrivadoProps {
  spreadAA?: number;
  spreadA?: number;
  emissoes?: number;
  estoqueCRACRI?: number;
  spreadAASeries?: SeriesDataPoint[];
  spreadASeries?: SeriesDataPoint[];
  emissoesSeries?: SeriesDataPoint[];
}

/* ─── Risk Assessment ─── */
function assessRisk(spreadAA: number, spreadA: number): { level: string; color: string; bgColor: string; message: string } {
  const diff = spreadA - spreadAA;
  if (diff > 1.5 || spreadA > 3.5) return { level: "ELEVADO", color: "text-red-400", bgColor: "bg-red-500/10 border-red-500/20", message: "Spreads elevados indicam aversão a risco no mercado de crédito privado. Janela pode ser desfavorável para novas emissões." };
  if (diff > 0.8 || spreadA > 2.5) return { level: "MODERADO", color: "text-amber-400", bgColor: "bg-amber-500/10 border-amber-500/20", message: "Spreads em patamar normal. Monitorar diferencial AA vs A para sinais de deterioração." };
  return { level: "BAIXO", color: "text-emerald-400", bgColor: "bg-emerald-500/10 border-emerald-500/20", message: "Spreads comprimidos refletem apetite saudável por crédito privado. Janela favorável para emissores." };
}

/* ─── Tooltip ─── */
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-2 shadow-xl">
      <div className="text-[9px] text-zinc-500 font-mono mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="text-[10px] font-mono">
          <span style={{ color: p.color }}>{p.name}:</span>{" "}
          <span className="text-zinc-100">{typeof p.value === "number" ? p.value.toFixed(2) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

export function SpreadCreditoPrivado({
  spreadAA = 1.35,
  spreadA = 2.10,
  emissoes = 28.40,
  estoqueCRACRI = 410.20,
  spreadAASeries,
  spreadASeries,
  emissoesSeries,
}: SpreadCreditoPrivadoProps) {
  const risk = useMemo(() => assessRisk(spreadAA, spreadA), [spreadAA, spreadA]);

  /* Merge spread series for chart */
  const spreadChartData = useMemo(() => {
    const baseAA = spreadAASeries || [];
    const baseA = spreadASeries || [];
    if (!baseAA.length) return [];
    return baseAA.map((d, i) => ({
      date: d.date,
      dateLabel: new Date(d.date + "T12:00:00").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      AA: d.value,
      A: baseA[i]?.value ?? d.value * 1.6,
      diff: (baseA[i]?.value ?? d.value * 1.6) - d.value,
    }));
  }, [spreadAASeries, spreadASeries]);

  const emissaoChartData = useMemo(() => {
    const base = emissoesSeries || [];
    if (!base.length) return [];
    return base.map((d) => ({
      date: d.date,
      dateLabel: new Date(d.date + "T12:00:00").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      volume: d.value,
    }));
  }, [emissoesSeries]);

  return (
    <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center gap-2">
        <Landmark className="w-4 h-4 text-[#6366F1]" />
        <span className="text-sm font-bold text-zinc-100">Crédito Privado — Spreads & Emissões</span>
      </div>

      <div className="p-4 space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-[#0a0a0a] border border-[#141414] rounded p-2.5">
            <div className="text-[8px] text-zinc-600 font-mono">Spread AA (s/ DI)</div>
            <div className="text-[14px] font-bold font-mono text-emerald-400">{spreadAA.toFixed(2)} p.p.</div>
          </div>
          <div className="bg-[#0a0a0a] border border-[#141414] rounded p-2.5">
            <div className="text-[8px] text-zinc-600 font-mono">Spread A (s/ DI)</div>
            <div className="text-[14px] font-bold font-mono text-amber-400">{spreadA.toFixed(2)} p.p.</div>
          </div>
          <div className="bg-[#0a0a0a] border border-[#141414] rounded p-2.5">
            <div className="text-[8px] text-zinc-600 font-mono">Emissões Debêntures</div>
            <div className="text-[14px] font-bold font-mono text-zinc-100">R$ {emissoes.toFixed(1)} bi</div>
          </div>
          <div className="bg-[#0a0a0a] border border-[#141414] rounded p-2.5">
            <div className="text-[8px] text-zinc-600 font-mono">Estoque CRA + CRI</div>
            <div className="text-[14px] font-bold font-mono text-zinc-100">R$ {estoqueCRACRI.toFixed(1)} bi</div>
          </div>
        </div>

        {/* Risk Assessment */}
        <div className={`rounded-lg border p-3 ${risk.bgColor}`}>
          <div className="flex items-center gap-2 mb-1">
            {risk.level === "ELEVADO" ? <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> :
             risk.level === "MODERADO" ? <ShieldAlert className="w-3.5 h-3.5 text-amber-400" /> :
             <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />}
            <span className={`text-[10px] font-mono font-bold ${risk.color}`}>
              Risco de Crédito Privado: {risk.level}
            </span>
            <span className="text-[9px] font-mono text-zinc-600 ml-auto">
              Δ AA→A: {(spreadA - spreadAA).toFixed(2)} p.p.
            </span>
          </div>
          <p className="text-[9px] text-zinc-500 leading-relaxed">{risk.message}</p>
        </div>

        {/* Spread Chart */}
        {spreadChartData.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-bold text-zinc-300 font-mono">Spreads Debêntures sobre DI</span>
              <div className="flex items-center gap-3 ml-auto">
                <span className="flex items-center gap-1 text-[8px] text-zinc-500 font-mono">
                  <span className="w-2 h-2 rounded-full bg-[#10B981]" />AA
                </span>
                <span className="flex items-center gap-1 text-[8px] text-zinc-500 font-mono">
                  <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />A
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={spreadChartData}>
                <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="dateLabel" tick={{ fill: "#52525b", fontSize: 8, fontFamily: "monospace" }} axisLine={{ stroke: "#1a1a1a" }} tickLine={false} />
                <YAxis tick={{ fill: "#52525b", fontSize: 8, fontFamily: "monospace" }} axisLine={false} tickLine={false} width={35} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="AA" stroke="#10B981" fill="#10B981" fillOpacity={0.1} strokeWidth={1.5} name="AA" />
                <Area type="monotone" dataKey="A" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.1} strokeWidth={1.5} name="A" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Emissões Chart */}
        {emissaoChartData.length > 0 && (
          <div>
            <span className="text-[10px] font-bold text-zinc-300 font-mono mb-2 block">Volume de Emissões — Debêntures</span>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={emissaoChartData}>
                <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="dateLabel" tick={{ fill: "#52525b", fontSize: 8, fontFamily: "monospace" }} axisLine={{ stroke: "#1a1a1a" }} tickLine={false} />
                <YAxis tick={{ fill: "#52525b", fontSize: 8, fontFamily: "monospace" }} axisLine={false} tickLine={false} width={35} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="volume" fill="#6366F1" fillOpacity={0.6} radius={[2, 2, 0, 0]} name="Volume (R$ bi)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Insights */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { title: "Compressão de Spreads", text: "Spreads AA abaixo de 1.5 p.p. historicamente indicam excesso de demanda por crédito privado — atenção ao risco de repricing.", color: "border-emerald-500/20 bg-emerald-500/5", textColor: "text-emerald-400" },
            { title: "Pipeline de Emissões", text: "Volume de emissões de debêntures acima de R$ 25 bi/mês sinaliza mercado primário aquecido — monitorar absorção.", color: "border-blue-500/20 bg-blue-500/5", textColor: "text-blue-400" },
          ].map((insight) => (
            <div key={insight.title} className={`rounded border p-2.5 ${insight.color}`}>
              <div className={`text-[9px] font-mono font-bold ${insight.textColor}`}>{insight.title}</div>
              <div className="text-[8px] text-zinc-600 mt-1">{insight.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
