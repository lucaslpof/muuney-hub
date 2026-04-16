/**
 * send-email-hook — Supabase Auth Send Email Hook
 *
 * Substitui o SMTP embutido do GoTrue por chamada HTTP direta ao Resend.
 * Isso elimina o timeout de 10s do SMTP e garante entrega confiável.
 *
 * Configuração:
 *   1. Deploy: supabase functions deploy send-email-hook --no-verify-jwt
 *   2. Secrets no Supabase (Settings → Edge Functions):
 *      - RESEND_API_KEY=re_...
 *      - SEND_EMAIL_HOOK_SECRET=v1,whsec_... (gerado pelo Supabase ao configurar o hook)
 *   3. Supabase Dashboard → Authentication → Hooks → Send Email:
 *      - Type: HTTPS
 *      - URL: https://yheopprbuimsunqfaqbp.supabase.co/functions/v1/send-email-hook
 *      - HTTP Timeout: 5000ms
 *      - Copiar o Hook Secret → setar como SEND_EMAIL_HOOK_SECRET
 *
 * O hook recebe payloads assinados com StandardWebhooks.
 * email_action_type: signup | recovery | invite | magiclink | email_change | reauthentication
 */

import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const RAW_HOOK_SECRET = Deno.env.get("SEND_EMAIL_HOOK_SECRET")!;

// Supabase stores the secret as "v1,whsec_<base64>" but standardwebhooks
// expects just the "whsec_<base64>" part. Strip the version prefix.
const HOOK_SECRET = RAW_HOOK_SECRET.startsWith("v1,")
  ? RAW_HOOK_SECRET.substring(3)
  : RAW_HOOK_SECRET;

const SENDER = "Muuney Hub <noreply@muuney.com.br>";
const HUB_URL = "https://hub.muuney.com.br";

// ── Email templates ──

interface EmailData {
  token: string;
  token_hash: string;
  redirect_to: string;
  email_action_type: string;
  site_url: string;
  token_new?: string;
  token_hash_new?: string;
}

interface HookPayload {
  user: {
    id: string;
    email: string;
    user_metadata?: Record<string, unknown>;
  };
  email_data: EmailData;
}

function buildConfirmationUrl(data: EmailData): string {
  // IMPORTANT: We link DIRECTLY to the app (bypassing Supabase /auth/v1/verify)
  // because /auth/v1/verify requires the apikey header/query param, which browsers
  // don't send when following an email link. The app page calls
  // supabase.auth.verifyOtp({ token_hash, type }) using the SDK, which handles
  // apikey injection automatically.
  const type = mapActionToType(data.email_action_type);
  const redirectTo = data.redirect_to || resolveDefaultRedirect(type);
  const url = new URL(redirectTo);
  url.searchParams.set("token_hash", data.token_hash);
  url.searchParams.set("type", type);
  return url.toString();
}

function resolveDefaultRedirect(type: string): string {
  switch (type) {
    case "recovery":
    case "invite":
      return `${HUB_URL}/reset-password`;
    case "signup":
    case "email_change":
    case "magiclink":
    case "reauthentication":
    default:
      return `${HUB_URL}/dashboard`;
  }
}

function mapActionToType(action: string): string {
  switch (action) {
    case "signup": return "signup";
    case "recovery": return "recovery";
    case "invite": return "invite";
    case "magiclink": return "magiclink";
    case "email_change": return "email_change";
    case "reauthentication": return "reauthentication";
    default: return action;
  }
}

function buildEmail(user: HookPayload["user"], data: EmailData): { subject: string; html: string } {
  const confirmUrl = buildConfirmationUrl(data);
  const firstName = (user.user_metadata?.full_name as string)?.split(" ")[0] || "Olá";

  const baseStyle = `
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background-color: #0a0a0a;
    color: #e4e4e7;
  `;

  const buttonStyle = `
    display: inline-block;
    padding: 14px 32px;
    background-color: #0B6C3E;
    color: #ffffff;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 16px;
  `;

  const wrapHtml = (body: string) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="${baseStyle} margin: 0; padding: 0;">
  <div style="max-width: 560px; margin: 0 auto; padding: 40px 24px;">
    <div style="text-align: center; margin-bottom: 32px;">
      <h1 style="color: #ffffff; font-size: 24px; margin: 0;">
        muuney<span style="color: #0B6C3E;">.hub</span>
      </h1>
    </div>
    <div style="background-color: #111111; border: 1px solid #27272a; border-radius: 12px; padding: 32px;">
      ${body}
    </div>
    <div style="text-align: center; margin-top: 24px;">
      <p style="color: #52525b; font-size: 12px; margin: 0;">
        © ${new Date().getFullYear()} Muuney · Seu dinheiro, claro. Sem esforço.
      </p>
    </div>
  </div>
</body>
</html>`;

  switch (data.email_action_type) {
    case "recovery":
      return {
        subject: "Redefina sua senha — Muuney Hub",
        html: wrapHtml(`
          <h2 style="color: #ffffff; font-size: 20px; margin: 0 0 16px 0;">${firstName},</h2>
          <p style="color: #a1a1aa; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
            Recebemos um pedido para redefinir sua senha no Muuney Hub.
            Clique no botão abaixo para criar uma nova senha:
          </p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${confirmUrl}" style="${buttonStyle}">Redefinir minha senha</a>
          </div>
          <p style="color: #71717a; font-size: 13px; line-height: 1.5; margin: 16px 0 0 0;">
            Se você não solicitou essa alteração, ignore este email.
            O link expira em 1 hora.
          </p>
        `),
      };

    case "invite":
      return {
        subject: "Você foi convidado para o Muuney Hub",
        html: wrapHtml(`
          <h2 style="color: #ffffff; font-size: 20px; margin: 0 0 16px 0;">${firstName},</h2>
          <p style="color: #a1a1aa; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
            Você foi convidado para acessar o <strong style="color: #ffffff;">Muuney Hub</strong> —
            nossa plataforma de inteligência de mercado para profissionais de investimento.
          </p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${confirmUrl}" style="${buttonStyle}">Aceitar convite</a>
          </div>
          <p style="color: #71717a; font-size: 13px; line-height: 1.5; margin: 16px 0 0 0;">
            Após clicar, você será direcionado para configurar sua senha de acesso.
          </p>
        `),
      };

    case "signup":
      return {
        subject: "Confirme seu email — Muuney Hub",
        html: wrapHtml(`
          <h2 style="color: #ffffff; font-size: 20px; margin: 0 0 16px 0;">Bem-vindo ao Muuney Hub!</h2>
          <p style="color: #a1a1aa; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
            Confirme seu email para ativar sua conta:
          </p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${confirmUrl}" style="${buttonStyle}">Confirmar email</a>
          </div>
        `),
      };

    case "magiclink":
      return {
        subject: "Seu link de acesso — Muuney Hub",
        html: wrapHtml(`
          <h2 style="color: #ffffff; font-size: 20px; margin: 0 0 16px 0;">${firstName},</h2>
          <p style="color: #a1a1aa; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
            Clique no botão abaixo para acessar o Muuney Hub:
          </p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${confirmUrl}" style="${buttonStyle}">Acessar o Hub</a>
          </div>
          <p style="color: #71717a; font-size: 13px; line-height: 1.5; margin: 16px 0 0 0;">
            Este link expira em 1 hora. Se você não solicitou, ignore este email.
          </p>
        `),
      };

    case "email_change":
      return {
        subject: "Confirme a alteração de email — Muuney Hub",
        html: wrapHtml(`
          <h2 style="color: #ffffff; font-size: 20px; margin: 0 0 16px 0;">${firstName},</h2>
          <p style="color: #a1a1aa; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
            Confirme a alteração do seu email clicando no botão abaixo:
          </p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${confirmUrl}" style="${buttonStyle}">Confirmar novo email</a>
          </div>
        `),
      };

    default:
      return {
        subject: "Muuney Hub — Verificação",
        html: wrapHtml(`
          <p style="color: #a1a1aa; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
            Clique no botão abaixo para continuar:
          </p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${confirmUrl}" style="${buttonStyle}">Continuar</a>
          </div>
        `),
      };
  }
}

// ── Handler ──

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  // Verify webhook signature
  let data: HookPayload;
  try {
    console.log("Hook secret prefix:", HOOK_SECRET.substring(0, 10) + "...");
    console.log("Headers received:", Object.keys(headers).join(", "));
    const wh = new Webhook(HOOK_SECRET);
    data = wh.verify(payload, headers) as HookPayload;
    console.log("Webhook signature verified OK");
  } catch (err) {
    console.error("Webhook verification failed:", err);
    console.error("Payload length:", payload.length);
    return new Response(
      JSON.stringify({ error: { http_code: 401, message: "Invalid signature" } }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const { user, email_data } = data;
  console.log(`Sending ${email_data.email_action_type} email to ${user.email}`);

  // Build email content
  const { subject, html } = buildEmail(user, email_data);

  // Send via Resend HTTP API
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: SENDER,
        to: [user.email],
        subject,
        html,
      }),
    });

    const resBody = await res.json();

    if (!res.ok) {
      console.error("Resend API error:", resBody);
      return new Response(
        JSON.stringify({ error: { http_code: res.status, message: resBody.message || "Email delivery failed" } }),
        { status: res.status, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`Email sent successfully: ${resBody.id} → ${user.email}`);

    // Return success — GoTrue expects this format
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Failed to send email:", err);
    return new Response(
      JSON.stringify({ error: { http_code: 500, message: "Internal error sending email" } }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
