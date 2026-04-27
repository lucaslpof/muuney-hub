import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Users, AlertTriangle } from "lucide-react";
import { useFundPerfilMensal } from "@/hooks/useHubFundos";
import { EmptyState } from "@/components/hub/EmptyState";

/**
 * FundPerfilCotistasPanel — perfil mensal de cotistas (17 categorias).
 * Donut por % PL + tabela compact + cenários FPR estresse (se declarados).
 *
 * Fonte: hub_fundos_perfil_mensal (CVM perfil_mensal_fi_YYYYMM.csv).
 * Cobertura: TODOS os fundos (FI + FIDC + FII + FIP).
 */

interface Props {
  cnpj: string | null;
  accent?: string;
}

const CAT_LABELS: Record<string, string> = {
  pf_pb: "PF Private Banking",
  pf_varejo: "PF Varejo",
  pj_nao_financ_pb: "PJ Não Fin. PB",
  pj_nao_financ_varejo: "PJ Não Fin. Varejo",
  pj_financ: "PJ Financeira",
  banco: "Banco",
  corretora_distrib: "Corretora/Distribuidora",
  invnr: "Inv. Não Residente",
  eapc: "EAPC (Prev. Aberta)",
  efpc: "EFPC (Prev. Fechada)",
  rpps: "RPPS (Prev. Pública)",
  segur: "Segurador",
  capitaliz: "Capitalização",
  fi_clube: "Outro FI / Clube",
  distrib: "Distribuidor",
  outro: "Outros",
};

const COLOR_MAP: Record<string, string> = {
  pf_pb: "#06B6D4",
  pf_varejo: "#0EA5E9",
  pj_nao_financ_pb: "#10B981",
  pj_nao_financ_varejo: "#22C55E",
  pj_financ: "#3B82F6",
  banco: "#6366F1",
  corretora_distrib: "#8B5CF6",
  invnr: "#525252",
  eapc: "#EC4899",
  efpc: "#F43F5E",
  rpps: "#F97316",
  segur: "#F59E0B",
  capitaliz: "#EAB308",
  fi_clube: "#A3A3A3",
  distrib: "#737373",
  outro: "#404040",
};

function fmtPct(v: number | null | undefined, digits = 2): string {
  if (v == null || !isFinite(v)) return "—";
  return `${v.toFixed(digits)}%`;
}

export function FundPerfilCotistasPanel({ cnpj, accent = "#0B6C3E" }: Props) {
  const { data: p, isLoading } = useFundPerfilMensal(cnpj);

  const categorias = useMemo(() => {
    if (!p) return [];
    const cats = Object.keys(CAT_LABELS).map((key) => {
      const nr = (p as any)[`nr_cotst_${key}`] as number | null;
      const prPl = (p as any)[`pr_pl_cotst_${key}`] as number | null;
      return {
        key,
        label: CAT_LABELS[key],
        nr,
        pr_pl: prPl,
        color: COLOR_MAP[key],
      };
    });
    return cats.filter((c) => (c.nr ?? 0) > 0 || (c.pr_pl ?? 0) > 0).sort((a, b) => (b.pr_pl ?? 0) - (a.pr_pl ?? 0));
  }, [p]);

  const dominantLabel = categorias[0]?.label;
  const dominantPct = categorias[0]?.pr_pl ?? 0;
  const totalCotistas = useMemo(() => categorias.reduce((s, c) => s + (c.nr ?? 0), 0), [categorias]);

  if (isLoading) return <div className="h-32 bg-zinc-900/50 rounded-md animate-pulse" />;
  if (!p || categorias.length === 0) {
    return (
      <EmptyState
        variant="no-data"
        title="Perfil de cotistas indisponível"
        description="Fundo não declarou breakdown nesta competência (perfil_mensal_fi)."
      />
    );
  }

  // FPR estresse: pelo menos 1 cenário declarado?
  const hasFpr = p.pr_variacao_diaria_cota_estresse != null;

  return (
    <div className="space-y-4">
      {/* Header summary */}
      <div className="rounded-md border border-zinc-800/60 bg-zinc-900/40 p-3 flex items-baseline gap-3 flex-wrap" style={{ borderLeft: `3px solid ${accent}66` }}>
        <Users className="w-4 h-4 self-center" style={{ color: accent }} />
        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px] font-mono">
          <div>
            <div className="text-zinc-600 uppercase">Total cotistas</div>
            <div className="text-zinc-200 text-sm">{totalCotistas.toLocaleString("pt-BR")}</div>
          </div>
          <div>
            <div className="text-zinc-600 uppercase">Dominante</div>
            <div className="text-zinc-200 text-sm truncate">
              {dominantLabel} ({dominantPct.toFixed(1)}%)
            </div>
          </div>
          <div>
            <div className="text-zinc-600 uppercase">Categorias presentes</div>
            <div className="text-zinc-200 text-sm">{categorias.length} / 16</div>
          </div>
          <div>
            <div className="text-zinc-600 uppercase">Competência</div>
            <div className="text-zinc-200 text-sm">{p.dt_comptc.split("-").reverse().join("/")}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Donut % PL */}
        <div className="rounded-md border border-zinc-800/60 bg-zinc-900/40 p-3">
          <h4 className="text-[10px] font-mono uppercase text-zinc-500 mb-2">% PL por categoria</h4>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={categorias.filter((c) => (c.pr_pl ?? 0) > 0).map((c) => ({ name: c.label, value: c.pr_pl, color: c.color, nr: c.nr }))}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={85}
                paddingAngle={1}
                dataKey="value"
                label={(e: { value?: number }) => (e.value && e.value > 8 ? `${e.value.toFixed(0)}%` : "")}
                labelLine={false}
              >
                {categorias.filter((c) => (c.pr_pl ?? 0) > 0).map((c, i) => (
                  <Cell key={i} fill={c.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#09090b", border: "1px solid #27272a", fontSize: 11 }}
                formatter={(v: number, _n, payload: { payload?: { nr?: number | null } }) =>
                  `${v.toFixed(2)}% · ${payload?.payload?.nr ?? "?"} cotista(s)`
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
                <th className="text-right py-1 pl-2">% PL</th>
              </tr>
            </thead>
            <tbody>
              {categorias.map((c) => (
                <tr key={c.key} className="border-t border-zinc-800/40">
                  <td className="py-1.5 pr-2 text-zinc-300">
                    <span
                      className="inline-block w-2 h-2 rounded-sm align-middle mr-1.5"
                      style={{ background: c.color }}
                    />
                    {c.label}
                  </td>
                  <td className="py-1.5 px-2 text-right text-zinc-400">
                    {c.nr != null ? c.nr.toLocaleString("pt-BR") : "—"}
                  </td>
                  <td className="py-1.5 pl-2 text-right text-zinc-200">{fmtPct(c.pr_pl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FPR estresse */}
      {hasFpr && (
        <div className="rounded-md border border-amber-700/30 bg-amber-500/5 p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <h4 className="text-[10px] font-mono uppercase text-amber-300 font-semibold">
              Cenários de estresse (FPR)
            </h4>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[10px] font-mono">
            <ScenBox label="Variação diária" value={fmtPct(p.pr_variacao_diaria_cota, 4)} sub="cota" />
            <ScenBox
              label="Estresse cota"
              value={fmtPct(p.pr_variacao_diaria_cota_estresse, 4)}
              sub="estresse simulado"
              highlight
            />
            {p.cenario_fpr_ibovespa != null && <ScenBox label="Cenário Ibov." value={fmtPct(p.cenario_fpr_ibovespa, 4)} />}
            {p.cenario_fpr_juros != null && <ScenBox label="Cenário Juros" value={fmtPct(p.cenario_fpr_juros, 4)} />}
            {p.cenario_fpr_dolar != null && <ScenBox label="Cenário Dólar" value={fmtPct(p.cenario_fpr_dolar, 4)} />}
            {p.cenario_fpr_cupom != null && <ScenBox label="Cenário Cupom" value={fmtPct(p.cenario_fpr_cupom, 4)} />}
          </div>
          {p.fpr && <div className="text-[9px] font-mono text-zinc-600 mt-2 truncate">FPR: {p.fpr}</div>}
        </div>
      )}

      <p className="text-[9px] font-mono text-zinc-600">
        <strong>Leitura:</strong> &gt; 50% em EFPC/EAPC/RPPS = institucional previdenciário.
        &gt; 50% PF Varejo = pulverizado. Inv. Não Residente alto = capital estrangeiro.
        Fonte: CVM Perfil Mensal · refresh mensal.
      </p>
    </div>
  );
}

function ScenBox({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-md border p-2 ${highlight ? "border-amber-500/40 bg-amber-500/10" : "border-zinc-800/40 bg-zinc-900/30"}`}>
      <div className="text-[9px] font-mono uppercase text-zinc-600 truncate">{label}</div>
      <div className={`text-sm font-mono mt-0.5 ${highlight ? "text-amber-300" : "text-zinc-200"}`}>{value}</div>
      {sub && <div className="text-[9px] font-mono text-zinc-600 truncate">{sub}</div>}
    </div>
  );
}
