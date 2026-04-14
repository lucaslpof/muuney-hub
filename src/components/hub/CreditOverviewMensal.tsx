import { useMemo } from "react";
import { MacroChart } from "@/components/hub/MacroChart";
import { CreditHeatmap } from "@/components/hub/CreditHeatmap";
import { useHubSeries, generateSampleSeries, type SeriesDataPoint } from "@/hooks/useHubData";
import { percentChange } from "@/lib/statistics";
import {
  TrendingUp, TrendingDown, Minus,
  Landmark, Users, Building2, ShieldAlert,
  Percent, ArrowLeftRight, Scale,
} from "lucide-react";

/* ─── Section wrapper ─── */
const Section = ({ title, icon: Icon, children }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 pt-2">
      <Icon className="w-4 h-4 text-[#10B981]" />
      <h2 className="text-sm font-bold text-zinc-100 tracking-tight">{title}</h2>
    </div>
    {children}
  </div>
);

/* ─── Mini summary card (top banner) ─── */
interface SummaryItem {
  label: string;
  value: string;
  delta: number;
  unit: string;
}

const SummaryBanner = ({ items }: { items: SummaryItem[] }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
    {items.map((item) => {
      const TrendIcon = item.delta > 0 ? TrendingUp : item.delta < 0 ? TrendingDown : Minus;
      const trendColor = item.delta > 0 ? "text-emerald-400" : item.delta < 0 ? "text-red-400" : "text-zinc-600";
      return (
        <div key={item.label} className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-3">
          <div className="text-[9px] text-zinc-500 font-mono mb-1">{item.label}</div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-bold text-zinc-100 font-mono">{item.value}</span>
            <span className="text-[9px] text-zinc-500">{item.unit}</span>
          </div>
          <div className={`flex items-center gap-0.5 mt-1 ${trendColor}`}>
            <TrendIcon className="w-3 h-3" />
            <span className="text-[9px] font-mono">
              {item.delta >= 0 ? "+" : ""}{item.delta.toFixed(1)}% a/a
            </span>
          </div>
        </div>
      );
    })}
  </div>
);

/* ─── Helper: use series with fallback ─── */
function useSeries(category: string, period: string, base: number, vol = 0.02) {
  const { data } = useHubSeries(category, period, "credito");
  return data?.length ? data : generateSampleSeries(base, 24, vol);
}

/* ─── Compute YoY growth from monthly series ─── */
function yoyGrowth(data: SeriesDataPoint[]): SeriesDataPoint[] {
  if (data.length < 13) return percentChange(data, 1);
  return data.slice(12).map((d, i) => ({
    date: d.date,
    value: data[i].value === 0 ? 0 : Math.round(((d.value - data[i].value) / Math.abs(data[i].value)) * 10000) / 100,
  }));
}

/* ─── Colors ─── */
const C = {
  emerald: "#10B981",
  indigo: "#6366F1",
  red: "#EF4444",
  amber: "#F59E0B",
  blue: "#3B82F6",
  violet: "#8B5CF6",
  cyan: "#06B6D4",
  pink: "#EC4899",
};

/* ═══════════════════════════════════════════════════════════════════ */
/* MAIN COMPONENT                                                     */
/* ═══════════════════════════════════════════════════════════════════ */

interface CreditOverviewMensalProps {
  period: string;
}

export const CreditOverviewMensal = ({ period }: CreditOverviewMensalProps) => {
  /* ── Fetch all series ── */
  // Saldos agregados
  const saldoTotal = useSeries("saldo_credito", period, 6120, 0.01);
  const saldoPF = useSeries("saldo_pf", period, 3580, 0.012);
  const saldoPJ = useSeries("saldo_pj_total", period, 2340, 0.012);
  const saldoLivres = useSeries("saldo_livres", period, 3520, 0.011);
  const saldoDirecionados = useSeries("saldo_direcionados", period, 2600, 0.010);

  // PF por modalidade
  const pfPessoal = useSeries("pf_pessoal", period, 428, 0.02);
  const pfConsignado = useSeries("pf_consignado", period, 582, 0.01);
  const pfVeiculos = useSeries("pf_veiculos", period, 312, 0.02);
  const pfCartao = useSeries("pf_cartao", period, 548, 0.025);
  const pfRural = useSeries("pf_rural", period, 384, 0.015);
  const pfHabitacional = useSeries("pf_habitacional", period, 892, 0.008);
  const pfBndes = useSeries("pf_bndes", period, 42, 0.02);

  // PJ por modalidade
  const pjCapitalGiro = useSeries("pj_capital_giro", period, 498, 0.015);
  const pjDuplicatas = useSeries("pj_duplicatas", period, 142, 0.02);
  const pjContaGarantida = useSeries("pj_conta_garantida", period, 54, 0.03);
  const pjComercioExt = useSeries("pj_comercio_ext", period, 112, 0.025);
  const pjRural = useSeries("pj_rural", period, 412, 0.015);
  const pjHabitacional = useSeries("pj_habitacional", period, 98, 0.012);
  const pjBndes = useSeries("pj_bndes", period, 310, 0.01);

  // Concessões
  const concessaoPF = useSeries("concessao_pf", period, 254, 0.04);
  const concessaoPJ = useSeries("concessao_pj", period, 198, 0.035);
  const concessaoPFLivres = useSeries("concessao_pf_livres", period, 198, 0.04);
  const concessaoPJLivres = useSeries("concessao_pj_livres", period, 165, 0.035);

  // Inadimplência >90d
  const inadTotal = useSeries("inadimplencia", period, 3.3, 0.03);
  const inadPF = useSeries("inadimplencia_pf", period, 4.1, 0.025);
  const inadPJ = useSeries("inadimplencia_pj", period, 2.4, 0.03);
  const inadLivres = useSeries("inadim_livres", period, 4.5, 0.025);
  const inadDirecionados = useSeries("inadim_direcionados", period, 1.6, 0.02);
  const inadPFLivres = useSeries("inadim_pf_livres", period, 5.8, 0.025);
  const inadPJLivres = useSeries("inadim_pj_livres", period, 2.8, 0.03);
  const inadPFDir = useSeries("inadim_pf_dir", period, 1.9, 0.02);
  const inadPJDir = useSeries("inadim_pj_dir", period, 1.2, 0.02);

  // Inadimplência 15-90d
  const inad15Total = useSeries("inadim_15_90_total", period, 4.2, 0.025);
  const inad15PF = useSeries("inadim_15_90_pf", period, 5.1, 0.025);
  const inad15PJ = useSeries("inadim_15_90_pj", period, 2.9, 0.03);
  const inad15Livres = useSeries("inadim_15_90_livres", period, 5.6, 0.025);
  const inad15Dir = useSeries("inadim_15_90_dir", period, 2.1, 0.02);

  // Taxas
  const taxaPF = useSeries("taxa_pf", period, 52, 0.015);
  const taxaPJ = useSeries("taxa_pj", period, 24, 0.015);
  const taxaPFLivres = useSeries("taxa_pf_livres", period, 58, 0.015);
  const taxaPJLivres = useSeries("taxa_pj_livres", period, 25.6, 0.015);
  const taxaPFDir = useSeries("taxa_pf_dir", period, 10.8, 0.01);
  const taxaPJDir = useSeries("taxa_pj_dir", period, 14.2, 0.01);

  // Spreads
  const spreadPF = useSeries("spread_pf", period, 30, 0.02);
  const spreadPJ = useSeries("spread_pj", period, 10.8, 0.025);
  const spreadLivres = useSeries("spread_livres_pf", period, 35.6, 0.02);
  const spreadDir = useSeries("spread_direcionados", period, 5.2, 0.015);

  // Alavancagem
  const endivExclHab = useSeries("endiv_excl_hab", period, 32.4, 0.01);
  const endivComHab = useSeries("endiv_com_hab", period, 48.2, 0.01);
  const comprometRenda = useSeries("compromet_renda", period, 26.8, 0.012);

  /* ── Derived: YoY series ── */
  const saldoTotalYoY = useMemo(() => yoyGrowth(saldoTotal), [saldoTotal]);
  const saldoPFYoY = useMemo(() => yoyGrowth(saldoPF), [saldoPF]);
  const saldoPJYoY = useMemo(() => yoyGrowth(saldoPJ), [saldoPJ]);
  const saldoLivresYoY = useMemo(() => yoyGrowth(saldoLivres), [saldoLivres]);
  const saldoDirYoY = useMemo(() => yoyGrowth(saldoDirecionados), [saldoDirecionados]);
  const concessaoPFLivresYoY = useMemo(() => yoyGrowth(concessaoPFLivres), [concessaoPFLivres]);
  const concessaoPJLivresYoY = useMemo(() => yoyGrowth(concessaoPJLivres), [concessaoPJLivres]);

  /* ── Summary banner data ── */
  const lastVal = (s: SeriesDataPoint[]) => s.length ? s[s.length - 1].value : 0;
  const yoyDelta = (s: SeriesDataPoint[]) => {
    const yoy = yoyGrowth(s);
    return yoy.length ? yoy[yoy.length - 1].value : 0;
  };

  const summaryItems: SummaryItem[] = useMemo(() => [
    { label: "Crédito Total", value: (lastVal(saldoTotal) / 1000).toFixed(2), delta: yoyDelta(saldoTotal), unit: "R$ tri" },
    { label: "Concessões PF", value: lastVal(concessaoPF).toFixed(0), delta: yoyDelta(concessaoPF), unit: "R$ bi" },
    { label: "Concessões PJ", value: lastVal(concessaoPJ).toFixed(0), delta: yoyDelta(concessaoPJ), unit: "R$ bi" },
    { label: "Inadim. >90d", value: lastVal(inadTotal).toFixed(2), delta: yoyDelta(inadTotal), unit: "%" },
    { label: "Taxa Média PF", value: lastVal(taxaPF).toFixed(1), delta: yoyDelta(taxaPF), unit: "% a.a." },
    { label: "Comprometimento Renda", value: lastVal(comprometRenda).toFixed(1), delta: yoyDelta(comprometRenda), unit: "%" },
  ], [saldoTotal, concessaoPF, concessaoPJ, inadTotal, taxaPF, comprometRenda]);

  /* ── Heatmap rows ── */
  const heatmapPF = useMemo(() => [
    { label: "Pessoal", values: pfPessoal },
    { label: "Consignado", values: pfConsignado },
    { label: "Veículos", values: pfVeiculos },
    { label: "Cartão", values: pfCartao },
    { label: "Rural", values: pfRural },
    { label: "Habitacional", values: pfHabitacional },
    { label: "BNDES PF", values: pfBndes },
  ], [pfPessoal, pfConsignado, pfVeiculos, pfCartao, pfRural, pfHabitacional, pfBndes]);

  const heatmapPJ = useMemo(() => [
    { label: "Capital de Giro", values: pjCapitalGiro },
    { label: "Duplicatas", values: pjDuplicatas },
    { label: "Conta Garantida", values: pjContaGarantida },
    { label: "Comércio Exterior", values: pjComercioExt },
    { label: "Rural", values: pjRural },
    { label: "Habitacional", values: pjHabitacional },
    { label: "BNDES", values: pjBndes },
  ], [pjCapitalGiro, pjDuplicatas, pjContaGarantida, pjComercioExt, pjRural, pjHabitacional, pjBndes]);

  const heatmapInadPF = useMemo(() => [
    { label: "Total PF", values: inadPF },
    { label: "PF Livres", values: inadPFLivres },
    { label: "PF Direcionados", values: inadPFDir },
  ], [inadPF, inadPFLivres, inadPFDir]);

  const heatmapInadPJ = useMemo(() => [
    { label: "Total PJ", values: inadPJ },
    { label: "PJ Livres", values: inadPJLivres },
    { label: "PJ Direcionados", values: inadPJDir },
  ], [inadPJ, inadPJLivres, inadPJDir]);

  return (
    <div className="space-y-5">
      {/* ─── Top Summary ─── */}
      <SummaryBanner items={summaryItems} />

      {/* ════════════════════════════════════════════════════════════ */}
      {/* CRÉDITO TOTAL                                               */}
      {/* ════════════════════════════════════════════════════════════ */}
      <Section title="Crédito Total" icon={Landmark}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <MacroChart
            data={saldoPFYoY.map((d, i) => ({
              ...d,
              value2: saldoPJYoY[i]?.value ?? 0,
            }))}
            title="Estoque de Crédito por Tomador (% a/a)"
            type="line"
            color={C.emerald}
            color2={C.indigo}
            label="PF"
            label2="PJ"
            unit="%"
          />
          <MacroChart
            data={saldoTotalYoY.map((d, i) => ({
              ...d,
              value2: saldoLivresYoY[i]?.value ?? 0,
            }))}
            title="Estoque de Crédito Total vs Livres (% a/a)"
            type="line"
            color={C.amber}
            color2={C.cyan}
            label="Total"
            label2="Livres"
            unit="%"
          />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <MacroChart
            data={saldoPF.map((d, i) => ({
              ...d,
              value2: saldoPJ[i]?.value ?? 0,
            }))}
            title="Estoque por Tomador (saldo absoluto)"
            type="area"
            color={C.emerald}
            color2={C.indigo}
            label="PF"
            label2="PJ"
            unit=" R$ bi"
          />
          <MacroChart
            data={saldoDirYoY.map((d, i) => ({
              ...d,
              value2: saldoLivresYoY[i]?.value ?? 0,
            }))}
            title="Livres vs Direcionados (% a/a)"
            type="line"
            color={C.amber}
            color2={C.cyan}
            label="Direcionados"
            label2="Livres"
            unit="%"
          />
        </div>
      </Section>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* CRÉDITO PF                                                  */}
      {/* ════════════════════════════════════════════════════════════ */}
      <Section title="Crédito a Pessoas Físicas" icon={Users}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <MacroChart
            data={pfPessoal.map((d, i) => ({
              ...d,
              value2: pfConsignado[i]?.value ?? 0,
            }))}
            title="PF Livres — Pessoal vs Consignado"
            type="line"
            color={C.emerald}
            color2={C.indigo}
            label="Pessoal"
            label2="Consignado"
            unit=" R$ bi"
          />
          <MacroChart
            data={pfVeiculos.map((d, i) => ({
              ...d,
              value2: pfCartao[i]?.value ?? 0,
            }))}
            title="PF Livres — Veículos vs Cartão"
            type="line"
            color={C.amber}
            color2={C.red}
            label="Veículos"
            label2="Cartão"
            unit=" R$ bi"
          />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <MacroChart
            data={pfRural.map((d, i) => ({
              ...d,
              value2: pfHabitacional[i]?.value ?? 0,
            }))}
            title="PF Direcionados — Rural vs Habitacional"
            type="line"
            color={C.cyan}
            color2={C.violet}
            label="Rural"
            label2="Habitacional"
            unit=" R$ bi"
          />
          <MacroChart
            data={concessaoPFLivresYoY}
            title="Concessões PF Livres (% a/a)"
            type="bar"
            color={C.emerald}
            label="PF Livres"
            unit="%"
          />
        </div>
      </Section>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* CRÉDITO PJ                                                  */}
      {/* ════════════════════════════════════════════════════════════ */}
      <Section title="Crédito a Empresas" icon={Building2}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <MacroChart
            data={pjCapitalGiro.map((d, i) => ({
              ...d,
              value2: pjDuplicatas[i]?.value ?? 0,
            }))}
            title="PJ Livres — Capital de Giro vs Duplicatas"
            type="line"
            color={C.emerald}
            color2={C.indigo}
            label="Capital Giro"
            label2="Duplicatas"
            unit=" R$ bi"
          />
          <MacroChart
            data={pjComercioExt.map((d, i) => ({
              ...d,
              value2: pjContaGarantida[i]?.value ?? 0,
            }))}
            title="PJ Livres — Com. Exterior vs Conta Garantida"
            type="line"
            color={C.amber}
            color2={C.red}
            label="Com. Ext."
            label2="Cta. Garantida"
            unit=" R$ bi"
          />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <MacroChart
            data={pjRural.map((d, i) => ({
              ...d,
              value2: pjHabitacional[i]?.value ?? 0,
            }))}
            title="PJ Direcionados — Rural vs Habitacional"
            type="line"
            color={C.cyan}
            color2={C.violet}
            label="Rural"
            label2="Habitacional"
            unit=" R$ bi"
          />
          <MacroChart
            data={concessaoPJLivresYoY}
            title="Concessões PJ Livres (% a/a)"
            type="bar"
            color={C.indigo}
            label="PJ Livres"
            unit="%"
          />
        </div>
      </Section>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* INADIMPLÊNCIA TOTAL                                         */}
      {/* ════════════════════════════════════════════════════════════ */}
      <Section title="Inadimplência Total" icon={ShieldAlert}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <MacroChart
            data={inadTotal.map((d, i) => ({
              ...d,
              value2: inad15Total[i]?.value ?? 0,
            }))}
            title="NPL Total — >90d vs 15-90d"
            type="line"
            color={C.red}
            color2={C.amber}
            label=">90 dias"
            label2="15-90 dias"
            unit="%"
          />
          <MacroChart
            data={inad15PF.map((d, i) => ({
              ...d,
              value2: inad15PJ[i]?.value ?? 0,
            }))}
            title="NPL 15-90 dias por Tomador"
            type="line"
            color={C.red}
            color2={C.amber}
            label="PF"
            label2="PJ"
            unit="%"
          />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <MacroChart
            data={inadLivres.map((d, i) => ({
              ...d,
              value2: inadDirecionados[i]?.value ?? 0,
            }))}
            title="NPL >90 dias por Tipo"
            type="line"
            color={C.amber}
            color2={C.cyan}
            label="Livres"
            label2="Direcionados"
            unit="%"
          />
          <MacroChart
            data={inad15Livres.map((d, i) => ({
              ...d,
              value2: inad15Dir[i]?.value ?? 0,
            }))}
            title="NPL 15-90 dias por Tipo"
            type="line"
            color={C.amber}
            color2={C.cyan}
            label="Livres"
            label2="Direcionados"
            unit="%"
          />
        </div>
      </Section>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* INADIMPLÊNCIA PF                                            */}
      {/* ════════════════════════════════════════════════════════════ */}
      <Section title="Inadimplência Pessoas Físicas" icon={Users}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <MacroChart
            data={inadPFLivres.map((d, i) => ({
              ...d,
              value2: inadPFDir[i]?.value ?? 0,
            }))}
            title="PF — NPL >90d Livres vs Direcionados"
            type="line"
            color={C.red}
            color2={C.emerald}
            label="Livres"
            label2="Direcionados"
            unit="%"
          />
          <MacroChart
            data={inadPF}
            title="PF — NPL >90d Total"
            type="area"
            color={C.red}
            label="PF Total"
            unit="%"
          />
        </div>
      </Section>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* INADIMPLÊNCIA PJ                                            */}
      {/* ════════════════════════════════════════════════════════════ */}
      <Section title="Inadimplência Empresas" icon={Building2}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <MacroChart
            data={inadPJLivres.map((d, i) => ({
              ...d,
              value2: inadPJDir[i]?.value ?? 0,
            }))}
            title="PJ — NPL >90d Livres vs Direcionados"
            type="line"
            color={C.red}
            color2={C.emerald}
            label="Livres"
            label2="Direcionados"
            unit="%"
          />
          <MacroChart
            data={inadPJ}
            title="PJ — NPL >90d Total"
            type="area"
            color={C.amber}
            label="PJ Total"
            unit="%"
          />
        </div>
      </Section>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* TAXA DE JUROS                                               */}
      {/* ════════════════════════════════════════════════════════════ */}
      <Section title="Taxa de Juros" icon={Percent}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <MacroChart
            data={taxaPF.map((d, i) => ({
              ...d,
              value2: taxaPJ[i]?.value ?? 0,
            }))}
            title="Taxa Média Anual por Tomador"
            type="line"
            color={C.red}
            color2={C.indigo}
            label="PF"
            label2="PJ"
            unit="% a.a."
          />
          <MacroChart
            data={taxaPFLivres.map((d, i) => ({
              ...d,
              value2: taxaPJLivres[i]?.value ?? 0,
            }))}
            title="Taxa Média — Livres PF vs PJ"
            type="line"
            color={C.red}
            color2={C.indigo}
            label="PF Livres"
            label2="PJ Livres"
            unit="% a.a."
          />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <MacroChart
            data={taxaPFDir.map((d, i) => ({
              ...d,
              value2: taxaPJDir[i]?.value ?? 0,
            }))}
            title="Taxa Média — Direcionados PF vs PJ"
            type="line"
            color={C.cyan}
            color2={C.violet}
            label="PF Dir."
            label2="PJ Dir."
            unit="% a.a."
          />
        </div>
      </Section>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* SPREAD                                                      */}
      {/* ════════════════════════════════════════════════════════════ */}
      <Section title="Spread dos Empréstimos" icon={ArrowLeftRight}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <MacroChart
            data={spreadPF.map((d, i) => ({
              ...d,
              value2: spreadPJ[i]?.value ?? 0,
            }))}
            title="Spread por Tomador"
            type="line"
            color={C.emerald}
            color2={C.indigo}
            label="PF"
            label2="PJ"
            unit=" p.p."
          />
          <MacroChart
            data={spreadLivres.map((d, i) => ({
              ...d,
              value2: spreadDir[i]?.value ?? 0,
            }))}
            title="Spread por Tipo"
            type="line"
            color={C.amber}
            color2={C.cyan}
            label="Livres"
            label2="Direcionados"
            unit=" p.p."
          />
        </div>
      </Section>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* ALAVANCAGEM PF                                              */}
      {/* ════════════════════════════════════════════════════════════ */}
      <Section title="Alavancagem Pessoas Físicas" icon={Scale}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <MacroChart
            data={endivExclHab.map((d, i) => ({
              ...d,
              value2: endivComHab[i]?.value ?? 0,
            }))}
            title="Endividamento das Famílias (% Renda Disponível)"
            type="line"
            color={C.amber}
            color2={C.red}
            label="Excl. Hab."
            label2="Com Hab."
            unit="%"
          />
          <MacroChart
            data={comprometRenda}
            title="Comprometimento da Renda com Serviço da Dívida"
            type="area"
            color={C.red}
            label="Comprometimento"
            unit="%"
          />
        </div>
      </Section>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* HEATMAPS                                                    */}
      {/* ════════════════════════════════════════════════════════════ */}
      <CreditHeatmap
        title="Heatmap — Saldo Crédito PF por Modalidade"
        rows={heatmapPF}
        unit="R$ bi"
        colorScale="sequential"
        invertColors={false}
      />

      <CreditHeatmap
        title="Heatmap — Saldo Crédito PJ por Modalidade"
        rows={heatmapPJ}
        unit="R$ bi"
        colorScale="sequential"
        invertColors={false}
      />

      <CreditHeatmap
        title="Heatmap — Inadimplência PF (>90 dias)"
        rows={heatmapInadPF}
        unit="%"
        colorScale="sequential"
        invertColors={true}
      />

      <CreditHeatmap
        title="Heatmap — Inadimplência PJ (>90 dias)"
        rows={heatmapInadPJ}
        unit="%"
        colorScale="sequential"
        invertColors={true}
      />

      {/* ─── Source footer ─── */}
      <div className="border-t border-zinc-800/30 pt-3 flex items-center justify-between text-[9px] text-zinc-700 font-mono">
        <span>Fonte: Banco Central do Brasil — SGS · Overview Mensal · ~75 séries</span>
        <span>Dados: Mensal (último dia útil) · Variação a/a calculada</span>
      </div>
    </div>
  );
};
