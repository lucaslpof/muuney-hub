import { useMemo } from "react";
import { LineChart, Line, BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceLine } from "recharts";
import { Building, Users, AlertTriangle, TrendingUp } from "lucide-react";
import {
  useFiiImovelKpis,
  useFiiInquilinoKpis,
  useFiiImoveisList,
  useFiiInquilinosList,
  useFiiDreHistory,
} from "@/hooks/useHubFundos";
import { EmptyState } from "@/components/hub/EmptyState";

/**
 * FiiAnexo14VPanel — vacância, inquilinos top-N, DRE estruturada.
 *
 * Fonte: CVM INF_TRIMESTRAL_FII Anexo 14-V (substitui LLM extraction).
 * Cobertura: ~680 FIIs com imóveis físicos × 4-8 trimestres.
 *
 * Sub-painéis:
 *  1. KPIs trimestrais (vacância média ponderada + locado + área)
 *  2. Top inquilinos (concentração + setor)
 *  3. Top imóveis (% receita FII + endereço)
 *  4. DRE histórica (rendimentos declarados + receitas + despesas)
 */

interface Props {
  cnpj: string | null;
  accent?: string;
}

function fmtPct(v: number | null | undefined, digits = 2): string {
  if (v == null || !isFinite(v)) return "—";
  return `${v.toFixed(digits)}%`;
}
function fmtBRL(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  if (Math.abs(v) >= 1e9) return `R$ ${(v / 1e9).toFixed(2)} bi`;
  if (Math.abs(v) >= 1e6) return `R$ ${(v / 1e6).toFixed(1)} mi`;
  if (Math.abs(v) >= 1e3) return `R$ ${(v / 1e3).toFixed(0)} k`;
  return `R$ ${v.toFixed(0)}`;
}
function fmtArea(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M m²`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k m²`;
  return `${v.toFixed(0)} m²`;
}
function fmtMonth(dt: string): string {
  // 2025-12-31 → "Dez/25"
  const m = dt.slice(5, 7);
  const y = dt.slice(2, 4);
  const labels = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${labels[parseInt(m, 10)] ?? m}/${y}`;
}

export function FiiAnexo14VPanel({ cnpj, accent = "#EC4899" }: Props) {
  const { data: imovelKpis, isLoading: l1 } = useFiiImovelKpis(cnpj, 8);
  const { data: inquilinoKpis, isLoading: l2 } = useFiiInquilinoKpis(cnpj, 8);
  const { data: imoveisList } = useFiiImoveisList(cnpj);
  const { data: inquilinosList } = useFiiInquilinosList(cnpj, null, 10);
  const { data: dreHistory } = useFiiDreHistory(cnpj, 8);

  const lastImKpi = imovelKpis && imovelKpis.length > 0 ? imovelKpis[imovelKpis.length - 1] : null;
  const lastInqKpi = inquilinoKpis && inquilinoKpis.length > 0 ? inquilinoKpis[inquilinoKpis.length - 1] : null;
  const lastDre = dreHistory && dreHistory.length > 0 ? dreHistory[dreHistory.length - 1] : null;

  const vacanciaSeries = useMemo(
    () =>
      (imovelKpis ?? []).map((k) => ({
        dt: fmtMonth(k.data_referencia),
        vacancia: k.vacancia_media_ponderada_receita ?? k.vacancia_media_simples ?? null,
        locado: k.locado_medio,
      })),
    [imovelKpis]
  );

  const dreSeries = useMemo(
    () =>
      (dreHistory ?? []).map((d) => ({
        dt: fmtMonth(d.data_referencia),
        rendimentos: d.rendimentos_declarados,
        aluguel: d.receita_aluguel_contabil,
        resultado: d.resultado_trimestral_contabil,
      })),
    [dreHistory]
  );

  if (l1 || l2) return <div className="h-48 bg-zinc-900/50 rounded-md animate-pulse" />;

  // No data at all (most FoFs / papéis won't have imóveis nor inquilinos but might have DRE)
  if (!lastImKpi && !lastInqKpi && !lastDre) {
    return (
      <EmptyState
        variant="no-data"
        title="Sem Anexo 14-V CVM"
        description="FII não declarou Inf Trimestral neste período (típico de FoFs / FIIs de papel sem imóveis físicos)."
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Header KPIs */}
      <div
        className="rounded-md border border-zinc-800/60 bg-zinc-900/40 p-3"
        style={{ borderLeft: `3px solid ${accent}66` }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Building className="w-4 h-4" style={{ color: accent }} />
          <h4 className="text-[10px] font-mono uppercase text-zinc-500 font-semibold">
            Anexo 14-V — Imóveis & DRE (CVM Inf Trimestral)
          </h4>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-[10px] font-mono">
          {lastImKpi && (
            <>
              <div>
                <div className="text-zinc-600 uppercase">Imóveis</div>
                <div className="text-sm text-zinc-200">{lastImKpi.num_imoveis}</div>
              </div>
              <div>
                <div className="text-zinc-600 uppercase">Vacância</div>
                <div className={`text-sm ${(lastImKpi.vacancia_media_ponderada_receita ?? 0) > 10 ? "text-red-400" : (lastImKpi.vacancia_media_ponderada_receita ?? 0) > 5 ? "text-amber-400" : "text-emerald-400"}`}>
                  {fmtPct(lastImKpi.vacancia_media_ponderada_receita ?? lastImKpi.vacancia_media_simples)}
                </div>
                <div className="text-[9px] text-zinc-600">ponderada · receita</div>
              </div>
              <div>
                <div className="text-zinc-600 uppercase">Locado</div>
                <div className="text-sm text-zinc-200">{fmtPct(lastImKpi.locado_medio)}</div>
              </div>
              <div>
                <div className="text-zinc-600 uppercase">Área total</div>
                <div className="text-sm text-zinc-200">{fmtArea(lastImKpi.area_total_m2)}</div>
              </div>
            </>
          )}
          {lastInqKpi && (
            <>
              <div>
                <div className="text-zinc-600 uppercase">Top 5 inq.</div>
                <div className={`text-sm ${(lastInqKpi.top5_concentracao_pct ?? 0) > 60 ? "text-amber-400" : "text-zinc-200"}`}>
                  {fmtPct(lastInqKpi.top5_concentracao_pct, 1)}
                </div>
              </div>
              <div>
                <div className="text-zinc-600 uppercase">Top setor</div>
                <div className="text-sm text-zinc-300 truncate" title={lastInqKpi.top_setor ?? ""}>
                  {lastInqKpi.top_setor ?? "—"}
                </div>
              </div>
            </>
          )}
        </div>
        <div className="text-[9px] font-mono text-zinc-600 mt-2">
          Competência: {lastImKpi ? lastImKpi.data_referencia.split("-").reverse().join("/") : lastDre?.data_referencia.split("-").reverse().join("/")}
          {lastInqKpi?.maior_inquilino_pct != null && (
            <span className="ml-3">
              · Maior inquilino: <span className="text-zinc-400">{fmtPct(lastInqKpi.maior_inquilino_pct, 1)}</span>
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Vacância histórica */}
        {vacanciaSeries.length > 0 && (
          <div className="rounded-md border border-zinc-800/60 bg-zinc-900/40 p-3">
            <h4 className="text-[10px] font-mono uppercase text-zinc-500 mb-2 flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3" />
              Vacância × Locado (% trimestral)
            </h4>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={vacanciaSeries} margin={{ top: 5, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="dt" tick={{ fontSize: 9, fill: "#71717a" }} axisLine={{ stroke: "#27272a" }} />
                <YAxis tick={{ fontSize: 9, fill: "#71717a" }} axisLine={{ stroke: "#27272a" }} domain={[0, "auto"]} width={32} />
                <Tooltip
                  contentStyle={{ background: "#09090b", border: "1px solid #27272a", fontSize: 11 }}
                  formatter={(v: number, n: string) => [fmtPct(v, 2), n === "vacancia" ? "Vacância" : "Locado"]}
                />
                <ReferenceLine y={5} stroke="#71717a" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="vacancia" stroke="#EF4444" strokeWidth={1.8} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="locado" stroke="#10B981" strokeWidth={1.5} dot={{ r: 2 }} strokeDasharray="3 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* DRE histórica */}
        {dreSeries.length > 0 && (
          <div className="rounded-md border border-zinc-800/60 bg-zinc-900/40 p-3">
            <h4 className="text-[10px] font-mono uppercase text-zinc-500 mb-2 flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3" />
              Rendimentos × Aluguel × Resultado trimestral
            </h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dreSeries} margin={{ top: 5, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="dt" tick={{ fontSize: 9, fill: "#71717a" }} axisLine={{ stroke: "#27272a" }} />
                <YAxis
                  tick={{ fontSize: 9, fill: "#71717a" }}
                  axisLine={{ stroke: "#27272a" }}
                  width={48}
                  tickFormatter={(v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(0)}M` : `${(v / 1e3).toFixed(0)}k`)}
                />
                <Tooltip
                  contentStyle={{ background: "#09090b", border: "1px solid #27272a", fontSize: 11 }}
                  formatter={(v: number) => fmtBRL(v)}
                />
                <Bar dataKey="aluguel" fill="#10B981" fillOpacity={0.5} name="Aluguel" />
                <Bar dataKey="resultado" fill={accent} fillOpacity={0.5} name="Resultado" />
                <Bar dataKey="rendimentos" fill="#06B6D4" fillOpacity={0.5} name="Distribuído" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Top imóveis */}
        {imoveisList && imoveisList.length > 0 && (
          <div className="rounded-md border border-zinc-800/60 bg-zinc-900/40 p-3 overflow-auto max-h-[260px]">
            <h4 className="text-[10px] font-mono uppercase text-zinc-500 mb-2 flex items-center gap-1.5">
              <Building className="w-3 h-3" />
              Imóveis (top 10 por % receita)
            </h4>
            <table className="w-full text-[10px] font-mono">
              <thead className="sticky top-0 bg-zinc-900/95">
                <tr className="text-zinc-500 uppercase">
                  <th className="text-left py-1 pr-2">Imóvel</th>
                  <th className="text-right py-1 px-2">% rec</th>
                  <th className="text-right py-1 px-2">Vac.</th>
                  <th className="text-right py-1 pl-2">Área</th>
                </tr>
              </thead>
              <tbody>
                {imoveisList.slice(0, 10).map((im, i) => (
                  <tr key={i} className="border-t border-zinc-800/40">
                    <td className="py-1.5 pr-2 text-zinc-300 truncate max-w-[200px]" title={im.nome_imovel}>
                      {im.nome_imovel}
                    </td>
                    <td className="py-1.5 px-2 text-right text-zinc-200">
                      {fmtPct(im.percentual_receitas_fii, 1)}
                    </td>
                    <td
                      className={`py-1.5 px-2 text-right ${
                        (im.percentual_vacancia ?? 0) > 10
                          ? "text-red-400"
                          : (im.percentual_vacancia ?? 0) > 5
                          ? "text-amber-400"
                          : "text-zinc-400"
                      }`}
                    >
                      {fmtPct(im.percentual_vacancia, 0)}
                    </td>
                    <td className="py-1.5 pl-2 text-right text-zinc-500">
                      {im.area != null ? `${(im.area).toLocaleString("pt-BR")}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Top inquilinos / setores */}
        {inquilinosList && inquilinosList.length > 0 && (
          <div className="rounded-md border border-zinc-800/60 bg-zinc-900/40 p-3 overflow-auto max-h-[260px]">
            <h4 className="text-[10px] font-mono uppercase text-zinc-500 mb-2 flex items-center gap-1.5">
              <Users className="w-3 h-3" />
              Concentração inquilinos (top 10)
            </h4>
            <table className="w-full text-[10px] font-mono">
              <thead className="sticky top-0 bg-zinc-900/95">
                <tr className="text-zinc-500 uppercase">
                  <th className="text-left py-1 pr-2">Imóvel · Setor</th>
                  <th className="text-right py-1 px-2">% imóvel</th>
                  <th className="text-right py-1 pl-2">% FII</th>
                </tr>
              </thead>
              <tbody>
                {inquilinosList.map((inq, i) => (
                  <tr key={i} className="border-t border-zinc-800/40">
                    <td className="py-1.5 pr-2 text-zinc-300">
                      <div className="truncate max-w-[200px]" title={inq.nome_imovel}>
                        {inq.nome_imovel}
                      </div>
                      {inq.setor_atuacao && (
                        <div className="text-[9px] text-zinc-600 truncate" title={inq.setor_atuacao}>
                          {inq.setor_atuacao}
                        </div>
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-right text-zinc-400">
                      {fmtPct(inq.percentual_receita_imovel, 1)}
                    </td>
                    <td className="py-1.5 pl-2 text-right text-zinc-200">
                      {fmtPct(inq.percentual_receitas_fii, 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Alertas concentração */}
      {lastInqKpi && (lastInqKpi.top5_concentracao_pct ?? 0) > 60 && (
        <div className="rounded-md border border-amber-700/30 bg-amber-500/5 p-2 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-[10px] font-mono text-amber-300">
            <strong>Atenção:</strong> Top 5 inquilinos concentram{" "}
            <span className="text-amber-100">{fmtPct(lastInqKpi.top5_concentracao_pct, 1)}</span>{" "}
            das receitas — risco de concentração elevado.
          </div>
        </div>
      )}

      <p className="text-[9px] font-mono text-zinc-600">
        <strong>Fonte:</strong> CVM INF_TRIMESTRAL_FII Anexo 14-V (CSV estruturado, refresh trimestral · dia 15 fev/mai/ago/nov).
        FoFs / FIIs de papel não declaram imóveis (esta seção pode ficar vazia).
      </p>
    </div>
  );
}
