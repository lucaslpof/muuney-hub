// ingest-cvm-eventos v1 — Eventos Relevantes / Comunicados de fundos
//
// Fonte: https://dados.cvm.gov.br/dados/FI/DOC/EVENTUAL/DADOS/eventual_fi_YYYY.csv
// Cobertura: TODOS os fundos (FI, FIDC, FII, FIP, FIAGRO + classes)
// Schema CVM: TP_FUNDO_CLASSE;CNPJ_FUNDO_CLASSE;DENOM_SOCIAL;ID_SUBCLASSE;
//             DT_COMPTC;DT_RECEB;TP_DOC;NM_ARQ;ID_DOC;LINK_ARQ;RESULTADO_AUDITORIA
//
// Execução: pg_cron daily 03:00 UTC. Pode ser invocada manualmente com ?year=YYYY.
// Defaults para ano corrente.

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

function pd(val: string | undefined): string | null {
  if (!val || !val.trim()) return null;
  const v = val.trim();
  // CVM uses YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  // Fallback DD/MM/YYYY
  if (v.includes("/")) {
    const p = v.split("/");
    if (p.length === 3) return p[2] + "-" + p[1].padStart(2, "0") + "-" + p[0].padStart(2, "0");
  }
  return null;
}

// Severity derivation by tp_doc (sem ler conteúdo do PDF; iteração futura
// pode adicionar keyword detection para promover FATO RELEV → critical
// quando contém default/dissolução/suspensão_resgate/evento_avaliação).
function deriveSeveridade(tpDoc: string): "info" | "attention" | "critical" {
  const t = (tpDoc || "").toUpperCase().trim();
  // Attention — eventos que merecem revisão por AAI
  if (t === "FATO RELEV") return "attention";
  if (t === "REL. RATING" || t.startsWith("REL. RATING")) return "attention";
  if (t === "EDITAL AGO" || t === "EDITAL AED") return "attention";
  if (t === "AGO PROPOST ADM" || t === "AGE PROPOST ADM" || t === "AGO/AGE PROPADM") return "attention";
  if (t === "REGUL FDO") return "attention";
  if (t === "PROPOSTA ADMINI") return "attention";
  // Default info — rotina (AGO, AED, AVISO MERCADO, RELAT GERENCIAL, AID, OUTROS, etc.)
  return "info";
}

function parseCsvLine(line: string, delimiter = ";"): string[] {
  // CVM CSV doesn't use quoted fields with internal semicolons in EVENTUAL
  // (verified empirically). Simple split is safe.
  return line.split(delimiter).map((v) => v.trim().replace(/^"|"$/g, ""));
}

async function downloadCSV(url: string): Promise<string> {
  console.log("Downloading " + url + " ...");
  const resp = await fetch(url);
  if (!resp.ok) throw new Error("Download failed: " + resp.status + " from " + url);
  const buf = new Uint8Array(await resp.arrayBuffer());
  console.log("Downloaded " + (buf.length / 1024 / 1024).toFixed(1) + " MB");
  return new TextDecoder("iso-8859-1").decode(buf);
}

async function ingestEventos(supabase: any, year: string) {
  const url = `https://dados.cvm.gov.br/dados/FI/DOC/EVENTUAL/DADOS/eventual_fi_${year}.csv`;
  const text = await downloadCSV(url);

  // Streaming line walk (avoid materializing 100k+ row array)
  let cursor = 0;
  const total = text.length;

  // Parse header
  let nl = text.indexOf("\n", cursor);
  if (nl === -1) throw new Error("Empty CSV");
  const header = parseCsvLine(text.slice(cursor, nl).replace(/\r$/, ""));
  cursor = nl + 1;

  const idx = (col: string) => header.indexOf(col);
  const iTp = idx("TP_FUNDO_CLASSE");
  const iCnpj = idx("CNPJ_FUNDO_CLASSE");
  const iDenom = idx("DENOM_SOCIAL");
  const iSub = idx("ID_SUBCLASSE");
  const iDtComptc = idx("DT_COMPTC");
  const iDtReceb = idx("DT_RECEB");
  const iTpDoc = idx("TP_DOC");
  const iNmArq = idx("NM_ARQ");
  const iIdDoc = idx("ID_DOC");
  const iLink = idx("LINK_ARQ");
  const iAud = idx("RESULTADO_AUDITORIA");

  if (iCnpj < 0 || iDtReceb < 0 || iTpDoc < 0) {
    throw new Error("Required columns missing: CNPJ_FUNDO_CLASSE / DT_RECEB / TP_DOC");
  }

  const batch: any[] = [];
  const BATCH_SIZE = 200;
  let totalRows = 0;
  let skippedNoNmArq = 0;
  let upserted = 0;
  let batchErrors = 0;
  const counts: Record<string, number> = { info: 0, attention: 0, critical: 0 };

  async function flush() {
    if (batch.length === 0) return;
    const { error } = await supabase
      .from("hub_fundos_eventos")
      .upsert(batch, { onConflict: "cnpj_fundo_classe,dt_receb,tp_doc,nm_arq", ignoreDuplicates: true });
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

    const cols = parseCsvLine(line);
    const cnpj = (cols[iCnpj] || "").trim();
    const dtReceb = pd(cols[iDtReceb]);
    const tpDoc = (cols[iTpDoc] || "").trim();
    if (!cnpj || !dtReceb || !tpDoc) continue;
    const nmArq = cols[iNmArq]?.trim() || null;
    if (!nmArq) {
      // Rows without NM_ARQ can't be deduped via uq_eventos_natural (NULL ≠ NULL).
      // Skip — empirically rare (<0.5%) and we'd risk re-ingestion duplicates.
      skippedNoNmArq++;
      continue;
    }

    const severidade = deriveSeveridade(tpDoc);
    counts[severidade]++;

    batch.push({
      cnpj_fundo_classe: cnpj,
      tp_fundo_classe: cols[iTp]?.trim() || null,
      denom_social: cols[iDenom]?.trim() || null,
      id_subclasse: cols[iSub]?.trim() || null,
      dt_comptc: pd(cols[iDtComptc]),
      dt_receb: dtReceb,
      tp_doc: tpDoc,
      nm_arq: nmArq,
      id_doc: cols[iIdDoc]?.trim() || null,
      link_arq: cols[iLink]?.trim() || null,
      resultado_auditoria: cols[iAud]?.trim() || null,
      severidade,
    });
    if (batch.length >= BATCH_SIZE) await flush();
  }
  await flush();

  return { year, total_rows: totalRows, skipped_no_nm_arq: skippedNoNmArq, upserted, batch_errors: batchErrors, severidade_counts: counts };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const startedAt = new Date().toISOString();
  const url = new URL(req.url);
  const year = url.searchParams.get("year") || String(new Date().getFullYear());

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    console.log(`=== ingest-cvm-eventos v1: year=${year} ===`);
    const result = await ingestEventos(supabase, year);

    await supabase.from("hub_cvm_ingestion_log").insert({
      source: "ingest-cvm-eventos",
      reference_date: year,
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
        source: "ingest-cvm-eventos",
        reference_date: year,
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
