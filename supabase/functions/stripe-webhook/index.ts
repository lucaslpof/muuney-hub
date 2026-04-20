// Stripe Webhook Handler
// Listens for subscription events and updates hub_user_tiers accordingly.
//
// Configure in Stripe Dashboard:
//   Endpoint URL: https://yheopprbuimsunqfaqbp.supabase.co/functions/v1/stripe-webhook
//   Events to send:
//     - checkout.session.completed
//     - customer.subscription.created
//     - customer.subscription.updated
//     - customer.subscription.deleted
//     - invoice.payment_failed
//
// Required env vars:
//   STRIPE_SECRET_KEY
//   STRIPE_WEBHOOK_SECRET  — whsec_...
//
// IMPORTANT: deploy with --no-verify-jwt (Stripe signs the request, not Supabase Auth).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function setTierForCustomer(customerId: string, tier: "free" | "pro", extras: Record<string, unknown> = {}) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("hub_user_tiers")
    .update({ tier, updated_at: new Date().toISOString(), ...extras })
    .eq("stripe_customer_id", customerId)
    .select("user_id");
  if (error) {
    console.error("Failed to update tier:", error);
    throw error;
  }
  // Warn — customer exists at Stripe but no matching hub_user_tiers row.
  // Most commonly: the row was created with stripe_customer_id=null and never
  // backfilled, or the user was deleted. Without this log we'd silently ignore.
  if (!data || data.length === 0) {
    console.warn(`setTierForCustomer: no hub_user_tiers row matched customer ${customerId} (tier=${tier})`);
  }
}

async function setTierForUserId(userId: string, tier: "free" | "pro", extras: Record<string, unknown> = {}) {
  const supabase = getSupabase();
  const { data: existing } = await supabase
    .from("hub_user_tiers")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) {
    await supabase
      .from("hub_user_tiers")
      .update({ tier, updated_at: new Date().toISOString(), ...extras })
      .eq("user_id", userId);
  } else {
    await supabase.from("hub_user_tiers").insert({ user_id: userId, tier, ...extras });
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!stripeKey || !webhookSecret) {
    return new Response(
      JSON.stringify({ error: "Stripe env vars not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const stripe = new Stripe(stripeKey, {
    apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion,
    httpClient: Stripe.createFetchHttpClient(),
  });

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
      undefined,
      Stripe.createSubtleCryptoProvider()
    );
  } catch (err) {
    console.error("Signature verification failed:", err);
    return new Response(`Webhook Error: ${err instanceof Error ? err.message : String(err)}`, {
      status: 400,
    });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;
        const customerId = typeof session.customer === "string" ? session.customer : null;

        if (userId && customerId) {
          await setTierForUserId(userId, "pro", {
            stripe_customer_id: customerId,
            stripe_subscription_id: session.subscription as string | null,
          });
          console.log(`Upgraded user ${userId} to pro (customer ${customerId})`);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const status = sub.status;
        const activeStatuses = ["active", "trialing"];
        const tier = activeStatuses.includes(status) ? "pro" : "free";
        await setTierForCustomer(customerId, tier, {
          stripe_subscription_id: sub.id,
          subscription_status: status,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        });
        console.log(`Subscription ${sub.id} → ${status} (tier=${tier})`);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        await setTierForCustomer(customerId, "free", {
          subscription_status: "canceled",
        });
        console.log(`Subscription ${sub.id} canceled → free`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
        if (customerId) {
          await setTierForCustomer(customerId, "free", {
            subscription_status: "past_due",
          });
          console.log(`Payment failed for customer ${customerId} → free`);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
