/**
 * RfPortfolioCalculator.tsx — P0-11 Renda Fixa audit (20/04/2026)
 *
 * Calculadora de Carteira RF — até 8 holdings em uma mesma view:
 *   • Kinds: LTN, LFT, NTN-B, CDB pré, CDB pós (%CDI), CRI/CRA isento, Debênture
 *   • Inputs por holding: nome, kind, valor aplicado, taxa/premio, prazo (anos)
 *   • Agregados: yield blend (médio ponderado), duration ponderada, DV01,
 *     exposição por kind, carry esperado em 12m, matriz de stress Δy {−200, 0, +200 bps}
 *
 * Uso: seção "Analytics" de HubRendaFixa, bloco complementar ao simulador
 * individual. Não depende de backend — 100% local.
 */
import { useMemo, useState } from "react";

type HoldingKind = "ltn" | "lft" | "ntnb" | "cdb_pre" | "cdb_pos" | "cri_cra" | "deb";

interface Holding {
  id: string;
  nome: string;
  kind: HoldingKind;
  valor: number;
  taxa: number; // a.a. (ou %CDI para cdb_pos)
  anos: number;
}

const KIND_LABELS: Record<HoldingKind, string> = {
  ltn: "LTN",
  lft: "LFT",
  ntnb: "NTN-B",
  cdb_pre: "CDB Pré",
  cdb_pos: "CDB %CDI",
  cri_cra: "CRI/CRA",
  deb: "Debênture",
};

const KIND_COLORS: Record<HoldingKind, string> = {
  ltn: "#10B981",
  lft: "#06B6D4",
  ntnb: "#F59E0B",
  cdb_pre: "#8B5CF6",
  cdb_pos: "#6366F1",
  cri_cra: "#EC4899",
  deb: "#F97316",
};

interface Props {
  selicAtual?: number;
  cdiAtual?: number;
  ipcaEsperado?: number;
  className?: string;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function money(v: number): string {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

/**
 * Yield nominal anual de cada holding.
 * • LTN / CDB Pré / Debênture / CRI-CRA → taxa contratada
 * • LFT → Selic + ágio/deságio
 * • NTN-B → (1+juroReal)(1+IPCA) − 1
 * • CDB %CDI → CDI × (percentual/100)
 */
function yieldOf(h: Holding, ctx: { selic: number; cdi: number; ipca: number }): number {
  switch (h.kind) {
    case "ltn":
    case "cdb_pre":
    case "cri_cra":
    case "deb":
      return h.taxa;
    case "lft":
      return ctx.selic + h.taxa;
    case "ntnb":
      return ((1 + h.taxa / 100) * (1 + ctx.ipca / 100) - 1) * 100;
    case "cdb_pos":
      return ctx.cdi * (h.taxa / 100);
    default:
      return 0;
  }
}

/**
 * Duration proxy por kind:
 * • LFT / CDB %CDI → 0,1 (quase imune a Δy)
 * • CRI/CRA / Debênture → 0,85 × anos (cupons rebatem duration ~15%)
 * • NTN-B → 0,85 × anos (cupom semestral)
 * • LTN / CDB Pré → anos (zero-cupom)
 */
function durationOf(h: Holding): number {
  if (h.kind === "lft" || h.kind === "cdb_pos") return 0.1;
  if (h.kind === "cri_cra" || h.kind === "deb" || h.kind === "ntnb") return h.anos * 0.85;
  return h.anos;
}

export function RfPortfolioCalculator({
  selicAtual = 14.75,
  cdiAtual = 14.65,
  ipcaEsperado = 4.5,
  className = "",
}: Props) {
  const [holdings, setHoldings] = useState<Holding[]>([
    { id: uid(), nome: "LTN 2029", kind: "ltn", valor: 20_000, taxa: 13.9, anos: 3 },
    { id: uid(), nome: "NTN-B 2035", kind: "ntnb", valor: 30_000, taxa: 7.2, anos: 10 },
    { id: uid(), nome: "Tesouro Selic", kind: "lft", valor: 25_000, taxa: 0.05, anos: 6 },
    { id: uid(), nome: "CDB 118%CDI", kind: "cdb_pos", valor: 25_000, taxa: 118, anos: 2 },
  ]);

  const ctx = { selic: selicAtual, cdi: cdiAtual, ipca: ipcaEsperado };

  const aggregate = useMemo(() => {
    const total = holdings.reduce((s, h) => s + (h.valor > 0 ? h.valor : 0), 0);
    if (total <= 0) {
      return {
        total: 0,
        blendYield: 0,
        blendDuration: 0,
        dv01: 0,
        carry12m: 0,
        byKind: {} as Record<HoldingKind, number>,
        stress: { down: 0, base: 0, up: 0 },
        enriched: [] as Array<Holding & { weight: number; yield: number; duration: number }>,
      };
    }
    let blendYield = 0;
    let blendDuration = 0;
    const byKind: Record<string, number> = {};
    const enriched = holdings.map((h) => {
      const weight = h.valor / total;
      const y = yieldOf(h, ctx);
      const d = durationOf(h);
      blendYield += weight * y;
      blendDuration += weight * d;
      byKind[h.kind] = (byKind[h.kind] || 0) + h.valor;
      return { ...h, weight, yield: y, duration: d };
    });

    const dv01 = total * blendDuration * 0.0001; // R$ por 1 bp
    const carry12m = total * (blendYield / 100);

    const deltaYbps = 200;
    const stressDown = enriched.reduce(
      (acc, h) => acc + h.valor * (1 - h.duration * (-deltaYbps / 10000)),
      0,
    );
    const stressUp = enriched.reduce(
      (acc, h) => acc + h.valor * (1 - h.duration * (deltaYbps / 10000)),
      0,
    );
    // stress proxy: P_new = V × (1 − D × Δy). Δy em fração (not bps).

    return {
      total,
      blendYield,
      blendDuration,
      dv01,
      carry12m,
      byKind: byKind as Record<HoldingKind, number>,
      stress: { down: stressDown, base: total, up: stressUp },
      enriched,
    };
  }, [holdings, selicAtual, cdiAtual, ipcaEsperado]);

  function updateHolding(id: string, patch: Partial<Holding>) {
    setHoldings((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch } : h)));
  }
  function removeHolding(id: string) {
    setHoldings((prev) => prev.filter((h) => h.id !== id));
  }
  function addHolding() {
    if (holdings.length >= 8) return;
    setHoldings((prev) => [
      ...prev,
      {
        id: uid(),
        nome: `Ativo ${prev.length + 1}`,
        kind: "ltn",
        valor: 10_000,
        taxa: 13.5,
        anos: 3,
      },
    ]);
  }

  return (
    <section
      className={`bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-3 md:p-4 ${className}`}
      aria-label="Calculadora de carteira renda fixa"
    >
      <div className="flex items-start justify-between mb-3 gap-2 flex-wrap">
        <div>
          <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-[#10B981]">
            Calculadora de carteira RF
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            Yield ponderado · duration blend · DV01 · stress ±200 bps · até 8 holdings
          </div>
        </div>
        <button
          onClick={addHolding}
          disabled={holdings.length >= 8}
          className="text-[10px] font-mono px-2.5 py-1 rounded border border-[#10B981]/40 text-[#10B981] hover:bg-[#10B981]/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          + holding ({holdings.length}/8)
        </button>
      </div>

      {/* Holdings table */}
      <div className="overflow-x-auto -mx-1 mb-4">
        <table className="w-full text-[10px] font-mono">
          <thead>
            <tr className="text-zinc-500 border-b border-[#1a1a1a]">
              <th className="text-left py-1 px-1 font-normal">Nome</th>
              <th className="text-left py-1 px-1 font-normal">Tipo</th>
              <th className="text-right py-1 px-1 font-normal">Valor (R$)</th>
              <th className="text-right py-1 px-1 font-normal">Taxa</th>
              <th className="text-right py-1 px-1 font-normal">Prazo</th>
              <th className="text-right py-1 px-1 font-normal">Yield ef.</th>
              <th className="text-right py-1 px-1 font-normal">Peso</th>
              <th className="w-6"></th>
            </tr>
          </thead>
          <tbody>
            {aggregate.enriched.map((h) => (
              <tr
                key={h.id}
                className="border-b border-[#141414] last:border-b-0 hover:bg-[#0f0f0f] transition-colors"
              >
                <td className="py-1 px-1">
                  <input
                    type="text"
                    value={h.nome}
                    onChange={(e) => updateHolding(h.id, { nome: e.target.value })}
                    className="w-28 md:w-32 bg-transparent text-zinc-200 focus:outline-none focus:border-b focus:border-[#10B981]/60"
                  />
                </td>
                <td className="py-1 px-1">
                  <select
                    value={h.kind}
                    onChange={(e) =>
                      updateHolding(h.id, { kind: e.target.value as HoldingKind })
                    }
                    className="bg-transparent text-zinc-300 text-[9px] focus:outline-none"
                    style={{ color: KIND_COLORS[h.kind] }}
                  >
                    {(Object.keys(KIND_LABELS) as HoldingKind[]).map((k) => (
                      <option key={k} value={k} className="bg-[#0a0a0a]">
                        {KIND_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1 px-1 text-right">
                  <input
                    type="number"
                    value={h.valor}
                    step={500}
                    onChange={(e) =>
                      updateHolding(h.id, { valor: Math.max(0, Number(e.target.value) || 0) })
                    }
                    className="w-24 bg-transparent text-right text-zinc-200 tabular-nums focus:outline-none focus:border-b focus:border-[#10B981]/60"
                  />
                </td>
                <td className="py-1 px-1 text-right">
                  <input
                    type="number"
                    value={h.taxa}
                    step={0.1}
                    onChange={(e) =>
                      updateHolding(h.id, { taxa: Number(e.target.value) || 0 })
                    }
                    className="w-16 bg-transparent text-right text-zinc-200 tabular-nums focus:outline-none focus:border-b focus:border-[#10B981]/60"
                  />
                  <span className="text-zinc-600 ml-0.5">
                    {h.kind === "cdb_pos" ? "%CDI" : "%"}
                  </span>
                </td>
                <td className="py-1 px-1 text-right">
                  <input
                    type="number"
                    value={h.anos}
                    step={0.5}
                    min={0.25}
                    onChange={(e) =>
                      updateHolding(h.id, {
                        anos: Math.max(0.25, Number(e.target.value) || 0.25),
                      })
                    }
                    className="w-12 bg-transparent text-right text-zinc-200 tabular-nums focus:outline-none focus:border-b focus:border-[#10B981]/60"
                  />
                  <span className="text-zinc-600 ml-0.5">a</span>
                </td>
                <td className="py-1 px-1 text-right tabular-nums text-emerald-400">
                  {h.yield.toFixed(2)}%
                </td>
                <td className="py-1 px-1 text-right tabular-nums text-zinc-300">
                  {(h.weight * 100).toFixed(1)}%
                </td>
                <td className="py-1 px-1 text-right">
                  <button
                    onClick={() => removeHolding(h.id)}
                    className="text-zinc-600 hover:text-red-400 transition-colors"
                    aria-label={`Remover ${h.nome}`}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Aggregate KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        <MiniBlock label="PL total" value={money(aggregate.total)} />
        <MiniBlock
          label="Yield ponderado"
          value={`${aggregate.blendYield.toFixed(2)}% a.a.`}
          accent="text-emerald-400"
        />
        <MiniBlock
          label="Duration blend"
          value={`${aggregate.blendDuration.toFixed(2)}`}
          sub="anos"
        />
        <MiniBlock
          label="DV01"
          value={money(aggregate.dv01)}
          sub="por 1 bp"
          accent="text-amber-400"
        />
        <MiniBlock
          label="Carry 12m esperado"
          value={money(aggregate.carry12m)}
          accent="text-emerald-400"
        />
      </div>

      {/* Stress */}
      <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded p-3 mb-3">
        <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 mb-2">
          Stress MaM ±200 bps (proxy ΔP = −D × Δy)
        </div>
        <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
          <StressCell
            label="Δy −200 bps"
            value={aggregate.stress.down}
            base={aggregate.total}
            positiveIsGood={true}
          />
          <StressCell
            label="Base (hoje)"
            value={aggregate.stress.base}
            base={aggregate.total}
          />
          <StressCell
            label="Δy +200 bps"
            value={aggregate.stress.up}
            base={aggregate.total}
            positiveIsGood={false}
          />
        </div>
        <p className="text-[9px] text-zinc-600 mt-2 leading-relaxed">
          Posições pós-fixadas (LFT/CDB %CDI) têm duration proxy 0,1 → quase imunes.
          Pré e IPCA+ absorvem o choque pela duration ponderada.
        </p>
      </div>

      {/* Exposição por kind */}
      <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded p-3">
        <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 mb-2">
          Exposição por tipo
        </div>
        <div className="flex h-2 rounded overflow-hidden">
          {(Object.keys(aggregate.byKind) as HoldingKind[]).map((k) => {
            const pct = aggregate.total > 0 ? (aggregate.byKind[k] / aggregate.total) * 100 : 0;
            if (pct < 0.1) return null;
            return (
              <div
                key={k}
                title={`${KIND_LABELS[k]}: ${pct.toFixed(1)}%`}
                style={{ width: `${pct}%`, backgroundColor: KIND_COLORS[k] }}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 mt-2 text-[9px] font-mono">
          {(Object.keys(aggregate.byKind) as HoldingKind[]).map((k) => {
            const pct = aggregate.total > 0 ? (aggregate.byKind[k] / aggregate.total) * 100 : 0;
            return (
              <span key={k} className="flex items-center gap-1 text-zinc-400">
                <span
                  className="inline-block w-2 h-2 rounded-sm"
                  style={{ backgroundColor: KIND_COLORS[k] }}
                />
                {KIND_LABELS[k]} · {pct.toFixed(1)}%
              </span>
            );
          })}
        </div>
      </div>

      <p className="text-[9px] text-zinc-600 mt-3 leading-relaxed">
        Premissas: Selic {selicAtual.toFixed(2)}% · CDI {cdiAtual.toFixed(2)}% · IPCA
        esperado {ipcaEsperado.toFixed(2)}%. Yield e duration são proxies — não
        consideram convexidade, reinvestimento de cupom nem spread bid/offer. Para
        simulação com IR e custódia, use o Simulador Tesouro Direto.
      </p>
    </section>
  );
}

function MiniBlock({
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

function StressCell({
  label,
  value,
  base,
  positiveIsGood,
}: {
  label: string;
  value: number;
  base: number;
  positiveIsGood?: boolean;
}) {
  const delta = value - base;
  const pct = base > 0 ? (delta / base) * 100 : 0;
  const neutral = positiveIsGood === undefined;
  const deltaColor = neutral
    ? "text-zinc-400"
    : (delta > 0) === positiveIsGood
    ? "text-emerald-400"
    : "text-red-400";
  return (
    <div>
      <div className="text-[9px] text-zinc-500 uppercase tracking-wider mb-0.5">
        {label}
      </div>
      <div className="text-xs font-semibold tabular-nums text-zinc-200">
        {money(value)}
      </div>
      {!neutral && (
        <div className={`text-[9px] tabular-nums ${deltaColor}`}>
          {delta >= 0 ? "+" : ""}
          {money(delta)} ({pct >= 0 ? "+" : ""}
          {pct.toFixed(2)}%)
        </div>
      )}
    </div>
  );
}

export default RfPortfolioCalculator;
