/**
 * detect-fund-insights — Muuney.hub Módulo Fundos V3 Fase 4
 *
 * Automated change detection for Brazilian investment funds.
 * Runs daily via pg_cron → net/http invocation.
 *
 * Detection types:
 * 1. gestor_change    — Fund changed its manager
 * 2. pl_drop          — PL dropped >20% in 30 days
 * 3. drawdown         — Drawdown >10% from peak
 * 4. taxa_change      — Admin or performance fee changed
 * 5. flow_anomaly     — Captação/resgate > 2σ from mean
 * 6. new_fund         — New fund registered this week
 * 7. cancelled_fund   — Fund status changed to CANCELADA
 * 8. cotistas_drop    — Lost >30% cotistas in 30 days
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

interface InsightRow {
  cnpj_fundo: string
  cnpj_fundo_classe: string | null
  denom_social: string | null
  slug: string | null
  classe_rcvm175: string | null
  tipo: string
  severidade: 'info' | 'warning' | 'critical'
  titulo: string
  detalhe: string | null
  valor_anterior: string | null
  valor_novo: string | null
  referencia_data: string | null
  detectado_em: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = getSupabase()
  const url = new URL(req.url)
  const dryRun = url.searchParams.get('dry_run') === 'true'
  const detectionType = url.searchParams.get('type') || 'all'
  const now = new Date().toISOString()
  const insights: InsightRow[] = []
  const errors: string[] = []

  try {
    // ─── 1. PL Drop Detection (>20% in 30 days) ───
    if (detectionType === 'all' || detectionType === 'pl_drop') {
      try {
        const { data: plDrops } = await supabase.rpc('detect_pl_drops', { threshold_pct: 20, lookback_days: 30 })
        if (plDrops) {
          for (const row of plDrops) {
            insights.push({
              cnpj_fundo: row.cnpj_fundo,
              cnpj_fundo_classe: row.cnpj_fundo_classe,
              denom_social: row.denom_social,
              slug: row.slug,
              classe_rcvm175: row.classe_rcvm175,
              tipo: 'pl_drop',
              severidade: row.drop_pct > 50 ? 'critical' : 'warning',
              titulo: `PL caiu ${Math.abs(row.drop_pct).toFixed(1)}% em 30 dias`,
              detalhe: `${row.denom_social || row.cnpj_fundo}: PL de R$ ${formatPL(row.pl_anterior)} → R$ ${formatPL(row.pl_atual)}`,
              valor_anterior: String(row.pl_anterior),
              valor_novo: String(row.pl_atual),
              referencia_data: row.dt_atual,
              detectado_em: now,
            })
          }
        }
      } catch (e) { errors.push(`pl_drop: ${e instanceof Error ? e.message : String(e)}`) }
    }

    // ─── 2. Drawdown Detection (>10% from peak) ───
    if (detectionType === 'all' || detectionType === 'drawdown') {
      try {
        const { data: drawdowns } = await supabase.rpc('detect_drawdowns', { threshold_pct: 10, lookback_days: 90 })
        if (drawdowns) {
          for (const row of drawdowns) {
            insights.push({
              cnpj_fundo: row.cnpj_fundo,
              cnpj_fundo_classe: row.cnpj_fundo_classe,
              denom_social: row.denom_social,
              slug: row.slug,
              classe_rcvm175: row.classe_rcvm175,
              tipo: 'drawdown',
              severidade: row.drawdown_pct > 20 ? 'critical' : 'warning',
              titulo: `Drawdown de ${Math.abs(row.drawdown_pct).toFixed(1)}% (pico → vale)`,
              detalhe: `Cota: ${row.vl_peak?.toFixed(6)} → ${row.vl_current?.toFixed(6)}`,
              valor_anterior: String(row.vl_peak),
              valor_novo: String(row.vl_current),
              referencia_data: row.dt_current,
              detectado_em: now,
            })
          }
        }
      } catch (e) { errors.push(`drawdown: ${e instanceof Error ? e.message : String(e)}`) }
    }

    // ─── 3. Flow Anomaly (captação/resgate > 2σ) ───
    if (detectionType === 'all' || detectionType === 'flow_anomaly') {
      try {
        const { data: flows } = await supabase.rpc('detect_flow_anomalies', { sigma_threshold: 2.0, lookback_days: 90 })
        if (flows) {
          for (const row of flows) {
            const isResgate = row.captac_dia < 0 || row.resg_dia > row.captac_dia
            insights.push({
              cnpj_fundo: row.cnpj_fundo,
              cnpj_fundo_classe: row.cnpj_fundo_classe,
              denom_social: row.denom_social,
              slug: row.slug,
              classe_rcvm175: row.classe_rcvm175,
              tipo: 'flow_anomaly',
              severidade: Math.abs(row.z_score) > 3 ? 'critical' : 'warning',
              titulo: isResgate
                ? `Resgate atípico: ${Math.abs(row.z_score).toFixed(1)}σ acima da média`
                : `Captação atípica: ${Math.abs(row.z_score).toFixed(1)}σ acima da média`,
              detalhe: `Captação: R$ ${formatPL(row.captac_dia)} | Resgate: R$ ${formatPL(row.resg_dia)} | z-score: ${row.z_score.toFixed(2)}`,
              valor_anterior: String(row.mean_flow),
              valor_novo: String(row.captac_dia - row.resg_dia),
              referencia_data: row.dt_comptc,
              detectado_em: now,
            })
          }
        }
      } catch (e) { errors.push(`flow_anomaly: ${e instanceof Error ? e.message : String(e)}`) }
    }

    // ─── 4. Cotistas Drop (>30% in 30 days) ───
    if (detectionType === 'all' || detectionType === 'cotistas_drop') {
      try {
        const { data: cotDrops } = await supabase.rpc('detect_cotistas_drops', { threshold_pct: 30, lookback_days: 30 })
        if (cotDrops) {
          for (const row of cotDrops) {
            insights.push({
              cnpj_fundo: row.cnpj_fundo,
              cnpj_fundo_classe: row.cnpj_fundo_classe,
              denom_social: row.denom_social,
              slug: row.slug,
              classe_rcvm175: row.classe_rcvm175,
              tipo: 'cotistas_drop',
              severidade: row.drop_pct > 50 ? 'critical' : 'warning',
              titulo: `Cotistas caíram ${Math.abs(row.drop_pct).toFixed(0)}% em 30 dias`,
              detalhe: `${row.cotistas_anterior} → ${row.cotistas_atual} cotistas`,
              valor_anterior: String(row.cotistas_anterior),
              valor_novo: String(row.cotistas_atual),
              referencia_data: row.dt_atual,
              detectado_em: now,
            })
          }
        }
      } catch (e) { errors.push(`cotistas_drop: ${e instanceof Error ? e.message : String(e)}`) }
    }

    // ─── 5. New Funds (registered in last 7 days) ───
    if (detectionType === 'all' || detectionType === 'new_fund') {
      try {
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        const { data: newFunds } = await supabase.from('hub_fundos_meta')
          .select('cnpj_fundo, cnpj_fundo_classe, denom_social, slug, classe_rcvm175, dt_reg')
          .gte('dt_reg', sevenDaysAgo.toISOString().split('T')[0])
          .order('dt_reg', { ascending: false })
          .limit(100)

        if (newFunds) {
          for (const f of newFunds) {
            insights.push({
              cnpj_fundo: f.cnpj_fundo,
              cnpj_fundo_classe: f.cnpj_fundo_classe,
              denom_social: f.denom_social,
              slug: f.slug,
              classe_rcvm175: f.classe_rcvm175,
              tipo: 'new_fund',
              severidade: 'info',
              titulo: `Novo fundo registrado na CVM`,
              detalhe: f.denom_social || f.cnpj_fundo_classe || f.cnpj_fundo,
              valor_anterior: null,
              valor_novo: null,
              referencia_data: f.dt_reg,
              detectado_em: now,
            })
          }
        }
      } catch (e) { errors.push(`new_fund: ${e instanceof Error ? e.message : String(e)}`) }
    }

    // ─── 6. Taxa Change Detection ───
    if (detectionType === 'all' || detectionType === 'taxa_change') {
      try {
        const { data: taxaChanges } = await supabase.rpc('detect_taxa_changes')
        if (taxaChanges) {
          for (const row of taxaChanges) {
            insights.push({
              cnpj_fundo: row.cnpj_fundo,
              cnpj_fundo_classe: row.cnpj_fundo_classe,
              denom_social: row.denom_social,
              slug: row.slug,
              classe_rcvm175: row.classe_rcvm175,
              tipo: 'taxa_change',
              severidade: 'warning',
              titulo: `Taxa de administração alterada: ${row.taxa_anterior?.toFixed(2)}% → ${row.taxa_nova?.toFixed(2)}%`,
              detalhe: `Variação: ${row.taxa_nova > row.taxa_anterior ? '+' : ''}${(row.taxa_nova - row.taxa_anterior).toFixed(2)}pp`,
              valor_anterior: String(row.taxa_anterior),
              valor_novo: String(row.taxa_nova),
              referencia_data: row.dt_detectado,
              detectado_em: now,
            })
          }
        }
      } catch (e) { errors.push(`taxa_change: ${e instanceof Error ? e.message : String(e)}`) }
    }

    // ─── Deduplicate: skip insights already detected today ───
    const today = now.split('T')[0]
    const { data: existing } = await supabase.from('hub_fundos_insights')
      .select('cnpj_fundo, tipo')
      .gte('detectado_em', today + 'T00:00:00Z')

    const existingSet = new Set((existing || []).map((e: any) => `${e.cnpj_fundo}:${e.tipo}`))
    const newInsights = insights.filter(i => !existingSet.has(`${i.cnpj_fundo}:${i.tipo}`))

    // ─── Insert new insights ───
    let inserted = 0
    if (!dryRun && newInsights.length > 0) {
      // Insert in batches of 100
      for (let i = 0; i < newInsights.length; i += 100) {
        const batch = newInsights.slice(i, i + 100)
        const { error } = await supabase.from('hub_fundos_insights').insert(batch)
        if (error) throw error
        inserted += batch.length
      }
    }

    // ─── Log ingestion ───
    await supabase.from('hub_cvm_ingestion_log').insert({
      source: 'detect_fund_insights',
      reference_date: today,
      records_inserted: inserted,
      records_updated: 0,
      status: errors.length > 0 ? 'partial' : 'success',
      error_message: errors.length > 0 ? errors.join('; ') : null,
    })

    const result = {
      detected: insights.length,
      new: newInsights.length,
      duplicates_skipped: insights.length - newInsights.length,
      inserted: dryRun ? 0 : inserted,
      dry_run: dryRun,
      errors: errors.length > 0 ? errors : undefined,
      by_type: groupBy(newInsights, 'tipo'),
      by_severity: groupBy(newInsights, 'severidade'),
      sample: newInsights.slice(0, 5),
    }

    return new Response(JSON.stringify(result, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: errorMsg, partial_errors: errors }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// ─── Helpers ───

function formatPL(val: number | null | undefined): string {
  if (val == null) return '—'
  const abs = Math.abs(val)
  if (abs >= 1e9) return (val / 1e9).toFixed(2) + 'B'
  if (abs >= 1e6) return (val / 1e6).toFixed(1) + 'M'
  if (abs >= 1e3) return (val / 1e3).toFixed(0) + 'k'
  return val.toFixed(0)
}

function groupBy(arr: any[], key: string): Record<string, number> {
  const result: Record<string, number> = {}
  for (const item of arr) {
    result[item[key]] = (result[item[key]] || 0) + 1
  }
  return result
}
