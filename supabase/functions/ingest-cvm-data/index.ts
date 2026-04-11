// ingest-cvm-data v4 — full parser rewrite for FIDC module
// Fixes:
//  - Tab X_1_1: sum nr_cotistas_senior + nr_cotistas_subordinada (16 investor type cols each)
//  - Mezanino branch in X_2/X_3 (no longer collapses into subordinada)
//  - Tab II argmax → tp_lastro_principal (11 high-level asset categories)
//  - Hard cap rentab ±95% (drops CVM outlier values like -280 bi%)
//  - Weighted avg rentab_fundo = sum(rentab_class * vl_pl_class) / vl_pl_total
// Ref: DIAGNOSTICO_FUNDOS.md §H-I (forensic deep-dive)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { unzipSync } from 'https://esm.sh/fflate@0.8.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RENTAB_CAP = 95 // |rentab| > 95% is treated as corrupt CVM data

function parseCSV(text: string, delimiter = ';'): Record<string, string>[] {
  const lines = text.split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/"/g, '').replace(/\r/g, ''))
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const values = line.split(delimiter).map(v => v.trim().replace(/"/g, '').replace(/\r/g, ''))
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = values[idx] || '' })
    rows.push(row)
  }
  return rows
}

function pn(val: string | undefined): number | null {
  if (!val || !val.trim()) return null
  const n = parseFloat(val.trim().replace(',', '.'))
  return isFinite(n) ? n : null
}

function pint(val: string | undefined): number | null {
  const n = pn(val)
  return n !== null ? Math.round(n) : null
}

/** Cap rentab values at ±RENTAB_CAP% — CVM raw data sometimes contains values like -280 bi% */
function cleanRentab(v: number | null): number | null {
  if (v == null) return null
  if (!isFinite(v)) return null
  if (Math.abs(v) > RENTAB_CAP) return null
  return v
}

function pd(val: string | undefined): string | null {
  if (!val || !val.trim()) return null
  const v = val.trim()
  if (v.includes('/')) {
    const parts = v.split('/')
    if (parts.length === 3) return parts[2] + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0')
  }
  return v
}

function getLastMonth(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return String(d.getFullYear()) + String(d.getMonth() + 1).padStart(2, '0')
}

function getYear(yearMonth: string): string {
  return yearMonth.substring(0, 4)
}

function getMonthFilter(yearMonth: string): string {
  const y = yearMonth.substring(0, 4)
  const m = yearMonth.substring(4, 6)
  return y + '-' + m + '-01'
}

async function downloadAndUnzip(url: string): Promise<Record<string, Uint8Array>> {
  console.log('Downloading ' + url + '...')
  const resp = await fetch(url)
  if (!resp.ok) throw new Error('Download failed: ' + resp.status + ' from ' + url)
  const data = new Uint8Array(await resp.arrayBuffer())
  console.log('Downloaded ' + (data.length / 1024 / 1024).toFixed(1) + ' MB, unzipping...')
  return unzipSync(data)
}

async function downloadCSV(url: string): Promise<string> {
  console.log('Downloading ' + url + '...')
  const resp = await fetch(url)
  if (!resp.ok) throw new Error('Download failed: ' + resp.status + ' from ' + url)
  const buf = new Uint8Array(await resp.arrayBuffer())
  console.log('Downloaded ' + (buf.length / 1024).toFixed(0) + ' KB')
  return new TextDecoder('iso-8859-1').decode(buf)
}

function decodeCSV(fileData: Uint8Array): string {
  return new TextDecoder('iso-8859-1').decode(fileData)
}

// ---- CDA Ingestion (unchanged from v3) ----

const BLOCO_MAP: Record<string, string> = {
  'BLC_1': 'titulo_publico', 'BLC_2': 'cota_fi', 'BLC_3': 'swap',
  'BLC_4': 'ativo_codificado', 'BLC_5': 'deposito_titfi',
  'BLC_6': 'agro_credpriv', 'BLC_7': 'investimento_exterior',
  'BLC_8': 'ativo_nao_codificado',
}

async function ingestCDA(supabase: any, yearMonth: string) {
  const { data: meta, error: metaErr } = await supabase
    .from('hub_fundos_meta').select('cnpj_fundo_classe').limit(50000)
  if (metaErr) throw metaErr
  const trackedCnpjs = new Set((meta || []).map((m: any) => m.cnpj_fundo_classe))
  console.log('Tracked funds: ' + trackedCnpjs.size)
  const zipUrl = 'https://dados.cvm.gov.br/dados/FI/DOC/CDA/DADOS/cda_fi_' + yearMonth + '.zip'
  const files = await downloadAndUnzip(zipUrl)
  let totalIngested = 0
  const details: any[] = []
  for (const [filename, fileData] of Object.entries(files)) {
    if (!filename.endsWith('.csv')) continue
    let bloco = 'outros'
    for (const [prefix, blocoName] of Object.entries(BLOCO_MAP)) {
      if (filename.includes(prefix)) { bloco = blocoName; break }
    }
    const text = decodeCSV(fileData)
    const rows = parseCSV(text)
    console.log(filename + ': ' + rows.length + ' rows (bloco=' + bloco + ')')
    const toInsert: any[] = []
    let rowIdx = 0
    for (const row of rows) {
      rowIdx++
      const cnpj = (row['CNPJ_FUNDO_CLASSE'] || row['CNPJ_FUNDO'] || '').trim()
      if (!trackedCnpjs.has(cnpj)) continue
      let cdAtivo = (row['CD_ATIVO'] || row['CD_ISIN'] || row['CD_SELIC'] || '').trim()
      if (!cdAtivo) cdAtivo = bloco + '_' + rowIdx
      toInsert.push({
        cnpj_fundo: cnpj, dt_comptc: (row['DT_COMPTC'] || '').trim(),
        tp_ativo: (row['TP_APLIC'] || row['TP_ATIVO'] || bloco).trim(), cd_ativo: cdAtivo,
        ds_ativo: (row['DS_ATIVO'] || row['NM_FUNDO_COTA'] || row['EMISSOR'] || '').trim() || null,
        vl_merc_pos_final: pn(row['VL_MERC_POS_FINAL']), vl_custo_pos_final: pn(row['VL_CUSTO_POS_FINAL']),
        qt_pos_final: pn(row['QT_POS_FINAL'] || row['QT_ATIVO']),
        emissor: (row['EMISSOR'] || '').trim() || null, dt_venc: pd(row['DT_VENC'] || row['DT_VENCTO']), bloco: bloco,
      })
    }
    if (toInsert.length > 0) {
      let be = 0
      for (let i = 0; i < toInsert.length; i += 500) {
        const { error } = await supabase.from('hub_fundos_cda').upsert(toInsert.slice(i, i + 500), { onConflict: 'cnpj_fundo,dt_comptc,tp_ativo,cd_ativo', ignoreDuplicates: false })
        if (error) { console.error('CDA err ' + i + ': ' + error.message); be++ }
      }
      totalIngested += toInsert.length
      details.push({ file: filename, bloco: bloco, filtered: toInsert.length, total: rows.length, errors: be })
    }
  }
  return { module: 'cda', year_month: yearMonth, total_ingested: totalIngested, tracked_funds: trackedCnpjs.size, details: details }
}

// ---- FIDC Ingestion v4 — full rewrite ----

interface TabData { rows: Record<string, string>[]; indexed: Record<string, Record<string, string>> }

// 11 high-level Tab II asset categories (sum of sub-items within each group)
const LASTRO_MAP: Array<[string, string]> = [
  ['TAB_II_A_VL_INDUST', 'Industrial'],
  ['TAB_II_B_VL_IMOBIL', 'Imobiliário'],
  ['TAB_II_C_VL_COMERC', 'Comercial'],
  ['TAB_II_D_VL_SERV', 'Serviços'],
  ['TAB_II_E_VL_AGRONEG', 'Agronegócio'],
  ['TAB_II_F_VL_FINANC', 'Financeiro'],
  ['TAB_II_G_VL_CREDITO', 'Crédito'],
  ['TAB_II_H_VL_FACTOR', 'Factoring'],
  ['TAB_II_I_VL_SETOR_PUBLICO', 'Setor Público'],
  ['TAB_II_J_VL_JUDICIAL', 'Judicial'],
  ['TAB_II_K_VL_MARCA', 'Marca'],
]

// Tab X_1_1 cotistas columns (16 investor types per class)
const COTST_TYPES = [
  'PF', 'PJ_NAO_FINANC', 'BANCO', 'CORRETORA_DISTRIB', 'PJ_FINANC', 'INVNR',
  'EAPC', 'EFPC', 'RPPS', 'SEGUR', 'CAPITALIZ', 'COTA_FIDC', 'FII',
  'OUTRO_FI', 'CLUBE', 'OUTRO',
]

function extractLastroPrincipal(row: Record<string, string>): string | null {
  let best: string | null = null
  let bestVal = 0
  for (const [col, label] of LASTRO_MAP) {
    const v = pn(row[col])
    if (v != null && v > bestVal) {
      bestVal = v
      best = label
    }
  }
  return bestVal > 0 ? best : null
}

function sumCotistas(row: Record<string, string>, prefix: 'SENIOR' | 'SUBORD'): number | null {
  let total = 0
  let hasAny = false
  for (const t of COTST_TYPES) {
    const v = pint(row['TAB_X_NR_COTST_' + prefix + '_' + t])
    if (v != null) {
      total += v
      hasAny = true
    }
  }
  return hasAny ? total : null
}

/** Classify X_2 / X_3 series by TAB_X_CLASSE_SERIE text.
 *  Mezanino takes priority over subordinada (mezanino strings often contain "subordinad mezanin"). */
function classifySeries(clasRaw: string): 'senior' | 'mezanino' | 'subordinada' | null {
  const cl = (clasRaw || '').toLowerCase()
  if (!cl) return null
  if (cl.includes('mezanin')) return 'mezanino'
  if (cl.includes('senior') || cl.includes('sênior') || cl.includes('\u00eanior')) return 'senior'
  if (cl.includes('subordinad')) return 'subordinada'
  return null
}

async function ingestFIDC(supabase: any, yearMonth: string) {
  const zipUrl = 'https://dados.cvm.gov.br/dados/FIDC/DOC/INF_MENSAL/DADOS/inf_mensal_fidc_' + yearMonth + '.zip'
  const files = await downloadAndUnzip(zipUrl)
  const tabs: Record<string, TabData> = {}
  for (const [filename, fileData] of Object.entries(files)) {
    if (!filename.endsWith('.csv')) continue
    const text = decodeCSV(fileData)
    const rows = parseCSV(text)
    const indexed: Record<string, Record<string, string>> = {}
    for (const r of rows) { const c = (r['CNPJ_FUNDO_CLASSE'] || '').trim(); if (c) indexed[c] = r }
    const key = filename.split('/').pop() || filename
    tabs[key] = { rows, indexed }
    console.log(key + ': ' + rows.length + ' rows')
  }
  let tabI: TabData | null = null, tabII: TabData | null = null, tabIV: TabData | null = null
  let tabX11: TabData | null = null, tabX2: TabData | null = null, tabX3: TabData | null = null
  for (const [fname, data] of Object.entries(tabs)) {
    const fn = fname.toLowerCase()
    if (fn.includes('tab_i_') && !fn.includes('tab_ii') && !fn.includes('tab_iv') && !fn.includes('tab_ix') && !fn.includes('tab_iii')) tabI = data
    else if (fn.includes('tab_ii_')) tabII = data
    else if (fn.includes('tab_iv_')) tabIV = data
    else if (fn.includes('tab_x_1_1_')) tabX11 = data
    else if (fn.includes('tab_x_2_')) tabX2 = data
    else if (fn.includes('tab_x_3_')) tabX3 = data
  }
  if (!tabI) throw new Error('Tab I not found in FIDC ZIP!')

  // Group X_2 and X_3 by cnpj (multiple rows per fund — one per series)
  const x2ByCnpj: Record<string, Record<string, string>[]> = {}
  if (tabX2) for (const r of tabX2.rows) { const c = (r['CNPJ_FUNDO_CLASSE'] || '').trim(); if (c) { (x2ByCnpj[c] ||= []).push(r) } }
  const x3ByCnpj: Record<string, Record<string, string>[]> = {}
  if (tabX3) for (const r of tabX3.rows) { const c = (r['CNPJ_FUNDO_CLASSE'] || '').trim(); if (c) { (x3ByCnpj[c] ||= []).push(r) } }

  const mapped: any[] = []
  for (const row of tabI.rows) {
    const cnpj = (row['CNPJ_FUNDO_CLASSE'] || '').trim(); if (!cnpj) continue
    const dt = (row['DT_COMPTC'] || '').trim(); if (!dt) continue

    // --- Tab I: carteira, cedentes, PDD ---
    const vlCart = pn(row['TAB_I2_VL_CARTEIRA'])
    const vlInad = pn(row['TAB_I2A2_VL_CRED_VENC_INAD'])
    const vlCI = pn(row['TAB_I2A3_VL_CRED_INAD'])
    const vlAV = pn(row['TAB_I2A1_VL_CRED_VENC_AD'])
    const vlRed = pn(row['TAB_I2A11_VL_REDUCAO_RECUP'])
    const topCed = pn(row['TAB_I2A12_PR_CEDENTE_1'])
    let nrCed = 0
    for (let i = 1; i <= 9; i++) { if (pn(row['TAB_I2A12_PR_CEDENTE_' + i])) nrCed++ }

    // --- Tab IV: PL ---
    let vlPl: number | null = null
    if (tabIV && tabIV.indexed[cnpj]) vlPl = pn(tabIV.indexed[cnpj]['TAB_IV_A_VL_PL'])

    // --- Tab II: total carteira + tp_lastro_principal (argmax) ---
    let vlCartT: number | null = null
    let lastroPrincipal: string | null = null
    if (tabII && tabII.indexed[cnpj]) {
      const tiiRow = tabII.indexed[cnpj]
      vlCartT = pn(tiiRow['TAB_II_VL_CARTEIRA'])
      lastroPrincipal = extractLastroPrincipal(tiiRow)
    }

    // Prefer Tab II (total carteira, more reliable). Min R$10k threshold.
    const cf = (vlCartT && vlCartT > 10000) ? vlCartT : ((vlCart && vlCart > 10000) ? vlCart : null)
    const it = (vlInad || 0) + (vlCI || 0)
    // Cap inadimplência at 100%
    let ti: number | null = null
    if (cf && it > 0) {
      ti = Math.round((it / cf) * 100 * 10000) / 10000
      if (ti > 100) ti = 100
    }
    let pc: number | null = null
    if (it > 0 && vlRed) pc = Math.round((Math.abs(vlRed) / it) * 100 * 100) / 100

    // --- Tab X_2: cota values and quantities per class (senior/mezanino/subordinada) ---
    let vcs: number | null = null, vcm: number | null = null, vcb: number | null = null
    let qcs: number | null = null, qcm: number | null = null, qcb: number | null = null
    for (const x2r of (x2ByCnpj[cnpj] || [])) {
      const cls = classifySeries(x2r['TAB_X_CLASSE_SERIE'] || '')
      if (!cls) continue
      const vc = pn(x2r['TAB_X_VL_COTA'])
      const qc = pn(x2r['TAB_X_QT_COTA'])
      // First non-null value wins per class
      if (cls === 'senior' && vcs === null) { vcs = vc; qcs = qc }
      else if (cls === 'mezanino' && vcm === null) { vcm = vc; qcm = qc }
      else if (cls === 'subordinada' && vcb === null) { vcb = vc; qcb = qc }
    }
    const pls = vcs && qcs ? Math.round(vcs * qcs * 100) / 100 : null
    const plm = vcm && qcm ? Math.round(vcm * qcm * 100) / 100 : null
    const plb = vcb && qcb ? Math.round(vcb * qcb * 100) / 100 : null

    // Índice de subordinação (subordinada + mezanino) / PL total
    const plSubTotal = (plb || 0) + (plm || 0)
    let isub: number | null = null
    if (vlPl && vlPl > 0 && plSubTotal > 0) isub = Math.round((plSubTotal / vlPl) * 100 * 100) / 100

    // --- Tab X_3: rentabilidade per class (cap ±95%) ---
    let rsRaw: number | null = null, rmRaw: number | null = null, rbRaw: number | null = null
    for (const x3r of (x3ByCnpj[cnpj] || [])) {
      const cls = classifySeries(x3r['TAB_X_CLASSE_SERIE'] || '')
      if (!cls) continue
      const rt = pn(x3r['TAB_X_VL_RENTAB_MES'])
      if (cls === 'senior' && rsRaw === null) rsRaw = rt
      else if (cls === 'mezanino' && rmRaw === null) rmRaw = rt
      else if (cls === 'subordinada' && rbRaw === null) rbRaw = rt
    }
    const rs = cleanRentab(rsRaw)
    const rm = cleanRentab(rmRaw)
    const rb = cleanRentab(rbRaw)

    // Weighted average rentab_fundo (by vl_pl of each class)
    let rf: number | null = null
    if (vlPl && vlPl > 0) {
      let sumW = 0, sumVal = 0
      if (rs != null && pls) { sumVal += rs * pls; sumW += pls }
      if (rm != null && plm) { sumVal += rm * plm; sumW += plm }
      if (rb != null && plb) { sumVal += rb * plb; sumW += plb }
      if (sumW > 0) rf = Math.round((sumVal / sumW) * 10000) / 10000
    }
    // Fallback: if no weights, use senior (most reliable single source)
    if (rf == null) rf = rs

    // --- Tab X_1_1: cotistas breakdown (sum 16 investor types per class) ---
    let nrCotstSr: number | null = null, nrCotstSub: number | null = null
    if (tabX11 && tabX11.indexed[cnpj]) {
      const x11r = tabX11.indexed[cnpj]
      nrCotstSr = sumCotistas(x11r, 'SENIOR')
      nrCotstSub = sumCotistas(x11r, 'SUBORD')
    }

    mapped.push({
      cnpj_fundo: cnpj,
      dt_comptc: dt,
      vl_cota_senior: vcs, vl_cota_mezanino: vcm, vl_cota_subordinada: vcb,
      qt_cota_senior: qcs, qt_cota_mezanino: qcm, qt_cota_subordinada: qcb,
      vl_pl_senior: pls, vl_pl_mezanino: plm, vl_pl_subordinada: plb, vl_pl_total: vlPl,
      indice_subordinacao: isub,
      vl_carteira_direitos: cf,
      vl_carteira_a_vencer: vlAV,
      vl_carteira_inadimplente: it > 0 ? it : null,
      vl_pdd: vlRed ? Math.abs(vlRed) : null,
      indice_pdd_cobertura: pc,
      taxa_inadimplencia: ti,
      rentab_senior: rs, rentab_subordinada: rb, rentab_fundo: rf,
      tp_lastro_principal: lastroPrincipal,
      nr_cedentes: nrCed > 0 ? nrCed : null,
      concentracao_cedente: topCed,
      nr_cotistas_senior: nrCotstSr,
      nr_cotistas_subordinada: nrCotstSub,
    })
  }

  let be = 0
  for (let i = 0; i < mapped.length; i += 500) {
    const { error } = await supabase.from('hub_fidc_mensal').upsert(mapped.slice(i, i + 500), { onConflict: 'cnpj_fundo,dt_comptc', ignoreDuplicates: false })
    if (error) { console.error('FIDC err ' + i + ': ' + error.message); be++ }
  }

  return {
    module: 'fidc',
    year_month: yearMonth,
    total_ingested: mapped.length,
    batch_errors: be,
    stats: {
      with_pl: mapped.filter(m => m.vl_pl_total).length,
      with_subordination: mapped.filter(m => m.indice_subordinacao).length,
      with_inadimplencia: mapped.filter(m => m.taxa_inadimplencia).length,
      with_rentab_senior: mapped.filter(m => m.rentab_senior != null).length,
      with_rentab_fundo_weighted: mapped.filter(m => m.rentab_fundo != null).length,
      with_mezanino: mapped.filter(m => m.vl_pl_mezanino != null).length,
      with_lastro: mapped.filter(m => m.tp_lastro_principal).length,
      with_cotistas_senior: mapped.filter(m => m.nr_cotistas_senior != null).length,
      with_cotistas_subord: mapped.filter(m => m.nr_cotistas_subordinada != null).length,
    },
  }
}

// ---- FII Ingestion (unchanged — Cotas_Emitidas is correct for 2026) ----

async function ingestFII(supabase: any, yearMonth: string) {
  const year = getYear(yearMonth)
  const monthFilter = getMonthFilter(yearMonth)
  console.log('FII: year=' + year + ', monthFilter=' + monthFilter)

  const zipUrl = 'https://dados.cvm.gov.br/dados/FII/DOC/INF_MENSAL/DADOS/inf_mensal_fii_' + year + '.zip'
  const files = await downloadAndUnzip(zipUrl)

  let complementoRows: Record<string, string>[] = []
  let ativoPassivoIdx: Record<string, Record<string, string>> = {}
  let geralIdx: Record<string, Record<string, string>> = {}

  for (const [filename, fileData] of Object.entries(files)) {
    if (!filename.endsWith('.csv')) continue
    const text = decodeCSV(fileData)
    const rows = parseCSV(text)
    const fn = filename.toLowerCase()
    console.log(filename + ': ' + rows.length + ' rows')

    if (fn.includes('complemento')) {
      complementoRows = rows.filter(r => (r['Data_Referencia'] || '') === monthFilter)
      console.log('  Filtered to ' + complementoRows.length + ' for ' + monthFilter)
    } else if (fn.includes('ativo_passivo')) {
      for (const r of rows) {
        if ((r['Data_Referencia'] || '') !== monthFilter) continue
        const cnpj = (r['CNPJ_Fundo_Classe'] || '').trim()
        if (cnpj) ativoPassivoIdx[cnpj] = r
      }
    } else if (fn.includes('geral')) {
      for (const r of rows) {
        if ((r['Data_Referencia'] || '') !== monthFilter) continue
        const cnpj = (r['CNPJ_Fundo_Classe'] || '').trim()
        if (cnpj) geralIdx[cnpj] = r
      }
    }
  }

  if (complementoRows.length === 0) {
    throw new Error('No FII complemento rows found for ' + monthFilter)
  }

  const mapped: any[] = []
  for (const row of complementoRows) {
    const cnpj = (row['CNPJ_Fundo_Classe'] || '').trim()
    if (!cnpj) continue
    const dt = (row['Data_Referencia'] || '').trim()
    if (!dt) continue

    const parts = dt.split('-')
    const yr = parseInt(parts[0]), mo = parseInt(parts[1])
    const lastDay = new Date(yr, mo, 0).getDate()
    const dtComptc = yr + '-' + String(mo).padStart(2, '0') + '-' + String(lastDay).padStart(2, '0')

    const geral = geralIdx[cnpj] || {}
    const ap = ativoPassivoIdx[cnpj] || {}

    mapped.push({
      cnpj_fundo: cnpj,
      dt_comptc: dtComptc,
      nome_fundo: (geral['Nome_Fundo_Classe'] || '').trim() || null,
      segmento: (geral['Segmento_Atuacao'] || '').trim() || null,
      mandato: (geral['Mandato'] || '').trim() || null,
      tipo_gestao: (geral['Tipo_Gestao'] || '').trim() || null,
      publico_alvo: (geral['Publico_Alvo'] || '').trim() || null,
      codigo_isin: (geral['Codigo_ISIN'] || '').trim() || null,
      vl_ativo: pn(row['Valor_Ativo']),
      patrimonio_liquido: pn(row['Patrimonio_Liquido']),
      cotas_emitidas: pn(row['Cotas_Emitidas']),
      valor_patrimonial_cota: pn(row['Valor_Patrimonial_Cotas']),
      rentabilidade_efetiva_mes: cleanRentab(pn(row['Percentual_Rentabilidade_Efetiva_Mes'])),
      rentabilidade_patrimonial_mes: cleanRentab(pn(row['Percentual_Rentabilidade_Patrimonial_Mes'])),
      dividend_yield_mes: cleanRentab(pn(row['Percentual_Dividend_Yield_Mes'])),
      amortizacao_cotas_mes: pn(row['Percentual_Amortizacao_Cotas_Mes']),
      nr_cotistas: pint(row['Total_Numero_Cotistas']),
      pct_despesas_adm: pn(row['Percentual_Despesas_Taxa_Administracao']),
      disponibilidades: pn(ap['Disponibilidades']),
      titulos_publicos: pn(ap['Titulos_Publicos']),
      titulos_privados: pn(ap['Titulos_Privados']),
      fundos_rf: pn(ap['Fundos_Renda_Fixa']),
      imoveis_renda: pn(ap['Imoveis_Renda_Acabados']),
      imoveis_construcao: pn(ap['Imoveis_Renda_Construcao']),
      imoveis_venda: pn(ap['Imoveis_Venda_Acabados']),
      cri: pn(ap['CRI']),
      lci: pn(ap['LCI']),
      fii_cotas: pn(ap['FII']),
      total_passivo: pn(ap['Total_Passivo']),
    })
  }

  console.log('Upserting ' + mapped.length + ' FII records...')
  let be = 0
  for (let i = 0; i < mapped.length; i += 500) {
    const { error } = await supabase.from('hub_fii_mensal').upsert(mapped.slice(i, i + 500), { onConflict: 'cnpj_fundo,dt_comptc', ignoreDuplicates: false })
    if (error) { console.error('FII err ' + i + ': ' + error.message); be++ }
  }

  const hasPl = mapped.filter(m => m.patrimonio_liquido).length
  const hasDy = mapped.filter(m => m.dividend_yield_mes).length
  const hasSeg = mapped.filter(m => m.segmento).length
  return { module: 'fii', year_month: yearMonth, total_ingested: mapped.length, batch_errors: be, stats: { with_pl: hasPl, with_dy: hasDy, with_segmento: hasSeg } }
}

// ---- FIP Ingestion (unchanged) ----

async function ingestFIP(supabase: any, yearMonth: string) {
  const year = getYear(yearMonth)
  const csvUrl = 'https://dados.cvm.gov.br/dados/FIP/DOC/INF_QUADRIMESTRAL/DADOS/inf_quadrimestral_fip_' + year + '.csv'
  const text = await downloadCSV(csvUrl)
  const allRows = parseCSV(text)
  console.log('FIP total rows: ' + allRows.length)

  const monthFilter = yearMonth.substring(4, 6)
  let rows = allRows
  if (monthFilter !== '00') {
    rows = allRows.filter(r => {
      const dt = (r['DT_COMPTC'] || '')
      return dt.substring(5, 7) === monthFilter
    })
    console.log('Filtered to ' + rows.length + ' for month ' + monthFilter)
  }
  if (rows.length === 0) {
    rows = allRows
    console.log('No match for month filter, ingesting all ' + rows.length + ' rows')
  }

  const mapped: any[] = []
  for (const row of rows) {
    const cnpj = (row['CNPJ_FUNDO_CLASSE'] || '').trim()
    if (!cnpj) continue
    const dt = (row['DT_COMPTC'] || '').trim()
    if (!dt) continue

    mapped.push({
      cnpj_fundo: cnpj,
      dt_comptc: dt,
      nome_fundo: (row['DENOM_SOCIAL'] || '').trim() || null,
      tp_fundo_classe: (row['TP_FUNDO_CLASSE'] || '').trim() || null,
      publico_alvo: (row['PUBLICO_ALVO'] || '').trim() || null,
      entid_invest: (row['ENTID_INVEST'] || '').trim() || null,
      patrimonio_liquido: pn(row['VL_PATRIM_LIQ']),
      qt_cota: pn(row['QT_COTA']),
      valor_patrimonial_cota: pn(row['VL_PATRIM_COTA']),
      nr_cotistas: pint(row['NR_COTST']),
      vl_cap_comprom: pn(row['VL_CAP_COMPROM']),
      vl_cap_subscr: pn(row['VL_CAP_SUBSCR']),
      vl_cap_integr: pn(row['VL_CAP_INTEGR']),
      vl_invest_fip_cota: pn(row['VL_INVEST_FIP_COTA']),
    })
  }

  const uniqueMap = new Map<string, any>()
  for (const m of mapped) {
    const key = m.cnpj_fundo + '|' + m.dt_comptc
    if (!uniqueMap.has(key)) uniqueMap.set(key, m)
  }
  const unique = Array.from(uniqueMap.values())

  console.log('Upserting ' + unique.length + ' FIP records (from ' + mapped.length + ' raw)...')
  let be = 0
  for (let i = 0; i < unique.length; i += 500) {
    const { error } = await supabase.from('hub_fip_quadrimestral').upsert(unique.slice(i, i + 500), { onConflict: 'cnpj_fundo,dt_comptc', ignoreDuplicates: false })
    if (error) { console.error('FIP err ' + i + ': ' + error.message); be++ }
  }

  const hasPl = unique.filter(m => m.patrimonio_liquido).length
  return { module: 'fip', year_month: yearMonth, total_ingested: unique.length, batch_errors: be, stats: { with_pl: hasPl, raw_rows: mapped.length } }
}

// ---- Main Handler ----

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const startedAt = new Date().toISOString()
  let moduleParam = 'cda'
  let yearMonthParam = getLastMonth()

  try {
    const url = new URL(req.url)
    moduleParam = url.searchParams.get('module') || 'cda'
    yearMonthParam = url.searchParams.get('year_month') || getLastMonth()
    console.log('=== ingest-cvm-data v4: module=' + moduleParam + ', year_month=' + yearMonthParam + ' ===')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    let result: any
    if (moduleParam === 'fidc') result = await ingestFIDC(supabase, yearMonthParam)
    else if (moduleParam === 'fii') result = await ingestFII(supabase, yearMonthParam)
    else if (moduleParam === 'fip') result = await ingestFIP(supabase, yearMonthParam)
    else result = await ingestCDA(supabase, yearMonthParam)

    await supabase.from('hub_cvm_ingestion_log').insert({
      source: 'ingest-cvm-data:' + moduleParam, reference_date: yearMonthParam,
      records_fetched: result.total_ingested, records_inserted: result.total_ingested,
      status: 'success', started_at: startedAt, finished_at: new Date().toISOString(),
    })
    console.log('Done! ' + result.total_ingested + ' records.')
    return new Response(JSON.stringify(result, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Fatal error: ' + msg)
    try {
      const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
      await supabase.from('hub_cvm_ingestion_log').insert({ source: 'ingest-cvm-data:' + moduleParam, reference_date: yearMonthParam, status: 'error', error_message: msg, started_at: startedAt, finished_at: new Date().toISOString() })
    } catch { /* ignore */ }
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
