import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { BlobReader, ZipReader, TextWriter } from 'https://deno.land/x/zipjs@v2.7.34/index.js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Cache-Control': 'public, max-age=3600',
}

const CVM_BASE = 'https://dados.cvm.gov.br/dados/FI'
const CVM_FIDC_BASE = 'https://dados.cvm.gov.br/dados/FIDC'

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

function parseNumeric(val: string | undefined): number | null {
  if (!val || val.trim() === '') return null
  const n = parseFloat(val.replace(',', '.'))
  return isNaN(n) ? null : n
}

function parseDate(val: string | undefined): string | null {
  if (!val || val.trim() === '') return null
  if (val.includes('/')) {
    const [d, m, y] = val.split('/')
    return `${y}-${m}-${d}`
  }
  return val
}

function parseCsvRobust(text: string, separator = ';'): Record<string, string>[] {
  const lines = text.split('\n').filter(l => l.trim().length > 0)
  if (lines.length < 2) return []
  const headers = lines[0].split(separator).map(h => h.trim().replace(/^\uFEFF/, '').replace(/^\"|\"$/g, ''))
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(separator).map(v => v.trim().replace(/^\"|\"$/g, ''))
    if (values.length < headers.length * 0.5) continue
    const row: Record<string, string> = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || ''
    }
    rows.push(row)
  }
  return rows
}

async function fetchCsvFromUrl(baseUrl: string, path: string): Promise<Record<string, string>[]> {
  const csvUrl = `${baseUrl}/${path}`
  const zipUrl = csvUrl.replace('.csv', '.zip')
  let resp = await fetch(csvUrl)
  if (resp.ok) {
    const buffer = await resp.arrayBuffer()
    const text = new TextDecoder('iso-8859-1').decode(buffer)
    return parseCsvRobust(text, ';')
  }
  resp = await fetch(zipUrl)
  if (!resp.ok) throw new Error('CVM fetch failed: ' + resp.status + ' for both ' + csvUrl + ' and ' + zipUrl)
  const zipBuffer = await resp.arrayBuffer()
  const blob = new Blob([zipBuffer])
  const zipReader = new ZipReader(new BlobReader(blob))
  const entries = await zipReader.getEntries()
  const csvEntry = entries.find((e: any) => e.filename.endsWith('.csv'))
  if (!csvEntry) throw new Error('No CSV found inside ZIP')
  const writer = new TextWriter('iso-8859-1')
  const text = await csvEntry.getData!(writer)
  await zipReader.close()
  return parseCsvRobust(text, ';')
}

async function fetchCsvFromCvm(path: string): Promise<Record<string, string>[]> {
  return fetchCsvFromUrl(CVM_BASE, path)
}

async function fetchFilteredCsvsFromZip(
  baseUrl: string, path: string, cnpjSet: Set<string> | null
): Promise<Record<string, Record<string, string>[]>> {
  const zipUrl = `${baseUrl}/${path}`
  const resp = await fetch(zipUrl)
  if (!resp.ok) throw new Error('CVM fetch failed: ' + resp.status + ' for ' + zipUrl)
  const zipBuffer = await resp.arrayBuffer()
  const blob = new Blob([zipBuffer])
  const zipReader = new ZipReader(new BlobReader(blob))
  const entries = await zipReader.getEntries()
  const result: Record<string, Record<string, string>[]> = {}
  for (const entry of entries) {
    if (entry.filename.endsWith('.csv') && entry.getData) {
      const writer = new TextWriter('iso-8859-1')
      const text = await entry.getData(writer)
      const allRows = parseCsvRobust(text, ';')
      if (cnpjSet) {
        result[entry.filename] = allRows.filter((r) => {
          const cnpj = (r.CNPJ_FUNDO || r.CNPJ_FUNDO_CLASSE || '')?.trim()
          return cnpjSet.has(cnpj)
        })
      } else {
        result[entry.filename] = allRows
      }
    }
  }
  await zipReader.close()
  return result
}

// --- Ingestion: cad_fi (fund catalog) ---
async function ingestCadFi(supabase: any, topN: number = 50) {
  const logEntry = { source: 'cad_fi', reference_date: new Date().toISOString().slice(0, 7).replace('-', ''), status: 'running' }
  const { data: logRow } = await supabase.from('hub_cvm_ingestion_log').insert(logEntry).select().single()
  const logId = logRow?.id
  try {
    const rows = await fetchCsvFromCvm('CAD/DADOS/cad_fi.csv')
    const active = rows.filter((r) => r.SIT === 'EM FUNCIONAMENTO NORMAL')
    active.sort((a, b) => (parseNumeric(b.VL_PATRIM_LIQ) ?? 0) - (parseNumeric(a.VL_PATRIM_LIQ) ?? 0))
    const top = active.slice(0, topN)
    const mapped = top.map((r) => ({
      cnpj_fundo: r.CNPJ_FUNDO?.trim(),
      denom_social: r.DENOM_SOCIAL?.trim(),
      cd_cvm: r.CD_CVM ? parseInt(r.CD_CVM) : null,
      tp_fundo: r.TP_FUNDO?.trim() || null,
      classe: r.CLASSE?.trim() || null,
      classe_anbima: r.CLASSE_ANBIMA?.trim() || null,
      condom: r.CONDOM?.trim() || null,
      fundo_cotas: r.FUNDO_COTAS?.trim() || null,
      fundo_exclusivo: r.FUNDO_EXCLUSIVO?.trim() || null,
      invest_qualif: r.INVEST_QUALIF?.trim() || null,
      taxa_adm: parseNumeric(r.TAXA_ADM),
      taxa_perfm: parseNumeric(r.TAXA_PERFM),
      benchmark: r.BENCHMARK?.trim() || null,
      vl_patrim_liq: parseNumeric(r.VL_PATRIM_LIQ),
      dt_patrim_liq: parseDate(r.DT_PATRIM_LIQ),
      cnpj_admin: r.CNPJ_ADMIN?.trim() || null,
      admin_nome: r.ADMIN?.trim() || null,
      cnpj_gestor: r.CPF_CNPJ_GESTOR?.trim() || null,
      gestor_nome: r.GESTOR?.trim() || null,
      sit: r.SIT?.trim() || null,
      dt_reg: parseDate(r.DT_REG),
      dt_const: parseDate(r.DT_CONST),
      dt_cancel: parseDate(r.DT_CANCEL),
      is_active: true,
      last_fetched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))
    const { error } = await supabase.from('hub_fundos_meta').upsert(mapped, { onConflict: 'cnpj_fundo' })
    if (error) throw error
    await supabase.from('hub_cvm_ingestion_log').update({
      records_fetched: rows.length, records_inserted: mapped.length, status: 'success', finished_at: new Date().toISOString(),
    }).eq('id', logId)
    return { source: 'cad_fi', total_cvm: rows.length, active_funds: active.length, ingested: mapped.length }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (logId) await supabase.from('hub_cvm_ingestion_log').update({ status: 'error', error_message: msg, finished_at: new Date().toISOString() }).eq('id', logId)
    throw err
  }
}

// --- Ingestion: inf_diario ---
async function ingestInfDiario(supabase: any, yearMonth: string, cnpjs: string[]) {
  const logEntry = { source: 'inf_diario', reference_date: yearMonth, status: 'running' }
  const { data: logRow } = await supabase.from('hub_cvm_ingestion_log').insert(logEntry).select().single()
  const logId = logRow?.id
  try {
    const rows = await fetchCsvFromCvm('DOC/INF_DIARIO/DADOS/inf_diario_fi_' + yearMonth + '.csv')
    const cnpjSet = new Set(cnpjs)
    const filtered = rows.filter((r) => {
      const cnpjClasse = (r.CNPJ_FUNDO_CLASSE || r.CNPJ_FUNDO || '')?.trim()
      return cnpjSet.has(cnpjClasse)
    })
    // Deduplicate by (cnpj_fundo_classe, dt_comptc) to avoid upsert conflicts
    const deduped = new Map<string, any>()
    for (const r of filtered) {
      const cnpjClasse = (r.CNPJ_FUNDO_CLASSE || r.CNPJ_FUNDO || '')?.trim()
      const key = cnpjClasse + '|' + r.DT_COMPTC?.trim()
      deduped.set(key, r)
    }
    const mapped = Array.from(deduped.values()).map((r) => ({
      cnpj_fundo_classe: (r.CNPJ_FUNDO_CLASSE || r.CNPJ_FUNDO || '')?.trim(),
      dt_comptc: r.DT_COMPTC?.trim(),
      vl_total: parseNumeric(r.VL_TOTAL),
      vl_quota: parseNumeric(r.VL_QUOTA),
      vl_patrim_liq: parseNumeric(r.VL_PATRIM_LIQ),
      captc_dia: parseNumeric(r.CAPTC_DIA),
      resg_dia: parseNumeric(r.RESG_DIA),
      nr_cotst: r.NR_COTST ? parseInt(r.NR_COTST) : null,
    }))
    const chunkSize = 500
    let inserted = 0
    for (let i = 0; i < mapped.length; i += chunkSize) {
      const chunk = mapped.slice(i, i + chunkSize)
      const { error } = await supabase.from('hub_fundos_diario').upsert(chunk, { onConflict: 'cnpj_fundo_classe,dt_comptc' })
      if (error) throw error
      inserted += chunk.length
    }
    await supabase.from('hub_cvm_ingestion_log').update({
      records_fetched: rows.length, records_inserted: inserted, status: 'success', finished_at: new Date().toISOString(),
    }).eq('id', logId)
    return { source: 'inf_diario', period: yearMonth, total_cvm: rows.length, filtered: filtered.length, ingested: inserted }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (logId) await supabase.from('hub_cvm_ingestion_log').update({ status: 'error', error_message: msg, finished_at: new Date().toISOString() }).eq('id', logId)
    throw err
  }
}

// --- Ingestion: perfil_mensal ---
async function ingestPerfilMensal(supabase: any, yearMonth: string, cnpjs: string[]) {
  const logEntry = { source: 'perfil_mensal', reference_date: yearMonth, status: 'running' }
  const { data: logRow } = await supabase.from('hub_cvm_ingestion_log').insert(logEntry).select().single()
  const logId = logRow?.id
  try {
    const rows = await fetchCsvFromCvm('DOC/PERFIL_MENSAL/DADOS/perfil_mensal_fi_' + yearMonth + '.csv')
    const cnpjSet = new Set(cnpjs)
    const filtered = rows.filter((r) => {
      const cnpjFundo = (r.CNPJ_FUNDO || r.CNPJ_FUNDO_CLASSE || '')?.trim()
      return cnpjSet.has(cnpjFundo)
    })
    const mapped = filtered.map((r) => ({
      cnpj_fundo: (r.CNPJ_FUNDO || r.CNPJ_FUNDO_CLASSE || '')?.trim(),
      dt_comptc: r.DT_COMPTC?.trim() || yearMonth.slice(0,4) + '-' + yearMonth.slice(4,6) + '-01',
      rentab_fundo: parseNumeric(r.RENTAB_FUNDO),
      captc_dia: parseNumeric(r.CAPTC_DIA),
      resg_dia: parseNumeric(r.RESG_DIA),
      captc_liquida_mes: parseNumeric(r.CAPTC_LIQ),
      nr_cotst: r.NR_COTST ? parseInt(r.NR_COTST) : null,
      vl_patrim_liq: parseNumeric(r.VL_PATRIM_LIQ),
      benchmark: r.BENCHMARK?.trim() || null,
      rentab_benchmark: parseNumeric(r.RENTAB_BENCHMARK),
    }))
    const chunkSize = 500
    let inserted = 0
    for (let i = 0; i < mapped.length; i += chunkSize) {
      const chunk = mapped.slice(i, i + chunkSize)
      const { error } = await supabase.from('hub_fundos_mensal').upsert(chunk, { onConflict: 'cnpj_fundo,dt_comptc' })
      if (error) throw error
      inserted += chunk.length
    }
    await supabase.from('hub_cvm_ingestion_log').update({
      records_fetched: rows.length, records_inserted: inserted, status: 'success', finished_at: new Date().toISOString(),
    }).eq('id', logId)
    return { source: 'perfil_mensal', period: yearMonth, total_cvm: rows.length, filtered: filtered.length, ingested: inserted }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (logId) await supabase.from('hub_cvm_ingestion_log').update({ status: 'error', error_message: msg, finished_at: new Date().toISOString() }).eq('id', logId)
    throw err
  }
}

// --- Ingestion: CDA ---
async function ingestCda(supabase: any, yearMonth: string, cnpjs: string[], blcNum?: number) {
  const logEntry = { source: 'cda_blc_' + (blcNum || 'all'), reference_date: yearMonth, status: 'running' }
  const { data: logRow } = await supabase.from('hub_cvm_ingestion_log').insert(logEntry).select().single()
  const logId = logRow?.id
  try {
    const cnpjSet = new Set(cnpjs)
    const zipPath = 'DOC/CDA/DADOS/cda_fi_' + yearMonth + '.zip'
    const csvFiles = await fetchFilteredCsvsFromZip(CVM_BASE, zipPath, cnpjSet)
    const blocoMap: Record<string, string> = { 'BLC_1': 'titulo_publico', 'BLC_2': 'cota_fi', 'BLC_3': 'swap', 'BLC_4': 'ativo_codificado', 'BLC_5': 'deposito_titfi', 'BLC_6': 'agro_credpriv', 'BLC_7': 'investimento_exterior', 'BLC_8': 'ativo_nao_codificado' }
    let totalIngested = 0
    let totalFiltered = 0
    for (const [filename, rows] of Object.entries(csvFiles)) {
      if (blcNum && !filename.includes('BLC_' + blcNum)) continue
      totalFiltered += rows.length
      if (rows.length === 0) continue
      let bloco = 'outros'
      for (const [prefix, blocoName] of Object.entries(blocoMap)) {
        if (filename.includes(prefix)) { bloco = blocoName; break }
      }
      const mapped = rows.map((r) => ({
        cnpj_fundo: (r.CNPJ_FUNDO || r.CNPJ_FUNDO_CLASSE || '')?.trim(),
        dt_comptc: r.DT_COMPTC?.trim(),
        tp_ativo: r.TP_APLIC?.trim() || r.TP_ATIVO?.trim() || bloco,
        cd_ativo: r.CD_ATIVO?.trim() || r.CD_ISIN?.trim() || r.CD_SELIC?.trim() || (bloco + '_' + rows.indexOf(r)),
        ds_ativo: r.DS_ATIVO?.trim() || r.NM_FUNDO_COTA?.trim() || r.EMISSOR?.trim() || null,
        vl_merc_pos_final: parseNumeric(r.VL_MERC_POS_FINAL),
        vl_custo_pos_final: parseNumeric(r.VL_CUSTO_POS_FINAL),
        qt_pos_final: parseNumeric(r.QT_POS_FINAL) || parseNumeric(r.QT_ATIVO),
        pct_pl: null,
        emissor: r.EMISSOR?.trim() || null,
        dt_venc: parseDate(r.DT_VENC) || parseDate(r.DT_VENCTO),
        bloco,
      })).filter(r => r.cnpj_fundo && r.dt_comptc)
      const chunkSize = 300
      for (let i = 0; i < mapped.length; i += chunkSize) {
        const chunk = mapped.slice(i, i + chunkSize)
        const { error } = await supabase.from('hub_fundos_cda').upsert(chunk, { onConflict: 'cnpj_fundo,dt_comptc,tp_ativo,cd_ativo' })
        if (error) throw error
        totalIngested += chunk.length
      }
    }
    await supabase.from('hub_cvm_ingestion_log').update({
      records_fetched: totalFiltered, records_inserted: totalIngested, status: 'success', finished_at: new Date().toISOString(),
    }).eq('id', logId)
    return { source: 'cda', period: yearMonth, blc: blcNum || 'all', filtered_rows: totalFiltered, ingested: totalIngested, files: Object.keys(csvFiles).length }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (logId) await supabase.from('hub_cvm_ingestion_log').update({ status: 'error', error_message: msg, finished_at: new Date().toISOString() }).eq('id', logId)
    throw err
  }
}

// --- Ingestion: FIDC Informe Mensal ---
async function ingestFidcMensal(supabase: any, yearMonth: string) {
  const logEntry = { source: 'fidc_mensal', reference_date: yearMonth, status: 'running' }
  const { data: logRow } = await supabase.from('hub_cvm_ingestion_log').insert(logEntry).select().single()
  const logId = logRow?.id
  try {
    const zipPath = 'DOC/INF_MENSAL/DADOS/inf_mensal_fidc_' + yearMonth + '.zip'
    const csvFiles = await fetchFilteredCsvsFromZip(CVM_FIDC_BASE, zipPath, null)
    let totalIngested = 0
    const tabIRows: Record<string, string>[] = []
    for (const [filename, rows] of Object.entries(csvFiles)) {
      const fn = filename.toLowerCase()
      if (fn.includes('tab_i') && !fn.includes('tab_ii') && !fn.includes('tab_x')) {
        tabIRows.push(...rows)
      }
    }
    if (tabIRows.length === 0) {
      for (const [filename, rows] of Object.entries(csvFiles)) {
        if (rows.length > 0 && rows[0].CNPJ_FUNDO) { tabIRows.push(...rows); break }
      }
    }
    if (tabIRows.length === 0) {
      throw new Error('No FIDC data found in ZIP for ' + yearMonth + '. Files: ' + Object.keys(csvFiles).join(', '))
    }
    const mapped = tabIRows.map((r) => {
      const vlPlSenior = parseNumeric(r.TAB_I2C1_VL_PL) || parseNumeric(r.VL_PL_SENIOR)
      const vlPlSub = parseNumeric(r.TAB_I2C2_VL_PL) || parseNumeric(r.VL_PL_SUBORDINADA)
      const vlPlMez = parseNumeric(r.TAB_I2C3_VL_PL) || parseNumeric(r.VL_PL_MEZANINO)
      const vlPlTotal = parseNumeric(r.TAB_I1C1_VL_PL) || parseNumeric(r.VL_PL)
      const subTotal = (vlPlSub || 0) + (vlPlMez || 0)
      const indiceSubordinacao = vlPlTotal && vlPlTotal > 0 ? (subTotal / vlPlTotal) * 100 : null
      const vlCarteira = parseNumeric(r.TAB_III1_VL_CARTEIRA) || parseNumeric(r.VL_CARTEIRA_DIREITOS)
      const vlAVencer = parseNumeric(r.TAB_III2_VL_A_VENCER) || parseNumeric(r.VL_CARTEIRA_A_VENCER)
      const vlInadim = parseNumeric(r.TAB_III3_VL_INADIMPL) || parseNumeric(r.VL_CARTEIRA_INADIMPLENTE)
      const vlPrejuizo = parseNumeric(r.TAB_III4_VL_PREJUIZO) || parseNumeric(r.VL_CARTEIRA_PREJUIZO)
      const vlPdd = parseNumeric(r.TAB_IV_VL_PDD) || parseNumeric(r.VL_PROVISAO_REDUCAO)
      const taxaInadim = vlCarteira && vlCarteira > 0 && vlInadim != null ? (vlInadim / vlCarteira) * 100 : null
      const indicePddCobertura = vlInadim && vlInadim > 0 && vlPdd != null ? (vlPdd / vlInadim) * 100 : null
      return {
        cnpj_fundo: (r.CNPJ_FUNDO || r.CNPJ_FUNDO_CLASSE || '')?.trim(),
        dt_comptc: r.DT_COMPTC?.trim(),
        vl_cota_senior: parseNumeric(r.TAB_I2C1_VL_COTA) || parseNumeric(r.VL_COTA_SENIOR),
        vl_cota_subordinada: parseNumeric(r.TAB_I2C2_VL_COTA) || parseNumeric(r.VL_COTA_SUBORDINADA),
        vl_cota_mezanino: parseNumeric(r.TAB_I2C3_VL_COTA),
        qt_cota_senior: parseNumeric(r.TAB_I2C1_QT_COTA) || parseNumeric(r.QT_COTA_SENIOR),
        qt_cota_subordinada: parseNumeric(r.TAB_I2C2_QT_COTA) || parseNumeric(r.QT_COTA_SUBORDINADA),
        qt_cota_mezanino: parseNumeric(r.TAB_I2C3_QT_COTA),
        vl_pl_senior: vlPlSenior,
        vl_pl_subordinada: vlPlSub,
        vl_pl_mezanino: vlPlMez,
        vl_pl_total: vlPlTotal,
        indice_subordinacao: indiceSubordinacao != null ? parseFloat(indiceSubordinacao.toFixed(2)) : null,
        vl_carteira_direitos: vlCarteira,
        vl_carteira_a_vencer: vlAVencer,
        vl_carteira_inadimplente: vlInadim,
        vl_carteira_prejuizo: vlPrejuizo,
        vl_pdd: vlPdd,
        indice_pdd_cobertura: indicePddCobertura != null ? parseFloat(indicePddCobertura.toFixed(2)) : null,
        taxa_inadimplencia: taxaInadim != null ? parseFloat(taxaInadim.toFixed(4)) : null,
        rentab_senior: parseNumeric(r.TAB_I2C1_RENTAB) || parseNumeric(r.RENTAB_SENIOR),
        rentab_subordinada: parseNumeric(r.TAB_I2C2_RENTAB) || parseNumeric(r.RENTAB_SUBORDINADA),
        rentab_fundo: parseNumeric(r.TAB_I1C1_RENTAB) || parseNumeric(r.RENTAB_FUNDO),
        tp_lastro_principal: r.TP_ATIVO?.trim() || r.LASTRO_PRINCIPAL?.trim() || null,
        nr_cedentes: r.NR_CEDENTES ? parseInt(r.NR_CEDENTES) : null,
        concentracao_cedente: parseNumeric(r.PCT_CEDENTE_PRINCIPAL),
        benchmark: r.BENCHMARK?.trim() || null,
        rentab_benchmark: parseNumeric(r.RENTAB_BENCHMARK),
        nr_cotistas_senior: r.TAB_I2C1_NR_COTST ? parseInt(r.TAB_I2C1_NR_COTST) : null,
        nr_cotistas_subordinada: r.TAB_I2C2_NR_COTST ? parseInt(r.TAB_I2C2_NR_COTST) : null,
      }
    }).filter(r => r.cnpj_fundo && r.dt_comptc)
    const chunkSize = 300
    for (let i = 0; i < mapped.length; i += chunkSize) {
      const chunk = mapped.slice(i, i + chunkSize)
      const { error } = await supabase.from('hub_fidc_mensal').upsert(chunk, { onConflict: 'cnpj_fundo,dt_comptc' })
      if (error) throw error
      totalIngested += chunk.length
    }
    await supabase.from('hub_cvm_ingestion_log').update({
      records_fetched: tabIRows.length, records_inserted: totalIngested, status: 'success', finished_at: new Date().toISOString(),
    }).eq('id', logId)
    return { source: 'fidc_mensal', period: yearMonth, total_cvm_rows: tabIRows.length, ingested: totalIngested, files_in_zip: Object.keys(csvFiles).join(', ') }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (logId) await supabase.from('hub_cvm_ingestion_log').update({ status: 'error', error_message: msg, finished_at: new Date().toISOString() }).eq('id', logId)
    throw err
  }
}

// --- Main handler ---
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const url = new URL(req.url)
    const endpoint = url.searchParams.get('endpoint') || 'catalog'
    const supabase = getSupabase()
    let result: any

    switch (endpoint) {
      case 'catalog': {
        const classe = url.searchParams.get('classe')
        const classeRcvm = url.searchParams.get('classe_rcvm175')
        const tp = url.searchParams.get('tp_fundo')
        const limit = parseInt(url.searchParams.get('limit') || '50')
        const offset = parseInt(url.searchParams.get('offset') || '0')
        const orderBy = url.searchParams.get('order_by') || 'vl_patrim_liq'
        const search = url.searchParams.get('search')
        let query = supabase.from('hub_fundos_meta').select('*', { count: 'exact' }).eq('is_active', true).order(orderBy, { ascending: false, nullsFirst: false }).range(offset, offset + limit - 1)
        if (classe) query = query.eq('classe_rcvm175', classe)
        if (classeRcvm) query = query.eq('classe_rcvm175', classeRcvm)
        if (tp) query = query.eq('tp_fundo', tp)
        if (search) {
          const isSlug = search.includes('-') && !/\d{2}\.\d{3}/.test(search)
          if (isSlug) query = query.ilike('slug', '%' + search + '%')
          else query = query.ilike('denom_social', '%' + search + '%')
        }
        const { data, count, error } = await query
        if (error) throw error
        result = { funds: data, total: count, limit, offset }
        break
      }
      case 'fund': {
        const cnpj = url.searchParams.get('cnpj')
        const slug = url.searchParams.get('slug')
        if (!cnpj && !slug) throw new Error('cnpj or slug parameter required')
        let metaQuery = supabase.from('hub_fundos_meta').select('*')
        if (slug) metaQuery = metaQuery.eq('slug', slug)
        else metaQuery = metaQuery.eq('cnpj_fundo_classe', cnpj)
        const { data: meta } = await metaQuery.single()
        const fundCnpjClasse = meta?.cnpj_fundo_classe || cnpj
        const period = url.searchParams.get('period') || '3m'
        const now = new Date()
        switch (period) {
          case '1m': now.setMonth(now.getMonth() - 1); break
          case '3m': now.setMonth(now.getMonth() - 3); break
          case '6m': now.setMonth(now.getMonth() - 6); break
          case '1y': now.setFullYear(now.getFullYear() - 1); break
          case 'max': now.setFullYear(2000); break
          default: now.setMonth(now.getMonth() - 3)
        }
        const { data: daily } = await supabase.from('hub_fundos_diario').select('dt_comptc, vl_quota, vl_patrim_liq, captc_dia, resg_dia, nr_cotst').eq('cnpj_fundo_classe', fundCnpjClasse).gte('dt_comptc', now.toISOString().split('T')[0]).order('dt_comptc', { ascending: true })
        const quotas = (daily || []).map((d: any) => d.vl_quota).filter(Boolean)
        const returnTotal = quotas.length >= 2 ? ((quotas[quotas.length - 1] / quotas[0]) - 1) * 100 : null
        result = { meta, daily: daily || [], metrics: { return_period: returnTotal ? parseFloat(returnTotal.toFixed(4)) : null, period, data_points: daily?.length || 0, latest_quota: quotas.length ? quotas[quotas.length - 1] : null, latest_pl: daily?.length ? daily[daily.length - 1].vl_patrim_liq : null } }
        break
      }
      case 'compare': {
        const cnpjsRaw = url.searchParams.get('cnpjs')
        if (!cnpjsRaw) throw new Error('cnpjs parameter required (comma-separated, max 6)')
        const cnpjList = cnpjsRaw.split(',').map(c => c.trim()).slice(0, 6)
        const period = url.searchParams.get('period') || '3m'
        const now = new Date()
        switch (period) {
          case '1m': now.setMonth(now.getMonth() - 1); break
          case '3m': now.setMonth(now.getMonth() - 3); break
          case '6m': now.setMonth(now.getMonth() - 6); break
          case '1y': now.setFullYear(now.getFullYear() - 1); break
          case 'max': now.setFullYear(2000); break
          default: now.setMonth(now.getMonth() - 3)
        }
        const fromDate = now.toISOString().split('T')[0]
        const items = []
        for (const cnpj of cnpjList) {
          const { data: meta } = await supabase.from('hub_fundos_meta').select('denom_social, classe_rcvm175, slug').eq('cnpj_fundo_classe', cnpj).single()
          const { data: daily } = await supabase.from('hub_fundos_diario').select('dt_comptc, vl_quota, vl_patrim_liq').eq('cnpj_fundo_classe', cnpj).gte('dt_comptc', fromDate).order('dt_comptc', { ascending: true })
          const quotas = (daily || []).map((d: any) => d.vl_quota).filter(Boolean)
          const baseQuota = quotas[0] || 1
          const returnPct = quotas.length >= 2 ? ((quotas[quotas.length - 1] / quotas[0]) - 1) * 100 : null
          items.push({ cnpj, name: meta?.denom_social || cnpj, classe_rcvm175: meta?.classe_rcvm175 || null, slug: meta?.slug || null, daily: (daily || []).map((d: any) => ({ date: d.dt_comptc, quota_index: d.vl_quota ? ((d.vl_quota / baseQuota) - 1) * 100 : 0 })), return_pct: returnPct ? parseFloat(returnPct.toFixed(4)) : null, pl_latest: daily?.length ? daily[daily.length - 1].vl_patrim_liq : null })
        }
        result = items
        break
      }
      case 'overview': {
        const { data: latestDate } = await supabase.from('hub_fundos_diario').select('dt_comptc').order('dt_comptc', { ascending: false }).limit(1)
        const lastDate = latestDate?.[0]?.dt_comptc
        if (!lastDate) { result = { total_pl: 0, total_funds: 0, total_cotistas: 0, avg_pl: 0, total_captacao: 0, total_resgate: 0, net_flow: 0, dates_covered: 0, latest_date: '' }; break }
        const { data: dayData } = await supabase.from('hub_fundos_diario').select('vl_patrim_liq, captc_dia, resg_dia, nr_cotst').eq('dt_comptc', lastDate)
        const { count: datesCount } = await supabase.from('hub_fundos_diario').select('dt_comptc', { count: 'exact', head: true })
        let totalPL = 0, totalCotistas = 0, totalCaptacao = 0, totalResgate = 0
        for (const d of (dayData || [])) { totalPL += d.vl_patrim_liq || 0; totalCotistas += d.nr_cotst || 0; totalCaptacao += d.captc_dia || 0; totalResgate += d.resg_dia || 0 }
        result = { total_pl: totalPL, total_funds: dayData?.length || 0, total_cotistas: totalCotistas, avg_pl: dayData?.length ? totalPL / dayData.length : 0, total_captacao: totalCaptacao, total_resgate: totalResgate, net_flow: totalCaptacao - totalResgate, dates_covered: datesCount || 0, latest_date: lastDate }
        break
      }
      case 'composition': {
        const cnpjParam = url.searchParams.get('cnpj')
        if (!cnpjParam) throw new Error('cnpj parameter required (cnpj_fundo_classe)')
        // CDA table still uses cnpj_fundo - lookup from meta
        const { data: metaLookup } = await supabase.from('hub_fundos_meta').select('cnpj_fundo').eq('cnpj_fundo_classe', cnpjParam).single()
        const cnpj = metaLookup?.cnpj_fundo || cnpjParam
        const month = url.searchParams.get('month')
        let query = supabase.from('hub_fundos_cda').select('*').eq('cnpj_fundo', cnpj)
        if (month) {
          query = query.eq('dt_comptc', month)
        } else {
          const { data: latest } = await supabase.from('hub_fundos_cda').select('dt_comptc').eq('cnpj_fundo', cnpj).order('dt_comptc', { ascending: false }).limit(1)
          if (latest?.length) query = query.eq('dt_comptc', latest[0].dt_comptc)
        }
        query = query.order('vl_merc_pos_final', { ascending: false, nullsFirst: false }).limit(200)
        const { data, error } = await query
        if (error) throw error
        const totalValue = (data || []).reduce((sum: number, r: any) => sum + (r.vl_merc_pos_final || 0), 0)
        const enriched = (data || []).map((r: any) => ({ ...r, pct_pl: totalValue > 0 && r.vl_merc_pos_final ? parseFloat(((r.vl_merc_pos_final / totalValue) * 100).toFixed(2)) : null }))
        result = { cnpj, composition: enriched, total_value: totalValue, assets_count: enriched.length }
        break
      }
      case 'composition_summary': {
        const cnpjParam2 = url.searchParams.get('cnpj')
        if (!cnpjParam2) throw new Error('cnpj parameter required (cnpj_fundo_classe)')
        const { data: metaLookup2 } = await supabase.from('hub_fundos_meta').select('cnpj_fundo').eq('cnpj_fundo_classe', cnpjParam2).single()
        const cnpj = metaLookup2?.cnpj_fundo || cnpjParam2
        const { data: latest } = await supabase.from('hub_fundos_cda').select('dt_comptc').eq('cnpj_fundo', cnpj).order('dt_comptc', { ascending: false }).limit(1)
        if (!latest?.length) { result = { cnpj: cnpjParam2, summary: [], date: null }; break }
        const dt = latest[0].dt_comptc
        const { data } = await supabase.from('hub_fundos_cda').select('bloco, vl_merc_pos_final').eq('cnpj_fundo', cnpj).eq('dt_comptc', dt)
        const byBloco: Record<string, { count: number; value: number }> = {}
        for (const r of (data || [])) { const b = r.bloco || 'outros'; if (!byBloco[b]) byBloco[b] = { count: 0, value: 0 }; byBloco[b].count++; byBloco[b].value += r.vl_merc_pos_final || 0 }
        const totalVal = Object.values(byBloco).reduce((s, v) => s + v.value, 0)
        const summary = Object.entries(byBloco).map(([bloco, v]) => ({ bloco, count: v.count, value: v.value, pct: totalVal > 0 ? parseFloat(((v.value / totalVal) * 100).toFixed(2)) : 0 })).sort((a, b) => b.value - a.value)
        result = { cnpj: cnpjParam2, date: dt, summary, total_value: totalVal }
        break
      }
      case 'rankings': {
        const classe = url.searchParams.get('classe')
        const limit = parseInt(url.searchParams.get('limit') || '20')
        let query = supabase.from('hub_fundos_meta').select('cnpj_fundo_classe, cnpj_fundo, denom_social, classe, classe_anbima, classe_rcvm175, slug, vl_patrim_liq, taxa_adm, taxa_perfm, gestor_nome, nr_cotistas, publico_alvo, tributacao').eq('is_active', true).order('vl_patrim_liq', { ascending: false, nullsFirst: false }).limit(limit)
        if (classe) query = query.eq('classe_rcvm175', classe)
        const { data } = await query
        result = { classe: classe || 'all', funds: data || [], count: data?.length || 0 }
        break
      }
      case 'stats': {
        const { data: meta } = await supabase.from('hub_fundos_meta').select('classe, classe_rcvm175, vl_patrim_liq, tp_fundo').eq('is_active', true)
        const byClasse: Record<string, { count: number; pl_total: number }> = {}
        const byClasseRcvm: Record<string, { count: number; pl_total: number }> = {}
        for (const f of (meta || [])) {
          const c = f.classe || 'Outros'; if (!byClasse[c]) byClasse[c] = { count: 0, pl_total: 0 }; byClasse[c].count++; byClasse[c].pl_total += f.vl_patrim_liq || 0
          const cr = f.classe_rcvm175 || 'Outros'; if (!byClasseRcvm[cr]) byClasseRcvm[cr] = { count: 0, pl_total: 0 }; byClasseRcvm[cr].count++; byClasseRcvm[cr].pl_total += f.vl_patrim_liq || 0
        }
        result = { total_funds: meta?.length || 0, by_classe: byClasse, by_classe_rcvm175: byClasseRcvm, last_updated: new Date().toISOString() }
        break
      }
      case 'monthly': {
        const cnpj = url.searchParams.get('cnpj')
        if (!cnpj) throw new Error('cnpj parameter required')
        const months = parseInt(url.searchParams.get('months') || '24')
        const fromDate = new Date(); fromDate.setMonth(fromDate.getMonth() - months)
        const { data, error } = await supabase.from('hub_fundos_mensal').select('*').eq('cnpj_fundo', cnpj).gte('dt_comptc', fromDate.toISOString().split('T')[0]).order('dt_comptc', { ascending: true })
        if (error) throw error
        result = { cnpj, months: data || [], count: data?.length || 0 }
        break
      }
      case 'monthly_rankings': {
        const period = url.searchParams.get('period')
        const classe = url.searchParams.get('classe')
        const limit = parseInt(url.searchParams.get('limit') || '20')
        const orderBy = url.searchParams.get('order_by') || 'rentab_fundo'
        const ascending = url.searchParams.get('order') === 'asc'
        if (!period) throw new Error('period parameter required (YYYY-MM-01)')
        let query = supabase.from('hub_fundos_mensal').select('cnpj_fundo, dt_comptc, rentab_fundo, vl_patrim_liq, captc_liquida_mes, nr_cotst, benchmark, rentab_benchmark').eq('dt_comptc', period).not('rentab_fundo', 'is', null).order(orderBy, { ascending, nullsFirst: false }).limit(limit)
        if (classe) {
          const { data: metaFunds } = await supabase.from('hub_fundos_meta').select('cnpj_fundo').eq('classe_rcvm175', classe).eq('is_active', true)
          const cnpjList = (metaFunds || []).map((f: any) => f.cnpj_fundo)
          if (cnpjList.length > 0) query = query.in('cnpj_fundo', cnpjList)
          else { result = { period, classe, funds: [], count: 0 }; break }
        }
        const { data, error } = await query
        if (error) throw error
        const cnpjsToLookup = (data || []).map((d: any) => d.cnpj_fundo)
        const { data: names } = await supabase.from('hub_fundos_meta').select('cnpj_fundo, denom_social, classe, classe_anbima, gestor_nome').in('cnpj_fundo', cnpjsToLookup)
        const nameMap: Record<string, any> = {}; for (const n of (names || [])) nameMap[n.cnpj_fundo] = n
        const enriched = (data || []).map((d: any) => ({ ...d, ...(nameMap[d.cnpj_fundo] || {}) }))
        result = { period, classe: classe || 'all', funds: enriched, count: enriched.length }
        break
      }
      case 'monthly_overview': {
        const months = parseInt(url.searchParams.get('months') || '12')
        const fromDate = new Date(); fromDate.setMonth(fromDate.getMonth() - months)
        const { data: raw } = await supabase.from('hub_fundos_mensal').select('dt_comptc, rentab_fundo, vl_patrim_liq, captc_liquida_mes').gte('dt_comptc', fromDate.toISOString().split('T')[0]).order('dt_comptc', { ascending: true })
        const byMonth: Record<string, { funds: number; sum_pl: number; sum_captc: number; rentabs: number[] }> = {}
        for (const r of (raw || [])) { const m = r.dt_comptc; if (!byMonth[m]) byMonth[m] = { funds: 0, sum_pl: 0, sum_captc: 0, rentabs: [] }; byMonth[m].funds++; byMonth[m].sum_pl += r.vl_patrim_liq || 0; byMonth[m].sum_captc += r.captc_liquida_mes || 0; if (r.rentab_fundo != null) byMonth[m].rentabs.push(r.rentab_fundo) }
        const overview = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, funds: v.funds, avg_rentab: v.rentabs.length > 0 ? v.rentabs.reduce((a, b) => a + b, 0) / v.rentabs.length : null, median_rentab: v.rentabs.length > 0 ? (() => { const s = [...v.rentabs].sort((a, b) => a - b); const mid = Math.floor(s.length / 2); return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2 })() : null, total_pl: v.sum_pl, total_captacao_liquida: v.sum_captc }))
        result = { months: overview, count: overview.length }
        break
      }
      // --- FIDC-specific queries ---
      case 'fidc_monthly': {
        const cnpj = url.searchParams.get('cnpj')
        if (!cnpj) throw new Error('cnpj parameter required')
        const months = parseInt(url.searchParams.get('months') || '24')
        const fromDate = new Date(); fromDate.setMonth(fromDate.getMonth() - months)
        const { data, error } = await supabase.from('hub_fidc_mensal').select('*').eq('cnpj_fundo', cnpj).gte('dt_comptc', fromDate.toISOString().split('T')[0]).order('dt_comptc', { ascending: true })
        if (error) throw error
        result = { cnpj, data: data || [], count: data?.length || 0 }
        break
      }
      case 'fidc_rankings': {
        const orderBy = url.searchParams.get('order_by') || 'indice_subordinacao'
        const limit = parseInt(url.searchParams.get('limit') || '20')
        const ascending = url.searchParams.get('order') === 'asc'
        const { data: latestDt } = await supabase.from('hub_fidc_mensal').select('dt_comptc').order('dt_comptc', { ascending: false }).limit(1)
        if (!latestDt?.length) { result = { funds: [], count: 0 }; break }
        const dt = latestDt[0].dt_comptc
        const { data, error } = await supabase.from('hub_fidc_mensal').select('cnpj_fundo, dt_comptc, vl_pl_total, indice_subordinacao, taxa_inadimplencia, indice_pdd_cobertura, rentab_fundo, rentab_senior, rentab_subordinada, spread_cdi, tp_lastro_principal, nr_cedentes').eq('dt_comptc', dt).not(orderBy, 'is', null).order(orderBy, { ascending, nullsFirst: false }).limit(limit)
        if (error) throw error
        const cnpjsToLookup = (data || []).map((d: any) => d.cnpj_fundo)
        const { data: names } = await supabase.from('hub_fundos_meta').select('cnpj_fundo, denom_social, classe_anbima, gestor_nome').in('cnpj_fundo', cnpjsToLookup)
        const nameMap: Record<string, any> = {}; for (const n of (names || [])) nameMap[n.cnpj_fundo] = n
        const enriched = (data || []).map((d: any) => ({ ...d, ...(nameMap[d.cnpj_fundo] || {}) }))
        result = { date: dt, order_by: orderBy, funds: enriched, count: enriched.length }
        break
      }
      case 'fidc_overview': {
        const { data: latestDt } = await supabase.from('hub_fidc_mensal').select('dt_comptc').order('dt_comptc', { ascending: false }).limit(1)
        if (!latestDt?.length) { result = { date: null, total_fidcs: 0 }; break }
        const dt = latestDt[0].dt_comptc
        const { data } = await supabase.from('hub_fidc_mensal').select('vl_pl_total, indice_subordinacao, taxa_inadimplencia, indice_pdd_cobertura, tp_lastro_principal').eq('dt_comptc', dt)
        const total = data?.length || 0
        let sumPl = 0, sumSubord = 0, sumInadim = 0, countSubord = 0, countInadim = 0
        const byLastro: Record<string, { count: number; pl: number }> = {}
        for (const r of (data || [])) { sumPl += r.vl_pl_total || 0; if (r.indice_subordinacao != null) { sumSubord += r.indice_subordinacao; countSubord++ }; if (r.taxa_inadimplencia != null) { sumInadim += r.taxa_inadimplencia; countInadim++ }; const lastro = r.tp_lastro_principal || 'Outros'; if (!byLastro[lastro]) byLastro[lastro] = { count: 0, pl: 0 }; byLastro[lastro].count++; byLastro[lastro].pl += r.vl_pl_total || 0 }
        result = { date: dt, total_fidcs: total, total_pl: sumPl, avg_subordinacao: countSubord > 0 ? parseFloat((sumSubord / countSubord).toFixed(2)) : null, avg_inadimplencia: countInadim > 0 ? parseFloat((sumInadim / countInadim).toFixed(4)) : null, by_lastro: Object.entries(byLastro).map(([lastro, v]) => ({ lastro, ...v, pct_pl: sumPl > 0 ? parseFloat(((v.pl / sumPl) * 100).toFixed(2)) : 0 })).sort((a, b) => b.pl - a.pl) }
        break
      }
      // --- FII-specific queries (H1.4 Fase 2) ---
      case 'fii_monthly': {
        const cnpj = url.searchParams.get('cnpj')
        if (!cnpj) throw new Error('cnpj parameter required')
        const months = parseInt(url.searchParams.get('months') || '24')
        const fromDate = new Date(); fromDate.setMonth(fromDate.getMonth() - months)
        const { data, error } = await supabase.from('hub_fii_mensal').select('*').eq('cnpj_fundo', cnpj).gte('dt_comptc', fromDate.toISOString().split('T')[0]).order('dt_comptc', { ascending: true })
        if (error) throw error
        result = { cnpj, data: data || [], count: data?.length || 0 }
        break
      }
      case 'fii_rankings': {
        const orderBy = url.searchParams.get('order_by') || 'dividend_yield_mes'
        const limit = parseInt(url.searchParams.get('limit') || '20')
        const ascending = url.searchParams.get('order') === 'asc'
        const segmento = url.searchParams.get('segmento')
        const { data: latestDt } = await supabase.from('hub_fii_mensal').select('dt_comptc').order('dt_comptc', { ascending: false }).limit(1)
        if (!latestDt?.length) { result = { funds: [], count: 0 }; break }
        const dt = latestDt[0].dt_comptc
        let query = supabase.from('hub_fii_mensal').select('cnpj_fundo, dt_comptc, nome_fundo, segmento, mandato, tipo_gestao, publico_alvo, patrimonio_liquido, cotas_emitidas, valor_patrimonial_cota, rentabilidade_efetiva_mes, rentabilidade_patrimonial_mes, dividend_yield_mes, nr_cotistas, pct_despesas_adm').eq('dt_comptc', dt).not(orderBy, 'is', null).order(orderBy, { ascending, nullsFirst: false }).limit(limit)
        if (segmento) query = query.eq('segmento', segmento)
        const { data, error } = await query
        if (error) throw error
        result = { date: dt, order_by: orderBy, segmento: segmento || 'all', funds: data || [], count: data?.length || 0 }
        break
      }
      case 'fii_overview': {
        const { data: latestDt } = await supabase.from('hub_fii_mensal').select('dt_comptc').order('dt_comptc', { ascending: false }).limit(1)
        if (!latestDt?.length) { result = { date: null, total_fiis: 0 }; break }
        const dt = latestDt[0].dt_comptc
        const { data } = await supabase.from('hub_fii_mensal').select('patrimonio_liquido, dividend_yield_mes, rentabilidade_efetiva_mes, nr_cotistas, segmento, valor_patrimonial_cota').eq('dt_comptc', dt)
        const total = data?.length || 0
        let sumPl = 0, sumDy = 0, sumRentab = 0, sumCotistas = 0, countDy = 0, countRentab = 0
        const bySegmento: Record<string, { count: number; pl: number; dy_sum: number; dy_count: number }> = {}
        for (const r of (data || [])) {
          sumPl += r.patrimonio_liquido || 0
          sumCotistas += r.nr_cotistas || 0
          if (r.dividend_yield_mes != null) { sumDy += r.dividend_yield_mes; countDy++ }
          if (r.rentabilidade_efetiva_mes != null) { sumRentab += r.rentabilidade_efetiva_mes; countRentab++ }
          const seg = r.segmento || 'Outros'
          if (!bySegmento[seg]) bySegmento[seg] = { count: 0, pl: 0, dy_sum: 0, dy_count: 0 }
          bySegmento[seg].count++
          bySegmento[seg].pl += r.patrimonio_liquido || 0
          if (r.dividend_yield_mes != null) { bySegmento[seg].dy_sum += r.dividend_yield_mes; bySegmento[seg].dy_count++ }
        }
        result = {
          date: dt, total_fiis: total, total_pl: sumPl, total_cotistas: sumCotistas,
          avg_dividend_yield: countDy > 0 ? parseFloat((sumDy / countDy).toFixed(4)) : null,
          avg_rentabilidade: countRentab > 0 ? parseFloat((sumRentab / countRentab).toFixed(4)) : null,
          by_segmento: Object.entries(bySegmento).map(([seg, v]) => ({
            segmento: seg, count: v.count, pl: v.pl,
            avg_dy: v.dy_count > 0 ? parseFloat((v.dy_sum / v.dy_count).toFixed(4)) : null,
            pct_pl: sumPl > 0 ? parseFloat(((v.pl / sumPl) * 100).toFixed(2)) : 0
          })).sort((a, b) => b.pl - a.pl)
        }
        break
      }
      // --- FIP-specific queries (H1.4 Fase 2) ---
      case 'fip_quarterly': {
        const cnpj = url.searchParams.get('cnpj')
        if (!cnpj) throw new Error('cnpj parameter required')
        const { data, error } = await supabase.from('hub_fip_quadrimestral').select('*').eq('cnpj_fundo', cnpj).order('dt_comptc', { ascending: true })
        if (error) throw error
        result = { cnpj, data: data || [], count: data?.length || 0 }
        break
      }
      case 'fip_rankings': {
        const orderBy = url.searchParams.get('order_by') || 'patrimonio_liquido'
        const limit = parseInt(url.searchParams.get('limit') || '20')
        const ascending = url.searchParams.get('order') === 'asc'
        const tp = url.searchParams.get('tp_fundo_classe')
        const { data: latestDt } = await supabase.from('hub_fip_quadrimestral').select('dt_comptc').order('dt_comptc', { ascending: false }).limit(1)
        if (!latestDt?.length) { result = { funds: [], count: 0 }; break }
        const dt = latestDt[0].dt_comptc
        let query = supabase.from('hub_fip_quadrimestral').select('cnpj_fundo, dt_comptc, nome_fundo, tp_fundo_classe, publico_alvo, patrimonio_liquido, qt_cota, valor_patrimonial_cota, nr_cotistas, vl_cap_comprom, vl_cap_subscr, vl_cap_integr, vl_invest_fip_cota').eq('dt_comptc', dt).not(orderBy, 'is', null).order(orderBy, { ascending, nullsFirst: false }).limit(limit)
        if (tp) query = query.eq('tp_fundo_classe', tp)
        const { data, error } = await query
        if (error) throw error
        result = { date: dt, order_by: orderBy, tp_fundo_classe: tp || 'all', funds: data || [], count: data?.length || 0 }
        break
      }
      case 'fip_overview': {
        const { data: latestDt } = await supabase.from('hub_fip_quadrimestral').select('dt_comptc').order('dt_comptc', { ascending: false }).limit(1)
        if (!latestDt?.length) { result = { date: null, total_fips: 0 }; break }
        const dt = latestDt[0].dt_comptc
        const { data } = await supabase.from('hub_fip_quadrimestral').select('patrimonio_liquido, nr_cotistas, tp_fundo_classe, vl_cap_comprom, vl_cap_subscr, vl_cap_integr').eq('dt_comptc', dt)
        const total = data?.length || 0
        let sumPl = 0, sumCotistas = 0, sumComprom = 0, sumSubscr = 0, sumIntegr = 0
        const byTipo: Record<string, { count: number; pl: number }> = {}
        for (const r of (data || [])) {
          sumPl += r.patrimonio_liquido || 0
          sumCotistas += r.nr_cotistas || 0
          sumComprom += r.vl_cap_comprom || 0
          sumSubscr += r.vl_cap_subscr || 0
          sumIntegr += r.vl_cap_integr || 0
          const tp = r.tp_fundo_classe || 'Outros'
          if (!byTipo[tp]) byTipo[tp] = { count: 0, pl: 0 }
          byTipo[tp].count++
          byTipo[tp].pl += r.patrimonio_liquido || 0
        }
        result = {
          date: dt, total_fips: total, total_pl: sumPl, total_cotistas: sumCotistas,
          total_capital_comprometido: sumComprom, total_capital_subscrito: sumSubscr, total_capital_integralizado: sumIntegr,
          pct_integralizacao: sumComprom > 0 ? parseFloat(((sumIntegr / sumComprom) * 100).toFixed(2)) : null,
          by_tipo: Object.entries(byTipo).map(([tp, v]) => ({
            tp_fundo_classe: tp, count: v.count, pl: v.pl,
            pct_pl: sumPl > 0 ? parseFloat(((v.pl / sumPl) * 100).toFixed(2)) : 0
          })).sort((a, b) => b.pl - a.pl)
        }
        break
      }
      // --- Gestora & Admin rankings + Fund search (H1.4 Fase A) ---
      case 'gestora_rankings': {
        const limit = parseInt(url.searchParams.get('limit') || '50')
        const orderBy = url.searchParams.get('order_by') || 'total_pl'
        const { data: funds } = await supabase.from('hub_fundos_meta').select('gestor_nome, cnpj_gestor, vl_patrim_liq, taxa_adm, nr_cotistas').not('gestor_nome', 'is', null).neq('gestor_nome', '')
        const byGestora: Record<string, { cnpj_gestor: string; count: number; total_pl: number; sum_taxa: number; count_taxa: number; total_cotistas: number }> = {}
        for (const f of (funds || [])) {
          const g = f.gestor_nome!
          if (!byGestora[g]) byGestora[g] = { cnpj_gestor: f.cnpj_gestor || '', count: 0, total_pl: 0, sum_taxa: 0, count_taxa: 0, total_cotistas: 0 }
          byGestora[g].count++
          byGestora[g].total_pl += f.vl_patrim_liq || 0
          if (f.taxa_adm != null) { byGestora[g].sum_taxa += f.taxa_adm; byGestora[g].count_taxa++ }
          byGestora[g].total_cotistas += f.nr_cotistas || 0
        }
        let gestoras = Object.entries(byGestora).map(([nome, v]) => ({
          gestor_nome: nome, cnpj_gestor: v.cnpj_gestor, fund_count: v.count, total_pl: v.total_pl,
          avg_taxa_adm: v.count_taxa > 0 ? parseFloat((v.sum_taxa / v.count_taxa).toFixed(4)) : null,
          total_cotistas: v.total_cotistas
        }))
        if (orderBy === 'fund_count') gestoras.sort((a, b) => b.fund_count - a.fund_count)
        else if (orderBy === 'avg_taxa_adm') gestoras.sort((a, b) => (b.avg_taxa_adm || 0) - (a.avg_taxa_adm || 0))
        else gestoras.sort((a, b) => b.total_pl - a.total_pl)
        result = { gestoras: gestoras.slice(0, limit), total: gestoras.length }
        break
      }
      case 'admin_rankings': {
        const limit = parseInt(url.searchParams.get('limit') || '50')
        const orderBy = url.searchParams.get('order_by') || 'total_pl'
        const { data: funds } = await supabase.from('hub_fundos_meta').select('admin_nome, cnpj_admin, vl_patrim_liq, nr_cotistas').not('admin_nome', 'is', null).neq('admin_nome', '')
        const byAdmin: Record<string, { cnpj_admin: string; count: number; total_pl: number; total_cotistas: number }> = {}
        for (const f of (funds || [])) {
          const a = f.admin_nome!
          if (!byAdmin[a]) byAdmin[a] = { cnpj_admin: f.cnpj_admin || '', count: 0, total_pl: 0, total_cotistas: 0 }
          byAdmin[a].count++
          byAdmin[a].total_pl += f.vl_patrim_liq || 0
          byAdmin[a].total_cotistas += f.nr_cotistas || 0
        }
        let admins = Object.entries(byAdmin).map(([nome, v]) => ({
          admin_nome: nome, cnpj_admin: v.cnpj_admin, fund_count: v.count, total_pl: v.total_pl,
          total_cotistas: v.total_cotistas
        }))
        if (orderBy === 'fund_count') admins.sort((a, b) => b.fund_count - a.fund_count)
        else admins.sort((a, b) => b.total_pl - a.total_pl)
        result = { admins: admins.slice(0, limit), total: admins.length }
        break
      }
      case 'fund_search': {
        const q = url.searchParams.get('q')
        if (!q || q.length < 2) throw new Error('q parameter required (min 2 chars)')
        const limit = parseInt(url.searchParams.get('limit') || '20')
        const isCnpj = /^\d/.test(q)
        const isSlugSearch = q.includes('-') && !/\d{2}\.\d{3}/.test(q)
        let query = supabase.from('hub_fundos_meta').select('cnpj_fundo_classe, cnpj_fundo, denom_social, classe, classe_anbima, classe_rcvm175, slug, tp_fundo, vl_patrim_liq, gestor_nome, admin_nome, publico_alvo, tributacao, is_active').order('vl_patrim_liq', { ascending: false, nullsFirst: false }).limit(limit)
        if (isCnpj) {
          query = query.ilike('cnpj_fundo_classe', '%' + q + '%')
        } else if (isSlugSearch) {
          query = query.ilike('slug', '%' + q + '%')
        } else {
          query = query.ilike('denom_social', '%' + q + '%')
        }
        const { data, error } = await query
        if (error) throw error
        result = { query: q, results: data || [], count: data?.length || 0 }
        break
      }
      case 'fund_by_slug': {
        const slugParam = url.searchParams.get('slug')
        if (!slugParam) throw new Error('slug parameter required')
        const { data: metaBySlug } = await supabase.from('hub_fundos_meta').select('*').eq('slug', slugParam).single()
        if (!metaBySlug) throw new Error('Fund not found for slug: ' + slugParam)
        const fundCnpjClasseSlug = metaBySlug.cnpj_fundo_classe
        const periodSlug = url.searchParams.get('period') || '6m'
        const nowSlug = new Date()
        switch (periodSlug) {
          case '1m': nowSlug.setMonth(nowSlug.getMonth() - 1); break
          case '3m': nowSlug.setMonth(nowSlug.getMonth() - 3); break
          case '6m': nowSlug.setMonth(nowSlug.getMonth() - 6); break
          case '1y': nowSlug.setFullYear(nowSlug.getFullYear() - 1); break
          case 'max': nowSlug.setFullYear(2000); break
          default: nowSlug.setMonth(nowSlug.getMonth() - 6)
        }
        const { data: dailySlug } = await supabase.from('hub_fundos_diario').select('dt_comptc, vl_quota, vl_patrim_liq, captc_dia, resg_dia, nr_cotst').eq('cnpj_fundo_classe', fundCnpjClasseSlug).gte('dt_comptc', nowSlug.toISOString().split('T')[0]).order('dt_comptc', { ascending: true })
        const quotasSlug = (dailySlug || []).map((d: any) => d.vl_quota).filter(Boolean)
        const returnTotalSlug = quotasSlug.length >= 2 ? ((quotasSlug[quotasSlug.length - 1] / quotasSlug[0]) - 1) * 100 : null
        result = { meta: metaBySlug, daily: dailySlug || [], metrics: { return_period: returnTotalSlug ? parseFloat(returnTotalSlug.toFixed(4)) : null, period: periodSlug, data_points: dailySlug?.length || 0, latest_quota: quotasSlug.length ? quotasSlug[quotasSlug.length - 1] : null, latest_pl: dailySlug?.length ? dailySlug[dailySlug.length - 1].vl_patrim_liq : null } }
        break
      }
      // --- Ingestion endpoints ---
      case 'ingest_catalog': {
        const topN = parseInt(url.searchParams.get('top') || '50')
        result = await ingestCadFi(supabase, topN)
        break
      }
      case 'ingest_daily': {
        const yearMonth = url.searchParams.get('year_month')
        if (!yearMonth) throw new Error('year_month parameter required (YYYYMM)')
        const { data: funds } = await supabase.from('hub_fundos_meta').select('cnpj_fundo_classe').eq('is_active', true)
        const cnpjs = (funds || []).map((f: any) => f.cnpj_fundo_classe)
        if (cnpjs.length === 0) throw new Error('No funds in catalog.')
        result = await ingestInfDiario(supabase, yearMonth, cnpjs)
        break
      }
      case 'ingest_mensal': {
        const yearMonth = url.searchParams.get('year_month')
        if (!yearMonth) throw new Error('year_month parameter required (YYYYMM)')
        const { data: funds } = await supabase.from('hub_fundos_meta').select('cnpj_fundo').eq('is_active', true)
        const cnpjs = (funds || []).map((f: any) => f.cnpj_fundo)
        if (cnpjs.length === 0) throw new Error('No funds in catalog.')
        result = await ingestPerfilMensal(supabase, yearMonth, cnpjs)
        break
      }
      case 'ingest_mensal_backfill': {
        const monthsBack = parseInt(url.searchParams.get('months') || '12')
        const { data: funds } = await supabase.from('hub_fundos_meta').select('cnpj_fundo').eq('is_active', true)
        const cnpjs = (funds || []).map((f: any) => f.cnpj_fundo)
        if (cnpjs.length === 0) throw new Error('No funds in catalog.')
        const results = []
        const now = new Date()
        for (let i = 0; i < monthsBack; i++) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
          const ym = d.getFullYear() + '' + String(d.getMonth() + 1).padStart(2, '0')
          try { const r = await ingestPerfilMensal(supabase, ym, cnpjs); results.push(r) }
          catch (e) { results.push({ source: 'perfil_mensal', period: ym, error: e instanceof Error ? e.message : String(e) }) }
        }
        result = { backfill: results, total_months: monthsBack }
        break
      }
      case 'ingest_cda': {
        const yearMonth = url.searchParams.get('year_month')
        if (!yearMonth) throw new Error('year_month parameter required (YYYYMM)')
        const blcNum = url.searchParams.get('blc') ? parseInt(url.searchParams.get('blc')!) : undefined
        const { data: funds } = await supabase.from('hub_fundos_meta').select('cnpj_fundo').eq('is_active', true)
        const cnpjs = (funds || []).map((f: any) => f.cnpj_fundo)
        if (cnpjs.length === 0) throw new Error('No funds in catalog.')
        result = await ingestCda(supabase, yearMonth, cnpjs, blcNum)
        break
      }
      case 'ingest_fidc_mensal': {
        const yearMonth = url.searchParams.get('year_month')
        if (!yearMonth) throw new Error('year_month parameter required (YYYYMM)')
        result = await ingestFidcMensal(supabase, yearMonth)
        break
      }
      case 'ingestion_status': {
        const { data } = await supabase.from('hub_cvm_ingestion_log').select('*').order('started_at', { ascending: false }).limit(30)
        result = { logs: data }
        break
      }

      // ─── Insights Feed (Fase 4) ───
      case 'insights': {
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200)
        const offset = parseInt(url.searchParams.get('offset') || '0')
        const tipo = url.searchParams.get('tipo')  // filter by type
        const severidade = url.searchParams.get('severidade')  // filter by severity
        const classe = url.searchParams.get('classe')  // filter by classe_rcvm175
        const days = parseInt(url.searchParams.get('days') || '30')  // lookback window

        const since = new Date()
        since.setDate(since.getDate() - days)

        let query = supabase.from('hub_fundos_insights')
          .select('*', { count: 'exact' })
          .gte('detectado_em', since.toISOString())
          .order('detectado_em', { ascending: false })
          .range(offset, offset + limit - 1)

        if (tipo) query = query.eq('tipo', tipo)
        if (severidade) query = query.eq('severidade', severidade)
        if (classe) query = query.eq('classe_rcvm175', classe)

        const { data, count, error } = await query
        if (error) throw error

        // Also get summary counts by type
        const { data: summary } = await supabase.from('hub_fundos_insights')
          .select('tipo, severidade')
          .gte('detectado_em', since.toISOString())

        const byType: Record<string, number> = {}
        const bySeveridade: Record<string, number> = {}
        for (const row of summary || []) {
          byType[row.tipo] = (byType[row.tipo] || 0) + 1
          bySeveridade[row.severidade] = (bySeveridade[row.severidade] || 0) + 1
        }

        result = { insights: data, total: count, summary: { by_type: byType, by_severity: bySeveridade }, limit, offset }
        break
      }
      case 'insights_for_fund': {
        const cnpj = url.searchParams.get('cnpj')
        const slug = url.searchParams.get('slug')
        if (!cnpj && !slug) throw new Error('cnpj or slug parameter required')

        let targetCnpj = cnpj
        if (slug && !cnpj) {
          const { data: meta } = await supabase.from('hub_fundos_meta')
            .select('cnpj_fundo_classe')
            .eq('slug', slug)
            .limit(1)
            .single()
          if (meta) targetCnpj = meta.cnpj_fundo_classe
        }

        const { data, error } = await supabase.from('hub_fundos_insights')
          .select('*')
          .or(`cnpj_fundo.eq.${targetCnpj},cnpj_fundo_classe.eq.${targetCnpj}`)
          .order('detectado_em', { ascending: false })
          .limit(20)

        if (error) throw error
        result = { insights: data, cnpj: targetCnpj }
        break
      }

      default:
        result = { error: 'Unknown endpoint', available: ['catalog','fund','fund_by_slug','compare','overview','composition','composition_summary','rankings','stats','monthly','monthly_rankings','monthly_overview','fidc_monthly','fidc_rankings','fidc_overview','fii_monthly','fii_rankings','fii_overview','fip_quarterly','fip_rankings','fip_overview','gestora_rankings','admin_rankings','fund_search','insights','insights_for_fund','ingest_catalog','ingest_daily','ingest_mensal','ingest_mensal_backfill','ingest_cda','ingest_fidc_mensal','ingestion_status'] }
    }
    return new Response(JSON.stringify(result, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: errorMsg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
