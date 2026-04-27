// ingest-cvm-sancoes v1 — Processos administrativos sancionadores CVM
//
// Fonte: https://dados.cvm.gov.br/dados/PROCESSO/SANCIONADOR/DADOS/processo_sancionador.zip
// 2 CSVs: processo_sancionador.csv (master) + processo_sancionador_acusado.csv (acusados)
//
// Schema processo:
//   NUP;Objeto;Ementa;Data_Abertura;Componente_Organizacional_Instrucao;
//   Fase_Atual;Subfase_Atual;Local_Atual;Data_Ultima_Movimentacao
//
// Schema acusado:
//   NUP;Nome_Acusado;Situacao;Data_Situacao
//
// Refresh: weekly Mon 04:00 UTC.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { unzipSync } from "https://esm.sh/fflate@0.8.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parseCsvLine(line: string, delimiter = ";"): string[] {
  return line.split(delimiter).map((v) => v.trim().replace(/^"|"$/g, ""));
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

async function ingestSancoes(supabase: any) {
  const zipUrl = "https://dados.cvm.gov.br/dados/PROCESSO/SANCIONADOR/DADOS/processo_sancionador.zip";
  console.log("Downloading " + zipUrl);
  const resp = await fetch(zipUrl);
  if (!resp.ok) throw new Error("Download failed: " + resp.status);
  const data = new Uint8Array(await resp.arrayBuffer());
  console.log("Downloaded " + (data.length / 1024).toFixed(1) + " KB, unzipping...");

  const files = unzipSync(data, { filter: (f: any) => f.name.toLowerCase().endsWith(".csv") });

  let processoCsv: Uint8Array | null = null;
  let acusadoCsv: Uint8Array | null = null;
  for (const [fn, content] of Object.entries(files)) {
    if (fn.toLowerCase().includes("acusado")) acusadoCsv = content as Uint8Array;
    else if (fn.toLowerCase().includes("processo_sancionador")) processoCsv = content as Uint8Array;
  }
  if (!processoCsv || !acusadoCsv) throw new Error("Required CSVs not found in ZIP");

  // ===== Parse processos =====
  const processoText = new TextDecoder("iso-8859-1").decode(processoCsv);
  const procLines = processoText.split("\n").filter((l) => l.trim());
  if (procLines.length < 2) throw new Error("Empty processos CSV");
  const procHeader = parseCsvLine(procLines[0].replace(/\r$/, ""));
  const idx = (col: string) => procHeader.indexOf(col);
  const I = {
    nup: idx("NUP"),
    objeto: idx("Objeto"),
    ementa: idx("Ementa"),
    dt_abertura: idx("Data_Abertura"),
    comp_org: idx("Componente_Organizacional_Instrucao"),
    fase: idx("Fase_Atual"),
    subfase: idx("Subfase_Atual"),
    local: idx("Local_Atual"),
    dt_ultima: idx("Data_Ultima_Movimentacao"),
  };
  if (I.nup < 0) throw new Error("NUP column missing in processos");

  const procBatch: any[] = [];
  const procSeen = new Set<string>();
  for (let i = 1; i < procLines.length; i++) {
    const cols = parseCsvLine(procLines[i].replace(/\r$/, ""));
    const nup = (cols[I.nup] || "").trim();
    if (!nup) continue;
    if (procSeen.has(nup)) continue; // dedupe within file
    procSeen.add(nup);
    procBatch.push({
      nup,
      objeto: cols[I.objeto]?.trim() || null,
      ementa: cols[I.ementa]?.trim() || null,
      data_abertura: pd(cols[I.dt_abertura]),
      componente_organizacional: cols[I.comp_org]?.trim() || null,
      fase_atual: cols[I.fase]?.trim() || null,
      subfase_atual: cols[I.subfase]?.trim() || null,
      local_atual: cols[I.local]?.trim() || null,
      data_ultima_movimentacao: pd(cols[I.dt_ultima]),
    });
  }
  console.log("Processos parsed: " + procBatch.length);

  // Upsert processos in batches
  let procUpserted = 0, procErrors = 0;
  for (let i = 0; i < procBatch.length; i += 200) {
    const { error } = await supabase
      .from("hub_cvm_sancoes")
      .upsert(procBatch.slice(i, i + 200), { onConflict: "nup", ignoreDuplicates: false });
    if (error) { console.error("processo upsert err: " + error.message); procErrors++; }
    else procUpserted += Math.min(200, procBatch.length - i);
  }

  // ===== Parse acusados =====
  const acusText = new TextDecoder("iso-8859-1").decode(acusadoCsv);
  const acusLines = acusText.split("\n").filter((l) => l.trim());
  if (acusLines.length < 2) throw new Error("Empty acusados CSV");
  const acusHeader = parseCsvLine(acusLines[0].replace(/\r$/, ""));
  const J = {
    nup: acusHeader.indexOf("NUP"),
    nome: acusHeader.indexOf("Nome_Acusado"),
    situacao: acusHeader.indexOf("Situacao"),
    dt_sit: acusHeader.indexOf("Data_Situacao"),
  };
  if (J.nup < 0 || J.nome < 0) throw new Error("Required columns missing in acusados");

  const acusBatch: any[] = [];
  const acusSeen = new Set<string>();
  for (let i = 1; i < acusLines.length; i++) {
    const cols = parseCsvLine(acusLines[i].replace(/\r$/, ""));
    const nup = (cols[J.nup] || "").trim();
    const nome = (cols[J.nome] || "").trim();
    if (!nup || !nome) continue;
    const dedupeKey = nup + "|" + nome.toUpperCase();
    if (acusSeen.has(dedupeKey)) continue;
    acusSeen.add(dedupeKey);
    // Skip orphan rows (acusado sem processo correspondente) — FK CASCADE rejeitaria
    if (!procSeen.has(nup)) continue;
    acusBatch.push({
      nup,
      nome_acusado: nome,
      situacao: cols[J.situacao]?.trim() || null,
      data_situacao: pd(cols[J.dt_sit]),
    });
  }
  console.log("Acusados parsed (matched): " + acusBatch.length);

  let acusUpserted = 0, acusErrors = 0;
  for (let i = 0; i < acusBatch.length; i += 200) {
    const { error } = await supabase
      .from("hub_cvm_sancoes_acusados")
      .upsert(acusBatch.slice(i, i + 200), { onConflict: "nup,nome_acusado", ignoreDuplicates: false });
    if (error) { console.error("acusado upsert err: " + error.message); acusErrors++; }
    else acusUpserted += Math.min(200, acusBatch.length - i);
  }

  return {
    processos_parsed: procBatch.length,
    processos_upserted: procUpserted,
    processos_errors: procErrors,
    acusados_parsed: acusBatch.length,
    acusados_upserted: acusUpserted,
    acusados_errors: acusErrors,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const startedAt = new Date().toISOString();
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    console.log("=== ingest-cvm-sancoes v1 ===");
    const result = await ingestSancoes(supabase);
    await supabase.from("hub_cvm_ingestion_log").insert({
      source: "ingest-cvm-sancoes",
      reference_date: new Date().toISOString().slice(0, 10),
      records_fetched: result.processos_parsed + result.acusados_parsed,
      records_inserted: result.processos_upserted + result.acusados_upserted,
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
        source: "ingest-cvm-sancoes",
        reference_date: new Date().toISOString().slice(0, 10),
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
