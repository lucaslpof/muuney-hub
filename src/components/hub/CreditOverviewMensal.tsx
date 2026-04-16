import { useMemo } from "react";
import { MacroChart } from "@/components/hub/MacroChart";
import { CreditHeatmap } from "@/components/hub/CreditHeatmap";
import {
  useHubSeriesBundle,
  pickSeries,
  type SeriesDataPoint,
} from "@/hooks/useHubData";
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
  /* ══════ Data: fetch bundles by REAL category names ══════ */
  const { data: saldoBundle } = useHubSeriesBundle("saldo_credito", period, "credito");
  const { data: pfModalBundle } = useHubSeriesBundle("saldo_pf_modal", period, "credito");
  const { data: pjModalBundle } = useHubSeriesBundle("saldo_pj_modal", period, "credito");
  const { data: concessaoBundle } = useHubSeriesBundle("concessao", period, "credito");
  const { data: inadBundle } = useHubSeriesBundle("inadimplencia", period, "credito");
  const { data: inadDetalheBundle } = useHubSeriesBundle("inadim_detalhe", period, "credito");
  const { data: inadBundle15 } = useHubSeriesBundle("inadim_15_90", period, "credito");
  const { data: taxaBundle } = useHubSeriesBundle("taxa", period, "credito");
  const { data: spreadBundle } = useHubSeriesBundle("spread", period, "credito");
  const { data: alavBundle } = useHubSeriesBundle("alavancagem", period, "credito");

  /* ══════ Pick individual series by BACEN SGS code ══════ */

  // Saldos agregados (category: saldo_credito)
  const saldoTotal = pickSeries(saldoBundle, "20540");
  const saldoPF    = pickSeries(saldoBundle, "20541");
  const saldoPJ    = pickSeries(saldoBundle, "20542");
  const saldoLivres = pickSeries(saldoBundle, "20543");
  const saldoDirecionados = pickSeries(saldoBundle, "20544");

  // PF por modalidade (category: saldo_pf_modal)
  const pfPessoal      = pickSeries(pfModalBundle, "20570");
  const pfConsignado   = pickSeries(pfModalBundle, "20572");
  const pfRural        = pickSeries(pfModalBundle, "20593");
  const pfHabitacional = pickSeries(pfModalBundle, "20599");
  const pfBndes        = pickSeries(pfModalBundle, "20606");
  // Veículos and Cartão are in saldo_credito, not saldo_pf_modal
  const pfVeiculos = pickSeries(saldoBundle, "20581");
  const pfCartao   = pickSeries(saldoBundle, "20590");

  // PJ por modalidade (category: saldo_pj_modal)
  const pjCapitalGiro   = pickSeries(pjModalBundle, "20551");
  const pjComercioExt   = pickSeries(pjModalBundle, "20565");   // Financ. Exportações in data
  const pjRural         = pickSeries(pjModalBundle, "20611");
  const pjHabitacional  = pickSeries(pjModalBundle, "20614");
  const pjBndes         = pickSeries(pjModalBundle, "20622");

  // Concessões (category: concessao)
  const concessaoPF       = pickSeries(concessaoBundle, "20631");
  const concessaoPJ       = pickSeries(concessaoBundle, "20632");
  const concessaoPFLivres = pickSeries(concessaoBundle, "20633");
  const concessaoPJLivres = pickSeries(concessaoBundle, "20634");

  // Inadimplência >90d (category: inadimplencia)
  const inadTotal  = pickSeries(inadBundle, "21082");
  const inadPF     = pickSeries(inadBundle, "21083");
  const inadPJ     = pickSeries(inadBundle, "21084");

  // Inadimplência detalhada (category: inadim_detalhe)
  const inadLivres       = pickSeries(inadDetalheBundle, "21085");
  const inadDirecionados = pickSeries(inadDetalheBundle, "21086");
  const inadPFLivres     = pickSeries(inadDetalheBundle, "21087");
  const inadPJLivres     = pickSeries(inadDetalheBundle, "21088");
  const inadPFDir        = pickSeries(inadDetalheBundle, "21089");
  const inadPJDir        = pickSeries(inadDetalheBundle, "21090");

  // Inadimplência 15-90d (category: inadim_15_90 — stored in saldo_pj_modal on BACEN)
  // These codes are in hub_credito_series under saldo_pj_modal category: 21128
  // And in inadim_15_90 meta category but no data.
  // Fallback: try saldo_pj_modal where 21128 has 62 data points
  const inad15Total  = pickSeries(inadBundle15, "21128").length ? pickSeries(inadBundle15, "21128") : pickSeries(pjModalBundle, "21128");
  const inad15Livres = pickSeries(inadBundle15, "21131");
  const inad15Dir    = pickSeries(inadBundle15, "21132");

  // Taxas (category: taxa)
  const taxaPF       = pickSeries(taxaBundle, "20714");
  const taxaPJ       = pickSeries(taxaBundle, "20715");
  const taxaPFLivres = pickSeries(taxaBundle, "20740");
  const taxaPJLivres = pickSeries(taxaBundle, "20751");
  const taxaPFDir    = pickSeries(taxaBundle, "20760");
  const taxaPJDir    = pickSeries(taxaBundle, "20763");

  // Spreads (category: spread)
  const spreadPF     = pickSeries(spreadBundle, "20783");
  const spreadPJ     = pickSeries(spreadBundle, "20784");
  const spreadLivres = pickSeries(spreadBundle, "20785");
  const spreadDir    = pickSeries(spreadBundle, "20787");

  // Alavancagem (category: alavancagem)
  const endivExclHab   = pickSeries(alavBundle, "29037");
  const endivComHab    = pickSeries(alavBundle, "29038");
  const comprometRenda = pickSeries(alavBundle, "29039");

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
    { label: "Comércio Exterior", values: pjComercioExt },
    { label: "Rural", values: pjRural },
    { label: "Habitacional", values: pjHabitacional },
    { label: "BNDES", values: pjBndes },
  ], [pjCapitalGiro, pjComercioExt, pjRural, pjHabitacional, pjBndes]);

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
            data={pjCapitalGiro}
            title="PJ — Capital de Giro"
            type="line"
            color={C.emerald}
            label="Capital Giro"
            unit=" R$ bi"
          />
          <MacroChart
            data={pjComercioExt}
            title="PJ — Financiamento Comércio Exterior"
            type="line"
            color={C.amber}
            label="Com. Ext."
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
            data={inadPF.map((d, i) => ({
              ...d,
              value2: inadPJ[i]?.value ?? 0,
            }))}
            title="NPL >90d por Tomador"
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
