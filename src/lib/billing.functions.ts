import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  ensureStripeCustomer,
  getStripe,
  priceIdForPlan,
  setupPriceIdForPlan,
  type BillingPlan,
} from "./stripe.server";

async function loadOwnerOrg(userId: string) {
  const { data: profile, error: pErr } = await supabaseAdmin
    .from("profiles")
    .select("user_id, email, role, organization_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (pErr || !profile) throw new Error("Profile not found");
  if (profile.role !== "owner" && profile.role !== "super_admin") {
    throw new Error("Only the organization owner can manage billing");
  }
  if (!profile.organization_id) throw new Error("No organization for user");
  const { data: org, error: oErr } = await supabaseAdmin
    .from("organizations")
    .select("id, company_name, plan_type, subscription_status, stripe_customer_id, stripe_subscription_id, stripe_price_id, current_period_end, grace_period_ends_at, has_used_trial")
    .eq("id", profile.organization_id)
    .maybeSingle();
  if (oErr || !org) throw new Error("Organization not found");
  return { profile, org };
}

export type BillingStatus = {
  plan: "free" | "starter" | "pro" | "enterprise";
  subscription_status: string;
  current_period_end: string | null;
  grace_period_ends_at: string | null;
  has_subscription: boolean;
  has_used_trial: boolean;
  is_owner: boolean;
  cancel_at_period_end: boolean | null;
};

export const getBillingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BillingStatus | null> => {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role, organization_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!profile?.organization_id) return null;
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("plan_type, subscription_status, current_period_end, grace_period_ends_at, has_used_trial, stripe_subscription_id")
      .eq("id", profile.organization_id)
      .maybeSingle();
    if (!org) return null;

    let cancel_at_period_end: boolean | null = null;
    if (org.stripe_subscription_id) {
      try {
        const stripe = getStripe();
        const sub = await stripe.subscriptions.retrieve(org.stripe_subscription_id);
        cancel_at_period_end = sub.cancel_at_period_end;
      } catch {
        // ignore
      }
    }

    return {
      plan: (org.plan_type as any) ?? "free",
      subscription_status: (org.subscription_status as string) ?? "active",
      current_period_end: (org.current_period_end as string | null) ?? null,
      grace_period_ends_at: (org.grace_period_ends_at as string | null) ?? null,
      has_subscription: !!org.stripe_subscription_id,
      has_used_trial: !!org.has_used_trial,
      is_owner: profile.role === "owner" || profile.role === "super_admin",
      cancel_at_period_end,
    };
  });

const CheckoutSchema = z.object({
  plan: z.enum(["starter", "pro"]),
});

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CheckoutSchema.parse(input))
  .handler(async ({ context, data }): Promise<{ url: string }> => {
    const { profile, org } = await loadOwnerOrg(context.userId);
    const stripe = getStripe();
    const customerId = await ensureStripeCustomer(org.id, profile.email);
    const origin = getRequestHeader("origin") ?? getRequestHeader("referer") ?? "";
    const base = origin.replace(/\/$/, "") || "https://inventoryflowapp.com";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceIdForPlan(data.plan as BillingPlan), quantity: 1 }],
      success_url: `${base}/settings?billing=success`,
      cancel_url: `${base}/settings?billing=cancelled`,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { organization_id: org.id },
        // Trial on first subscription only
        ...(org.has_used_trial ? {} : { trial_period_days: TRIAL_DAYS }),
      },
      metadata: { organization_id: org.id, plan: data.plan },
    });

    if (!session.url) throw new Error("Failed to create checkout session");
    return { url: session.url };
  });

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ url: string }> => {
    const { profile, org } = await loadOwnerOrg(context.userId);
    if (!org.stripe_customer_id) {
      // create the customer on the fly so the portal opens cleanly
      await ensureStripeCustomer(org.id, profile.email);
    }
    const refreshed = await supabaseAdmin
      .from("organizations")
      .select("stripe_customer_id")
      .eq("id", org.id)
      .maybeSingle();
    const customerId = refreshed.data?.stripe_customer_id as string | null;
    if (!customerId) throw new Error("Stripe customer not configured");

    const stripe = getStripe();
    const origin = getRequestHeader("origin") ?? getRequestHeader("referer") ?? "";
    const base = origin.replace(/\/$/, "") || "https://inventoryflowapp.com";

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${base}/settings`,
    });
    return { url: session.url };
  });
