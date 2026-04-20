// Stripe Customer Portal Edge Function
// Creates a Stripe Billing Portal session so the user can self-service their
// subscription (update payment method, cancel, download invoices, switch plan).
//
// Required env vars:
//   STRIPE_SECRET_KEY   — sk_test_... or sk_live_...
//   SITE_URL            — https://hub.muuney.com.br (return URL)
//
// POST body: {} (no params — plan is derived from Stripe customer ID)
// Requires authenticated user (Authorization: Bearer <jwt>).
// Returns { url: "https://billing.stripe.com/..." }
//
// Stripe Dashboard setup:
//   1. Go to https://dashboard.stripe.com/settings/billing/portal
//   2. Enable Customer portal, configure allowed actions (cancel, update plan,
//      update payment method, invoice history, update billing info).
//   3. Save configuration — the portal is then usable by this endpoint.

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
    const siteUrl = Deno.env.get("SITE_URL") ?? "https://hub.muuney.com.br";

    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: "STRIPE_SECRET_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // Look up Stripe customer ID
    const { data: tierRow } = await supabase
      .from("hub_user_tiers")
      .select("stripe_customer_id, tier")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!tierRow?.stripe_customer_id) {
      return new Response(
        JSON.stringify({
          error: "No Stripe customer on file",
          hint: "User has not completed checkout yet — send them to /upgrade first.",
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Init Stripe
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion,
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Create billing portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: tierRow.stripe_customer_id,
      return_url: `${siteUrl}/upgrade`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("stripe-portal error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
