// Stripe Checkout Edge Function
// Creates a Stripe Checkout Session and returns the URL for the user to be redirected to.
//
// Required env vars:
//   STRIPE_SECRET_KEY          — sk_test_... or sk_live_...
//   STRIPE_PRICE_ID_MONTHLY    — price_... (Pro R$49/mês)
//   STRIPE_PRICE_ID_YEARLY     — price_... (Pro R$490/ano)
//   SITE_URL                   — https://hub.muuney.com.br (Hub domain)
// Optional:
//   STRIPE_TRIAL_DAYS          — "14" to enable 14-day trial; unset/0 disables.
//                                Trial is granted only to users who never had
//                                an active subscription (hub_user_tiers.pro_since IS NULL).
//
// POST body: { plan: "monthly" | "yearly" }
// Requires authenticated user (Authorization: Bearer <jwt>).
// Upserts hub_user_tiers row if missing (stays "free" until webhook confirms).
// Returns { url: "https://checkout.stripe.com/..." }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const priceMonthly = Deno.env.get("STRIPE_PRICE_ID_MONTHLY");
    const priceYearly = Deno.env.get("STRIPE_PRICE_ID_YEARLY");
    const siteUrl = Deno.env.get("SITE_URL") ?? "https://hub.muuney.com.br";

    if (!stripeKey || !priceMonthly || !priceYearly) {
      return new Response(
        JSON.stringify({
          error: "Stripe env vars not configured",
          missing: {
            STRIPE_SECRET_KEY: !stripeKey,
            STRIPE_PRICE_ID_MONTHLY: !priceMonthly,
            STRIPE_PRICE_ID_YEARLY: !priceYearly,
          },
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse body
    const body = await req.json().catch(() => ({}));
    const plan = body.plan === "yearly" ? "yearly" : "monthly";
    const priceId = plan === "yearly" ? priceYearly : priceMonthly;

    // Extract user from JWT
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = userData.user;

    // Ensure hub_user_tiers row exists (default free) — webhook will upgrade to pro
    const { data: existingTier } = await supabase
      .from("hub_user_tiers")
      .select("tier, stripe_customer_id, pro_since")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existingTier) {
      await supabase.from("hub_user_tiers").insert({ user_id: user.id, tier: "free" });
    }

    // Trial eligibility: only first-time subscribers (never had an active Pro sub).
    // STRIPE_TRIAL_DAYS=0 or unset disables trial globally.
    const trialDaysRaw = Deno.env.get("STRIPE_TRIAL_DAYS");
    const trialDays = trialDaysRaw ? parseInt(trialDaysRaw, 10) : 0;
    const eligibleForTrial = trialDays > 0 && existingTier?.pro_since == null;

    // Init Stripe
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion,
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Find or create Stripe customer
    let customerId = existingTier?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await supabase
        .from("hub_user_tiers")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", user.id);
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/upgrade?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/upgrade?status=cancelled`,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { supabase_user_id: user.id, plan },
        ...(eligibleForTrial ? { trial_period_days: trialDays } : {}),
      },
      metadata: { supabase_user_id: user.id, plan },
    });

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("stripe-checkout error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
