import { useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from "recharts";
import { ShieldAlert, TrendingUp, AlertTriangle, Landmark, Download, Minus } from "lucide-react";
import type { SeriesDataPoint } from "@/hooks/useHubData";

/* ═══════════════════════════════════════════════════════════════════════════
   SPREAD CRÉDITO PRIVADO v2
   Debêntures vs DI · Regime Detection · Cross-Signals · CSV Export
   ═══════════════════════════════════════════════════════════════════════════ */

interface SpreadCreditoPrivadoProps {
  spreadAA?: number;
  spreadA?: number;
  emissoes?: number;
  estoqueCRACRI?: number;
  spreadAASeries?: SeriesDataPoint[];
  spreadASeries?: SeriesDataPoint[];
  emissoesSeries?: SeriesDataPoint[];
  selic?: number;
}

/* ─── Regime Detection ─── */
interface CreditPrivateRegime {
  name: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

function detectPrivateRegime(spreadAA: number, spreadA: number, emissoes: number, selic: number): CreditPrivateRegime {
  const diff = spreadA - spreadAA;
  if (diff > 1.5 && spreadA > 3.5) return { name: "Stress", color: "text-red-400", bgColor: "bg-red-500/10", borderColor: "border-red-500/20" };
  if (spreadAA < 0.8 && selic > 12) return { name: "Complacência", color: "text-amber-400", bgColor: "bg-amber-500/10", borderColor: "border-amber-500/20" };
  if (emissoes > 35 && spreadAA < 1.5) return { name: "Expansão", color: "text-emerald-400", bgColor: "bg-emerald-500/10", borderColor: "border-emerald-500/20" };
  if (emissoes < 15) return { name: "Retração", color: "text-orange-400", bgColor: "bg-orange-500/10", borderColor: "border-orange-500/20" };
  return { name: "Neutro", color: "text-zinc-400", bgColor: "bg-zinc-500/10", borderColor: "border-zinc-500/20" };
}

/* ─── Cross-Signals ─── */
interface Signal { label: string; message: string; severity: "alert" | "watch" | "positive" }

function generateSignals(spreadAA: number, spreadA: number, emissoes: number, selic: number): Signal[] {
  const signals: Signal[] = [];
  const diff = spreadA - spreadAA;

  if (spreadAA < 1.0 && selic > 12) {
    signals.push({ label: "Subprecificação", message: `Spread AA (${spreadAA.toFixed(2)} p.p.) muito comprimido para Selic de ${selic.toFixed(2)}% — risco de repricing.`, severity: "alert" });
  }
  if (diff > 1.2) {
    signals.push({ label: "Diferencial AA→A Alto", message: `Gap de ${diff.toFixed(2)} p.p. entre ratings — mercado discriminando qualidade de crédito.`, severity: "watch" });
  } else if (diff < 0.5) {
    signals.push({ label: "Diferencial Comprimido", message: `Gap AA→A de apenas ${diff.toFixed(2)} p.p. — risco de homogeneização de ratings.`, severity: "watch" });
  }
  if (emissoes > 30) {
    signals.push({ label: "Mercado Primário Aquecido", message: `Emissões de R$ ${emissoes.toFixed(1)} bi/mês — absorção forte pelo mercado.`, severity: "positive" });
  } else if (emissoes < 15) {
    signals.push({ label: "Emissões Retraindo", message: `Volume de apenas R$ ${emissoes.toFixed(1)} bi — janela desfavorável ou aversão de emissores.`, severity: "alert" });
  }
  if (spreadAA > 2.0) {
    signals.push({ label: "Spreads Elevados", message: `AA em ${spreadAA.toFixed(2)} p.p. — acima do p90 histórico. Oportunidade para compra com prêmio.`, severity: "watch" });
  }

  return signals;
}

/* ─── Risk Assessment ─── */
function assessRisk(spreadAA: number, spreadA: number): { level: string; color: string; bgColor: string; message: string } {
  const diff = spreadA - spreadAA;
  if (diff > 1.5 || spreadA > 3.5) return { level: "ELEVADO", color: "text-red-400", bgColor: "bg-red-500/10 border-red-500/20", message: "Spreads elevados indicam aversão a risco no mercado de crédito privado." };
  if (diff > 0.8 || spreadA > 2.5) return { level: "MODERADO", color: "text-amber-400", bgColor: "bg-amber-500/10 border-amber-500/20", message: "Spreads em patamar normal. Monitorar diferencial AA vs A." };
  return { level: "BAIXO", color: "text-emerald-400", bgColor: "bg-emerald-500/10 border-emerald-500/20", message: "Spreads comprimidos refletem apetite saudável por crédito privado." };
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
  selic = 14.25,
}: SpreadCreditoPrivadoProps) {
  const risk = useMemo(() => assessRisk(spreadAA, spreadA), [spreadAA, spreadA]);
  const regime = useMemo(() => detectPrivateRegime(spreadAA, spreadA, emissoes, selic), [spreadAA, spreadA, emissoes, selic]);
  const signals = useMemo(() => generateSignals(spreadAA, spreadA, emissoes, selic), [spreadAA, spreadA, emissoes, selic]);

  const severityStyles: Record<string, { bg: string; border: string; text: string }> = {
    alert: { bg: "bg-red-500/5", border: "border-red-500/20", text: "text-red-400" },
    watch: { bg: "bg-amber-500/5", border: "border-amber-500/20", text: "text-amber-400" },
    positive: { bg: "bg-emerald-500/5", border: "border-emerald-500/20", text: "text-emerald-400" },
  };

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

  /* CSV export */
  const exportCSV = () => {
    const header = "Data,Spread AA,Spread A,Diferencial\n";
    const rows = spreadChartData.map((d) => `${d.date},${d.AA.toFixed(2)},${d.A.toFixed(2)},${d.diff.toFixed(2)}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "spread_credito_privado.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Landmark className="w-4 h-4 text-[#6366F1]" />
          <span className="text-sm font-bold text-zinc-100">Crédito Privado — Spreads & Emissões</span>
          <span className="text-[9px] font-mono text-zinc-600">v2</span>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-1 text-[9px] font-mono text-zinc-600 hover:text-[#10B981] transition-colors"
        >
          <Download className="w-3 h-3" /> CSV
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* KPI Cards + Regime */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <div className="bg-[#0a0a0a] border border-[#141414] rounded p-2.5">
            <div className="text-[8px] text-zinc-600 font-mono">Spread AA</div>
            <div className="text-[14px] font-bold font-mono text-emerald-400">{spreadAA.toFixed(2)} p.p.</div>
          </div>
          <div className="bg-[#0a0a0a] border border-[#141414] rounded p-2.5">
            <div className="text-[8px] text-zinc-600 font-mono">Spread A</div>
            <div className="text-[14px] font-bold font-mono text-amber-400">{spreadA.toFixed(2)} p.p.</div>
          </div>
          <div className="bg-[#0a0a0a] border border-[#141414] rounded p-2.5">
            <div className="text-[8px] text-zinc-600 font-mono">Emissões Deb.</div>
            <div className="text-[14px] font-bold font-mono text-zinc-100">R$ {emissoes.toFixed(1)} bi</div>
          </div>
          <div className="bg-[#0a0a0a] border border-[#141414] rounded p-2.5">
            <div className="text-[8px] text-zinc-600 font-mono">CRA + CRI</div>
            <div className="text-[14px] font-bold font-mono text-zinc-100">R$ {estoqueCRACRI.toFixed(1)} bi</div>
          </div>
          <div className={`rounded p-2.5 border ${regime.bgColor} ${regime.borderColor}`}>
            <div className="text-[8px] text-zinc-600 font-mono">Regime</div>
            <div className={`text-[14px] font-bold font-mono ${regime.color}`}>{regime.name}</div>
          </div>
        </div>

        {/* Risk Assessment */}
        <div className={`rounded-lg border p-3 ${risk.bgColor}`}>
          <div className="flex items-center gap-2 mb-1">
            {risk.level === "ELEVADO" ? <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> :
             risk.level === "MODERADO" ? <ShieldAlert className="w-3.5 h-3.5 text-amber-400" /> :
             <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />}
            <span className={`text-[10px] font-mono font-bold ${risk.color}`}>
              Risco: {risk.level}
            </span>
            <span className="text-[9px] font-mono text-zinc-600 ml-auto">
              Δ AA→A: {(spreadA - spreadAA).toFixed(2)} p.p.
            </span>
          </div>
          <p className="text-[9px] text-zinc-500 leading-relaxed">{risk.message}</p>
        </div>

        {/* Cross-Signals */}
        {signals.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {signals.map((signal) => {
              const style = severityStyles[signal.severity];
              return (
                <div key={signal.label} className={`rounded border p-3 ${style.bg} ${style.border}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    {signal.severity === "alert" && <AlertTriangle className="w-3 h-3 text-red-400" />}
                    {signal.severity === "watch" && <Minus className="w-3 h-3 text-amber-400" />}
                    {signal.severity === "positive" && <TrendingUp className="w-3 h-3 text-emerald-400" />}
                    <span className={`text-[10px] font-mono font-bold ${style.text}`}>{signal.label}</span>
                  </div>
                  <p className="text-[9px] text-zinc-500">{signal.message}</p>
                </div>
              );
            })}
          </div>
        )}

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
      </div>
    </div>
  );
}
