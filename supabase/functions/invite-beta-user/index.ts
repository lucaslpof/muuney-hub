/**
 * invite-beta-user — Edge Function para convidar beta testers do Muuney Hub
 *
 * Fluxo:
 *   1. Recebe array de emails
 *   2. Para cada email:
 *      a. Registra em hub_beta_invites
 *      b. Cria user via auth.admin.createUser (se não existe)
 *      c. Insere tier=pro em hub_user_tiers
 *      d. Cria profile básico
 *      e. Gera magic link (recovery) para o user configurar senha
 *   3. Retorna status por email
 *
 * Auth: Bearer token do admin (verifica tier=admin no hub_user_tiers)
 * Deploy: supabase functions deploy invite-beta-user
 *
 * POST body: { emails: ["email1@test.com", "email2@test.com"] }
 * Optional:  { emails: [...], redirect_to: "https://muuney.app/reset-password" }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    // ── Auth: verify caller is admin ──
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");

    if (!jwt) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    // Anon client to verify the JWT belongs to an admin
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });

    const {
      data: { user: caller },
      error: authError,
    } = await anonClient.auth.getUser();
    if (authError || !caller) {
      return json({ error: "Unauthorized" }, 401);
    }

    // Check admin tier
    const { data: tierRow } = await anonClient
      .from("hub_user_tiers")
      .select("tier")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (tierRow?.tier !== "admin") {
      return json({ error: "Forbidden — admin only" }, 403);
    }

    // ── Parse body ──
    const body = await req.json();
    const emails: string[] = body.emails;
    const redirectTo =
      body.redirect_to || Deno.env.get("SITE_URL") + "/reset-password" ||
      "https://muuney.app/reset-password";

    if (!Array.isArray(emails) || emails.length === 0) {
      return json({ error: "emails must be a non-empty array" }, 400);
    }

    if (emails.length > 50) {
      return json({ error: "Max 50 emails per call" }, 400);
    }

    // ── Service role client (admin powers) ──
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const results: Array<{
      email: string;
      status: string;
      user_id?: string;
      error?: string;
    }> = [];

    for (const email of emails) {
      const trimmed = email.trim().toLowerCase();
      if (!trimmed || !trimmed.includes("@")) {
        results.push({ email: trimmed, status: "invalid_email" });
        continue;
      }

      try {
        // 1. Register invite
        await admin.from("hub_beta_invites").upsert(
          { email: trimmed, invited_at: new Date().toISOString() },
          { onConflict: "email" }
        );

        // 2. Check if user already exists (via SECURITY DEFINER RPC)
        const { data: existingRow } = await admin
          .rpc("get_user_by_email", { target_email: trimmed });

        let userId: string;

        if (existingRow && existingRow.length > 0) {
          // User exists — just ensure tier is pro
          userId = existingRow[0].id;
          results.push({
            email: trimmed,
            status: "already_exists_upgraded",
            user_id: userId,
          });
        } else {
          // 3. Create new user (no password → must use recovery)
          const { data: newUser, error: createErr } =
            await admin.auth.admin.createUser({
              email: trimmed,
              email_confirm: true,
              user_metadata: { invited_by: caller.email },
            });

          if (createErr) {
            results.push({
              email: trimmed,
              status: "create_failed",
              error: createErr.message,
            });
            continue;
          }

          userId = newUser.user.id;
          results.push({
            email: trimmed,
            status: "created",
            user_id: userId,
          });
        }

        // 4. Upsert tier = pro
        await admin.from("hub_user_tiers").upsert(
          {
            user_id: userId,
            tier: "pro",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

        // 5. Ensure profile exists
        await admin.from("profiles").upsert(
          {
            id: userId,
            email: trimmed,
            full_name: trimmed,
            role: "client",
          },
          { onConflict: "id" }
        );

        // 6. Mark invite as claimed
        await admin
          .from("hub_beta_invites")
          .update({
            claimed_at: new Date().toISOString(),
            claimed_by: userId,
          })
          .eq("email", trimmed);

        // 7. Send password recovery email (triggers Supabase SMTP)
        // Note: resetPasswordForEmail actually sends the email,
        // unlike generateLink which only returns the link data.
        const { error: resetErr } =
          await admin.auth.resetPasswordForEmail(trimmed, { redirectTo });

        if (resetErr) {
          // User created but email not sent — log the error
          const last = results[results.length - 1];
          last.status += "_no_email";
          last.error = resetErr.message;
        }
      } catch (err) {
        results.push({
          email: trimmed,
          status: "error",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return json({
      invited: results.filter((r) => r.status.startsWith("created")).length,
      upgraded: results.filter((r) => r.status.startsWith("already_exists"))
        .length,
      failed: results.filter(
        (r) => r.status === "error" || r.status === "create_failed"
      ).length,
      results,
    });
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : "Internal error" },
      500
    );
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
