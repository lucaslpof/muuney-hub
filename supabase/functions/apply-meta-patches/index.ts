// apply-meta-patches v1 — receives a JSON array of patches and upserts into hub_fundos_meta
// POST body: { "patches": [ { "cnpj_fundo_classe": "...", "benchmark": "...", ... }, ... ] }
// Only rows already in hub_fundos_meta are updated (no orphans).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Use POST' }), { status: 405, headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const patches: any[] = Array.isArray(body) ? body : (body.patches || [])
    if (!patches.length) {
      return new Response(JSON.stringify({ error: 'No patches' }), { status: 400, headers: corsHeaders })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Pre-fetch known CNPJs in this batch to avoid orphan inserts
    const batchCnpjs = patches.map(p => p.cnpj_fundo_classe).filter(Boolean)
    const { data: existing, error: selErr } = await supabase
      .from('hub_fundos_meta')
      .select('cnpj_fundo_classe')
      .in('cnpj_fundo_classe', batchCnpjs)
    if (selErr) throw selErr
    const known = new Set((existing || []).map((r: any) => r.cnpj_fundo_classe))

    const filtered = patches.filter(p => p.cnpj_fundo_classe && known.has(p.cnpj_fundo_classe))

    // Batch upsert
    let updated = 0
    let errors = 0
    for (let i = 0; i < filtered.length; i += 200) {
      const slice = filtered.slice(i, i + 200)
      const { error, count } = await supabase
        .from('hub_fundos_meta')
        .upsert(slice, { onConflict: 'cnpj_fundo_classe', ignoreDuplicates: false, count: 'exact' })
      if (error) {
        console.error('Batch err: ' + error.message)
        errors++
      } else {
        updated += count || slice.length
      }
    }

    return new Response(JSON.stringify({
      received: patches.length,
      in_meta: filtered.length,
      updated,
      errors,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders })
  }
})
