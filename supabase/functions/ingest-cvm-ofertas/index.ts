// ingest-cvm-ofertas v2 — streaming version for Edge Function memory limits
// Processes one CSV at a time, streams rows into 400-row batches, upserts immediately,
// drops references between CSVs so GC can reclaim memory.
//
// GET/POST /functions/v1/ingest-cvm-ofertas
// Optional params: ?dry_run=1 (parse only, no write), ?only=legacy|rcvm160

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { unzipSync } from 'https://esm.sh/fflate@0.8.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ZIP_URL = 'https://dados.cvm.gov.br/dados/OFERTA/DISTRIB/DADOS/oferta_distribuicao.zip'
const BATCH_SIZE = 400

// ---------- helpers ----------

function clean(v: string | undefined): string | null {
  if (v == null) return null
  const s = String(v).trim()
  if (!s) return null
  const up = s.toUpperCase()
  if (up === 'N/A' || up === 'NA' || up === '-' || up === '--') return null
  return s
}

function parseNum(v: string | undefined): number | null {
  const s = clean(v)
  if (!s) return null
  let norm = s
  if (s.includes(',')) norm = s.replace(/\./g, '').replace(',', '.')
  const n = parseFloat(norm)
  return isFinite(n) ? n : null
}

function parseDate(v: string | undefined): string | null {
  const s = clean(v)
  if (!s) return null
  const sub = s.substring(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(sub)) return sub
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(sub)) {
    const [d, m, y] = sub.split('/')
    return `${y}-${m}-${d}`
  }
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(sub)) return sub.replace(/\//g, '-')
  return null
}

function fmtCnpj(raw: string | undefined): string | null {
  if (!raw) return null
  const digits = String(raw).replace(/\D/g, '')
  if (digits.length !== 14) return null
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`
}

// ---------- mappers ----------

const LEGACY_STATUS_MAP: [string, string][] = [
  ['concedido', 'concedido'], ['arquivado', 'arquivado'], ['cancelado', 'cancelado'],
  ['suspenso', 'suspenso'], ['interrompido', 'suspenso'], ['encerrada', 'encerrado'],
  ['em análise', 'em_analise'], ['em analise', 'em_analise'], ['registrada', 'concedido'],
]

const RCVM160_STATUS_MAP: [string, string][] = [
  ['oferta encerrada', 'encerrado'], ['oferta em distribuição', 'em_distribuicao'],
  ['oferta em distribuicao', 'em_distribuicao'], ['oferta cancelada', 'cancelado'],
  ['oferta arquivada', 'arquivado'], ['oferta suspensa', 'suspenso'],
  ['registrada', 'concedido'], ['em análise', 'em_analise'], ['em analise', 'em_analise'],
  ['aguardando análise', 'em_analise'], ['deferido', 'concedido'], ['indeferido', 'cancelado'],
]

function mapStatus(val: string | undefined, table: [string, string][]): string {
  const s = clean(val)
  if (!s) return 'em_analise'
  const low = s.toLowerCase()
  for (const [needle, out] of table) if (low.includes(needle)) return out
  return 'em_analise'
}

function normalizeTipoAtivo(val: string | undefined): string | null {
  const s = clean(val)
  if (!s) return null
  const up = s.toUpperCase()
  if (up.includes('DEBÊNTUR') || up.includes('DEBENTUR')) return 'Debêntures'
  if (up === 'CRI' || up.includes('CERT REC IMOB') || up.includes('RECEBÍVEIS IMOBILIÁRIOS')) return 'CRI'
  if (up === 'CRA' || up.includes('CERT REC AGRO') || up.includes('RECEBÍVEIS DO AGRONEGÓCIO')) return 'CRA'
  if (up.includes('FIDC') || up.includes('DIREITOS CRED')) return 'FIDC'
  if (up.includes('FII') || up.includes('IMOBILIÁR') || up.includes('IMOBILIAR')) return 'FII'
  if (up.includes('AÇÕES') || up.includes('AÇÔES') || up.includes('ORDINÁR') || up.includes('PREFERENC')) return 'Ações'
  if (up.includes('NOTA PROMISSÓR') || up.includes('NOTA PROMISS')) return 'Notas Promissórias'
  if (up.includes('BDR')) return 'BDR'
  if (up.includes('LETR')) return 'Letras Financeiras'
  if (up.includes('FIP') || up.includes('PARTICIPAÇ')) return 'FIP'
  return s.substring(0, 60)
}

// ---------- streaming row mappers ----------

interface Patch {
  protocolo: string
  numero_oferta: string | null
  emissor_cnpj: string | null
  emissor_nome: string | null
  tipo_oferta: string
  tipo_ativo: string | null
  status: string
  modalidade: string | null
  valor_total: number | null
  volume_final: number | null
  data_protocolo: string | null
  data_registro: string | null
  data_inicio: string | null
  data_encerramento: string | null
  coordenador_lider: string | null
  rating: string | null
  serie: string | null
  segmento: string | null
  observacoes: string | null
  source_url: string
}

function mapLegacyRow(row: Record<string, string>): Patch | null {
  const protoRaw = clean(row['Numero_Processo']) || clean(row['Numero_Registro_Oferta'])
  if (!protoRaw) return null
  let valor = parseNum(row['Valor_Total'])
  const qty = parseNum(row['Quantidade_Total'])
  const preco = parseNum(row['Preco_Unitario'])
  if (!valor && qty && preco) valor = Math.round(qty * preco * 100) / 100
  const rito = clean(row['Rito_Oferta']) || ''
  let tipoOferta = 'CVM 400'
  if (rito.includes('476')) tipoOferta = 'CVM 476'
  else if (rito.includes('400')) tipoOferta = 'CVM 400'
  return {
    protocolo: `L:${protoRaw}`,
    numero_oferta: clean(row['Numero_Registro_Oferta']),
    emissor_cnpj: fmtCnpj(row['CNPJ_Emissor']),
    emissor_nome: clean(row['Nome_Emissor']),
    tipo_oferta: tipoOferta,
    tipo_ativo: normalizeTipoAtivo(row['Tipo_Ativo']),
    status: mapStatus(row['Modalidade_Registro'], LEGACY_STATUS_MAP),
    modalidade: rito || null,
    valor_total: valor,
    volume_final: valor,
    data_protocolo: parseDate(row['Data_Protocolo']),
    data_registro: parseDate(row['Data_Registro_Oferta']),
    data_inicio: parseDate(row['Data_Inicio_Oferta']),
    data_encerramento: parseDate(row['Data_Encerramento_Oferta']),
    coordenador_lider: clean(row['Nome_Lider']),
    rating: null,
    serie: clean(row['Serie']),
    segmento: clean(row['Tipo_Fundo_Investimento']) || clean(row['Classe_Ativo']),
    observacoes: null,
    source_url: ZIP_URL,
  }
}

function mapRcvm160Row(row: Record<string, string>): Patch | null {
  const protoRaw = clean(row['Numero_Requerimento']) || clean(row['Numero_Processo'])
  if (!protoRaw) return null
  const valor = parseNum(row['Valor_Total_Registrado'])
  const obsParts: string[] = []
  for (const k of ['Descricao_lastro', 'Destinacao_recursos', 'Ativos_alvo']) {
    const v = clean(row[k])
    if (v) obsParts.push(`${k}: ${v.substring(0, 200)}`)
  }
  return {
    protocolo: `R160:${protoRaw}`,
    numero_oferta: clean(row['Numero_Processo']),
    emissor_cnpj: fmtCnpj(row['CNPJ_Emissor']),
    emissor_nome: clean(row['Nome_Emissor']),
    tipo_oferta: 'CVM 160',
    tipo_ativo: normalizeTipoAtivo(row['Valor_Mobiliario']),
    status: mapStatus(row['Status_Requerimento'], RCVM160_STATUS_MAP),
    modalidade: clean(row['Rito_Requerimento']) || clean(row['Tipo_requerimento']),
    valor_total: valor,
    volume_final: valor,
    data_protocolo: parseDate(row['Data_requerimento']),
    data_registro: parseDate(row['Data_Registro']),
    data_inicio: null,
    data_encerramento: parseDate(row['Data_Encerramento']),
    coordenador_lider: clean(row['Nome_Lider']),
    rating: null,
    serie: clean(row['Emissao']),
    segmento: clean(row['Tipo_lastro']) || clean(row['Publico_alvo']),
    observacoes: obsParts.length ? obsParts.join(' | ').substring(0, 2000) : null,
    source_url: ZIP_URL,
  }
}

// ---------- streaming CSV processor ----------

interface StreamStats {
  rows_seen: number
  mapped: number
  skipped: number
  upserted: number
  errors: number
  by_tipo_oferta: Record<string, number>
  by_status: Record<string, number>
}

/** Process a CSV in a single streaming pass. Parses line-by-line, maps to Patch, dedupes within batch,
 *  and upserts every BATCH_SIZE rows. Never materializes the full row set. */
async function streamProcessCSV(
  text: string,
  mapper: (row: Record<string, string>) => Patch | null,
  supabase: any,
  dryRun: boolean,
): Promise<StreamStats> {
  const stats: StreamStats = {
    rows_seen: 0, mapped: 0, skipped: 0, upserted: 0, errors: 0,
    by_tipo_oferta: {}, by_status: {},
  }

  // Find header line
  const firstNl = text.indexOf('\n')
  if (firstNl < 0) return stats
  const headerLine = text.substring(0, firstNl).replace(/\r/g, '')
  const headers = headerLine.split(';').map(h => h.trim().replace(/^"|"$/g, ''))

  // Streaming batch buffer (dedupe within batch via Map)
  let batchMap = new Map<string, Patch>()
  const flushBatch = async () => {
    if (batchMap.size === 0) return
    const slice = Array.from(batchMap.values())
    batchMap = new Map()
    if (dryRun) {
      stats.upserted += slice.length
      return
    }
    try {
      const { data, error } = await supabase
        .from('hub_ofertas_publicas')
        .upsert(slice, { onConflict: 'protocolo', ignoreDuplicates: false })
        .select('protocolo')
      if (error) {
        stats.errors++
        console.error('batch err: ' + error.message)
      } else {
        stats.upserted += data?.length || 0
      }
    } catch (e) {
      stats.errors++
      console.error('batch exception: ' + String(e))
    }
  }

  // Walk lines without accumulating a full array
  let pos = firstNl + 1
  const len = text.length
  while (pos < len) {
    let nl = text.indexOf('\n', pos)
    if (nl < 0) nl = len
    const line = text.substring(pos, nl).replace(/\r/g, '')
    pos = nl + 1
    if (!line.trim()) continue
    stats.rows_seen++
    const values = line.split(';').map(v => v.trim().replace(/^"|"$/g, ''))
    const row: Record<string, string> = {}
    for (let i = 0; i < headers.length; i++) row[headers[i]] = values[i] || ''
    const patch = mapper(row)
    if (!patch) { stats.skipped++; continue }
    stats.mapped++
    stats.by_tipo_oferta[patch.tipo_oferta] = (stats.by_tipo_oferta[patch.tipo_oferta] || 0) + 1
    stats.by_status[patch.status] = (stats.by_status[patch.status] || 0) + 1
    batchMap.set(patch.protocolo, patch)
    if (batchMap.size >= BATCH_SIZE) {
      await flushBatch()
    }
  }
  await flushBatch()
  return stats
}

// ---------- main handler ----------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const startedAt = new Date().toISOString()
  const url = new URL(req.url)
  const dryRun = url.searchParams.get('dry_run') === '1'
  const only = url.searchParams.get('only') // 'legacy' | 'rcvm160' | null

  try {
    console.log('=== ingest-cvm-ofertas v2 (streaming) ===')
    console.log('dry_run=' + dryRun + ' only=' + (only || 'both'))
    console.log('Downloading ' + ZIP_URL + '...')
    const resp = await fetch(ZIP_URL)
    if (!resp.ok) throw new Error('Download failed: ' + resp.status)
    const zipBytes = new Uint8Array(await resp.arrayBuffer())
    console.log('Downloaded ' + (zipBytes.length / 1024 / 1024).toFixed(1) + ' MB')

    const files = unzipSync(zipBytes)
    console.log('Files: ' + Object.keys(files).join(', '))

    const supabase = dryRun ? null : createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const dec = new TextDecoder('iso-8859-1')
    const results: Record<string, StreamStats> = {}

    // Legacy CSV
    if ((!only || only === 'legacy') && files['oferta_distribuicao.csv']) {
      console.log('Processing oferta_distribuicao.csv...')
      const bytes = files['oferta_distribuicao.csv']
      const text = dec.decode(bytes)
      console.log('legacy CSV: ' + (text.length / 1024 / 1024).toFixed(1) + ' MB')
      // Release ZIP reference for legacy file as soon as possible
      // @ts-ignore - delete for GC hint
      delete files['oferta_distribuicao.csv']
      results.legacy = await streamProcessCSV(text, mapLegacyRow, supabase, dryRun)
      console.log('legacy done: ' + JSON.stringify({
        rows_seen: results.legacy.rows_seen, mapped: results.legacy.mapped,
        upserted: results.legacy.upserted, errors: results.legacy.errors,
      }))
    }

    // RCVM 160 CSV
    if ((!only || only === 'rcvm160') && files['oferta_resolucao_160.csv']) {
      console.log('Processing oferta_resolucao_160.csv...')
      const bytes = files['oferta_resolucao_160.csv']
      const text = dec.decode(bytes)
      console.log('rcvm160 CSV: ' + (text.length / 1024 / 1024).toFixed(1) + ' MB')
      // @ts-ignore
      delete files['oferta_resolucao_160.csv']
      results.rcvm160 = await streamProcessCSV(text, mapRcvm160Row, supabase, dryRun)
      console.log('rcvm160 done: ' + JSON.stringify({
        rows_seen: results.rcvm160.rows_seen, mapped: results.rcvm160.mapped,
        upserted: results.rcvm160.upserted, errors: results.rcvm160.errors,
      }))
    }

    const totalUpserted = Object.values(results).reduce((s, r) => s + r.upserted, 0)
    const totalErrors = Object.values(results).reduce((s, r) => s + r.errors, 0)
    const totalMapped = Object.values(results).reduce((s, r) => s + r.mapped, 0)

    if (!dryRun && supabase) {
      await supabase.from('hub_cvm_ingestion_log').insert({
        source: 'ingest-cvm-ofertas',
        reference_date: new Date().toISOString().slice(0, 10),
        records_fetched: totalMapped,
        records_inserted: totalUpserted,
        status: totalErrors ? 'partial' : 'success',
        error_message: null,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      })
    }

    console.log('Done! upserted=' + totalUpserted + ' errors=' + totalErrors)
    return new Response(JSON.stringify({
      dry_run: dryRun,
      total_mapped: totalMapped,
      total_upserted: totalUpserted,
      total_errors: totalErrors,
      results,
    }, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Fatal: ' + msg)
    try {
      const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
      await supabase.from('hub_cvm_ingestion_log').insert({
        source: 'ingest-cvm-ofertas',
        reference_date: new Date().toISOString().slice(0, 10),
        status: 'error',
        error_message: msg,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      })
    } catch { /* ignore */ }
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
