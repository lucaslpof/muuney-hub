// ingest-cvm-perfil v1 — Perfil mensal de fundos (cotistas detalhados + FPR estresse)
//
// Fonte: /dados/FI/DOC/PERFIL_MENSAL/DADOS/perfil_mensal_fi_YYYYMM.csv
// Cobertura: TODOS os fundos (FI + FIDC + FII + FIP)
// Schema: 17 categorias cotistas × NR + PR_PL + cenários FPR + voto/delib assembleia
//
// Refresh: monthly day 8 06:30 UTC (após CDA/FIDC/FII).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function pn(val: string | undefined): number | null {
  if (!val || !val.trim()) return null;
  const n = parseFloat(val.trim().replace(",", "."));
  return isFinite(n) ? n : null;
}
function pint(val: string | undefined): number | null {
  const n = pn(val);
  return n != null ? Math.round(n) : null;
}
function pd(val: string | undefined): string | null {
  if (!val || !val.trim()) return null;
  const v = val.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  return null;
}
function parseCsvLine(line: string, delimiter = ";"): string[] {
  return line.split(delimiter).map((v) => v.trim().replace(/^"|"$/g, ""));
}
function getLastMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return String(d.getFullYear()) + String(d.getMonth() + 1).padStart(2, "0");
}

async function ingestPerfil(supabase: any, yearMonth: string) {
  const url = `https://dados.cvm.gov.br/dados/FI/DOC/PERFIL_MENSAL/DADOS/perfil_mensal_fi_${yearMonth}.csv`;
  console.log("Downloading " + url);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error("Download failed: " + resp.status);
  const buf = new Uint8Array(await resp.arrayBuffer());
  console.log("Downloaded " + (buf.length / 1024 / 1024).toFixed(1) + " MB");
  const text = new TextDecoder("iso-8859-1").decode(buf);

  let cursor = 0;
  const total = text.length;
  let nl = text.indexOf("\n", cursor);
  if (nl === -1) throw new Error("Empty CSV");
  const header = parseCsvLine(text.slice(cursor, nl).replace(/\r$/, ""));
  cursor = nl + 1;
  const idx = (col: string) => header.indexOf(col);

  // Required cols
  const I = {
    tp: idx("TP_FUNDO_CLASSE"),
    cnpj: idx("CNPJ_FUNDO_CLASSE"),
    denom: idx("DENOM_SOCIAL"),
    dt: idx("DT_COMPTC"),
    versao: idx("VERSAO"),
    // Cotistas (17 categorias)
    nr_pf_pb: idx("NR_COTST_PF_PB"),
    nr_pf_varejo: idx("NR_COTST_PF_VAREJO"),
    nr_pj_nf_pb: idx("NR_COTST_PJ_NAO_FINANC_PB"),
    nr_pj_nf_varejo: idx("NR_COTST_PJ_NAO_FINANC_VAREJO"),
    nr_banco: idx("NR_COTST_BANCO"),
    nr_corr: idx("NR_COTST_CORRETORA_DISTRIB"),
    nr_pj_fin: idx("NR_COTST_PJ_FINANC"),
    nr_invnr: idx("NR_COTST_INVNR"),
    nr_eapc: idx("NR_COTST_EAPC"),
    nr_efpc: idx("NR_COTST_EFPC"),
    nr_rpps: idx("NR_COTST_RPPS"),
    nr_segur: idx("NR_COTST_SEGUR"),
    nr_capitaliz: idx("NR_COTST_CAPITALIZ"),
    nr_fi_clube: idx("NR_COTST_FI_CLUBE"),
    nr_distrib: idx("NR_COTST_DISTRIB"),
    nr_outro: idx("NR_COTST_OUTRO"),
    // % PL
    pr_pf_pb: idx("PR_PL_COTST_PF_PB"),
    pr_pf_varejo: idx("PR_PL_COTST_PF_VAREJO"),
    pr_pj_nf_pb: idx("PR_PL_COTST_PJ_NAO_FINANC_PB"),
    pr_pj_nf_varejo: idx("PR_PL_COTST_PJ_NAO_FINANC_VAREJO"),
    pr_banco: idx("PR_PL_COTST_BANCO"),
    pr_corr: idx("PR_PL_COTST_CORRETORA_DISTRIB"),
    pr_pj_fin: idx("PR_PL_COTST_PJ_FINANC"),
    pr_invnr: idx("PR_PL_COTST_INVNR"),
    pr_eapc: idx("PR_PL_COTST_EAPC"),
    pr_efpc: idx("PR_PL_COTST_EFPC"),
    pr_rpps: idx("PR_PL_COTST_RPPS"),
    pr_segur: idx("PR_PL_COTST_SEGUR"),
    pr_capitaliz: idx("PR_PL_COTST_CAPITALIZ"),
    pr_fi_clube: idx("PR_PL_COTST_FI_CLUBE"),
    pr_distrib: idx("PR_PL_COTST_DISTRIB"),
    pr_outro: idx("PR_PL_COTST_OUTRO"),
    // Operações
    voto_admin: idx("VOTO_ADMIN_ASSEMB"),
    delib: idx("DELIB_ASSEMB"),
    pr_var_cart: idx("PR_VAR_CARTEIRA"),
    mod_var: idx("MOD_VAR"),
    prazo_titulo: idx("PRAZO_CARTEIRA_TITULO"),
    vl_compra_dolar: idx("VL_CONTRATO_COMPRA_DOLAR"),
    vl_venda_dolar: idx("VL_CONTRATO_VENDA_DOLAR"),
    pr_var_diaria: idx("PR_VARIACAO_DIARIA_COTA"),
    fpr: idx("FPR"),
    fpr_iboves: idx("CENARIO_FPR_IBOVESPA"),
    fpr_juros: idx("CENARIO_FPR_JUROS"),
    fpr_cupom: idx("CENARIO_FPR_CUPOM"),
    fpr_dolar: idx("CENARIO_FPR_DOLAR"),
    fpr_outro: idx("CENARIO_FPR_OUTRO"),
    pr_var_estresse: idx("PR_VARIACAO_DIARIA_COTA_ESTRESSE"),
  };

  if (I.cnpj < 0 || I.dt < 0) throw new Error("CNPJ_FUNDO_CLASSE / DT_COMPTC missing");

  const batch: any[] = [];
  const BATCH_SIZE = 200;
  let totalRows = 0, upserted = 0, batchErrors = 0;
  const seen = new Set<string>();

  async function flush() {
    if (batch.length === 0) return;
    const { error } = await supabase
      .from("hub_fundos_perfil_mensal")
      .upsert(batch, { onConflict: "cnpj_fundo_classe,dt_comptc", ignoreDuplicates: false });
    if (error) {
      console.error("upsert err: " + error.message);
      batchErrors++;
    } else {
      upserted += batch.length;
    }
    batch.length = 0;
  }

  while (cursor < total) {
    nl = text.indexOf("\n", cursor);
    const line = (nl === -1 ? text.slice(cursor) : text.slice(cursor, nl)).replace(/\r$/, "");
    cursor = nl === -1 ? total : nl + 1;
    if (!line.trim()) continue;
    totalRows++;
    const c = parseCsvLine(line);
    const cnpj = (c[I.cnpj] || "").trim();
    const dt = pd(c[I.dt]);
    if (!cnpj || !dt) continue;
    const key = cnpj + "|" + dt;
    if (seen.has(key)) continue;
    seen.add(key);

    batch.push({
      cnpj_fundo_classe: cnpj,
      dt_comptc: dt,
      tp_fundo_classe: c[I.tp]?.trim() || null,
      denom_social: c[I.denom]?.trim() || null,
      versao: pint(c[I.versao]),
      nr_cotst_pf_pb: pint(c[I.nr_pf_pb]),
      nr_cotst_pf_varejo: pint(c[I.nr_pf_varejo]),
      nr_cotst_pj_nao_financ_pb: pint(c[I.nr_pj_nf_pb]),
      nr_cotst_pj_nao_financ_varejo: pint(c[I.nr_pj_nf_varejo]),
      nr_cotst_banco: pint(c[I.nr_banco]),
      nr_cotst_corretora_distrib: pint(c[I.nr_corr]),
      nr_cotst_pj_financ: pint(c[I.nr_pj_fin]),
      nr_cotst_invnr: pint(c[I.nr_invnr]),
      nr_cotst_eapc: pint(c[I.nr_eapc]),
      nr_cotst_efpc: pint(c[I.nr_efpc]),
      nr_cotst_rpps: pint(c[I.nr_rpps]),
      nr_cotst_segur: pint(c[I.nr_segur]),
      nr_cotst_capitaliz: pint(c[I.nr_capitaliz]),
      nr_cotst_fi_clube: pint(c[I.nr_fi_clube]),
      nr_cotst_distrib: pint(c[I.nr_distrib]),
      nr_cotst_outro: pint(c[I.nr_outro]),
      pr_pl_cotst_pf_pb: pn(c[I.pr_pf_pb]),
      pr_pl_cotst_pf_varejo: pn(c[I.pr_pf_varejo]),
      pr_pl_cotst_pj_nao_financ_pb: pn(c[I.pr_pj_nf_pb]),
      pr_pl_cotst_pj_nao_financ_varejo: pn(c[I.pr_pj_nf_varejo]),
      pr_pl_cotst_banco: pn(c[I.pr_banco]),
      pr_pl_cotst_corretora_distrib: pn(c[I.pr_corr]),
      pr_pl_cotst_pj_financ: pn(c[I.pr_pj_fin]),
      pr_pl_cotst_invnr: pn(c[I.pr_invnr]),
      pr_pl_cotst_eapc: pn(c[I.pr_eapc]),
      pr_pl_cotst_efpc: pn(c[I.pr_efpc]),
      pr_pl_cotst_rpps: pn(c[I.pr_rpps]),
      pr_pl_cotst_segur: pn(c[I.pr_segur]),
      pr_pl_cotst_capitaliz: pn(c[I.pr_capitaliz]),
      pr_pl_cotst_fi_clube: pn(c[I.pr_fi_clube]),
      pr_pl_cotst_distrib: pn(c[I.pr_distrib]),
      pr_pl_cotst_outro: pn(c[I.pr_outro]),
      voto_admin_assemb: c[I.voto_admin]?.trim() || null,
      delib_assemb: c[I.delib]?.trim() || null,
      pr_var_carteira: pn(c[I.pr_var_cart]),
      mod_var: c[I.mod_var]?.trim() || null,
      prazo_carteira_titulo: pn(c[I.prazo_titulo]),
      vl_contrato_compra_dolar: pn(c[I.vl_compra_dolar]),
      vl_contrato_venda_dolar: pn(c[I.vl_venda_dolar]),
      pr_variacao_diaria_cota: pn(c[I.pr_var_diaria]),
      fpr: c[I.fpr]?.trim() || null,
      cenario_fpr_ibovespa: pn(c[I.fpr_iboves]),
      cenario_fpr_juros: pn(c[I.fpr_juros]),
      cenario_fpr_cupom: pn(c[I.fpr_cupom]),
      cenario_fpr_dolar: pn(c[I.fpr_dolar]),
      cenario_fpr_outro: pn(c[I.fpr_outro]),
      pr_variacao_diaria_cota_estresse: pn(c[I.pr_var_estresse]),
    });
    if (batch.length >= BATCH_SIZE) await flush();
  }
  await flush();

  return { year_month: yearMonth, total_rows: totalRows, upserted, batch_errors: batchErrors };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const startedAt = new Date().toISOString();
  const url = new URL(req.url);
  const yearMonth = url.searchParams.get("year_month") || getLastMonth();
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    console.log(`=== ingest-cvm-perfil v1: year_month=${yearMonth} ===`);
    const result = await ingestPerfil(supabase, yearMonth);
    await supabase.from("hub_cvm_ingestion_log").insert({
      source: "ingest-cvm-perfil",
      reference_date: yearMonth,
      records_fetched: result.total_rows,
      records_inserted: result.upserted,
      status: "success",
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });
    return new Response(JSON.stringify(result, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Fatal: " + msg);
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await supabase.from("hub_cvm_ingestion_log").insert({
        source: "ingest-cvm-perfil",
        reference_date: yearMonth,
        status: "error",
        error_message: msg,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      });
    } catch { /* ignore */ }
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
