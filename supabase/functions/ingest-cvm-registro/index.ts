// ingest-cvm-registro v1 — Enriches hub_fundos_meta from CVM registro_fundo_classe.zip
// Sources: registro_classe.csv (~35k classes) + registro_fundo.csv (~87k parent funds)
// Populates: denom_social, benchmark, classe_anbima, tributacao, publico_alvo, tp_condom,
//            admin_nome, cnpj_admin, gestor_nome, cnpj_gestor, vl_patrim_liq, dt_reg
// Join: registro_classe.ID_Registro_Fundo → registro_fundo.ID_Registro_Fundo
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { unzipSync } from 'https://esm.sh/fflate@0.8.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const REGISTRO_URL = 'https://dados.cvm.gov.br/dados/FI/CAD/DADOS/registro_fundo_classe.zip'

function parseCSV(text: string, delimiter = ';'): Record<string, string>[] {
  const lines = text.split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/\r/g, ''))
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const values = line.split(delimiter).map(v => v.trim().replace(/\r/g, ''))
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = values[idx] || '' })
    rows.push(row)
  }
  return rows
}

function pn(v: string | undefined): number | null {
  if (!v || !v.trim()) return null
  const n = parseFloat(v.trim().replace(',', '.'))
  return isFinite(n) ? n : null
}

function pdate(v: string | undefined): string | null {
  if (!v || !v.trim()) return null
  const s = v.trim()
  // Accept YYYY-MM-DD or DD/MM/YYYY
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10)
  if (s.includes('/')) {
    const p = s.split('/')
    if (p.length === 3) return p[2] + '-' + p[1].padStart(2, '0') + '-' + p[0].padStart(2, '0')
  }
  return null
}

/** Format a 14-digit CNPJ string as XX.XXX.XXX/XXXX-XX */
function fmtCnpj(raw: string | undefined): string | null {
  if (!raw) return null
  const d = raw.replace(/\D/g, '')
  if (d.length !== 14) return null
  return d.substring(0, 2) + '.' + d.substring(2, 5) + '.' + d.substring(5, 8) + '/' + d.substring(8, 12) + '-' + d.substring(12, 14)
}

async function downloadAndUnzip(url: string): Promise<Record<string, Uint8Array>> {
  console.log('Downloading ' + url)
  const resp = await fetch(url)
  if (!resp.ok) throw new Error('Download failed: ' + resp.status)
  const data = new Uint8Array(await resp.arrayBuffer())
  console.log('Downloaded ' + (data.length / 1024 / 1024).toFixed(1) + ' MB, unzipping...')
  return unzipSync(data)
}

function decodeCSV(fileData: Uint8Array): string {
  return new TextDecoder('iso-8859-1').decode(fileData)
}

interface FundoRow {
  admin_nome: string | null
  cnpj_admin: string | null
  gestor_nome: string | null
  cnpj_gestor: string | null
  dt_reg: string | null
}

/** Tipo_Classe → classe_rcvm175 (hub convention) */
function mapTipoClasse(tipo: string): string | null {
  const t = tipo.toLowerCase()
  if (t.includes('fidc')) return 'FIDC'
  if (t.includes('fip')) return 'FIP'
  if (t.includes('fiim')) return 'FII'
  if (t.includes('fii')) return 'FII'
  if (t.includes('fiagro')) return 'FIAGRO'
  if (t.includes('fif')) {
    // FIF covers RF/Multi/Ações/Cambial/ETF/Previdência — can't refine without Classificacao
    return null
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const startedAt = new Date().toISOString()
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const url = new URL(req.url)
    const dryRun = url.searchParams.get('dry_run') === '1'
    const fidcOnly = url.searchParams.get('fidc_only') === '1'
    console.log('=== ingest-cvm-registro v1 === dry_run=' + dryRun + ' fidc_only=' + fidcOnly)

    // 0) Pre-fetch known cnpj_fundo_classe so we only ENRICH (no inserts)
    const knownCnpjs = new Set<string>()
    {
      const PAGE = 1000
      let from = 0
      while (true) {
        const { data, error } = await supabase
          .from('hub_fundos_meta')
          .select('cnpj_fundo_classe')
          .range(from, from + PAGE - 1)
        if (error) throw new Error('meta pre-fetch: ' + error.message)
        if (!data || data.length === 0) break
        for (const r of data) if (r.cnpj_fundo_classe) knownCnpjs.add(r.cnpj_fundo_classe)
        if (data.length < PAGE) break
        from += PAGE
      }
    }
    console.log('Known meta CNPJs: ' + knownCnpjs.size)

    const files = await downloadAndUnzip(REGISTRO_URL)

    // 1) Parse registro_fundo.csv into map by ID_Registro_Fundo
    const fundoIdx: Record<string, FundoRow> = {}
    let fundoCount = 0
    for (const [fname, fdata] of Object.entries(files)) {
      if (!fname.endsWith('registro_fundo.csv')) continue
      const text = decodeCSV(fdata)
      const rows = parseCSV(text)
      fundoCount = rows.length
      console.log('registro_fundo.csv: ' + rows.length + ' rows')
      for (const r of rows) {
        const id = (r['ID_Registro_Fundo'] || '').trim()
        if (!id) continue
        fundoIdx[id] = {
          admin_nome: (r['Administrador'] || '').trim() || null,
          cnpj_admin: fmtCnpj(r['CNPJ_Administrador']),
          gestor_nome: (r['Gestor'] || '').trim() || null,
          cnpj_gestor: fmtCnpj(r['CPF_CNPJ_Gestor']),
          dt_reg: pdate(r['Data_Registro']),
        }
      }
      break
    }
    console.log('Indexed ' + Object.keys(fundoIdx).length + ' parent funds')

    // 2) Parse registro_classe.csv and build upsert payload
    const upserts: any[] = []
    const stats = {
      total: 0,
      with_benchmark: 0,
      with_anbima: 0,
      with_trib: 0,
      with_publico: 0,
      with_tp_condom: 0,
      with_admin: 0,
      with_gestor: 0,
      by_tipo: {} as Record<string, number>,
    }

    for (const [fname, fdata] of Object.entries(files)) {
      if (!fname.endsWith('registro_classe.csv')) continue
      const text = decodeCSV(fdata)
      const rows = parseCSV(text)
      console.log('registro_classe.csv: ' + rows.length + ' rows')

      for (const r of rows) {
        const rawCnpj = (r['CNPJ_Classe'] || '').trim()
        const cnpjClasse = fmtCnpj(rawCnpj)
        if (!cnpjClasse) continue
        if (!knownCnpjs.has(cnpjClasse)) continue // enrichment only — no orphan inserts

        const tipoClasseRaw = (r['Tipo_Classe'] || '').trim()
        const classeRcvm = mapTipoClasse(tipoClasseRaw)
        if (fidcOnly && classeRcvm !== 'FIDC') continue

        stats.total++
        stats.by_tipo[tipoClasseRaw] = (stats.by_tipo[tipoClasseRaw] || 0) + 1

        const idFundo = (r['ID_Registro_Fundo'] || '').trim()
        const fundoInfo = idFundo ? fundoIdx[idFundo] : null

        const benchmark = (r['Indicador_Desempenho'] || '').trim() || null
        const classeAnbima = (r['Classificacao_Anbima'] || '').trim() || null
        const tributacao = (r['Tributacao_Longo_Prazo'] || '').trim() || null
        const publicoAlvo = (r['Publico_Alvo'] || '').trim() || null
        const tpCondom = (r['Forma_Condominio'] || '').trim() || null
        const denom = (r['Denominacao_Social'] || '').trim() || null
        const pl = pn(r['Patrimonio_Liquido'])
        const dtPl = pdate(r['Data_Patrimonio_Liquido'])

        if (benchmark) stats.with_benchmark++
        if (classeAnbima) stats.with_anbima++
        if (tributacao) stats.with_trib++
        if (publicoAlvo) stats.with_publico++
        if (tpCondom) stats.with_tp_condom++
        if (fundoInfo?.admin_nome) stats.with_admin++
        if (fundoInfo?.gestor_nome) stats.with_gestor++

        // Only set fields where we have non-null data (otherwise we'd wipe existing good data)
        const patch: any = { cnpj_fundo_classe: cnpjClasse }
        if (denom) patch.denom_social = denom
        if (benchmark) patch.benchmark = benchmark
        if (classeAnbima) patch.classe_anbima = classeAnbima
        if (tributacao) patch.tributacao = tributacao
        if (publicoAlvo) patch.publico_alvo = publicoAlvo
        if (tpCondom) patch.tp_condom = tpCondom
        if (pl != null) patch.vl_patrim_liq = pl
        if (dtPl) patch.dt_patrim_liq = dtPl
        if (fundoInfo?.admin_nome) patch.admin_nome = fundoInfo.admin_nome
        if (fundoInfo?.cnpj_admin) patch.cnpj_admin = fundoInfo.cnpj_admin
        if (fundoInfo?.gestor_nome) patch.gestor_nome = fundoInfo.gestor_nome
        if (fundoInfo?.cnpj_gestor) patch.cnpj_gestor = fundoInfo.cnpj_gestor
        if (fundoInfo?.dt_reg) patch.dt_reg = fundoInfo.dt_reg

        // Only push if there's at least one enrichment field (besides PK)
        if (Object.keys(patch).length > 1) upserts.push(patch)
      }
      break
    }

    console.log('Prepared ' + upserts.length + ' upsert payloads')

    if (dryRun) {
      return new Response(JSON.stringify({
        mode: 'dry_run',
        parent_funds_indexed: Object.keys(fundoIdx).length,
        classes_parsed: stats.total,
        upserts_ready: upserts.length,
        stats,
      }, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 3) Batch upsert by cnpj_fundo_classe (merge — only updates columns in payload)
    let updated = 0
    let batchErrors = 0
    for (let i = 0; i < upserts.length; i += 500) {
      const batch = upserts.slice(i, i + 500)
      // Use update via upsert with ignoreDuplicates=false and PK conflict
      const { error, count } = await supabase
        .from('hub_fundos_meta')
        .upsert(batch, { onConflict: 'cnpj_fundo_classe', ignoreDuplicates: false, count: 'exact' })
      if (error) {
        console.error('Batch ' + i + ' err: ' + error.message)
        batchErrors++
      } else {
        updated += count || batch.length
      }
    }

    await supabase.from('hub_cvm_ingestion_log').insert({
      source: 'ingest-cvm-registro', reference_date: new Date().toISOString().substring(0, 10),
      records_fetched: stats.total, records_inserted: updated, status: 'success',
      started_at: startedAt, finished_at: new Date().toISOString(),
    })

    return new Response(JSON.stringify({
      module: 'registro',
      parent_funds_indexed: Object.keys(fundoIdx).length,
      classes_parsed: stats.total,
      upserts_applied: updated,
      batch_errors: batchErrors,
      stats,
    }, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Fatal: ' + msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
