/**
 * TesouroSimulator.tsx — P0-10 Renda Fixa audit (20/04/2026)
 *
 * Simulador de Tesouro Direto com:
 *   • LTN (Prefixado) — zero-coupon, trava taxa nominal
 *   • LFT (Selic)    — pós-fixado, rende Selic
 *   • NTN-B (IPCA+)  — cupom semestral 6%a.a. sobre valor atualizado pelo IPCA
 *
 * Descontos:
 *   • IR regressivo RF (22,5% ≤180d; 20% 181-360d; 17,5% 361-720d; 15% >720d)
 *   • Custódia B3: 0,20% a.a. sobre saldo (isento até R$ 10k em Tesouro Selic)
 *
 * Saídas:
 *   • Valor de face / valor de resgate / IR devido / custódia total / líquido
 *   • Taxa líquida anualizada equivalente vs CDI e poupança
 *   • Resgate antecipado com MaM estimado (Δy shift input)
 *   • Tabela ano-a-ano com evolução de saldo nominal
 */
import { useMemo, useState } from "react";

type TituloKind = "ltn" | "lft" | "ntnb";

interface Props {
  /** Selic atual (% a.a.) */
  selicAtual?: number;
  /** CDI atual (% a.a.) */
  cdiAtual?: number;
  /** IPCA esperado (% a.a.) — para projeção NTN-B */
  ipcaEsperado?: number;
  /** Rendimento Poupança (%/mês) */
  poupancaMes?: number;
  className?: string;
}

const PRESETS: Record<
  TituloKind,
  { label: string; taxa: number; anos: number; desc: string }
> = {
  ltn: {
    label: "LTN — Tesouro Prefixado",
    taxa: 13.9,
    anos: 3,
    desc: "Zero-cupom · taxa travada · face R$ 1.000",
  },
  lft: {
    label: "LFT — Tesouro Selic",
    taxa: 0.05, // ágio/deságio; rendimento é a Selic em si
    anos: 6,
    desc: "Pós-fixado · rende Selic + ágio/deságio",
  },
  ntnb: {
    label: "NTN-B — Tesouro IPCA+",
    taxa: 7.2,
    anos: 10,
    desc: "Juro real + IPCA · cupom semestral 6% a.a.",
  },
};

function calcIR(anos: number): number {
  const dias = anos * 365;
  if (dias <= 180) return 0.225;
  if (dias <= 360) return 0.2;
  if (dias <= 720) return 0.175;
  return 0.15;
}

function compounding(annualPct: number, years: number): number {
  return Math.pow(1 + annualPct / 100, years);
}

function money(v: number): string {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });
}

export function TesouroSimulator({
  selicAtual = 14.75,
  cdiAtual = 14.65,
  ipcaEsperado = 4.5,
  poupancaMes = 0.5,
  className = "",
}: Props) {
  const [kind, setKind] = useState<TituloKind>("ltn");
  const [aporte, setAporte] = useState(10_000);
  const [anos, setAnos] = useState<number>(PRESETS.ltn.anos);
  const [taxaCustom, setTaxaCustom] = useState<number>(PRESETS.ltn.taxa);
  const [deltaY, setDeltaY] = useState<number>(0);

  // Reset defaults when kind changes
  function handleKindChange(next: TituloKind) {
    setKind(next);
    setAnos(PRESETS[next].anos);
    setTaxaCustom(PRESETS[next].taxa);
  }

  const result = useMemo(() => {
    const years = Math.max(0.25, anos);
    const irAliquota = calcIR(years);

    // Taxa bruta anual nominal conforme título
    let brutaAA: number;
    if (kind === "ltn") brutaAA = taxaCustom;
    else if (kind === "lft") brutaAA = selicAtual + taxaCustom; // ágio/deságio
    else brutaAA = (1 + taxaCustom / 100) * (1 + ipcaEsperado / 100) * 100 - 100;

    const fator = compounding(brutaAA, years);
    const valorBrutoFinal = aporte * fator;
    const ganhoBruto = valorBrutoFinal - aporte;

    // Custódia B3: 0,20% a.a. sobre saldo (isenção Selic até R$ 10k simplificada)
    const custodiaTaxa = 0.0020;
    const selicIsencao = kind === "lft" && aporte <= 10_000;
    // aprox: custódia incide sobre saldo médio → (aporte + final)/2
    const custodiaTotal = selicIsencao
      ? 0
      : ((aporte + valorBrutoFinal) / 2) * custodiaTaxa * years;

    const ganhoApósCustodia = ganhoBruto - custodiaTotal;
    const irDevido = Math.max(0, ganhoApósCustodia * irAliquota);
    const liquido = aporte + ganhoApósCustodia - irDevido;

    // Taxa anualizada líquida equivalente
    const liqAA = years > 0 ? (Math.pow(liquido / aporte, 1 / years) - 1) * 100 : 0;

    // Comparação com CDI 100% e poupança no mesmo prazo
    const cdiFinal = aporte * compounding(cdiAtual, years);
    const cdiLiquido = aporte + (cdiFinal - aporte) * (1 - irAliquota);
    const cdiLiqAA = years > 0 ? (Math.pow(cdiLiquido / aporte, 1 / years) - 1) * 100 : 0;

    const poupAnual = Math.pow(1 + poupancaMes / 100, 12) - 1;
    const poupFinal = aporte * Math.pow(1 + poupAnual, years);

    // MaM: estimativa de variação % no preço ao vender agora com Δy bps
    // Proxy: ΔP/P ≈ −D × Δy, duration ≈ anos (aproximação zero-coupon)
    const durationProxy = kind === "ltn" ? years : kind === "ntnb" ? years * 0.85 : 0.1;
    const mamShiftPct = -durationProxy * (deltaY / 100);
    const valorMam = aporte * (1 + mamShiftPct / 100);

    // Tabela ano-a-ano (saldo nominal bruto)
    const fullYears = Math.floor(years);
    const table = Array.from({ length: fullYears + 1 }, (_, i) => {
      const y = i;
      const saldo = aporte * compounding(brutaAA, y);
      return { ano: y, saldo };
    });

    return {
      brutaAA,
      valorBrutoFinal,
      ganhoBruto,
      custodiaTotal,
      irDevido,
      irAliquota,
      liquido,
      liqAA,
      cdiLiquido,
      cdiLiqAA,
      poupFinal,
      valorMam,
      mamShiftPct,
      table,
      selicIsencao,
    };
  }, [kind, aporte, anos, taxaCustom, deltaY, selicAtual, cdiAtual, ipcaEsperado, poupancaMes]);

  return (
    <section
      className={`bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-3 md:p-4 ${className}`}
      aria-label="Simulador Tesouro Direto"
    >
      <div className="mb-3 flex items-start justify-between flex-wrap gap-2">
        <div>
          <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-[#10B981]">
            Simulador Tesouro Direto
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            Rentabilidade líquida com IR regressivo, custódia B3 e MaM estimado
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {(Object.keys(PRESETS) as TituloKind[]).map((k) => (
          <button
            key={k}
            onClick={() => handleKindChange(k)}
            className={`px-2.5 py-1 text-[10px] font-mono rounded border transition-colors ${
              kind === k
                ? "bg-[#10B981]/15 text-[#10B981] border-[#10B981]/40"
                : "bg-transparent text-zinc-500 border-[#1a1a1a] hover:text-zinc-300"
            }`}
          >
            {PRESETS[k].label}
          </button>
        ))}
      </div>

      <p className="text-[10px] text-zinc-500 mb-3">{PRESETS[kind].desc}</p>

      {/* Inputs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <label className="block">
          <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-mono">
            Aporte (R$)
          </span>
          <input
            type="number"
            value={aporte}
            min={100}
            step={500}
            onChange={(e) => setAporte(Math.max(0, Number(e.target.value) || 0))}
            className="w-full mt-1 bg-[#0f0f0f] border border-[#1a1a1a] rounded px-2 py-1 text-xs font-mono text-zinc-200 focus:border-[#10B981]/60 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-mono">
            Prazo (anos)
          </span>
          <input
            type="number"
            value={anos}
            min={0.25}
            max={30}
            step={0.25}
            onChange={(e) => setAnos(Math.max(0.25, Number(e.target.value) || 0.25))}
            className="w-full mt-1 bg-[#0f0f0f] border border-[#1a1a1a] rounded px-2 py-1 text-xs font-mono text-zinc-200 focus:border-[#10B981]/60 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-mono">
            {kind === "ntnb"
              ? "Juro real (% a.a.)"
              : kind === "lft"
              ? "Ágio/deságio (% a.a.)"
              : "Taxa prefixada (% a.a.)"}
          </span>
          <input
            type="number"
            value={taxaCustom}
            step={0.1}
            onChange={(e) => setTaxaCustom(Number(e.target.value) || 0)}
            className="w-full mt-1 bg-[#0f0f0f] border border-[#1a1a1a] rounded px-2 py-1 text-xs font-mono text-zinc-200 focus:border-[#10B981]/60 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-mono">
            Δ Taxa MaM (bps)
          </span>
          <input
            type="number"
            value={deltaY}
            step={10}
            onChange={(e) => setDeltaY(Number(e.target.value) || 0)}
            className="w-full mt-1 bg-[#0f0f0f] border border-[#1a1a1a] rounded px-2 py-1 text-xs font-mono text-zinc-200 focus:border-[#10B981]/60 focus:outline-none"
          />
        </label>
      </div>

      {/* Resultados */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <KpiBlock
          label="Valor final bruto"
          value={money(result.valorBrutoFinal)}
          sub={`Taxa: ${result.brutaAA.toFixed(2)}% a.a.`}
        />
        <KpiBlock
          label="IR devido"
          value={money(result.irDevido)}
          sub={`Alíquota: ${(result.irAliquota * 100).toFixed(1)}%`}
          accent="text-amber-400"
        />
        <KpiBlock
          label="Custódia B3"
          value={result.selicIsencao ? "Isento" : money(result.custodiaTotal)}
          sub={result.selicIsencao ? "LFT ≤ R$ 10k" : "0,20% a.a."}
          accent={result.selicIsencao ? "text-emerald-400" : "text-zinc-300"}
        />
        <KpiBlock
          label="Líquido final"
          value={money(result.liquido)}
          sub={`${result.liqAA.toFixed(2)}% a.a. líq.`}
          accent="text-emerald-400"
        />
      </div>

      {/* Comparação */}
      <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded p-3 mb-3">
        <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 mb-2">
          Comparação no mesmo prazo
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[10px] font-mono">
          <div className="flex justify-between">
            <span className="text-zinc-400">CDI 100% (líq.):</span>
            <span className="text-zinc-200 tabular-nums">
              {money(result.cdiLiquido)} ({result.cdiLiqAA.toFixed(2)}% a.a.)
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Poupança:</span>
            <span className="text-zinc-200 tabular-nums">{money(result.poupFinal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Δ vs CDI:</span>
            <span
              className={`tabular-nums ${
                result.liquido > result.cdiLiquido ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {result.liquido > result.cdiLiquido ? "+" : ""}
              {money(result.liquido - result.cdiLiquido)}
            </span>
          </div>
        </div>
      </div>

      {/* MaM */}
      {deltaY !== 0 && (
        <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded p-3 mb-3">
          <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 mb-2">
            Resgate antecipado (marcação a mercado)
          </div>
          <div className="flex justify-between items-baseline text-[10px] font-mono">
            <span className="text-zinc-400">
              Estimativa com Δy de {deltaY} bps:
            </span>
            <span
              className={`tabular-nums text-xs ${
                result.mamShiftPct > 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {money(result.valorMam)} ({result.mamShiftPct.toFixed(2)}%)
            </span>
          </div>
          <p className="text-[9px] text-zinc-600 mt-1 leading-relaxed">
            Proxy: ΔP/P ≈ −D × Δy. Duration aproximada pelo prazo (LTN/NTN-B) ou 0,1
            (LFT, pós-fixado). Não considera convexidade.
          </p>
        </div>
      )}

      {/* Tabela ano-a-ano */}
      {result.table.length > 1 && (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-[10px] font-mono">
            <thead>
              <tr className="text-zinc-500 border-b border-[#1a1a1a]">
                <th className="text-left py-1 px-2 font-normal">Ano</th>
                <th className="text-right py-1 px-2 font-normal">Saldo bruto</th>
                <th className="text-right py-1 px-2 font-normal">Ganho acum.</th>
              </tr>
            </thead>
            <tbody>
              {result.table.map((row) => (
                <tr key={row.ano} className="border-b border-[#141414] last:border-b-0">
                  <td className="py-1 px-2 text-zinc-300">{row.ano}</td>
                  <td className="py-1 px-2 text-right tabular-nums text-zinc-200">
                    {money(row.saldo)}
                  </td>
                  <td className="py-1 px-2 text-right tabular-nums text-emerald-400">
                    {row.ano === 0 ? "—" : money(row.saldo - aporte)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[9px] text-zinc-600 mt-3 leading-relaxed">
        Simulação educacional. Não considera spread bid/offer, come-cotas (não aplicável
        ao Tesouro Direto) nem possíveis custos de corretagem. Premissas: Selic{" "}
        {selicAtual.toFixed(2)}% · CDI {cdiAtual.toFixed(2)}% · IPCA esperado{" "}
        {ipcaEsperado.toFixed(2)}% · Poupança {poupancaMes.toFixed(2)}%/mês.
      </p>
    </section>
  );
}

function KpiBlock({
  label,
  value,
  sub,
  accent = "text-zinc-200",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded p-2">
      <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 mb-1">
        {label}
      </div>
      <div className={`text-xs font-mono font-semibold tabular-nums ${accent}`}>
        {value}
      </div>
      {sub && <div className="text-[9px] text-zinc-600 mt-0.5 font-mono">{sub}</div>}
    </div>
  );
}

export default TesouroSimulator;
