import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp, BarChart3, Landmark, Building2, GraduationCap,
  ArrowRight, Zap, Radio,
} from "lucide-react";
import { KPICard } from "@/components/hub/KPICard";
import { MacroChart } from "@/components/hub/MacroChart";
import { AlertCard } from "@/components/hub/AlertCard";
import { IngestionStatus } from "@/components/hub/IngestionStatus";
import {
  useHubLatest, useHubSeries,
  MACRO_SAMPLE, CREDITO_SAMPLE, generateSampleSeries,
} from "@/hooks/useHubData";
/* ─── Helpers ─── */
const useHubPrefix = () => "";

function toSparkline(series: { date: string; value: number }[], points = 20) {
  if (!series.length) return [];
  const step = Math.max(1, Math.floor(series.length / points));
  return series.filter((_, i) => i % step === 0).map((d) => ({ value: d.value }));
}

/* ─── Module config ─── */
const useModules = () => {
  const prefix = useHubPrefix();
  return [
    { path: `${prefix}/macro`, label: "Panorama Macro", desc: "Selic, IPCA, câmbio, PIB, dívida", icon: TrendingUp, color: "#0B6C3E", active: true },
    { path: `${prefix}/credito`, label: "Overview Crédito", desc: "Spreads, inadimplência, concessões", icon: BarChart3, color: "#10B981", active: true },
    { path: `${prefix}/renda-fixa`, label: "Renda Fixa", desc: "Curva DI, NTN-B, Tesouro, crédito privado", icon: TrendingUp, color: "#6366F1", active: true },
    { path: `${prefix}/fundos`, label: "Fundos", desc: "Performance, Sharpe, captação", icon: Landmark, color: "#F59E0B", active: true },
    { path: "#", label: "Empresas", desc: "P/L, ROE, EV/EBITDA", icon: Building2, color: "#F59E0B", active: false },
    { path: "#", label: "Educacional", desc: "Glossário, calculadoras", icon: GraduationCap, color: "#EC4899", active: false },
  ];
};

/* ─── Main Component ─── */
const HubDashboard = () => {
  const navigate = useNavigate();
  const prefix = useHubPrefix();
  const modules = useModules();

  /* Data — Macro */
  const { data: macroCards, isLoading: macroLoading } = useHubLatest("macro");
  const macro = macroCards?.length ? macroCards : MACRO_SAMPLE;
  const topMacro = macro.slice(0, 4); // Selic, IPCA Mensal, IPCA 12m, PTAX

  /* Data — Crédito */
  const { data: creditoCards, isLoading: creditoLoading } = useHubLatest("credito");
  const credito = creditoCards?.length ? creditoCards : CREDITO_SAMPLE;
  const topCredito = credito.slice(0, 4); // Spread PF, Spread PJ, Inad Total, Inad PF

  /* Series for mini-charts */
  const { data: selicSeries } = useHubSeries("selic", "1y", "macro");
  const { data: ipcaSeries } = useHubSeries("ipca", "1y", "macro");
  const { data: cambioSeries } = useHubSeries("cambio", "1y", "macro");
  const { data: inadSeries } = useHubSeries("inadimplencia", "1y", "credito");

  const selic = selicSeries?.length ? selicSeries : generateSampleSeries(14.25, 24, 0.01);
  const ipca = ipcaSeries?.length ? ipcaSeries : generateSampleSeries(0.5, 24, 0.15);
  const cambio = cambioSeries?.length ? cambioSeries : generateSampleSeries(5.7, 24, 0.03);
  const inadimplencia = inadSeries?.length ? inadSeries : generateSampleSeries(3.3, 24, 0.03);

  /* Sparklines for KPI cards */
  const sparkMap = useMemo(() => ({
    selic_meta: toSparkline(selic),
    ipca_mensal: toSparkline(ipca),
    ipca_12m: toSparkline(ipca),
    ptax_compra: toSparkline(cambio),
    spread_pf: toSparkline(inadimplencia),
    spread_pj: toSparkline(inadimplencia),
    inadimplencia_total: toSparkline(inadimplencia),
    inadimplencia_pf: toSparkline(inadimplencia),
  }), [selic, ipca, cambio, inadimplencia]);

  /* Combined KPIs for alert evaluation */
  const allKPIs = useMemo(() => [...macro, ...credito], [macro, credito]);

  return (
    <div className="space-y-4 max-w-[1400px]">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-zinc-100 tracking-tight">
              Hub de Inteligência
            </h1>
            <span className="flex items-center gap-1 text-[9px] bg-[#0B6C3E]/15 text-[#0B6C3E] px-1.5 py-0.5 rounded font-mono">
              <Radio className="w-2.5 h-2.5" />
              LIVE
            </span>
          </div>
          <p className="text-[10px] text-zinc-600 mt-0.5 font-mono">
            BACEN SGS &middot; PTAX &middot; IF.data &middot; {macro.length + credito.length} indicadores ativos
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[9px] text-zinc-600 font-mono">
          <Zap className="w-3 h-3 text-[#0B6C3E]" />
          {new Date().toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
        </div>
      </div>

      {/* ─── Cross-module Alerts ─── */}
      <AlertCard kpis={allKPIs} module="credito" />

      {/* ─── Top-line grid: Macro KPIs + Crédito KPIs ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Macro section */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-[#0B6C3E]" />
              <h2 className="text-[11px] text-zinc-500 uppercase tracking-wider font-mono">
                Macro
              </h2>
            </div>
            <button
              onClick={() => navigate(`${prefix}/macro`)}
              className="text-[10px] text-[#0B6C3E] hover:text-[#0B6C3E]/70 flex items-center gap-0.5 font-mono transition-colors"
            >
              Ver módulo <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {topMacro.map((card) => (
              <KPICard
                key={card.serie_code}
                title={card.display_name}
                value={card.last_value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                unit={card.unit}
                change={card.change_pct}
                trend={card.trend}
                lastDate={card.last_date}
                loading={macroLoading}
                sparklineData={sparkMap[card.serie_code as keyof typeof sparkMap]}
                onClick={() => navigate(`${prefix}/macro`)}
              />
            ))}
          </div>
        </section>

        {/* Crédito section */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-[#10B981]" />
              <h2 className="text-[11px] text-zinc-500 uppercase tracking-wider font-mono">
                Crédito
              </h2>
            </div>
            <button
              onClick={() => navigate(`${prefix}/credito`)}
              className="text-[10px] text-[#10B981] hover:text-[#10B981]/70 flex items-center gap-0.5 font-mono transition-colors"
            >
              Ver módulo <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {topCredito.map((card) => (
              <KPICard
                key={card.serie_code}
                title={card.display_name}
                value={card.last_value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                unit={card.unit}
                change={card.change_pct}
                trend={card.trend}
                lastDate={card.last_date}
                loading={creditoLoading}
                sparklineData={sparkMap[card.serie_code as keyof typeof sparkMap]}
                onClick={() => navigate(`${prefix}/credito`)}
              />
            ))}
          </div>
        </section>
      </div>

      {/* ─── Mini-charts row: 4 key series ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <MacroChart data={selic} title="Selic" type="area" color="#0B6C3E" label="Selic" unit="%" height={140} />
        <MacroChart data={ipca} title="IPCA" type="bar" color="#10B981" label="IPCA" unit="%" height={140} />
        <MacroChart data={cambio} title="PTAX" type="line" color="#F59E0B" label="PTAX" unit=" R$" height={140} />
        <MacroChart data={inadimplencia} title="Inadimplência" type="area" color="#EF4444" label="Inad." unit="%" height={140} />
      </div>

      {/* ─── Bottom row: Modules + Ingestion Status ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Module cards — 2 cols */}
        <div className="lg:col-span-2">
          <h2 className="text-[10px] text-zinc-600 uppercase tracking-wider font-mono mb-2">
            Módulos
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {modules.map((mod) => (
              <button
                key={mod.label}
                onClick={() => mod.active && navigate(mod.path)}
                disabled={!mod.active}
                className={`text-left bg-[#111111] border border-[#1a1a1a] rounded-lg p-3 transition-all duration-150 group ${
                  mod.active
                    ? "hover:border-[#0B6C3E]/30 cursor-pointer"
                    : "opacity-30 cursor-not-allowed"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center"
                    style={{ backgroundColor: `${mod.color}12` }}
                  >
                    <mod.icon className="w-3.5 h-3.5" style={{ color: mod.color }} />
                  </div>
                  {!mod.active && (
                    <span className="text-[8px] bg-zinc-800 text-zinc-600 px-1 py-0.5 rounded font-mono">
                      Q3
                    </span>
                  )}
                  {mod.active && (
                    <ArrowRight className="w-3 h-3 text-zinc-800 group-hover:text-[#0B6C3E] transition-colors" />
                  )}
                </div>
                <h3 className="text-[12px] font-medium text-zinc-300">{mod.label}</h3>
                <p className="text-[9px] text-zinc-600 mt-0.5 leading-relaxed">{mod.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Ingestion Status — 1 col */}
        <div>
          <h2 className="text-[10px] text-zinc-600 uppercase tracking-wider font-mono mb-2">
            Status do Pipeline
          </h2>
          <IngestionStatus />
        </div>
      </div>

      {/* ─── CVM Disclaimer ─── */}
      <div className="border-t border-[#141414] pt-3">
        <p className="text-[8px] text-zinc-700 leading-relaxed max-w-3xl">
          <strong className="text-zinc-600">Aviso legal:</strong> Dados de fontes primárias oficiais
          (BACEN/CVM). Caráter exclusivamente informativo. Não constitui oferta, recomendação ou aconselhamento
          de investimento. A Muuney não é instituição financeira nem está autorizada a distribuir produtos financeiros.
        </p>
      </div>
    </div>
  );
};

export default HubDashboard;
