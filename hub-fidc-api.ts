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

/** Get latest FIDC date with >500 funds (skip incomplete months) */
async function getLatestFidcDate(supabase: any): Promise<string | null> {
  // Query: get the latest date where count > 500
  const { data, error } = await supabase.rpc('fidc_latest_complete_date')
  if (!error && data) return data
  // Fallback: brute-force check last few dates
  const { data: allDates } = await supabase.from('hub_fidc_mensal')
    .select('dt_comptc').order('dt_comptc', { ascending: false }).limit(5000)
  if (!allDates?.length) return null
  // Count per date
  const counts: Record<string, number> = {}
  for (const r of allDates) {
    counts[r.dt_comptc] = (counts[r.dt_comptc] || 0) + 1
  }
  // Pick latest with >500
  const sorted = Object.entries(counts).sort((a, b) => b[0].localeCompare(a[0]))
  for (const [dt, cnt] of sorted) {
    if (cnt >= 500) return dt
  }
  return sorted[0]?.[0] || null
}

async function handleRequest(req: Request): Promise<Response> {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 })
  }

  try {
    const url = new URL(req.url)
    const supabase = getSupabase()
    let result: any = null

    const endpoint = url.searchParams.get('endpoint')
    if (!endpoint) throw new Error('endpoint parameter required')

    switch (endpoint) {
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

      case 'fidc_detail': {
        // Accepts slug or cnpj
        const identifier = url.searchParams.get('slug') || url.searchParams.get('cnpj')
        if (!identifier) throw new Error('slug or cnpj parameter required')
        const isSlug = !identifier.includes('/')
        // Lookup in hub_fundos_meta
        let metaQuery = supabase.from('hub_fundos_meta').select('*').eq('classe_rcvm175', 'FIDC')
        if (isSlug) metaQuery = metaQuery.eq('slug', identifier)
        else metaQuery = metaQuery.eq('cnpj_fundo_classe', identifier)
        const { data: metaArr } = await metaQuery.limit(1)
        const meta = metaArr?.[0] || null
        if (!meta) { result = { meta: null, monthly: [], latest: null }; break }
        // Fetch monthly data: bridge via cnpj_fundo_legado or cnpj_fundo_classe
        const fundCnpj = meta.cnpj_fundo_legado || meta.cnpj_fundo_classe
        const { data: monthly } = await supabase.from('hub_fidc_mensal').select('*').eq('cnpj_fundo', fundCnpj).order('dt_comptc', { ascending: true })
        const latestMonth = monthly && monthly.length > 0 ? monthly[monthly.length - 1] : null
        // Fetch similar FIDCs (same lastro, top 6 by PL)
        const lastro = latestMonth?.tp_lastro_principal
        let similarFunds: any[] = []
        if (lastro && lastro !== 'Não Classificado') {
          const latestDt = await getLatestFidcDate(supabase)
          if (latestDt) {
            const { data: sim } = await supabase.from('hub_fidc_mensal')
              .select('cnpj_fundo, vl_pl_total, indice_subordinacao, taxa_inadimplencia, rentab_senior, tp_lastro_principal')
              .eq('dt_comptc', latestDt).eq('tp_lastro_principal', lastro)
              .neq('cnpj_fundo', fundCnpj)
              .not('vl_pl_total', 'is', null)
              .order('vl_pl_total', { ascending: false }).limit(6)
            if (sim?.length) {
              // Enrich with names: bridge from cnpj_fundo → cnpj_fundo_legado in hub_fundos_meta
              const simCnpjs = sim.map((s: any) => s.cnpj_fundo)
              const { data: simNames } = await supabase.from('hub_fundos_meta')
                .select('cnpj_fundo_classe, denom_social, slug, gestor_nome')
                .or(`cnpj_fundo_classe.in.(${simCnpjs.map(c => `"${c}"`).join(',')}),cnpj_fundo_legado.in.(${simCnpjs.map(c => `"${c}"`).join(',')})`)
              const nm: Record<string, any> = {}
              for (const n of (simNames || [])) {
                nm[n.cnpj_fundo_classe] = n
                if (n.cnpj_fundo_classe) nm[n.cnpj_fundo_classe] = n
              }
              similarFunds = sim.map((s: any) => ({ ...s, ...(nm[s.cnpj_fundo] || nm[s.cnpj_fundo] || {}) }))
            }
          }
        }
        result = { meta, monthly: monthly || [], latest: latestMonth, similar: similarFunds }
        break
      }

      case 'fidc_rankings': {
        const orderBy = url.searchParams.get('order_by') || 'vl_pl_total'
        const limit = parseInt(url.searchParams.get('limit') || '50')
        const offset = parseInt(url.searchParams.get('offset') || '0')
        const ascending = url.searchParams.get('order') === 'asc'
        const lastro = url.searchParams.get('lastro')
        const minPl = parseFloat(url.searchParams.get('min_pl') || '0')
        const maxInadim = url.searchParams.get('max_inadim') ? parseFloat(url.searchParams.get('max_inadim')!) : null
        const minSubord = url.searchParams.get('min_subord') ? parseFloat(url.searchParams.get('min_subord')!) : null
        const gestor = url.searchParams.get('gestor')
        const search = url.searchParams.get('search')

        const dt = await getLatestFidcDate(supabase)
        if (!dt) { result = { funds: [], count: 0, date: null }; break }

        let query = supabase.from('hub_fidc_mensal')
          .select('cnpj_fundo, dt_comptc, vl_pl_total, vl_pl_senior, vl_pl_subordinada, vl_pl_mezanino, indice_subordinacao, taxa_inadimplencia, indice_pdd_cobertura, rentab_fundo, rentab_senior, rentab_subordinada, tp_lastro_principal, nr_cedentes, concentracao_cedente, vl_carteira_direitos, vl_carteira_a_vencer, vl_carteira_inadimplente, vl_carteira_prejuizo, vl_pdd')
          .eq('dt_comptc', dt)

        if (lastro && lastro !== 'all') query = query.eq('tp_lastro_principal', lastro)
        if (minPl > 0) query = query.gte('vl_pl_total', minPl)
        if (maxInadim !== null) query = query.lte('taxa_inadimplencia', maxInadim)
        if (minSubord !== null) query = query.gte('indice_subordinacao', minSubord)

        query = query.not(orderBy, 'is', null).order(orderBy, { ascending, nullsFirst: false }).range(offset, offset + limit - 1)

        const { data, error } = await query
        if (error) throw error

        // Enrich with names from hub_fundos_meta: bridge via cnpj_fundo_legado
        const cnpjsToLookup = (data || []).map((d: any) => d.cnpj_fundo)
        let enriched = data || []
        if (cnpjsToLookup.length > 0) {
          const { data: names } = await supabase.from('hub_fundos_meta')
            .select('cnpj_fundo_classe, cnpj_fundo_legado, denom_social, slug, gestor_nome, admin_nome, classe_rcvm175')
            .or(`cnpj_fundo_classe.in.(${cnpjsToLookup.map(c => `"${c}"`).join(',')}),cnpj_fundo_legado.in.(${cnpjsToLookup.map(c => `"${c}"`).join(',')})`)
          const nameMap: Record<string, any> = {}
          for (const n of (names || [])) {
            nameMap[n.cnpj_fundo_classe] = n
            if (n.cnpj_fundo_legado) nameMap[n.cnpj_fundo_legado] = n
          }
          enriched = (data || []).map((d: any) => ({ ...d, ...(nameMap[d.cnpj_fundo] || {}) }))
          // Apply gestor filter after enrichment (gestor is in meta, not fidc_mensal)
          if (gestor) enriched = enriched.filter((d: any) => d.gestor_nome && d.gestor_nome.toLowerCase().includes(gestor.toLowerCase()))
          // Apply name search after enrichment
          if (search) enriched = enriched.filter((d: any) => d.denom_social && d.denom_social.toLowerCase().includes(search.toLowerCase()))
        }
        result = { date: dt, order_by: orderBy, funds: enriched, count: enriched.length }
        break
      }

      case 'fidc_overview': {
        const dt = await getLatestFidcDate(supabase)
        if (!dt) { result = { date: null, total_fidcs: 0 }; break }
        const { data } = await supabase.from('hub_fidc_mensal').select('vl_pl_total, indice_subordinacao, taxa_inadimplencia, indice_pdd_cobertura, tp_lastro_principal, rentab_senior, rentab_fundo, vl_carteira_direitos').eq('dt_comptc', dt)
        const total = data?.length || 0
        let sumPl = 0, sumSubord = 0, sumInadim = 0, sumRentab = 0, sumCarteira = 0
        let countSubord = 0, countInadim = 0, countRentab = 0
        const byLastro: Record<string, { count: number; pl: number; inadim_sum: number; inadim_count: number }> = {}
        for (const r of (data || [])) {
          sumPl += r.vl_pl_total || 0
          sumCarteira += r.vl_carteira_direitos || 0
          if (r.indice_subordinacao != null) { sumSubord += r.indice_subordinacao; countSubord++ }
          if (r.taxa_inadimplencia != null && r.taxa_inadimplencia < 100) { sumInadim += r.taxa_inadimplencia; countInadim++ }
          if (r.rentab_senior != null) { sumRentab += r.rentab_senior; countRentab++ }
          const lastro = r.tp_lastro_principal || 'Não Classificado'
          if (!byLastro[lastro]) byLastro[lastro] = { count: 0, pl: 0, inadim_sum: 0, inadim_count: 0 }
          byLastro[lastro].count++
          byLastro[lastro].pl += r.vl_pl_total || 0
          if (r.taxa_inadimplencia != null && r.taxa_inadimplencia < 100) { byLastro[lastro].inadim_sum += r.taxa_inadimplencia; byLastro[lastro].inadim_count++ }
        }
        result = {
          date: dt, total_fidcs: total, total_pl: sumPl, total_carteira: sumCarteira,
          avg_subordinacao: countSubord > 0 ? parseFloat((sumSubord / countSubord).toFixed(2)) : null,
          avg_inadimplencia: countInadim > 0 ? parseFloat((sumInadim / countInadim).toFixed(4)) : null,
          avg_rentab_senior: countRentab > 0 ? parseFloat((sumRentab / countRentab).toFixed(4)) : null,
          by_lastro: Object.entries(byLastro).map(([lastro, v]) => ({
            lastro, count: v.count, pl: v.pl,
            pct_pl: sumPl > 0 ? parseFloat(((v.pl / sumPl) * 100).toFixed(2)) : 0,
            avg_inadim: v.inadim_count > 0 ? parseFloat((v.inadim_sum / v.inadim_count).toFixed(4)) : null,
          })).sort((a, b) => b.pl - a.pl),
          segments: Object.keys(byLastro).filter(k => k !== 'Não Classificado').sort(),
        }
        break
      }

      case 'fidc_search': {
        const q = url.searchParams.get('q')
        if (!q || q.length < 2) throw new Error('q parameter required (min 2 chars)')
        const limit = parseInt(url.searchParams.get('limit') || '20')
        const { data, error } = await supabase.from('hub_fundos_meta')
          .select('cnpj_fundo_classe, denom_social, slug, gestor_nome, vl_patrim_liq')
          .eq('classe_rcvm175', 'FIDC')
          .ilike('denom_social', `%${q}%`)
          .not('vl_patrim_liq', 'is', null)
          .order('vl_patrim_liq', { ascending: false })
          .limit(limit)
        if (error) throw error
        result = { query: q, results: data || [], count: data?.length || 0 }
        break
      }

      case 'fidc_segments': {
        const dt = await getLatestFidcDate(supabase)
        if (!dt) { result = { segments: [], date: null }; break }
        const { data } = await supabase.from('hub_fidc_mensal')
          .select('tp_lastro_principal, vl_pl_total')
          .eq('dt_comptc', dt)
          .not('tp_lastro_principal', 'is', null)
        const byLastro: Record<string, { count: number; pl: number }> = {}
        for (const r of (data || [])) {
          const lastro = r.tp_lastro_principal || 'Não Classificado'
          if (!byLastro[lastro]) byLastro[lastro] = { count: 0, pl: 0 }
          byLastro[lastro].count++
          byLastro[lastro].pl += r.vl_pl_total || 0
        }
        result = {
          date: dt,
          segments: Object.entries(byLastro).map(([lastro, v]) => ({ lastro, ...v })).sort((a, b) => b.pl - a.pl),
        }
        break
      }

      default:
        throw new Error(`Unknown endpoint: ${endpoint}. Available: fidc_monthly, fidc_detail, fidc_rankings, fidc_overview, fidc_search, fidc_segments`)
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err: any) {
    console.error('FIDC API Error:', err)
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
}

Deno.serve(handleRequest)
