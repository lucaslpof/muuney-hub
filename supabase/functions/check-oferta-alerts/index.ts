/**
 * check-oferta-alerts — Daily digest de ofertas que enquadram nas regras do AAI
 *
 * Fluxo:
 *   1. Lista novas ofertas (last 24h por data_protocolo) em hub_ofertas_publicas.
 *   2. Lista regras ativas em hub_user_alert_rules.
 *   3. Para cada user, intersecta novas ofertas vs regras (match por
 *      tipo_ativo, segmento, modalidade, faixa de volume).
 *   4. Se houver matches: envia digest email via Resend; atualiza last_triggered.
 *   5. Logs em audit_logs (action='oferta_alerts_digest').
 *
 * Deploy:
 *   supabase functions deploy check-oferta-alerts --no-verify-jwt
 *
 * Cron:
 *   pg_cron job daily 08:00 BRT (= 11:00 UTC):
 *     SELECT cron.schedule('check_oferta_alerts_daily', '0 11 * * *',
 *       $$ SELECT net.http_post(
 *         url := 'https://yheopprbuimsunqfaqbp.supabase.co/functions/v1/check-oferta-alerts',
 *         headers := '{"Content-Type": "application/json"}'::jsonb,
 *         body := '{}'::jsonb
 *       ) $$);
 *
 * Secrets necessários:
 *   - RESEND_API_KEY=re_...
 *
 * Query params:
 *   ?dry_run=1     — testa sem enviar email nem atualizar last_triggered
 *   ?since=YYYY-MM-DD — override para data de corte (default: ontem)
 *   ?user_id=uuid  — limita a um user específico
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SENDER = "Muuney Hub <ofertas@muuney.com.br>";
const HUB_URL = "https://hub.muuney.com.br";

interface OfertaRow {
  id: number;
  protocolo: string;
  numero_oferta: string | null;
  emissor_nome: string | null;
  tipo_ativo: string | null;
  tipo_oferta: string;
  status: string;
  modalidade: string | null;
  valor_total: number | null;
  data_protocolo: string | null;
  data_inicio: string | null;
  coordenador_lider: string | null;
  rating: string | null;
  segmento: string | null;
}

interface AlertRuleRow {
  id: string;
  user_id: string;
  name: string;
  tipo_ativo: string[] | null;
  segmento: string[] | null;
  modalidade: string[] | null;
  min_volume: number | null;
  max_volume: number | null;
  rating_min: string | null;
  prazo_min_meses: number | null;
  prazo_max_meses: number | null;
  ativa: boolean;
  last_triggered: string | null;
}

interface UserInfo {
  id: string;
  email: string;
}

/** Match a single oferta against a single rule (V2: no rating/prazo filtering yet). */
function ofertaMatchesRule(oferta: OfertaRow, rule: AlertRuleRow): boolean {
  // tipo_ativo: NULL = todos
  if (rule.tipo_ativo && rule.tipo_ativo.length > 0) {
    if (!oferta.tipo_ativo || !rule.tipo_ativo.includes(oferta.tipo_ativo)) return false;
  }
  // segmento
  if (rule.segmento && rule.segmento.length > 0) {
    if (!oferta.segmento || !rule.segmento.includes(oferta.segmento)) return false;
  }
  // modalidade
  if (rule.modalidade && rule.modalidade.length > 0) {
    if (!oferta.modalidade || !rule.modalidade.includes(oferta.modalidade)) return false;
  }
  // volume range
  if (rule.min_volume !== null && (oferta.valor_total ?? 0) < rule.min_volume) return false;
  if (rule.max_volume !== null && (oferta.valor_total ?? 0) > rule.max_volume) return false;
  // rating_min, prazo: deferidos para V3 (requerem hub_oferta_detalhes preenchido via LLM)
  return true;
}

function formatBRL(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1e9) return `R$ ${(n / 1e9).toFixed(2).replace(".", ",")} bi`;
  if (n >= 1e6) return `R$ ${(n / 1e6).toFixed(1).replace(".", ",")} mi`;
  if (n >= 1e3) return `R$ ${(n / 1e3).toFixed(0)} mil`;
  return `R$ ${n.toFixed(0)}`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));
}

/** Tech-Noir HTML email digest. */
function buildDigestHtml(
  ofertas: Array<{ oferta: OfertaRow; matchedRules: AlertRuleRow[] }>,
  userEmail: string,
): string {
  const rows = ofertas
    .map(({ oferta: o, matchedRules }) => {
      const url = `${HUB_URL}/ofertas/${encodeURIComponent(o.protocolo)}`;
      const tipo = escapeHtml(o.tipo_ativo ?? "—");
      const emissor = escapeHtml(o.emissor_nome ?? "Emissor não identificado");
      const volume = formatBRL(o.valor_total);
      const seg = o.segmento ? `<span style="color:#71717a">· ${escapeHtml(o.segmento)}</span>` : "";
      const ratingChip = o.rating
        ? `<span style="display:inline-block;padding:1px 6px;background:#0e7490;color:#ecfeff;border-radius:3px;font-size:10px;margin-left:6px">${escapeHtml(o.rating)}</span>`
        : "";
      const ruleNames = matchedRules.map((r) => escapeHtml(r.name)).join(", ");

      return `
        <tr>
          <td style="padding:12px 14px;border-bottom:1px solid #27272a;">
            <div style="font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;font-family:ui-monospace,Menlo,Consolas,monospace">${tipo}${ratingChip}</div>
            <a href="${url}" style="color:#10b981;font-weight:600;font-size:14px;text-decoration:none;display:block;margin-top:3px">${emissor}</a>
            <div style="font-size:11px;color:#a1a1aa;margin-top:4px;font-family:ui-monospace,Menlo,Consolas,monospace">
              <strong style="color:#10b981">${volume}</strong> ${seg}
              ${o.coordenador_lider ? `<br/><span style="color:#71717a">Coord.: ${escapeHtml(o.coordenador_lider)}</span>` : ""}
            </div>
            <div style="font-size:10px;color:#52525b;margin-top:6px;font-family:ui-monospace,Menlo,Consolas,monospace">
              Disparada por: <em>${ruleNames}</em>
            </div>
          </td>
        </tr>`;
    })
    .join("");

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Digest de ofertas — muuney.hub</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;color:#e4e4e7;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#0a0a0a">
    <tr><td style="padding:28px 24px 16px">
      <div style="font-size:11px;color:#52525b;letter-spacing:0.1em;text-transform:uppercase;font-family:ui-monospace,Menlo,Consolas,monospace">muuney.hub · digest diário</div>
      <h1 style="font-size:20px;color:#fafafa;margin:8px 0 4px">${ofertas.length} oferta${ofertas.length > 1 ? "s" : ""} bate${ofertas.length > 1 ? "m" : ""} com seus alertas</h1>
      <p style="font-size:13px;color:#a1a1aa;margin:0">Novos registros CVM nas últimas 24h que enquadraram nas regras que você configurou.</p>
    </td></tr>
    <tr><td>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 24px;border-top:1px solid #27272a;border-bottom:1px solid #27272a">
        ${rows}
      </table>
    </td></tr>
    <tr><td style="padding:20px 24px;font-size:11px;color:#52525b;font-family:ui-monospace,Menlo,Consolas,monospace">
      <a href="${HUB_URL}/ofertas/alertas" style="color:#10b981;text-decoration:none">Ajustar regras</a>
      &nbsp;·&nbsp;
      <a href="${HUB_URL}/ofertas/watchlist" style="color:#10b981;text-decoration:none">Watchlist</a>
      &nbsp;·&nbsp;
      <a href="${HUB_URL}/configuracoes" style="color:#71717a;text-decoration:none">Cancelar alertas</a>
    </td></tr>
    <tr><td style="padding:0 24px 24px;font-size:9px;color:#3f3f46;line-height:1.5;font-family:ui-monospace,Menlo,Consolas,monospace">
      Enviado para ${escapeHtml(userEmail)}. Este email é gerado automaticamente — não é uma recomendação de investimento.
      Dados de oferta de fonte CVM (RCVM 160/476/400). muuney.hub é uma plataforma de informação operada pela FLUXX CASH TECNOLOGIA LTDA.
    </td></tr>
  </table>
</body></html>`;
}

/** Get user emails by user_id list via auth.users (admin API). */
async function getUserEmails(supabase: SupabaseClient, userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (userIds.length === 0) return map;

  // listUsers admin API — page through if needed
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data.users ?? [];
    for (const u of users) {
      if (u.email && userIds.includes(u.id)) map.set(u.id, u.email);
    }
    if (users.length < 200) break;
    page += 1;
    if (page > 50) break; // safety cap
  }
  return map;
}

async function sendResend(to: string, subject: string, html: string): Promise<{ ok: boolean; status: number; body: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: SENDER, to: [to], subject, html }),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry_run") === "1";
  const userIdFilter = url.searchParams.get("user_id");
  const sinceParam = url.searchParams.get("since");

  // Default since = 24h ago (UTC)
  const since = sinceParam
    ? new Date(`${sinceParam}T00:00:00Z`)
    : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sinceISO = since.toISOString().slice(0, 10); // YYYY-MM-DD

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    /* ── 1. Pull novas ofertas ── */
    const { data: ofertasRaw, error: oErr } = await supabase
      .from("hub_ofertas_publicas")
      .select("id, protocolo, numero_oferta, emissor_nome, tipo_ativo, tipo_oferta, status, modalidade, valor_total, data_protocolo, data_inicio, coordenador_lider, rating, segmento")
      .gte("data_protocolo", sinceISO)
      .in("status", ["em_analise", "concedido", "em_distribuicao"])
      .limit(500);
    if (oErr) throw oErr;
    const ofertas = (ofertasRaw as OfertaRow[]) ?? [];

    /* ── 2. Pull regras ativas ── */
    let rulesQ = supabase
      .from("hub_user_alert_rules")
      .select("id, user_id, name, tipo_ativo, segmento, modalidade, min_volume, max_volume, rating_min, prazo_min_meses, prazo_max_meses, ativa, last_triggered")
      .eq("ativa", true);
    if (userIdFilter) rulesQ = rulesQ.eq("user_id", userIdFilter);
    const { data: rulesRaw, error: rErr } = await rulesQ;
    if (rErr) throw rErr;
    const rules = (rulesRaw as AlertRuleRow[]) ?? [];

    /* ── 3. Match per user ── */
    type UserHit = { oferta: OfertaRow; matchedRules: AlertRuleRow[] };
    const matchesByUser = new Map<string, UserHit[]>();
    for (const oferta of ofertas) {
      // Group matched rules per oferta+user
      const matchedPerUser = new Map<string, AlertRuleRow[]>();
      for (const rule of rules) {
        if (ofertaMatchesRule(oferta, rule)) {
          const arr = matchedPerUser.get(rule.user_id) ?? [];
          arr.push(rule);
          matchedPerUser.set(rule.user_id, arr);
        }
      }
      for (const [userId, matchedRules] of matchedPerUser.entries()) {
        const arr = matchesByUser.get(userId) ?? [];
        arr.push({ oferta, matchedRules });
        matchesByUser.set(userId, arr);
      }
    }

    if (matchesByUser.size === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          since: sinceISO,
          ofertas_scanned: ofertas.length,
          rules_active: rules.length,
          users_notified: 0,
          dry_run: dryRun,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    /* ── 4. Lookup user emails ── */
    const userIds = Array.from(matchesByUser.keys());
    const emailMap = await getUserEmails(supabase, userIds);

    /* ── 5. Send digests ── */
    const results: Array<{ user_id: string; email: string; matches: number; status: string }> = [];
    const triggeredRuleIds = new Set<string>();

    for (const [userId, hits] of matchesByUser.entries()) {
      const email = emailMap.get(userId);
      if (!email) {
        results.push({ user_id: userId, email: "(missing)", matches: hits.length, status: "skipped_no_email" });
        continue;
      }

      const html = buildDigestHtml(hits, email);
      const subject = `${hits.length} oferta${hits.length > 1 ? "s" : ""} bate${hits.length > 1 ? "m" : ""} com seus alertas — muuney.hub`;

      if (dryRun) {
        results.push({ user_id: userId, email, matches: hits.length, status: "dry_run" });
        continue;
      }

      const sendRes = await sendResend(email, subject, html);
      if (!sendRes.ok) {
        console.error("Resend error", { user: userId, status: sendRes.status, body: sendRes.body });
        results.push({ user_id: userId, email, matches: hits.length, status: `resend_error_${sendRes.status}` });
        continue;
      }

      results.push({ user_id: userId, email, matches: hits.length, status: "sent" });
      for (const hit of hits) {
        for (const rule of hit.matchedRules) triggeredRuleIds.add(rule.id);
      }
    }

    /* ── 6. Update last_triggered ── */
    if (!dryRun && triggeredRuleIds.size > 0) {
      await supabase
        .from("hub_user_alert_rules")
        .update({ last_triggered: new Date().toISOString() })
        .in("id", Array.from(triggeredRuleIds));
    }

    /* ── 7. Audit log ── */
    if (!dryRun) {
      try {
        await supabase.from("audit_logs").insert({
          action: "oferta_alerts_digest",
          category: "alerts",
          severity: "info",
          details: {
            since: sinceISO,
            ofertas_scanned: ofertas.length,
            rules_active: rules.length,
            users_notified: results.filter((r) => r.status === "sent").length,
            results,
          },
        });
      } catch (logErr) {
        console.warn("Audit log insert failed (non-fatal)", logErr);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        since: sinceISO,
        ofertas_scanned: ofertas.length,
        rules_active: rules.length,
        users_notified: results.filter((r) => r.status === "sent").length,
        results,
        dry_run: dryRun,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("check-oferta-alerts error", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
