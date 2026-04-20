/**
 * CreditoPrivadoDeepPanel.tsx — P0-12 Renda Fixa audit (20/04/2026)
 *
 * Painel profundo de crédito privado:
 *   • Stress/relief heatmap (spreads AA/A × cenários de Selic)
 *   • Rating cluster (distribuição do pool de ofertas por rating)
 *   • CRA vs CRI (evolução do estoque e emissões, complementado por
 *     hub_ofertas_publicas quando há tipo_ativo in {CRA, CRI})
 *   • Emissões por setor (agregado de hub_ofertas_publicas.segmento)
 *
 * Estratégia de dados: consome props (séries BACEN SGS para spread AA/A,
 * emissões, Selic) + agrega hub_ofertas_publicas via supabase client para
 * rating/setor/CRA-CRI (dados reais do RCVM 160 + legacy 400/476).
 */
import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import type { SeriesDataPoint } from "@/hooks/useHubData";
import { exportCsv, csvFilename } from "@/lib/csvExport";
import { Download } from "lucide-react";

interface OfertaRow {
  tipo_ativo: string | null;
  rating: string | null;
  segmento: string | null;
  valor_total: number | null;
  volume_final: number | null;
  data_inicio: string | null;
}

interface Props {
  spreadAA?: number;
  spreadA?: number;
  selicAtual?: number;
  cdiAtual?: number;
  spreadAASeries?: SeriesDataPoint[];
  spreadASeries?: SeriesDataPoint[];
  className?: string;
}

const SELIC_SCENARIOS = [-2, -1, 0, +1, +2]; // pp desvio Selic
const SPREAD_SCENARIOS = [-50, -25, 0, +25, +50]; // bps desvio spread

function money(v: number): string {
  if (!Number.isFinite(v)) return "—";
  if (v >= 1e9) return `R$ ${(v / 1e9).toFixed(2)} bi`;
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(1)} mi`;
  return `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

function normalizeRating(r: string | null): string {
  if (!r) return "Sem rating";
  const t = r.trim().toUpperCase();
  if (/^AAA/.test(t)) return "AAA";
  if (/^AA/.test(t)) return "AA";
  if (/^A[+\-]?$/.test(t) || /^A\(/.test(t) || /^A /.test(t)) return "A";
  if (/^BBB/.test(t)) return "BBB";
  if (/^BB/.test(t)) return "BB";
  if (/^B[+\-]?$/.test(t)) return "B";
  if (/CC|CCC|C/.test(t)) return "C/CCC";
  if (/D/.test(t)) return "D";
  return "Outros";
}

export function CreditoPrivadoDeepPanel({
  spreadAA = 1.4,
  spreadA = 2.3,
  selicAtual = 14.75,
  spreadAASeries = [],
  spreadASeries = [],
  className = "",
}: Props) {
  const [rows, setRows] = useState<OfertaRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch hub_ofertas_publicas (últimos 24 meses, em distribuição ou encerradas)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - 24);
        const cutoffStr = cutoff.toISOString().slice(0, 10);
        const { data } = await supabase
          .from("hub_ofertas_publicas")
          .select("tipo_ativo, rating, segmento, valor_total, volume_final, data_inicio")
          .gte("data_inicio", cutoffStr)
          .limit(5000);
        if (mounted) {
          setRows((data as OfertaRow[]) ?? []);
          setLoading(false);
        }
      } catch {
        if (mounted) {
          setRows([]);
          setLoading(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  /* ═════ Stress/Relief Heatmap ═════ */
  const stressMatrix = useMemo(() => {
    // Para cada combinação (ΔSelic, ΔSpread), computa yield efetivo em debênture AA
    // yield = (Selic + ΔSelic) + (SpreadAA + ΔSpread_bps/100)
    return SELIC_SCENARIOS.map((ds) =>
      SPREAD_SCENARIOS.map((dsp) => {
        const yAA = selicAtual + ds + spreadAA + dsp / 100;
        const yA = selicAtual + ds + spreadA + dsp / 100;
        return { yAA, yA, ds, dsp };
      }),
    );
  }, [selicAtual, spreadAA, spreadA]);

  /* ═════ Rating cluster ═════ */
  const ratingData = useMemo(() => {
    if (!rows) return [] as { rating: string; count: number; volume: number }[];
    const acc: Record<string, { count: number; volume: number }> = {};
    for (const r of rows) {
      const k = normalizeRating(r.rating);
      const v = r.volume_final ?? r.valor_total ?? 0;
      if (!acc[k]) acc[k] = { count: 0, volume: 0 };
      acc[k].count += 1;
      acc[k].volume += v;
    }
    const order = ["AAA", "AA", "A", "BBB", "BB", "B", "C/CCC", "D", "Outros", "Sem rating"];
    return order
      .filter((k) => acc[k])
      .map((k) => ({ rating: k, count: acc[k].count, volume: acc[k].volume }));
  }, [rows]);

  /* ═════ CRA vs CRI ═════ */
  const craCriData = useMemo(() => {
    if (!rows) return { cra: 0, cri: 0, craCount: 0, criCount: 0 };
    let cra = 0,
      cri = 0,
      craCount = 0,
      criCount = 0;
    for (const r of rows) {
      const t = (r.tipo_ativo ?? "").toUpperCase();
      const vol = r.volume_final ?? r.valor_total ?? 0;
      if (t.includes("CRA")) {
        cra += vol;
        craCount++;
      } else if (t.includes("CRI")) {
        cri += vol;
        criCount++;
      }
    }
    return { cra, cri, craCount, criCount };
  }, [rows]);

  /* ═════ Emissões por setor ═════ */
  const setoresData = useMemo(() => {
    if (!rows) return [] as { segmento: string; count: number; volume: number }[];
    const acc: Record<string, { count: number; volume: number }> = {};
    for (const r of rows) {
      const k = r.segmento?.trim() || "Não informado";
      const v = r.volume_final ?? r.valor_total ?? 0;
      if (!acc[k]) acc[k] = { count: 0, volume: 0 };
      acc[k].count += 1;
      acc[k].volume += v;
    }
    return Object.entries(acc)
      .map(([segmento, a]) => ({ segmento, count: a.count, volume: a.volume }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 10);
  }, [rows]);

  const spreadHistory = useMemo(() => {
    const map = new Map<string, { date: string; aa: number | null; a: number | null }>();
    for (const p of spreadAASeries) map.set(p.date, { date: p.date, aa: p.value, a: null });
    for (const p of spreadASeries) {
      const existing = map.get(p.date);
      if (existing) existing.a = p.value;
      else map.set(p.date, { date: p.date, aa: null, a: p.value });
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [spreadAASeries, spreadASeries]);

  function exportStress() {
    const rowsCsv: Array<{
      ds: string;
      dsp: string;
      yAA: string;
      yA: string;
    }> = [];
    stressMatrix.forEach((row) =>
      row.forEach((c) =>
        rowsCsv.push({
          ds: `${c.ds >= 0 ? "+" : ""}${c.ds} pp`,
          dsp: `${c.dsp >= 0 ? "+" : ""}${c.dsp} bps`,
          yAA: `${c.yAA.toFixed(2)}%`,
          yA: `${c.yA.toFixed(2)}%`,
        }),
      ),
    );
    exportCsv(
      rowsCsv,
      [
        { header: "ΔSelic", accessor: (r) => r.ds },
        { header: "ΔSpread", accessor: (r) => r.dsp },
        { header: "Yield AA", accessor: (r) => r.yAA },
        { header: "Yield A", accessor: (r) => r.yA },
      ],
      csvFilename("rf-credito-privado", "stress"),
    );
  }

  function exportRatings() {
    exportCsv(
      ratingData,
      [
        { header: "Rating", accessor: (r) => r.rating },
        { header: "Nº ofertas", accessor: (r) => r.count },
        {
          header: "Volume (R$)",
          accessor: (r) => r.volume.toFixed(2).replace(".", ","),
        },
      ],
      csvFilename("rf-credito-privado", "ratings"),
    );
  }

  return (
    <section
      className={`bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-3 md:p-4 ${className}`}
      aria-label="Crédito privado — painel profundo"
    >
      <div className="flex items-start justify-between mb-3 gap-2 flex-wrap">
        <div>
          <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-[#10B981]">
            Crédito privado — painel profundo
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            Stress/relief · rating cluster · CRA×CRI · emissões por setor (24 meses)
          </div>
        </div>
      </div>

      {/* Stress heatmap */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-[10px] font-mono uppercase text-zinc-400">
            Matriz Stress: yield efetivo em debêntures AA/A (% a.a.)
          </h4>
          <button
            onClick={exportStress}
            className="text-[9px] font-mono text-[#10B981] hover:underline flex items-center gap-1"
          >
            <Download className="w-3 h-3" /> CSV
          </button>
        </div>
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-[9px] font-mono border-separate border-spacing-[2px]">
            <thead>
              <tr className="text-zinc-500">
                <th className="text-left py-1 px-1 font-normal">ΔSelic \ ΔSpread</th>
                {SPREAD_SCENARIOS.map((dsp) => (
                  <th key={dsp} className="text-center py-1 px-1 font-normal">
                    {dsp >= 0 ? "+" : ""}
                    {dsp} bps
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stressMatrix.map((row, i) => (
                <tr key={i}>
                  <td className="py-0.5 px-1 text-zinc-400 tabular-nums">
                    {SELIC_SCENARIOS[i] >= 0 ? "+" : ""}
                    {SELIC_SCENARIOS[i]} pp
                  </td>
                  {row.map((c, j) => {
                    // yield "neutro" = selicAtual + spreadAA no centro da matriz
                    const center = selicAtual + spreadAA;
                    const diff = c.yAA - center;
                    const intensity = Math.min(1, Math.abs(diff) / 3);
                    const isBad = diff > 0.01; // yield sobe = bad para holder de posição
                    const bg = Math.abs(diff) < 0.01
                      ? "bg-zinc-900"
                      : isBad
                      ? intensity > 0.66
                        ? "bg-red-700/70"
                        : intensity > 0.33
                        ? "bg-red-800/60"
                        : "bg-red-950/50"
                      : intensity > 0.66
                      ? "bg-emerald-700/70"
                      : intensity > 0.33
                      ? "bg-emerald-800/60"
                      : "bg-emerald-950/50";
                    return (
                      <td
                        key={j}
                        className={`${bg} py-1 px-1 text-center tabular-nums text-[9px] border border-[#1a1a1a] rounded-sm text-zinc-100`}
                        title={`Yield AA: ${c.yAA.toFixed(2)}% · Yield A: ${c.yA.toFixed(2)}% · ΔSelic ${c.ds}pp · ΔSpread ${c.dsp}bps`}
                      >
                        {c.yAA.toFixed(2)}%
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] text-zinc-600 mt-2 leading-relaxed">
          Centro da matriz = Selic {selicAtual.toFixed(2)}% + Spread AA{" "}
          {spreadAA.toFixed(2)}pp = {(selicAtual + spreadAA).toFixed(2)}%. Células em
          verde indicam yield mais baixo (relief para holders atuais via MaM);
          vermelho = yield mais alto (stress / oportunidade de entrada).
        </p>
      </div>

      {/* Ratings + CRA/CRI */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[10px] font-mono uppercase text-zinc-400">
              Rating cluster · ofertas 24m
            </h4>
            <button
              onClick={exportRatings}
              className="text-[9px] font-mono text-[#10B981] hover:underline flex items-center gap-1"
            >
              <Download className="w-3 h-3" /> CSV
            </button>
          </div>
          {loading ? (
            <div className="py-6 text-center text-[10px] text-zinc-600 font-mono">
              Carregando ofertas…
            </div>
          ) : ratingData.length === 0 ? (
            <div className="py-6 text-center text-[10px] text-zinc-600 font-mono">
              Nenhuma oferta com rating nos últimos 24 meses.
            </div>
          ) : (
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ratingData} margin={{ top: 10, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid stroke="#1a1a1a" strokeDasharray="2 2" />
                  <XAxis
                    dataKey="rating"
                    tick={{ fill: "#71717a", fontSize: 9, fontFamily: "monospace" }}
                    stroke="#1a1a1a"
                  />
                  <YAxis
                    tick={{ fill: "#71717a", fontSize: 9, fontFamily: "monospace" }}
                    stroke="#1a1a1a"
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#0a0a0a",
                      border: "1px solid #1a1a1a",
                      fontSize: 10,
                      fontFamily: "monospace",
                    }}
                  />
                  <Bar dataKey="count" fill="#10B981" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded p-3">
          <h4 className="text-[10px] font-mono uppercase text-zinc-400 mb-2">
            CRA × CRI · volume 24m
          </h4>
          {loading ? (
            <div className="py-6 text-center text-[10px] text-zinc-600 font-mono">
              Carregando…
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[9px] text-zinc-500 mb-1 uppercase tracking-wider font-mono">
                  CRA — Agro
                </div>
                <div className="text-base font-semibold font-mono text-emerald-400">
                  {money(craCriData.cra)}
                </div>
                <div className="text-[9px] text-zinc-600 mt-0.5 font-mono">
                  {craCriData.craCount} ofertas · isento IR PF
                </div>
              </div>
              <div>
                <div className="text-[9px] text-zinc-500 mb-1 uppercase tracking-wider font-mono">
                  CRI — Imobiliário
                </div>
                <div className="text-base font-semibold font-mono text-pink-400">
                  {money(craCriData.cri)}
                </div>
                <div className="text-[9px] text-zinc-600 mt-0.5 font-mono">
                  {craCriData.criCount} ofertas · isento IR PF
                </div>
              </div>
            </div>
          )}
          <p className="text-[9px] text-zinc-600 mt-3 leading-relaxed">
            Ambos isentos de IR para PF. CRA traz risco de safra/commodities; CRI traz
            risco de construção/locação. Benchmark típico: CDI+1,5 a 3%.
          </p>
        </div>
      </div>

      {/* Emissões por setor */}
      <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded p-3">
        <h4 className="text-[10px] font-mono uppercase text-zinc-400 mb-2">
          Top 10 setores emissores · 24m
        </h4>
        {loading ? (
          <div className="py-6 text-center text-[10px] text-zinc-600 font-mono">
            Carregando…
          </div>
        ) : setoresData.length === 0 ? (
          <div className="py-6 text-center text-[10px] text-zinc-600 font-mono">
            Nenhum setor cadastrado. Aguardando ingestão CVM RCVM 160.
          </div>
        ) : (
          <table className="w-full text-[10px] font-mono">
            <thead>
              <tr className="text-zinc-500 border-b border-[#1a1a1a]">
                <th className="text-left py-1 px-2 font-normal">Setor</th>
                <th className="text-right py-1 px-2 font-normal">Nº ofertas</th>
                <th className="text-right py-1 px-2 font-normal">Volume</th>
                <th className="text-right py-1 px-2 font-normal w-[30%]">Participação</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const totalVol = setoresData.reduce((s, x) => s + x.volume, 0) || 1;
                return setoresData.map((s) => {
                  const pct = (s.volume / totalVol) * 100;
                  return (
                    <tr
                      key={s.segmento}
                      className="border-b border-[#141414] last:border-b-0 hover:bg-[#0f0f0f]"
                    >
                      <td className="py-1 px-2 text-zinc-300 truncate max-w-[180px]">
                        {s.segmento}
                      </td>
                      <td className="py-1 px-2 text-right tabular-nums text-zinc-300">
                        {s.count}
                      </td>
                      <td className="py-1 px-2 text-right tabular-nums text-zinc-200">
                        {money(s.volume)}
                      </td>
                      <td className="py-1 px-2">
                        <div className="flex items-center justify-end gap-2">
                          <div className="flex-1 bg-[#0a0a0a] h-1.5 rounded overflow-hidden max-w-[120px]">
                            <div
                              className="h-full bg-[#10B981]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="tabular-nums text-zinc-400 min-w-[42px] text-right">
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-[9px] text-zinc-600 mt-3 leading-relaxed">
        Dados de ofertas consolidados em <code className="text-zinc-400">hub_ofertas_publicas</code>{" "}
        (CVM RCVM 160 + ICVM 400/476 histórico). Rating cluster reflete apenas ofertas
        com rating informado pelo emissor. Spread referência{" "}
        {spreadHistory.length > 0 ? `${spreadHistory.length} pontos série` : "snapshot"}.
      </p>
    </section>
  );
}

export default CreditoPrivadoDeepPanel;
