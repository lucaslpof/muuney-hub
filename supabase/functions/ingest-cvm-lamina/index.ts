// ingest-cvm-lamina v1 — Lâmina mensal de fundos (política, taxas, limites)
//
// Fonte: /dados/FI/DOC/LAMINA/DADOS/lamina_fi_YYYYMM.zip
// Contém 4 CSVs: main + carteira + rentab_ano + rentab_mes
// Esta função processa apenas o main CSV (~3MB/mês descompactado).
// Carteira/rentab serão sprints futuros se necessário.
//
// Cobertura: FI + FIDC + FII + FIP — todos os fundos abertos com lâmina obrigatória.

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
  if (v.includes("/")) {
    const p = v.split("/");
    if (p.length === 3) return p[2] + "-" + p[1].padStart(2, "0") + "-" + p[0].padStart(2, "0");
  }
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

async function ingestLamina(supabase: any, yearMonth: string) {
  const zipUrl = `https://dados.cvm.gov.br/dados/FI/DOC/LAMINA/DADOS/lamina_fi_${yearMonth}.zip`;
  console.log("Downloading " + zipUrl + " ...");
  const resp = await fetch(zipUrl);
  if (!resp.ok) throw new Error("Download failed: " + resp.status + " from " + zipUrl);
  const data = new Uint8Array(await resp.arrayBuffer());
  console.log("Downloaded " + (data.length / 1024 / 1024).toFixed(1) + " MB, unzipping (filtered to main CSV) ...");

  // Filter to main CSV only — skip carteira/rentab to save memory
  const files = unzipSync(data, {
    filter: (f: any) =>
      f.name.toLowerCase().endsWith(".csv") &&
      !f.name.toLowerCase().includes("carteira") &&
      !f.name.toLowerCase().includes("rentab"),
  });

  const mainFile = Object.entries(files).find(([fn]) => /lamina_fi_\d{6}\.csv$/i.test(fn));
  if (!mainFile) throw new Error("Main lamina CSV not found in ZIP");

  const text = new TextDecoder("iso-8859-1").decode(mainFile[1] as Uint8Array);

  let cursor = 0;
  const total = text.length;

  let nl = text.indexOf("\n", cursor);
  if (nl === -1) throw new Error("Empty CSV");
  const header = parseCsvLine(text.slice(cursor, nl).replace(/\r$/, ""));
  cursor = nl + 1;

  const idx = (col: string) => header.indexOf(col);
  // Build column index map for all fields we care about
  const I = {
    tp: idx("TP_FUNDO_CLASSE"),
    cnpj: idx("CNPJ_FUNDO_CLASSE"),
    sub: idx("ID_SUBCLASSE"),
    denom: idx("DENOM_SOCIAL"),
    dt: idx("DT_COMPTC"),
    nmFant: idx("NM_FANTASIA"),
    enderEl: idx("ENDER_ELETRONICO"),
    pubAlvo: idx("PUBLICO_ALVO"),
    restrInvest: idx("RESTR_INVEST"),
    objetivo: idx("OBJETIVO"),
    politInvest: idx("POLIT_INVEST"),
    prPlExt: idx("PR_PL_ATIVO_EXTERIOR"),
    prPlCredPriv: idx("PR_PL_ATIVO_CRED_PRIV"),
    prPlAlav: idx("PR_PL_ALAVANC"),
    prAtEmiss: idx("PR_ATIVO_EMISSOR"),
    derivProt: idx("DERIV_PROTECAO_CARTEIRA"),
    riscoPerda: idx("RISCO_PERDA"),
    riscoPerdaNeg: idx("RISCO_PERDA_NEGATIVO"),
    prPlAplicMax: idx("PR_PL_APLIC_MAX_FUNDO_UNICO"),
    investMin: idx("INVEST_INICIAL_MIN"),
    investAdic: idx("INVEST_ADIC"),
    resgateMin: idx("RESGATE_MIN"),
    horaAplic: idx("HORA_APLIC_RESGATE"),
    vlMinPerman: idx("VL_MIN_PERMAN"),
    qtDiaCaren: idx("QT_DIA_CAREN"),
    condicCaren: idx("CONDIC_CAREN"),
    convCotaCompra: idx("CONVERSAO_COTA_COMPRA"),
    qtDiaConvCompra: idx("QT_DIA_CONVERSAO_COTA_COMPRA"),
    convCotaCanc: idx("CONVERSAO_COTA_CANC"),
    qtDiaConvResg: idx("QT_DIA_CONVERSAO_COTA_RESGATE"),
    tpDiaPagto: idx("TP_DIA_PAGTO_RESGATE"),
    qtDiaPagto: idx("QT_DIA_PAGTO_RESGATE"),
    tpTaxaAdm: idx("TP_TAXA_ADM"),
    taxaAdm: idx("TAXA_ADM"),
    taxaAdmMin: idx("TAXA_ADM_MIN"),
    taxaAdmMax: idx("TAXA_ADM_MAX"),
    taxaAdmObs: idx("TAXA_ADM_OBS"),
    taxaEntr: idx("TAXA_ENTR"),
    condicEntr: idx("CONDIC_ENTR"),
    qtDiaSaida: idx("QT_DIA_SAIDA"),
    taxaSaida: idx("TAXA_SAIDA"),
    condicSaida: idx("CONDIC_SAIDA"),
    taxaPerfm: idx("TAXA_PERFM"),
    prPlDesp: idx("PR_PL_DESPESA"),
    dtIniDesp: idx("DT_INI_DESPESA"),
    dtFimDesp: idx("DT_FIM_DESPESA"),
    vlPl: idx("VL_PATRIM_LIQ"),
    classeRisco: idx("CLASSE_RISCO_ADMIN"),
    prRent5: idx("PR_RENTAB_FUNDO_5ANO"),
    indRefer: idx("INDICE_REFER"),
    prVarInd5: idx("PR_VARIACAO_INDICE_REFER_5ANO"),
    qtAnoPerda: idx("QT_ANO_PERDA"),
    dtIni5: idx("DT_INI_ATIV_5ANO"),
    calcGatilho: idx("CALC_RENTAB_FUNDO_GATILHO"),
    prVarPerfm: idx("PR_VARIACAO_PERFM"),
    calcRent: idx("CALC_RENTAB_FUNDO"),
    rentGat: idx("RENTAB_GATILHO"),
    dsRentGat: idx("DS_RENTAB_GATILHO"),
    vlDesp3: idx("VL_DESPESA_3ANO"),
    vlDesp5: idx("VL_DESPESA_5ANO"),
    vlRet3: idx("VL_RETORNO_3ANO"),
    vlRet5: idx("VL_RETORNO_5ANO"),
    remunDist: idx("REMUN_DISTRIB"),
    distGestUnico: idx("DISTRIB_GESTOR_UNICO"),
    conflVenda: idx("CONFLITO_VENDA"),
    telSac: idx("TEL_SAC"),
    enderEletReclam: idx("ENDER_ELETRONICO_RECLAMACAO"),
    infSac: idx("INF_SAC"),
  };
  if (I.cnpj < 0 || I.dt < 0) throw new Error("CNPJ_FUNDO_CLASSE / DT_COMPTC missing");

  const batch: any[] = [];
  const BATCH_SIZE = 200;
  let totalRows = 0;
  let upserted = 0;
  let batchErrors = 0;
  // Dedupe within file: PK is (cnpj, dt) but file may have duplicates
  const seen = new Set<string>();

  async function flush() {
    if (batch.length === 0) return;
    const { error } = await supabase
      .from("hub_fundos_lamina")
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
      id_subclasse: c[I.sub]?.trim() || null,
      denom_social: c[I.denom]?.trim() || null,
      nm_fantasia: c[I.nmFant]?.trim() || null,
      ender_eletronico: c[I.enderEl]?.trim() || null,
      publico_alvo: c[I.pubAlvo]?.trim() || null,
      restr_invest: c[I.restrInvest]?.trim() || null,
      objetivo: c[I.objetivo]?.trim() || null,
      polit_invest: c[I.politInvest]?.trim() || null,
      pr_pl_ativo_exterior: pn(c[I.prPlExt]),
      pr_pl_ativo_cred_priv: pn(c[I.prPlCredPriv]),
      pr_pl_alavanc: pn(c[I.prPlAlav]),
      pr_ativo_emissor: pn(c[I.prAtEmiss]),
      deriv_protecao_carteira: c[I.derivProt]?.trim() || null,
      risco_perda: c[I.riscoPerda]?.trim() || null,
      risco_perda_negativo: c[I.riscoPerdaNeg]?.trim() || null,
      pr_pl_aplic_max_fundo_unico: pn(c[I.prPlAplicMax]),
      invest_inicial_min: pn(c[I.investMin]),
      invest_adic: pn(c[I.investAdic]),
      resgate_min: pn(c[I.resgateMin]),
      hora_aplic_resgate: c[I.horaAplic]?.trim() || null,
      vl_min_perman: pn(c[I.vlMinPerman]),
      qt_dia_caren: pint(c[I.qtDiaCaren]),
      condic_caren: c[I.condicCaren]?.trim() || null,
      conversao_cota_compra: c[I.convCotaCompra]?.trim() || null,
      qt_dia_conversao_cota_compra: pint(c[I.qtDiaConvCompra]),
      conversao_cota_canc: c[I.convCotaCanc]?.trim() || null,
      qt_dia_conversao_cota_resgate: pint(c[I.qtDiaConvResg]),
      tp_dia_pagto_resgate: c[I.tpDiaPagto]?.trim() || null,
      qt_dia_pagto_resgate: pint(c[I.qtDiaPagto]),
      tp_taxa_adm: c[I.tpTaxaAdm]?.trim() || null,
      taxa_adm: pn(c[I.taxaAdm]),
      taxa_adm_min: pn(c[I.taxaAdmMin]),
      taxa_adm_max: pn(c[I.taxaAdmMax]),
      taxa_adm_obs: c[I.taxaAdmObs]?.trim() || null,
      taxa_entr: pn(c[I.taxaEntr]),
      condic_entr: c[I.condicEntr]?.trim() || null,
      qt_dia_saida: pint(c[I.qtDiaSaida]),
      taxa_saida: pn(c[I.taxaSaida]),
      condic_saida: c[I.condicSaida]?.trim() || null,
      taxa_perfm: c[I.taxaPerfm]?.trim() || null,
      pr_pl_despesa: pn(c[I.prPlDesp]),
      dt_ini_despesa: pd(c[I.dtIniDesp]),
      dt_fim_despesa: pd(c[I.dtFimDesp]),
      vl_patrim_liq: pn(c[I.vlPl]),
      classe_risco_admin: c[I.classeRisco]?.trim() || null,
      pr_rentab_fundo_5ano: pn(c[I.prRent5]),
      indice_refer: c[I.indRefer]?.trim() || null,
      pr_variacao_indice_refer_5ano: pn(c[I.prVarInd5]),
      qt_ano_perda: pint(c[I.qtAnoPerda]),
      dt_ini_ativ_5ano: pd(c[I.dtIni5]),
      calc_rentab_fundo_gatilho: c[I.calcGatilho]?.trim() || null,
      pr_variacao_perfm: pn(c[I.prVarPerfm]),
      calc_rentab_fundo: c[I.calcRent]?.trim() || null,
      rentab_gatilho: c[I.rentGat]?.trim() || null,
      ds_rentab_gatilho: c[I.dsRentGat]?.trim() || null,
      vl_despesa_3ano: pn(c[I.vlDesp3]),
      vl_despesa_5ano: pn(c[I.vlDesp5]),
      vl_retorno_3ano: pn(c[I.vlRet3]),
      vl_retorno_5ano: pn(c[I.vlRet5]),
      remun_distrib: c[I.remunDist]?.trim() || null,
      distrib_gestor_unico: c[I.distGestUnico]?.trim() || null,
      conflito_venda: c[I.conflVenda]?.trim() || null,
      tel_sac: c[I.telSac]?.trim() || null,
      ender_eletronico_reclamacao: c[I.enderEletReclam]?.trim() || null,
      inf_sac: c[I.infSac]?.trim() || null,
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
    console.log(`=== ingest-cvm-lamina v1: year_month=${yearMonth} ===`);
    const result = await ingestLamina(supabase, yearMonth);

    await supabase.from("hub_cvm_ingestion_log").insert({
      source: "ingest-cvm-lamina",
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
        source: "ingest-cvm-lamina",
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
