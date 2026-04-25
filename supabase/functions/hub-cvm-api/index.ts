import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Cache-Control': 'public, max-age=3600',
}

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

// Helper: bypass PostgREST 1000-row cap with chunked pagination.
// IMPORTANT: orderCol MUST exist in the target table. No default 'id' here —
// hub_fundos_diario (and most CVM tables) use composite PKs without an `id` column.
// Always pass an explicit column present in the table (e.g. 'cnpj_fundo_classe', 'cnpj_fundo').
async function fetchAllByDate(
  supabase: ReturnType<typeof getSupabase>,
  table: string,
  dateColumn: string,
  date: string,
  columns: string,
  orderCol: string,
  chunkSize = 1000,
) {
  const out: any[] = []
  let from = 0
  for (let i = 0; i < 30; i++) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .eq(dateColumn, date)
      .order(orderCol, { ascending: true })
      .range(from, from + chunkSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    out.push(...data)
    if (data.length < chunkSize) break
    from += chunkSize
  }
  return out
}

async function getLatestDate(
  supabase: ReturnType<typeof getSupabase>,
  table: string,
  dateColumn: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from(table)
    .select(dateColumn)
    .order(dateColumn, { ascending: false })
    .limit(1)
  if (error) throw error
  if (!data || data.length === 0) return null
  return (data[0] as any)[dateColumn] as string
}

// --- Main handler ---
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const url = new URL(req.url)
  const endpoint = url.searchParams.get('endpoint') || 'catalog'
  try {
    const supabase = getSupabase()
    let result: any

    switch (endpoint) {
      /* Meta / catalog */
      case 'catalog': {
        const classe = url.searchParams.get('classe')
        const classeRcvm = url.searchParams.get('classe_rcvm175')
        const tp = url.searchParams.get('tp_fundo')
        const limit = parseInt(url.searchParams.get('limit') || '50')
        const offset = parseInt(url.searchParams.get('offset') || '0')
        const orderBy = url.searchParams.get('order_by') || 'vl_patrim_liq'
        const search = url.searchParams.get('search')
        let query = supabase
          .from('hub_fundos_meta')
          .select('*', { count: 'exact' })
          .order(orderBy, { ascending: false, nullsFirst: false })
          .range(offset, offset + limit - 1)
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
        if (!cnpj && !slug) throw new Error('cnpj or slug required')
        let query = supabase.from('hub_fundos_meta').select('*')
        if (slug) query = query.eq('slug', slug)
        else query = query.or(`cnpj_fundo_classe.eq.${cnpj},cnpj_fundo.eq.${cnpj}`)
        const { data, error } = await query.limit(1).maybeSingle()
        if (error) throw error
        result = data
        break
      }

      case 'fund_by_slug': {
        const slug = url.searchParams.get('slug')
        if (!slug) throw new Error('slug required')
        const { data, error } = await supabase
          .from('hub_fundos_meta')
          .select('*')
          .eq('slug', slug)
          .maybeSingle()
        if (error) throw error
        result = data
        break
      }

      case 'fund_search': {
        const q = url.searchParams.get('q')
        const limit = parseInt(url.searchParams.get('limit') || '20')
        if (!q || q.length < 2) throw new Error('query must be at least 2 chars')
        const isSlug = q.includes('-') && !/\d{2}\.\d{3}/.test(q)
        let query = supabase
          .from('hub_fundos_meta')
          .select('*', { count: 'exact' })
          .limit(limit)
        if (isSlug) query = query.ilike('slug', '%' + q + '%')
        else query = query.ilike('denom_social', '%' + q + '%')
        const { data, count, error } = await query
        if (error) throw error
        result = { query: q, results: data ?? [], count: count ?? 0 }
        break
      }

      case 'compare': {
        const cnpjs = url.searchParams.get('cnpjs') || ''
        const slugs = url.searchParams.get('slugs') || ''
        const ids = cnpjs.length > 0 ? cnpjs.split(',').slice(0, 6) : slugs.split(',').slice(0, 6)
        const column = cnpjs.length > 0 ? 'cnpj_fundo_classe' : 'slug'
        const { data, error } = await supabase.from('hub_fundos_meta').select('*').in(column, ids)
        if (error) throw error
        result = { funds: data }
        break
      }

      case 'stats': {
        // Bypass PostgREST 1000-row cap by paginating through hub_fundos_meta
        // (29k+ classes). Sem isso o agregado fica truncado em 1000 fundos.
        const meta: any[] = []
        let from = 0
        const chunkSize = 1000
        for (let i = 0; i < 50; i++) {
          const { data, error } = await supabase
            .from('hub_fundos_meta')
            .select('classe, classe_rcvm175, vl_patrim_liq, tp_fundo')
            .order('cnpj_fundo_classe', { ascending: true })
            .range(from, from + chunkSize - 1)
          if (error) throw error
          if (!data || data.length === 0) break
          meta.push(...data)
          if (data.length < chunkSize) break
          from += chunkSize
        }

        const byClasse: Record<string, { count: number; pl_total: number }> = {}
        const byClasseRcvm: Record<string, { count: number; pl_total: number }> = {}
        let plTotal = 0
        let topPl = 0
        for (const f of meta) {
          const c = (f as any).classe || 'Outros'
          if (!byClasse[c]) byClasse[c] = { count: 0, pl_total: 0 }
          byClasse[c].count++
          const pl = (f as any).vl_patrim_liq || 0
          byClasse[c].pl_total += pl
          plTotal += pl
          if (pl > topPl) topPl = pl
          const rc = (f as any).classe_rcvm175 || 'Outros'
          if (!byClasseRcvm[rc]) byClasseRcvm[rc] = { count: 0, pl_total: 0 }
          byClasseRcvm[rc].count++
          byClasseRcvm[rc].pl_total += pl
        }
        result = {
          total_funds: meta.length,
          total_pl: plTotal,
          top_pl: topPl,
          by_classe: byClasse,
          by_classe_rcvm175: byClasseRcvm,
        }
        break
      }

      case 'overview': {
        const { count: totalCount } = await supabase
          .from('hub_fundos_meta')
          .select('*', { count: 'exact', head: true })
        const { data: top } = await supabase
          .from('hub_fundos_meta')
          .select('cnpj_fundo_classe, denom_social, slug, classe_rcvm175, vl_patrim_liq, nr_cotistas')
          .order('vl_patrim_liq', { ascending: false, nullsFirst: false })
          .limit(10)
        result = { total_funds: totalCount ?? 0, top_by_pl: top ?? [] }
        break
      }

      case 'rankings': {
        const classe = url.searchParams.get('classe') || url.searchParams.get('classe_rcvm175')
        const limit = parseInt(url.searchParams.get('limit') || '50')
        const orderBy = url.searchParams.get('order_by') || 'vl_patrim_liq'
        let query = supabase
          .from('hub_fundos_meta')
          .select('cnpj_fundo_classe, cnpj_fundo, denom_social, slug, classe_rcvm175, subclasse_rcvm175, tp_fundo, vl_patrim_liq, taxa_adm, taxa_perfm, nr_cotistas, gestor_nome, admin_nome', { count: 'exact' })
          .order(orderBy, { ascending: false, nullsFirst: false })
          .limit(limit)
        if (classe) query = query.eq('classe_rcvm175', classe)
        const { data, count, error } = await query
        if (error) throw error
        result = { classe: classe ?? 'all', funds: data ?? [], count: count ?? 0 }
        break
      }

      case 'gestora_rankings': {
        const limit = parseInt(url.searchParams.get('limit') || '20')
        const { data, error } = await supabase.rpc('gestora_rankings_rpc', { p_limit: limit })
        if (error) throw error
        result = { gestoras: data ?? [], total: (data ?? []).length }
        break
      }

      case 'admin_rankings': {
        const limit = parseInt(url.searchParams.get('limit') || '20')
        const { data, error } = await supabase.rpc('admin_rankings_rpc', { p_limit: limit })
        if (error) throw error
        result = { admins: data ?? [], total: (data ?? []).length }
        break
      }

      /* Daily series (hub_fundos_diario) */
      case 'monthly': {
        const cnpj = url.searchParams.get('cnpj')
        const months = parseInt(url.searchParams.get('months') || '12')
        if (!cnpj) throw new Error('cnpj required')
        const limitRows = months * 25
        const { data, error } = await supabase
          .from('hub_fundos_diario')
          .select('cnpj_fundo, cnpj_fundo_classe, dt_comptc, vl_total, vl_quota, vl_patrim_liq, captc_dia, resg_dia, nr_cotst')
          .or(`cnpj_fundo_classe.eq.${cnpj},cnpj_fundo.eq.${cnpj}`)
          .order('dt_comptc', { ascending: false })
          .limit(limitRows)
        if (error) throw error
        result = { cnpj, months: data ?? [], count: (data ?? []).length }
        break
      }

      case 'monthly_rankings': {
        const classe = url.searchParams.get('classe') || url.searchParams.get('classe_rcvm175')
        const limit = parseInt(url.searchParams.get('limit') || '50')
        const period = url.searchParams.get('period') || 'latest'
        const latest = await getLatestDate(supabase, 'hub_fundos_diario', 'dt_comptc')
        if (!latest) {
          result = { period, classe: classe ?? 'all', funds: [], count: 0 }
          break
        }
        const q2 = supabase
          .from('hub_fundos_diario')
          .select('cnpj_fundo, cnpj_fundo_classe, dt_comptc, vl_patrim_liq, vl_quota, nr_cotst', { count: 'exact' })
          .eq('dt_comptc', latest)
          .order('vl_patrim_liq', { ascending: false, nullsFirst: false })
          .limit(limit)
        const { data, error } = await q2
        if (error) throw error
        const cnpjs = (data ?? []).map((r: any) => r.cnpj_fundo_classe).filter(Boolean)
        const metaMap: Record<string, any> = {}
        if (cnpjs.length > 0) {
          const { data: metas } = await supabase
            .from('hub_fundos_meta')
            .select('cnpj_fundo_classe, denom_social, slug, classe_rcvm175')
            .in('cnpj_fundo_classe', cnpjs)
          for (const m of metas ?? []) metaMap[(m as any).cnpj_fundo_classe] = m
        }
        let enriched = (data ?? []).map((r: any) => ({ ...r, ...(metaMap[r.cnpj_fundo_classe] || {}) }))
        if (classe) enriched = enriched.filter((r: any) => r.classe_rcvm175 === classe)
        result = { period: latest, classe: classe ?? 'all', funds: enriched, count: enriched.length }
        break
      }

      case 'monthly_overview': {
        const months = parseInt(url.searchParams.get('months') || '6')
        const latest = await getLatestDate(supabase, 'hub_fundos_diario', 'dt_comptc')
        if (!latest) {
          result = { months: [], count: 0 }
          break
        }
        const latestDate = new Date(latest)
        const points: { dt: string; total_pl: number; total_funds: number }[] = []
        for (let i = 0; i < months; i++) {
          const d = new Date(latestDate.getFullYear(), latestDate.getMonth() - i + 1, 0)
          const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
          const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10)
          const { data: maxRow } = await supabase
            .from('hub_fundos_diario')
            .select('dt_comptc')
            .gte('dt_comptc', startOfMonth)
            .lte('dt_comptc', endOfMonth)
            .order('dt_comptc', { ascending: false })
            .limit(1)
          const dt = (maxRow?.[0] as any)?.dt_comptc
          if (!dt) continue
          // FIX v24: pass explicit orderCol. hub_fundos_diario has composite PK
          // (cnpj_fundo_classe, dt_comptc) — no `id` column (previous default).
          const rows = await fetchAllByDate(
            supabase,
            'hub_fundos_diario',
            'dt_comptc',
            dt,
            'vl_patrim_liq, cnpj_fundo_classe',
            'cnpj_fundo_classe',
          )
          const totalPl = rows.reduce((acc, r) => acc + ((r as any).vl_patrim_liq || 0), 0)
          points.push({ dt, total_pl: totalPl, total_funds: rows.length })
        }
        result = { months: points.reverse(), count: points.length }
        break
      }

      /* CDA composition (hub_fundos_cda) */
      case 'composition':
      case 'fund_composition': {
        const cnpj = url.searchParams.get('cnpj')
        if (!cnpj) throw new Error('cnpj required')
        const { data: latestRow } = await supabase
          .from('hub_fundos_cda')
          .select('dt_comptc')
          .eq('cnpj_fundo', cnpj)
          .order('dt_comptc', { ascending: false })
          .limit(1)
        const dt = (latestRow?.[0] as any)?.dt_comptc
        if (!dt) {
          result = { cnpj, assets: [], count: 0 }
          break
        }
        const { data, error } = await supabase
          .from('hub_fundos_cda')
          .select('cnpj_fundo, dt_comptc, bloco, tp_ativo, cd_ativo, ds_ativo, emissor, vl_merc_pos_final, qt_pos_final, pct_pl, vl_custo_pos_final, dt_venc')
          .eq('cnpj_fundo', cnpj)
          .eq('dt_comptc', dt)
          .order('vl_merc_pos_final', { ascending: false, nullsFirst: false })
          .limit(500)
        if (error) throw error
        result = { cnpj, assets: data ?? [], count: (data ?? []).length }
        break
      }

      case 'composition_summary':
      case 'fund_composition_summary': {
        const cnpj = url.searchParams.get('cnpj')
        if (!cnpj) throw new Error('cnpj required')
        const { data: latestRow } = await supabase
          .from('hub_fundos_cda')
          .select('dt_comptc')
          .eq('cnpj_fundo', cnpj)
          .order('dt_comptc', { ascending: false })
          .limit(1)
        const dt = (latestRow?.[0] as any)?.dt_comptc
        if (!dt) {
          result = { cnpj, summary: [], total_pl: 0 }
          break
        }
        const { data, error } = await supabase
          .from('hub_fundos_cda')
          .select('bloco, vl_merc_pos_final, pct_pl')
          .eq('cnpj_fundo', cnpj)
          .eq('dt_comptc', dt)
          .limit(5000)
        if (error) throw error
        const byBloco: Record<string, { bloco: string; total: number; pct: number; count: number }> = {}
        let totalPl = 0
        for (const r of data ?? []) {
          const row = r as any
          const bloco = row.bloco || 'Outros'
          if (!byBloco[bloco]) byBloco[bloco] = { bloco, total: 0, pct: 0, count: 0 }
          byBloco[bloco].total += row.vl_merc_pos_final || 0
          byBloco[bloco].pct += row.pct_pl || 0
          byBloco[bloco].count++
          totalPl += row.vl_merc_pos_final || 0
        }
        const summary = Object.values(byBloco).sort((a, b) => b.total - a.total)
        result = { cnpj, summary, total_pl: totalPl }
        break
      }

      /* Legacy FIDC/FII/FIP endpoints (backwards-compat) */
      case 'fidc_monthly': {
        const cnpj = url.searchParams.get('cnpj')
        const months = parseInt(url.searchParams.get('months') || '12')
        if (!cnpj) throw new Error('cnpj required')
        const { data, error } = await supabase
          .from('v_hub_fidc_clean')
          .select('*')
          .eq('cnpj_fundo', cnpj)
          .order('dt_comptc', { ascending: false })
          .limit(months)
        if (error) throw error
        result = { cnpj, months: data ?? [], count: (data ?? []).length }
        break
      }

      case 'fidc_rankings': {
        const limit = parseInt(url.searchParams.get('limit') || '50')
        const orderBy = url.searchParams.get('order_by') || 'vl_pl_total'
        const latest = await getLatestDate(supabase, 'v_hub_fidc_clean', 'dt_comptc')
        if (!latest) {
          result = { funds: [], count: 0 }
          break
        }
        const { data, error } = await supabase
          .from('v_hub_fidc_clean')
          .select('*')
          .eq('dt_comptc', latest)
          .order(orderBy, { ascending: false, nullsFirst: false })
          .limit(limit)
        if (error) throw error
        result = { funds: data ?? [], count: (data ?? []).length }
        break
      }

      case 'fidc_overview': {
        const latest = await getLatestDate(supabase, 'v_hub_fidc_clean', 'dt_comptc')
        if (!latest) {
          result = { date: null, total_fidcs: 0, total_pl: 0 }
          break
        }
        const rows = await fetchAllByDate(
          supabase,
          'v_hub_fidc_clean',
          'dt_comptc',
          latest,
          'cnpj_fundo, vl_pl_total',
          'cnpj_fundo',
        )
        const totalPl = rows.reduce((a, r) => a + ((r as any).vl_pl_total || 0), 0)
        result = { date: latest, total_fidcs: rows.length, total_pl: totalPl }
        break
      }

      case 'fii_monthly': {
        const cnpj = url.searchParams.get('cnpj')
        const months = parseInt(url.searchParams.get('months') || '12')
        if (!cnpj) throw new Error('cnpj required')
        const { data, error } = await supabase
          .from('hub_fii_mensal')
          .select('*')
          .eq('cnpj_fundo', cnpj)
          .order('dt_comptc', { ascending: false })
          .limit(months)
        if (error) throw error
        result = { cnpj, data: data ?? [], count: (data ?? []).length }
        break
      }

      case 'fii_rankings': {
        const limit = parseInt(url.searchParams.get('limit') || '50')
        const orderBy = url.searchParams.get('order_by') || 'patrimonio_liquido'
        const latest = await getLatestDate(supabase, 'hub_fii_mensal', 'dt_comptc')
        if (!latest) {
          result = { date: null, funds: [], count: 0 }
          break
        }
        const { data, error } = await supabase
          .from('hub_fii_mensal')
          .select('*')
          .eq('dt_comptc', latest)
          .order(orderBy, { ascending: false, nullsFirst: false })
          .limit(limit)
        if (error) throw error
        result = { date: latest, funds: data ?? [], count: (data ?? []).length }
        break
      }

      case 'fii_overview': {
        const latest = await getLatestDate(supabase, 'hub_fii_mensal', 'dt_comptc')
        if (!latest) {
          result = { date: null, total_fiis: 0, total_pl: 0 }
          break
        }
        const rows = await fetchAllByDate(
          supabase,
          'hub_fii_mensal',
          'dt_comptc',
          latest,
          'cnpj_fundo, patrimonio_liquido, dividend_yield_mes',
          'cnpj_fundo',
        )
        const totalPl = rows.reduce((a, r) => a + ((r as any).patrimonio_liquido || 0), 0)
        result = { date: latest, total_fiis: rows.length, total_pl: totalPl }
        break
      }

      case 'fip_quarterly': {
        const cnpj = url.searchParams.get('cnpj')
        const quarters = parseInt(url.searchParams.get('quarters') || '4')
        if (!cnpj) throw new Error('cnpj required')
        const { data, error } = await supabase
          .from('hub_fip_quadrimestral')
          .select('*')
          .eq('cnpj_fundo', cnpj)
          .order('dt_comptc', { ascending: false })
          .limit(quarters)
        if (error) throw error
        result = { cnpj, data: data ?? [], count: (data ?? []).length }
        break
      }

      case 'fip_rankings': {
        const limit = parseInt(url.searchParams.get('limit') || '50')
        const orderBy = url.searchParams.get('order_by') || 'patrimonio_liquido'
        const latest = await getLatestDate(supabase, 'hub_fip_quadrimestral', 'dt_comptc')
        if (!latest) {
          result = { date: null, funds: [], count: 0 }
          break
        }
        const { data, error } = await supabase
          .from('hub_fip_quadrimestral')
          .select('*')
          .eq('dt_comptc', latest)
          .order(orderBy, { ascending: false, nullsFirst: false })
          .limit(limit)
        if (error) throw error
        result = { date: latest, funds: data ?? [], count: (data ?? []).length }
        break
      }

      case 'fip_overview': {
        const latest = await getLatestDate(supabase, 'hub_fip_quadrimestral', 'dt_comptc')
        if (!latest) {
          result = { date: null, total_fips: 0, total_pl: 0 }
          break
        }
        const rows = await fetchAllByDate(
          supabase,
          'hub_fip_quadrimestral',
          'dt_comptc',
          latest,
          'cnpj_fundo, patrimonio_liquido',
          'cnpj_fundo',
        )
        const totalPl = rows.reduce((a, r) => a + ((r as any).patrimonio_liquido || 0), 0)
        result = { date: latest, total_fips: rows.length, total_pl: totalPl }
        break
      }

      /* Insights feed */
      case 'insights':
      case 'insights_feed': {
        const limit = parseInt(url.searchParams.get('limit') || '20')
        const offset = parseInt(url.searchParams.get('offset') || '0')
        const tipo = url.searchParams.get('tipo')
        const severidade = url.searchParams.get('severidade')
        let query = supabase
          .from('hub_fundos_insights')
          .select('*', { count: 'exact' })
          .order('detectado_em', { ascending: false })
          .range(offset, offset + limit - 1)
        if (tipo) query = query.eq('tipo', tipo)
        if (severidade) query = query.eq('severidade', severidade)
        const { data, count, error } = await query
        if (error) throw error
        result = { insights: data ?? [], total: count ?? 0, limit, offset }
        break
      }

      case 'insights_for_fund': {
        const slug = url.searchParams.get('slug')
        const cnpj = url.searchParams.get('cnpj')
        if (!slug && !cnpj) throw new Error('slug or cnpj required')
        let query = supabase.from('hub_fundos_insights').select('*').order('detectado_em', { ascending: false })
        if (slug) query = query.eq('slug', slug)
        else query = query.or(`cnpj_fundo_classe.eq.${cnpj},cnpj_fundo.eq.${cnpj}`)
        const { data, error } = await query
        if (error) throw error
        result = { insights: data ?? [], cnpj: cnpj ?? '' }
        break
      }

      /* Macro passthroughs (back-compat) */
      case 'hub_macro_series_bundle': {
        const category = url.searchParams.get('category') || 'pib'
        const period = url.searchParams.get('period') || '6m'
        const module = url.searchParams.get('module') || 'macro'
        const { data, error } = await supabase
          .from('hub_macro_series_meta')
          .select('*')
          .eq('categoria', category)
          .eq('modulo', module)
          .eq('periodo_padrao', period)
        if (error) throw error
        result = { series_bundle: data }
        break
      }

      case 'hub_latest': {
        const { data, error } = await supabase.from('hub_macro_series_meta').select('*').limit(10)
        if (error) throw error
        result = { latest: data }
        break
      }

      case 'hub_series': {
        const codigo = url.searchParams.get('codigo')
        const limit = parseInt(url.searchParams.get('limit') || '120')
        if (!codigo) throw new Error('codigo required')
        const { data, error } = await supabase
          .from(`hub_serie_${codigo}`)
          .select('*')
          .order('data', { ascending: false })
          .limit(limit)
        if (error) throw error
        result = { series: data }
        break
      }

      case 'hub_ingestion_status': {
        const { data, error } = await supabase
          .from('hub_cvm_ingestion_log')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5)
        if (error) throw error
        result = { ingestion_status: data }
        break
      }

      default:
        throw new Error(`Unknown endpoint: ${endpoint}`)
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: unknown) {
    // FIX v24: PostgrestError is a plain object, not an Error instance.
    // Previous String(err) rendered '[object Object]' for PostgREST/RPC failures.
    const e = err as any
    const message =
      e?.message ||
      e?.error?.message ||
      (typeof e === 'string' ? e : null) ||
      'Internal error'
    const code = e?.code ?? null
    const details = e?.details ?? null
    const hint = e?.hint ?? null
    console.error('[hub-cvm-api] error', { endpoint, message, code, details, hint })
    return new Response(
      JSON.stringify({ error: message, code, details, hint, endpoint }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
