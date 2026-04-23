// hub-alt-api — Standalone API for Ativos Alternativos module
// Mirrors hub-ofertas-api / hub-fii-api pattern.
//
// Endpoints (core V0):
//   alt_opportunities_list      — paginated + filterable catalog of alt opportunities (PRO-only)
//   alt_opportunity_detail      — single opportunity by slug + partner + materials
//   alt_opportunity_stats       — aggregate KPIs + breakdowns by classe/status/publico_alvo
//   alt_opportunity_filters     — distinct values for dropdowns
//   alt_suitability_get         — fetch user suitability ack
//   alt_suitability_ack         — POST to record suitability acceptance
//   alt_material_signed_url     — POST to generate signed URL for a gated material + log access
//   alt_interest_submit         — POST to submit interest form (creates hub_alt_interests row + log)
//   alt_my_interests            — list user's interests
//   alt_log_view                — POST to log view event (opportunity viewed)
//
// Data sources:
//   hub_alt_partners, hub_alt_opportunities, hub_alt_materials,
//   hub_alt_access_logs, hub_alt_interests, hub_alt_user_suitability
//
// Auth: verify_jwt=true (user JWT required for tier checks + RLS + logging)
//
// deploy: supabase functions deploy hub-alt-api

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const CURRENT_TERMS_VERSION = "2026-04-22";
const SIGNED_URL_TTL_SECONDS = 300; // 5 minutes

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function getSupabaseAdmin(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400, code?: string) {
  return jsonResponse({ error: { message, code } }, status);
}

function sanitizeSearch(raw: string): string {
  return raw.replace(/[%_(),.\\]/g, "").trim().slice(0, 100);
}

/** Extract + verify user from Authorization header */
async function getAuthUser(req: Request): Promise<{ id: string; email?: string } | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  return { id: data.user.id, email: data.user.email ?? undefined };
}

async function userIsPro(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("hub_user_tiers")
    .select("tier")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return false;
  return data.tier === "pro" || data.tier === "admin";
}

async function userHasSuitabilityAck(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("hub_alt_user_suitability")
    .select("terms_version")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return false;
  return data.terms_version === CURRENT_TERMS_VERSION;
}

async function logAccess(
  supabase: SupabaseClient,
  params: {
    userId: string;
    opportunityId?: string | null;
    materialId?: string | null;
    action: string;
    ip?: string | null;
    userAgent?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  try {
    await supabase.from("hub_alt_access_logs").insert({
      user_id: params.userId,
      opportunity_id: params.opportunityId ?? null,
      material_id: params.materialId ?? null,
      action: params.action,
      ip_address: params.ip ?? null,
      user_agent: params.userAgent ?? null,
      metadata: params.metadata ?? {},
    });
  } catch (e) {
    console.warn("[hub-alt-api] logAccess failed", e);
  }
}

function getClientIp(req: Request): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const endpoint = url.searchParams.get("endpoint") ?? "";
  const supabase = getSupabaseAdmin();

  // All endpoints require auth (beyond auth check, most need PRO tier)
  const user = await getAuthUser(req);
  if (!user) return errorResponse("Unauthorized", 401, "NO_AUTH");

  const isPro = await userIsPro(supabase, user.id);

  try {
    switch (endpoint) {
      /* ── alt_opportunities_list ── paginated + filterable catalog ── */
      case "alt_opportunities_list": {
        if (!isPro) return errorResponse("Acesso PRO necessário", 403, "TIER_REQUIRED");

        const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 200);
        const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
        const orderBy = url.searchParams.get("order_by") ?? "created_at";
        const order = url.searchParams.get("order") ?? "desc";

        const classe = url.searchParams.get("classe");
        const status = url.searchParams.get("status");
        const publicoAlvo = url.searchParams.get("publico_alvo");
        const perfilRisco = url.searchParams.get("perfil_risco");
        const setor = url.searchParams.get("setor");
        const geografia = url.searchParams.get("geografia");
        const search = url.searchParams.get("search");
        const minTicket = url.searchParams.get("min_ticket");
        const maxTicket = url.searchParams.get("max_ticket");
        const destaque = url.searchParams.get("destaque");

        let q = supabase
          .from("hub_alt_opportunities")
          .select(
            "id, slug, titulo, subtitulo, resumo, classe, subclasse, ticket_minimo, ticket_maximo, moeda, horizonte_meses, perfil_risco, publico_alvo, rentabilidade_alvo, volume_captacao, estrategia, setor, geografia, tags, status, data_abertura, data_encerramento, destaque, created_at, updated_at, partner:hub_alt_partners(id, slug, nome, tipo_gestora)",
            { count: "exact" },
          )
          .eq("publicado", true);

        if (classe) q = q.eq("classe", classe);
        if (status) q = q.eq("status", status);
        if (publicoAlvo) q = q.eq("publico_alvo", publicoAlvo);
        if (perfilRisco) q = q.eq("perfil_risco", perfilRisco);
        if (setor) q = q.ilike("setor", `%${sanitizeSearch(setor)}%`);
        if (geografia) q = q.ilike("geografia", `%${sanitizeSearch(geografia)}%`);
        if (minTicket) q = q.gte("ticket_minimo", parseFloat(minTicket));
        if (maxTicket) q = q.lte("ticket_minimo", parseFloat(maxTicket));
        if (destaque === "true") q = q.eq("destaque", true);
        if (search) {
          const s = sanitizeSearch(search);
          q = q.or(`titulo.ilike.%${s}%,resumo.ilike.%${s}%,subclasse.ilike.%${s}%`);
        }

        q = q.order(orderBy, { ascending: order === "asc" });
        q = q.range(offset, offset + limit - 1);

        const { data, error, count } = await q;
        if (error) throw error;

        return jsonResponse({
          data: data ?? [],
          count: count ?? 0,
          limit,
          offset,
        });
      }

      /* ── alt_opportunity_detail ── single opportunity by slug ── */
      case "alt_opportunity_detail": {
        if (!isPro) return errorResponse("Acesso PRO necessário", 403, "TIER_REQUIRED");

        const slug = url.searchParams.get("slug");
        if (!slug) return errorResponse("Missing slug", 400);

        const { data: opp, error: errOpp } = await supabase
          .from("hub_alt_opportunities")
          .select(
            "*, partner:hub_alt_partners(id, slug, nome, cnpj, descricao, website, tipo_gestora)",
          )
          .eq("slug", slug)
          .eq("publicado", true)
          .maybeSingle();

        if (errOpp) throw errOpp;
        if (!opp) return errorResponse("Oportunidade não encontrada", 404, "NOT_FOUND");

        const { data: materials, error: errMat } = await supabase
          .from("hub_alt_materials")
          .select("id, tipo, titulo, descricao, mime_type, file_size_bytes, tier_acesso, watermark_enabled, versao, ordem")
          .eq("opportunity_id", opp.id)
          .eq("ativo", true)
          .order("ordem", { ascending: true });
        if (errMat) throw errMat;

        // Check user's interest status for this opportunity (unlocks DD room materials)
        const { data: myInterests } = await supabase
          .from("hub_alt_interests")
          .select("id, status, cliente_primeiro_nome, created_at")
          .eq("user_id", user.id)
          .eq("opportunity_id", opp.id)
          .order("created_at", { ascending: false });

        const hasInterestRegistered = (myInterests?.length ?? 0) > 0;

        return jsonResponse({
          opportunity: opp,
          materials: materials ?? [],
          my_interests: myInterests ?? [],
          has_interest_registered: hasInterestRegistered,
          suitability_version: CURRENT_TERMS_VERSION,
        });
      }

      /* ── alt_opportunity_stats ── aggregate KPIs ── */
      case "alt_opportunity_stats": {
        if (!isPro) return errorResponse("Acesso PRO necessário", 403, "TIER_REQUIRED");

        const { data, error } = await supabase
          .from("hub_alt_opportunities")
          .select("classe, status, publico_alvo, perfil_risco, volume_captacao, ticket_minimo")
          .eq("publicado", true);
        if (error) throw error;
        const rows = data ?? [];

        const byClasse: Record<string, { count: number; volume: number }> = {};
        const byStatus: Record<string, number> = {};
        const byPublicoAlvo: Record<string, number> = {};
        const byPerfilRisco: Record<string, number> = {};
        let totalVolume = 0;
        let captando = 0;

        for (const r of rows) {
          const c = r.classe ?? "outro";
          const v = Number(r.volume_captacao ?? 0);
          if (!byClasse[c]) byClasse[c] = { count: 0, volume: 0 };
          byClasse[c].count += 1;
          byClasse[c].volume += v;
          totalVolume += v;

          const s = r.status ?? "outro";
          byStatus[s] = (byStatus[s] ?? 0) + 1;
          if (s === "captando") captando += 1;

          const pa = r.publico_alvo ?? "outro";
          byPublicoAlvo[pa] = (byPublicoAlvo[pa] ?? 0) + 1;

          if (r.perfil_risco) {
            byPerfilRisco[r.perfil_risco] = (byPerfilRisco[r.perfil_risco] ?? 0) + 1;
          }
        }

        return jsonResponse({
          total: rows.length,
          captando,
          total_volume_captacao: totalVolume,
          by_classe: Object.entries(byClasse)
            .map(([classe, v]) => ({ classe, count: v.count, volume: v.volume }))
            .sort((a, b) => b.count - a.count),
          by_status: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
          by_publico_alvo: Object.entries(byPublicoAlvo).map(([publico_alvo, count]) => ({
            publico_alvo,
            count,
          })),
          by_perfil_risco: Object.entries(byPerfilRisco).map(([perfil_risco, count]) => ({
            perfil_risco,
            count,
          })),
        });
      }

      /* ── alt_opportunity_filters ── distinct values ── */
      case "alt_opportunity_filters": {
        if (!isPro) return errorResponse("Acesso PRO necessário", 403, "TIER_REQUIRED");

        const { data, error } = await supabase
          .from("hub_alt_opportunities")
          .select("classe, status, publico_alvo, perfil_risco, setor, geografia, subclasse")
          .eq("publicado", true);
        if (error) throw error;
        const rows = data ?? [];

        const uniq = (key: keyof typeof rows[number]) =>
          [...new Set(rows.map((r) => r[key]).filter(Boolean) as string[])].sort();

        return jsonResponse({
          classes: uniq("classe"),
          statuses: uniq("status"),
          publico_alvo: uniq("publico_alvo"),
          perfil_risco: uniq("perfil_risco"),
          setores: uniq("setor"),
          geografias: uniq("geografia"),
          subclasses: uniq("subclasse"),
        });
      }

      /* ── alt_suitability_get ── current user ack state ── */
      case "alt_suitability_get": {
        const { data, error } = await supabase
          .from("hub_alt_user_suitability")
          .select("terms_version, acknowledged_at, declared_profile, declared_escritorio")
          .eq("user_id", user.id)
          .maybeSingle();
        if (error) throw error;
        const ack = data ?? null;
        const valid = ack?.terms_version === CURRENT_TERMS_VERSION;
        return jsonResponse({
          ack,
          current_version: CURRENT_TERMS_VERSION,
          valid,
        });
      }

      /* ── alt_my_interests ── user's submitted interests ── */
      case "alt_my_interests": {
        const { data, error } = await supabase
          .from("hub_alt_interests")
          .select(
            "id, opportunity_id, cliente_primeiro_nome, cliente_faixa_patrimonio, ticket_pretendido, status, created_at, updated_at, opportunity:hub_alt_opportunities(slug, titulo, classe, partner:hub_alt_partners(nome))",
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return jsonResponse({ data: data ?? [] });
      }

      /* ── POST endpoints ── */
      default: {
        if (req.method !== "POST") {
          return errorResponse(`Unknown endpoint: ${endpoint}`, 400, "UNKNOWN_ENDPOINT");
        }
      }
    }

    // POST endpoints below
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));

      switch (endpoint) {
        /* ── alt_suitability_ack ── record user acceptance ── */
        case "alt_suitability_ack": {
          const declared_profile = body.declared_profile as string | undefined;
          const declared_escritorio = body.declared_escritorio as string | undefined;

          if (!declared_profile || !["qualificado", "profissional", "varejo_ciente"].includes(declared_profile)) {
            return errorResponse("declared_profile inválido", 400);
          }

          const ip = getClientIp(req);
          const ua = req.headers.get("user-agent");

          const { error } = await supabase
            .from("hub_alt_user_suitability")
            .upsert({
              user_id: user.id,
              terms_version: CURRENT_TERMS_VERSION,
              acknowledged_at: new Date().toISOString(),
              ip_address: ip,
              user_agent: ua,
              declared_profile,
              declared_escritorio: declared_escritorio ?? null,
            });
          if (error) throw error;

          await logAccess(supabase, {
            userId: user.id,
            action: "suitability_ack",
            ip,
            userAgent: ua,
            metadata: { terms_version: CURRENT_TERMS_VERSION, declared_profile },
          });

          return jsonResponse({ ok: true, terms_version: CURRENT_TERMS_VERSION });
        }

        /* ── alt_log_view ── opportunity viewed ── */
        case "alt_log_view": {
          if (!isPro) return errorResponse("Acesso PRO necessário", 403, "TIER_REQUIRED");
          const opportunity_id = body.opportunity_id as string | undefined;
          if (!opportunity_id) return errorResponse("Missing opportunity_id", 400);

          await logAccess(supabase, {
            userId: user.id,
            opportunityId: opportunity_id,
            action: "view",
            ip: getClientIp(req),
            userAgent: req.headers.get("user-agent"),
          });

          return jsonResponse({ ok: true });
        }

        /* ── alt_material_signed_url ── gated download ── */
        case "alt_material_signed_url": {
          if (!isPro) return errorResponse("Acesso PRO necessário", 403, "TIER_REQUIRED");

          const material_id = body.material_id as string | undefined;
          if (!material_id) return errorResponse("Missing material_id", 400);

          const suitOk = await userHasSuitabilityAck(supabase, user.id);
          if (!suitOk) {
            return errorResponse(
              "Aceite do termo de suitability pendente",
              403,
              "SUITABILITY_REQUIRED",
            );
          }

          const { data: mat, error: errMat } = await supabase
            .from("hub_alt_materials")
            .select("id, opportunity_id, storage_path, tier_acesso, ativo, watermark_enabled, tipo, titulo")
            .eq("id", material_id)
            .eq("ativo", true)
            .maybeSingle();
          if (errMat) throw errMat;
          if (!mat) return errorResponse("Material não encontrado", 404, "NOT_FOUND");

          // Check tier_acesso gating
          if (mat.tier_acesso === "interesse_registrado") {
            const { data: interests } = await supabase
              .from("hub_alt_interests")
              .select("id")
              .eq("user_id", user.id)
              .eq("opportunity_id", mat.opportunity_id)
              .limit(1);
            if (!interests || interests.length === 0) {
              return errorResponse(
                "Registre interesse antes de acessar este material",
                403,
                "INTEREST_REQUIRED",
              );
            }
          }

          // Generate signed URL (watermark injection deferred to V1)
          const { data: signed, error: errSigned } = await supabase.storage
            .from("alt-materials")
            .createSignedUrl(mat.storage_path, SIGNED_URL_TTL_SECONDS);
          if (errSigned) throw errSigned;

          await logAccess(supabase, {
            userId: user.id,
            opportunityId: mat.opportunity_id,
            materialId: mat.id,
            action: "download",
            ip: getClientIp(req),
            userAgent: req.headers.get("user-agent"),
            metadata: { tipo: mat.tipo, watermark_enabled: mat.watermark_enabled },
          });

          return jsonResponse({
            signed_url: signed?.signedUrl,
            expires_in_seconds: SIGNED_URL_TTL_SECONDS,
            watermark_enabled: mat.watermark_enabled,
          });
        }

        /* ── alt_interest_submit ── AAI submits interest on behalf of client ── */
        case "alt_interest_submit": {
          if (!isPro) return errorResponse("Acesso PRO necessário", 403, "TIER_REQUIRED");

          const suitOk = await userHasSuitabilityAck(supabase, user.id);
          if (!suitOk) {
            return errorResponse(
              "Aceite do termo de suitability pendente",
              403,
              "SUITABILITY_REQUIRED",
            );
          }

          const required = [
            "opportunity_id",
            "aai_nome",
            "aai_email",
            "cliente_primeiro_nome",
            "cliente_faixa_patrimonio",
          ];
          for (const k of required) {
            if (!body[k]) return errorResponse(`Missing field: ${k}`, 400, "MISSING_FIELD");
          }

          const validFaixa = ["ate_1m", "1m_5m", "5m_10m", "10m_plus"];
          if (!validFaixa.includes(body.cliente_faixa_patrimonio)) {
            return errorResponse("cliente_faixa_patrimonio inválido", 400);
          }

          const { data: opp, error: errOpp } = await supabase
            .from("hub_alt_opportunities")
            .select("id, publicado, status, titulo")
            .eq("id", body.opportunity_id)
            .maybeSingle();
          if (errOpp) throw errOpp;
          if (!opp?.publicado) return errorResponse("Oportunidade indisponível", 404);
          if (opp.status === "encerrada") {
            return errorResponse("Oportunidade encerrada", 409, "OPPORTUNITY_CLOSED");
          }

          const insertRow = {
            user_id: user.id,
            opportunity_id: body.opportunity_id,
            aai_nome: String(body.aai_nome).slice(0, 200),
            aai_email: String(body.aai_email).slice(0, 200),
            aai_telefone: body.aai_telefone ? String(body.aai_telefone).slice(0, 50) : null,
            aai_escritorio: body.aai_escritorio ? String(body.aai_escritorio).slice(0, 200) : null,
            cliente_primeiro_nome: String(body.cliente_primeiro_nome).slice(0, 100),
            cliente_faixa_patrimonio: body.cliente_faixa_patrimonio,
            cliente_perfil_suitability: body.cliente_perfil_suitability ?? null,
            ticket_pretendido: body.ticket_pretendido ? Number(body.ticket_pretendido) : null,
            observacoes: body.observacoes ? String(body.observacoes).slice(0, 2000) : null,
            status: "novo",
          };

          const { data: inserted, error: errInsert } = await supabase
            .from("hub_alt_interests")
            .insert(insertRow)
            .select("id, created_at")
            .single();
          if (errInsert) {
            if ((errInsert as { code?: string }).code === "23505") {
              return errorResponse(
                "Interesse já registrado para este cliente nesta oportunidade",
                409,
                "DUPLICATE_INTEREST",
              );
            }
            throw errInsert;
          }

          await logAccess(supabase, {
            userId: user.id,
            opportunityId: body.opportunity_id,
            action: "interest_submitted",
            ip: getClientIp(req),
            userAgent: req.headers.get("user-agent"),
            metadata: {
              interest_id: inserted?.id,
              cliente_faixa_patrimonio: body.cliente_faixa_patrimonio,
              ticket_pretendido: body.ticket_pretendido ?? null,
            },
          });

          return jsonResponse({ ok: true, interest: inserted });
        }

        default:
          return errorResponse(`Unknown POST endpoint: ${endpoint}`, 400, "UNKNOWN_ENDPOINT");
      }
    }

    return errorResponse(`Unknown endpoint: ${endpoint}`, 400, "UNKNOWN_ENDPOINT");
  } catch (err) {
    console.error("[hub-alt-api] error:", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return errorResponse(message, 500, "INTERNAL");
  }
});
