// ingest-cvm-fii-trimestral v1 — Anexo 14-V FII (vacância + inquilinos + DRE)
//
// Fonte: /dados/FII/DOC/INF_TRIMESTRAL/DADOS/inf_trimestral_fii_YYYY.zip (~2.5MB ZIP)
// Cobertura: ~1.200 FIIs × 4 trimestres/ano (16 CSVs)
// Tabelas alvo:
//   - hub_fii_imoveis (vacância, locação, inadimplência, área, endereço)
//   - hub_fii_inquilinos (concentração + setor)
//   - hub_fii_resultado_contabil (DRE estruturada — ~40 cols modeladas + raw_payload)
//
// Refresh: trimestral (dia 15 dos meses fev/mai/ago/nov 06:00 UTC).
//
// Modes:
//   ?year=2025         → ingere ano completo (default = ano corrente)
//   ?only=imoveis|inquilinos|resultado → carrega só uma tabela

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { unzipSync } from "https://esm.sh/fflate@0.8.2";

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
function ps(val: string | undefined): string | null {
  const v = val?.trim();
  return v && v.length > 0 ? v : null;
}
function parseCsvLine(line: string, delimiter = ";"): string[] {
  return line.split(delimiter).map((v) => v.trim().replace(/^"|"$/g, ""));
}

// ============================================================================
// IMOVEIS
// ============================================================================
async function ingestImoveis(supabase: any, csvText: string) {
  let cursor = 0, total = csvText.length;
  let nl = csvText.indexOf("\n", cursor);
  if (nl === -1) return { rows: 0, upserted: 0, errors: 0 };
  const header = parseCsvLine(csvText.slice(cursor, nl).replace(/\r$/, ""));
  cursor = nl + 1;
  const idx = (col: string) => header.indexOf(col);
  const I = {
    cnpj: idx("CNPJ_Fundo_Classe"),
    dt: idx("Data_Referencia"),
    versao: idx("Versao"),
    classe: idx("Classe"),
    nome: idx("Nome_Imovel"),
    endereco: idx("Endereco"),
    area: idx("Area"),
    nu: idx("Numero_Unidades"),
    vac: idx("Percentual_Vacancia"),
    inad: idx("Percentual_Inadimplencia"),
    receitas_fii: idx("Percentual_Receitas_FII"),
    locado: idx("Percentual_Locado"),
    vendido: idx("Percentual_Vendido"),
    obras_real: idx("Percentual_Conclusao_Obras_Realizado"),
    obras_prev: idx("Percentual_Conclusao_Obras_Previsto"),
    custo_real: idx("Custo_Construcao_Realizado"),
    custo_prev: idx("Custo_Construcao_Previsto"),
    pct_total_inv: idx("Percentual_Imovel_Total_Investido"),
    outras: idx("Outras_Caracteristicas_Relevantes"),
  };
  if (I.cnpj < 0 || I.dt < 0 || I.nome < 0) throw new Error("imoveis: cnpj/dt/nome missing");

  const batch: any[] = [];
  const seen = new Set<string>();
  let rows = 0, upserted = 0, errors = 0;

  async function flush() {
    if (!batch.length) return;
    const { error } = await supabase.from("hub_fii_imoveis")
      .upsert(batch, { onConflict: "cnpj_fundo_classe,data_referencia,nome_imovel", ignoreDuplicates: false });
    if (error) { console.error("imoveis upsert: " + error.message); errors++; }
    else upserted += batch.length;
    batch.length = 0;
  }

  while (cursor < total) {
    nl = csvText.indexOf("\n", cursor);
    const line = (nl === -1 ? csvText.slice(cursor) : csvText.slice(cursor, nl)).replace(/\r$/, "");
    cursor = nl === -1 ? total : nl + 1;
    if (!line.trim()) continue;
    rows++;
    const c = parseCsvLine(line);
    const cnpj = ps(c[I.cnpj]);
    const dt = pd(c[I.dt]);
    const nome = ps(c[I.nome]);
    if (!cnpj || !dt || !nome) continue;
    const key = cnpj + "|" + dt + "|" + nome;
    if (seen.has(key)) continue;
    seen.add(key);

    batch.push({
      cnpj_fundo_classe: cnpj,
      data_referencia: dt,
      versao: pint(c[I.versao]),
      classe: ps(c[I.classe]),
      nome_imovel: nome.slice(0, 500),
      endereco: ps(c[I.endereco])?.slice(0, 500) ?? null,
      area: pn(c[I.area]),
      numero_unidades: pint(c[I.nu]),
      percentual_vacancia: pn(c[I.vac]),
      percentual_inadimplencia: pn(c[I.inad]),
      percentual_receitas_fii: pn(c[I.receitas_fii]),
      percentual_locado: pn(c[I.locado]),
      percentual_vendido: pn(c[I.vendido]),
      percentual_conclusao_obras_realizado: pn(c[I.obras_real]),
      percentual_conclusao_obras_previsto: pn(c[I.obras_prev]),
      custo_construcao_realizado: pn(c[I.custo_real]),
      custo_construcao_previsto: pn(c[I.custo_prev]),
      percentual_imovel_total_investido: pn(c[I.pct_total_inv]),
      outras_caracteristicas_relevantes: ps(c[I.outras])?.slice(0, 2000) ?? null,
    });
    if (batch.length >= 200) await flush();
  }
  await flush();
  return { rows, upserted, errors };
}

// ============================================================================
// INQUILINOS
// ============================================================================
async function ingestInquilinos(supabase: any, csvText: string) {
  let cursor = 0, total = csvText.length;
  let nl = csvText.indexOf("\n", cursor);
  if (nl === -1) return { rows: 0, upserted: 0, errors: 0 };
  const header = parseCsvLine(csvText.slice(cursor, nl).replace(/\r$/, ""));
  cursor = nl + 1;
  const idx = (col: string) => header.indexOf(col);
  const I = {
    cnpj: idx("CNPJ_Fundo_Classe"),
    dt: idx("Data_Referencia"),
    versao: idx("Versao"),
    nome: idx("Nome_Imovel"),
    setor: idx("Setor_Atuacao"),
    pct_imovel: idx("Percentual_Receita_Imovel"),
    pct_fii: idx("Percentual_Receitas_FII"),
  };
  if (I.cnpj < 0 || I.dt < 0) throw new Error("inquilinos: cnpj/dt missing");

  const batch: any[] = [];
  let rows = 0, upserted = 0, errors = 0;

  async function flush() {
    if (!batch.length) return;
    const { error } = await supabase.from("hub_fii_inquilinos").insert(batch);
    if (error) { console.error("inquilinos insert: " + error.message); errors++; }
    else upserted += batch.length;
    batch.length = 0;
  }

  // Inquilinos: deletar rows do trimestre atual antes de inserir (replace, not upsert)
  // Coletamos as datas únicas primeiro
  const dates = new Set<string>();
  // peek first pass: scan dates only (cheap)
  // Para simplificar: deletar quando encontramos primeira row de cada (cnpj, dt) novo
  const purged = new Set<string>();

  while (cursor < total) {
    nl = csvText.indexOf("\n", cursor);
    const line = (nl === -1 ? csvText.slice(cursor) : csvText.slice(cursor, nl)).replace(/\r$/, "");
    cursor = nl === -1 ? total : nl + 1;
    if (!line.trim()) continue;
    rows++;
    const c = parseCsvLine(line);
    const cnpj = ps(c[I.cnpj]);
    const dt = pd(c[I.dt]);
    const nome = ps(c[I.nome]);
    if (!cnpj || !dt || !nome) continue;

    // Purge once per (cnpj, dt) — replaces all rows from the same trimestre
    const purgeKey = cnpj + "|" + dt;
    if (!purged.has(purgeKey)) {
      await supabase.from("hub_fii_inquilinos")
        .delete()
        .eq("cnpj_fundo_classe", cnpj)
        .eq("data_referencia", dt);
      purged.add(purgeKey);
      dates.add(dt);
    }

    batch.push({
      cnpj_fundo_classe: cnpj,
      data_referencia: dt,
      versao: pint(c[I.versao]),
      nome_imovel: nome.slice(0, 500),
      setor_atuacao: ps(c[I.setor])?.slice(0, 200) ?? null,
      percentual_receita_imovel: pn(c[I.pct_imovel]),
      percentual_receitas_fii: pn(c[I.pct_fii]),
    });
    if (batch.length >= 200) await flush();
  }
  await flush();
  return { rows, upserted, errors };
}

// ============================================================================
// RESULTADO_CONTABIL_FINANCEIRO
// ============================================================================
async function ingestResultado(supabase: any, csvText: string) {
  let cursor = 0, total = csvText.length;
  let nl = csvText.indexOf("\n", cursor);
  if (nl === -1) return { rows: 0, upserted: 0, errors: 0 };
  const headerStr = csvText.slice(cursor, nl).replace(/\r$/, "");
  const header = parseCsvLine(headerStr);
  cursor = nl + 1;
  const idx = (col: string) => header.indexOf(col);

  const I = {
    cnpj: idx("CNPJ_Fundo_Classe"),
    dt: idx("Data_Referencia"),
    versao: idx("Versao"),
    rec_venda_estoque_c: idx("Receita_Venda_Estoque_Contabil"),
    rec_venda_estoque_f: idx("Receita_Venda_Estoque_Financeiro"),
    custo_estoque_c: idx("Custo_Estoque_Contabil"),
    custo_estoque_f: idx("Custo_Estoque_Financeiro"),
    res_liq_estoque_c: idx("Resultado_Liquido_Estoque_Contabil"),
    res_liq_estoque_f: idx("Resultado_Liquido_Estoque_Financeiro"),
    rec_aluguel_c: idx("Receita_Aluguel_Investimento_Contabil"),
    rec_aluguel_f: idx("Receita_Aluguel_Investimento_Financeiro"),
    desp_manut_c: idx("Despesa_Manutencao_Investimento_Contabil"),
    desp_manut_f: idx("Despesa_Manutencao_Investimento_Financeiro"),
    rec_venda_inv_c: idx("Receita_Venda_Investimento_Contabil"),
    rec_venda_inv_f: idx("Receita_Venda_Investimento_Financeiro"),
    res_liq_renda_c: idx("Resultado_Liquido_Renda_Contabil"),
    res_liq_renda_f: idx("Resultado_Liquido_Renda_Investimento_Financeiro"),
    rec_juros_tvm_c: idx("Receita_Juros_TVM_Contabil"),
    rec_juros_tvm_f: idx("Receita_Juros_TVM_Financeiro"),
    res_venda_tvm_c: idx("Resultado_Venda_TVM_Contabil"),
    res_venda_tvm_f: idx("Resultado_Venda_TVM_Financeiro"),
    res_liq_tvm_c: idx("Resultado_Liquido_TVM_Contabil"),
    res_liq_tvm_f: idx("Resultado_Liquido_TVM_Financeiro"),
    res_liq_total_c: idx("Resultado_Liquido_Total_Contabil"),
    res_liq_total_f: idx("Resultado_Liquido_Total_Financeiro"),
    rec_juros_apl_c: idx("Receita_Juros_Aplicacao_Contabil"),
    rec_juros_apl_f: idx("Receita_Juros_Aplicacao_Financeiro"),
    desp_admin_c: idx("Despesa_Administracao_Contabil"),
    desp_admin_f: idx("Despesa_Administracao_Financeiro"),
    desp_consult_c: idx("Despesa_Consultoria_Contabil"),
    desp_consult_f: idx("Despesa_Consultoria_Financeiro"),
    desp_corret_c: idx("Despesa_Corretagem_Contabil"),
    desp_corret_f: idx("Despesa_Corretagem_Financeiro"),
    desp_jurid_c: idx("Despesa_Juridica_Contabil"),
    desp_jurid_f: idx("Despesa_Juridica_Financeiro"),
    desp_audit_c: idx("Despesa_Auditoria_Contabil"),
    desp_audit_f: idx("Despesa_Auditoria_Financeiro"),
    desp_taxa_cvm_c: idx("Despesa_Taxa_CVM_Contabil"),
    desp_taxa_cvm_f: idx("Despesa_Taxa_CVM_Financeiro"),
    outras_desp_c: idx("Outras_Despesas_Contabil"),
    outras_desp_f: idx("Outras_Despesas_Financeiro"),
    res_bruto_c: idx("Resultado_Bruto_Periodo_Contabil"),
    res_bruto_f: idx("Resultado_Bruto_Periodo_Financeiro"),
    res_liq_periodo_c: idx("Resultado_Liquido_Periodo_Contabil"),
    res_liq_periodo_f: idx("Resultado_Liquido_Periodo_Financeiro"),
    rendimentos_dist: idx("Rendimentos_Distribuidos_Periodo"),
    amort_dist: idx("Amortizacoes_Distribuidas_Periodo"),
  };
  if (I.cnpj < 0 || I.dt < 0) throw new Error("resultado: cnpj/dt missing");

  const batch: any[] = [];
  const seen = new Set<string>();
  let rows = 0, upserted = 0, errors = 0;

  async function flush() {
    if (!batch.length) return;
    const { error } = await supabase.from("hub_fii_resultado_contabil")
      .upsert(batch, { onConflict: "cnpj_fundo_classe,data_referencia", ignoreDuplicates: false });
    if (error) { console.error("resultado upsert: " + error.message); errors++; }
    else upserted += batch.length;
    batch.length = 0;
  }

  while (cursor < total) {
    nl = csvText.indexOf("\n", cursor);
    const line = (nl === -1 ? csvText.slice(cursor) : csvText.slice(cursor, nl)).replace(/\r$/, "");
    cursor = nl === -1 ? total : nl + 1;
    if (!line.trim()) continue;
    rows++;
    const c = parseCsvLine(line);
    const cnpj = ps(c[I.cnpj]);
    const dt = pd(c[I.dt]);
    if (!cnpj || !dt) continue;
    const key = cnpj + "|" + dt;
    if (seen.has(key)) continue;
    seen.add(key);

    // Build raw_payload com TODAS as colunas (preserva 95 cols originais)
    const raw: Record<string, string | null> = {};
    for (let i = 0; i < header.length; i++) {
      const v = c[i]?.trim();
      raw[header[i]] = v && v.length > 0 ? v : null;
    }

    batch.push({
      cnpj_fundo_classe: cnpj,
      data_referencia: dt,
      versao: pint(c[I.versao]),
      receita_venda_estoque_contabil: pn(c[I.rec_venda_estoque_c]),
      receita_venda_estoque_financeiro: pn(c[I.rec_venda_estoque_f]),
      custo_estoque_contabil: pn(c[I.custo_estoque_c]),
      custo_estoque_financeiro: pn(c[I.custo_estoque_f]),
      resultado_liquido_estoque_contabil: pn(c[I.res_liq_estoque_c]),
      resultado_liquido_estoque_financeiro: pn(c[I.res_liq_estoque_f]),
      receita_aluguel_investimento_contabil: pn(c[I.rec_aluguel_c]),
      receita_aluguel_investimento_financeiro: pn(c[I.rec_aluguel_f]),
      despesa_manutencao_investimento_contabil: pn(c[I.desp_manut_c]),
      despesa_manutencao_investimento_financeiro: pn(c[I.desp_manut_f]),
      receita_venda_investimento_contabil: pn(c[I.rec_venda_inv_c]),
      receita_venda_investimento_financeiro: pn(c[I.rec_venda_inv_f]),
      resultado_liquido_renda_contabil: pn(c[I.res_liq_renda_c]),
      resultado_liquido_renda_investimento_financeiro: pn(c[I.res_liq_renda_f]),
      receita_juros_tvm_contabil: pn(c[I.rec_juros_tvm_c]),
      receita_juros_tvm_financeiro: pn(c[I.rec_juros_tvm_f]),
      resultado_venda_tvm_contabil: pn(c[I.res_venda_tvm_c]),
      resultado_venda_tvm_financeiro: pn(c[I.res_venda_tvm_f]),
      resultado_liquido_tvm_contabil: pn(c[I.res_liq_tvm_c]),
      resultado_liquido_tvm_financeiro: pn(c[I.res_liq_tvm_f]),
      resultado_liquido_total_contabil: pn(c[I.res_liq_total_c]),
      resultado_liquido_total_financeiro: pn(c[I.res_liq_total_f]),
      receita_juros_aplicacao_contabil: pn(c[I.rec_juros_apl_c]),
      receita_juros_aplicacao_financeiro: pn(c[I.rec_juros_apl_f]),
      despesa_administracao_contabil: pn(c[I.desp_admin_c]),
      despesa_administracao_financeiro: pn(c[I.desp_admin_f]),
      despesa_consultoria_contabil: pn(c[I.desp_consult_c]),
      despesa_consultoria_financeiro: pn(c[I.desp_consult_f]),
      despesa_corretagem_contabil: pn(c[I.desp_corret_c]),
      despesa_corretagem_financeiro: pn(c[I.desp_corret_f]),
      despesa_juridica_contabil: pn(c[I.desp_jurid_c]),
      despesa_juridica_financeiro: pn(c[I.desp_jurid_f]),
      despesa_auditoria_contabil: pn(c[I.desp_audit_c]),
      despesa_auditoria_financeiro: pn(c[I.desp_audit_f]),
      despesa_taxa_cvm_contabil: pn(c[I.desp_taxa_cvm_c]),
      despesa_taxa_cvm_financeiro: pn(c[I.desp_taxa_cvm_f]),
      outras_despesas_contabil: pn(c[I.outras_desp_c]),
      outras_despesas_financeiro: pn(c[I.outras_desp_f]),
      resultado_bruto_periodo_contabil: pn(c[I.res_bruto_c]),
      resultado_bruto_periodo_financeiro: pn(c[I.res_bruto_f]),
      resultado_liquido_periodo_contabil: pn(c[I.res_liq_periodo_c]),
      resultado_liquido_periodo_financeiro: pn(c[I.res_liq_periodo_f]),
      rendimentos_distribuidos_periodo: pn(c[I.rendimentos_dist]),
      amortizacoes_distribuidas_periodo: pn(c[I.amort_dist]),
      raw_payload: raw,
    });
    if (batch.length >= 100) await flush();
  }
  await flush();
  return { rows, upserted, errors };
}

// ============================================================================
// MAIN
// ============================================================================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const startedAt = new Date().toISOString();
  const url = new URL(req.url);
  const year = url.searchParams.get("year") || String(new Date().getFullYear());
  const only = url.searchParams.get("only") || ""; // imoveis | inquilinos | resultado | empty=all

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    console.log(`=== ingest-cvm-fii-trimestral v1: year=${year} only=${only || "all"} ===`);

    const zipUrl = `https://dados.cvm.gov.br/dados/FII/DOC/INF_TRIMESTRAL/DADOS/inf_trimestral_fii_${year}.zip`;
    console.log("Downloading " + zipUrl);
    const resp = await fetch(zipUrl);
    if (!resp.ok) throw new Error("Download failed: " + resp.status);
    const data = new Uint8Array(await resp.arrayBuffer());
    console.log("Downloaded " + (data.length / 1024 / 1024).toFixed(1) + " MB");

    // Filter ZIP to relevant CSVs only (skip aquisicao/alienacao/contrato/desempenho/ativo etc to save memory)
    const wanted = new Set<string>();
    if (!only || only === "imoveis") wanted.add(`inf_trimestral_fii_imovel_${year}.csv`);
    if (!only || only === "inquilinos") wanted.add(`inf_trimestral_fii_imovel_renda_acabado_inquilino_${year}.csv`);
    if (!only || only === "resultado") wanted.add(`inf_trimestral_fii_resultado_contabil_financeiro_${year}.csv`);

    const files = unzipSync(data, {
      filter: (f: any) => wanted.has(f.name.toLowerCase()) || wanted.has(f.name),
    });

    const result: any = { year, only: only || "all" };

    for (const want of wanted) {
      const entry = Object.entries(files).find(([fn]) => fn.toLowerCase() === want.toLowerCase());
      if (!entry) {
        console.warn(`Missing CSV in ZIP: ${want}`);
        continue;
      }
      const csvText = new TextDecoder("iso-8859-1").decode(entry[1] as Uint8Array);
      console.log(`Processing ${want} (${(csvText.length / 1024).toFixed(0)} KB)`);

      if (want.includes("imovel_renda_acabado_inquilino")) {
        result.inquilinos = await ingestInquilinos(supabase, csvText);
      } else if (want.includes("resultado_contabil_financeiro")) {
        result.resultado = await ingestResultado(supabase, csvText);
      } else if (want.includes("imovel_")) {
        result.imoveis = await ingestImoveis(supabase, csvText);
      }
    }

    await supabase.from("hub_cvm_ingestion_log").insert({
      source: "ingest-cvm-fii-trimestral",
      reference_date: year + "-12-31",
      records_fetched:
        (result.imoveis?.rows ?? 0) + (result.inquilinos?.rows ?? 0) + (result.resultado?.rows ?? 0),
      records_inserted:
        (result.imoveis?.upserted ?? 0) + (result.inquilinos?.upserted ?? 0) + (result.resultado?.upserted ?? 0),
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
        source: "ingest-cvm-fii-trimestral",
        reference_date: year + "-12-31",
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
