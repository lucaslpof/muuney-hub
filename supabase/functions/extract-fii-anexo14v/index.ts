// extract-fii-anexo14v — SCAFFOLD (não-produtivo)
//
// Implementação produtiva diferida pós-launch (30/04/2026).
// Spec: SPEC_FII_LLM_EXTRACTION.md
//
// Fluxo (a implementar):
//  1. Validar admin tier
//  2. Discovery PDF Anexo 14-V via CVM RAD
//  3. Download PDF (max 10MB, 60s timeout)
//  4. Extract text (pdf-parse Deno-compat)
//  5. Anthropic Sonnet 4.5 com tool_use schema (24 campos + top 5 inquilinos)
//  6. Zod validate + sanity checks
//  7. Upsert hub_fii_trimestral + hub_fii_inquilinos
//  8. Audit log hub_fii_extraction_log
//
// Estado atual: retorna 501 Not Implemented com payload estruturado descrevendo
// o que falta. Esqueleto de auth + input validation já presente para reduzir
// trabalho na fase de implementação real.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ExtractionRequest {
  cnpj_fundo: string
  trimestre: string  // '1T26', '2T26', '3T26', '4T26', etc.
  dry_run?: boolean
}

const QUARTER_REGEX = /^[1-4]T\d{2}$/

function validateRequest(body: any): { ok: true; data: ExtractionRequest } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Body must be a JSON object' }
  const { cnpj_fundo, trimestre, dry_run } = body
  if (!cnpj_fundo || typeof cnpj_fundo !== 'string') return { ok: false, error: 'cnpj_fundo is required (string)' }
  if (!cnpj_fundo.match(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/)) {
    return { ok: false, error: 'cnpj_fundo must be formatted as XX.XXX.XXX/XXXX-XX' }
  }
  if (!trimestre || typeof trimestre !== 'string') return { ok: false, error: 'trimestre is required (string)' }
  if (!QUARTER_REGEX.test(trimestre)) return { ok: false, error: 'trimestre must match /^[1-4]T\\d{2}$/ (e.g., "1T26")' }
  return { ok: true, data: { cnpj_fundo, trimestre, dry_run: !!dry_run } }
}

async function getAdminUserId(supabase: any, authHeader: string | null): Promise<string | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  const token = authHeader.slice('Bearer '.length).trim()
  const { data: userResp, error: userErr } = await supabase.auth.getUser(token)
  if (userErr || !userResp?.user) return null
  const userId = userResp.user.id
  const { data: tier, error: tierErr } = await supabase
    .from('hub_user_tiers')
    .select('tier')
    .eq('user_id', userId)
    .maybeSingle()
  if (tierErr || !tier || tier.tier !== 'admin') return null
  return userId
}

// ========== TODO: PDF DISCOVERY ==========
// Investigar: https://www.rad.cvm.gov.br/ENET/frmConsultaExternaCVM.aspx
// Procurar endpoint JSON ou parsear HTML para listar Anexo 14-V por (cnpj, trimestre).
// Output: { pdfUrl: string, fundName: string, dataReferencia: string }
async function discoverAnexo14vUrl(_cnpjFundo: string, _trimestre: string): Promise<{ pdfUrl: string; fundName: string; dataReferencia: string } | null> {
  // STUB — retorna null até pipeline RAD ser implementado
  return null
}

// ========== TODO: PDF DOWNLOAD + PARSE ==========
// Lib options:
//  - https://deno.land/x/pdf_parse (Deno-native, simples)
//  - https://esm.sh/pdf-parse (npm port — pode ter issues com Deno worker)
//  - Subprocess Python via Edge Function (mais lento, fallback)
async function downloadAndExtractPdf(_url: string): Promise<{ text: string; pages: number; bytes: number } | null> {
  // STUB — retorna null até lib PDF ser escolhida e integrada
  return null
}

// ========== TODO: LLM EXTRACTION ==========
// Anthropic API call com tool_use forçado para schema JSON.
// System prompt: "Você é um extrator estruturado de relatórios FII brasileiros..."
// Schema completo: ver SPEC_FII_LLM_EXTRACTION.md §3.3
//
// Campos do schema:
//   - vacancia_fisica_pct, vacancia_financeira_pct, abl_total_m2, abl_locada_m2, abl_vaga_m2
//   - receita_locacao_trim, receita_financeira_trim, receita_outras_trim, receita_total_trim
//   - despesa_imobiliaria_trim, despesa_administrativa_trim, despesa_total_trim
//   - nr_imoveis_renda, nr_inquilinos_total
//   - top_5_inquilinos: [{ rank, nome, segmento, pct_receita, prazo_remanescente_meses }]
async function extractFieldsViaLlm(_text: string, _fundContext: { cnpj: string; nome: string; trimestre: string }): Promise<{ fields: Record<string, any>; tokens: { input: number; output: number }; cost: number } | null> {
  // STUB — retorna null até Anthropic API key + prompt estarem prontos
  return null
}

// ========== TODO: ZOD VALIDATE + SANITY CHECKS ==========
// Validar com Zod schema completo (mesmos 24 campos), depois aplicar:
//   - vacancia_fisica_pct ∈ [0, 100]
//   - vacancia_financeira_pct ∈ [0, 100]
//   - abl_locada_m2 + abl_vaga_m2 ≈ abl_total_m2 (tolerance 5%)
//   - sum(top_5.pct_receita) ≤ 100
//   - receita_locacao + receita_financeira + receita_outras ≈ receita_total (tolerance 2%)
function validateExtractedFields(_fields: Record<string, any>): { ok: boolean; errors: string[]; warnings: string[] } {
  // STUB — implementar quando schema estiver finalizado
  return { ok: false, errors: ['validateExtractedFields not implemented'], warnings: [] }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  // 1. Auth (admin only)
  const adminUserId = await getAdminUserId(supabase, req.headers.get('Authorization'))
  if (!adminUserId) {
    return new Response(JSON.stringify({ error: 'Unauthorized — admin tier required' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // 2. Input validation
  let body: any
  try { body = await req.json() } catch { body = null }
  const validation = validateRequest(body)
  if (!validation.ok) {
    return new Response(JSON.stringify({ error: validation.error }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // 3-7. Pipeline (a implementar)
  const { cnpj_fundo, trimestre, dry_run } = validation.data
  const startedAt = new Date().toISOString()

  return new Response(JSON.stringify({
    status: 'not_implemented',
    message: 'Edge Function scaffold — implementação produtiva diferida pós-launch (30/04/2026). Ver SPEC_FII_LLM_EXTRACTION.md',
    request: { cnpj_fundo, trimestre, dry_run, admin_user_id: adminUserId, started_at: startedAt },
    pipeline_status: {
      auth: 'ok',
      input_validation: 'ok',
      pdf_discovery: 'todo — investigar CVM RAD endpoint',
      pdf_download_parse: 'todo — escolher lib pdf-parse Deno-compat',
      llm_extract: 'todo — Anthropic API key + Sonnet 4.5 + tool_use schema',
      validation: 'todo — Zod schema + sanity checks',
      persist: 'todo — upsert hub_fii_trimestral + hub_fii_inquilinos',
      audit_log: 'todo — insert hub_fii_extraction_log',
    },
    next_steps: [
      'Aprovar SPEC com Lucas (revisão semana 1 maio)',
      'Aplicar migration F0 (3 tabelas: trimestral, inquilinos, extraction_log)',
      'F2-F4: pipeline produtivo',
      'F5-F8: frontend + backfill + cron + validation',
    ],
  }, null, 2), {
    status: 501,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
