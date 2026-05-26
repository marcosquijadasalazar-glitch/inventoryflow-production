// Server-only Stripe helpers. NEVER import from client code.
import Stripe from "stripe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

let _stripe: Stripe | undefined;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  _stripe = new Stripe(key, { apiVersion: "2024-12-18.acacia" as any });
  return _stripe;
}

export type BillingPlan = "starter" | "pro";

export function priceIdForPlan(plan: BillingPlan): string {
  const id = plan === "starter"
    ? process.env.STRIPE_PRICE_STARTER
    : process.env.STRIPE_PRICE_PRO;
  if (!id) throw new Error(`Missing Stripe price ID for plan ${plan}`);
  console.log(`[stripe] subscription price for ${plan} ends with ...${id.slice(-6)}`);
  return id;
}

export function setupPriceIdForPlan(plan: BillingPlan): string | null {
  const id = plan === "starter"
    ? process.env.STRIPE_SETUP_STARTER
    : process.env.STRIPE_SETUP_PRO;
  if (id) {
    console.log(`[stripe] setup price for ${plan} ends with ...${id.slice(-6)}`);
  } else {
    console.log(`[stripe] setup price for ${plan} is not set`);
  }
  return id || null;
}

export function planForPriceId(priceId: string | null | undefined): BillingPlan | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_STARTER) return "starter";
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  return null;
}

export function isSetupPriceId(priceId: string | null | undefined): BillingPlan | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_SETUP_STARTER) return "starter";
  if (priceId === process.env.STRIPE_SETUP_PRO) return "pro";
  return null;
}

// Ensure the org has a Stripe customer; create it if missing.
export async function ensureStripeCustomer(orgId: string, email: string | null): Promise<string> {
  const { data: org, error } = await supabaseAdmin
    .from("organizations")
    .select("id, stripe_customer_id, company_name")
    .eq("id", orgId)
    .maybeSingle();
  if (error || !org) throw new Error("Organization not found");
  if (org.stripe_customer_id) return org.stripe_customer_id;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: email ?? undefined,
    name: org.company_name ?? undefined,
    metadata: { organization_id: orgId },
  });

  const { error: updErr } = await supabaseAdmin
    .from("organizations")
    .update({ stripe_customer_id: customer.id })
    .eq("id", orgId);
  if (updErr) throw new Error(updErr.message);

  return customer.id;
}

// Map a Stripe subscription to org row updates.
export function subscriptionToOrgUpdate(sub: Stripe.Subscription) {
  const item = sub.items.data[0];
  const priceId = item?.price?.id ?? null;
  const plan = planForPriceId(priceId);
  // current_period_end moved to the subscription item in newer Stripe API versions;
  // fall back to the subscription-level field for older versions.
  const periodEnd =
    (item as any)?.current_period_end ?? (sub as any).current_period_end ?? null;
  return {
    stripe_subscription_id: sub.id,
    stripe_price_id: priceId,
    subscription_status: sub.status,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    trial_end_at_iso: sub.trial_end
      ? new Date(sub.trial_end * 1000).toISOString()
      : null,
    plan,
  };
}
