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

const TRIAL_DAYS = 7;

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
    .select("id, company_name, plan_type, subscription_status, stripe_customer_id, stripe_subscription_id, stripe_price_id, current_period_end, grace_period_ends_at, has_used_trial, setup_fee_paid, setup_fee_paid_at, setup_fee_plan")
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
  setup_fee_paid: boolean;
  setup_fee_paid_at: string | null;
  setup_fee_plan: string | null;
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
      .select("plan_type, subscription_status, current_period_end, grace_period_ends_at, has_used_trial, stripe_subscription_id, setup_fee_paid, setup_fee_paid_at, setup_fee_plan")
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
      plan: (org.plan_type as any) ?? "starter",
      subscription_status: (org.subscription_status as string) ?? "active",
      current_period_end: (org.current_period_end as string | null) ?? null,
      grace_period_ends_at: (org.grace_period_ends_at as string | null) ?? null,
      has_subscription: !!org.stripe_subscription_id,
      has_used_trial: !!org.has_used_trial,
      is_owner: profile.role === "owner" || profile.role === "super_admin",
      cancel_at_period_end,
      setup_fee_paid: !!(org as any).setup_fee_paid,
      setup_fee_paid_at: ((org as any).setup_fee_paid_at as string | null) ?? null,
      setup_fee_plan: ((org as any).setup_fee_plan as string | null) ?? null,
    };
  });

const CheckoutSchema = z.object({
  plan: z.enum(["starter", "pro"]),
});

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CheckoutSchema.parse(input))
  .handler(async ({ context, data }): Promise<{ url: string }> => {
    console.info("[billing.checkout] start", { userId: context.userId, plan: data.plan });
    let profile: { email: string | null }; let org: any;
    try {
      const loaded = await loadOwnerOrg(context.userId);
      profile = loaded.profile as any;
      org = loaded.org;
    } catch (e: any) {
      console.error("[billing.checkout] loadOwnerOrg failed", { message: e?.message });
      throw new Error(e?.message ?? "Could not load organization");
    }

    let recurringPriceId: string;
    try {
      recurringPriceId = priceIdForPlan(data.plan as BillingPlan);
    } catch (e: any) {
      throw new Error("Billing is not fully configured. Please contact support.");
    }

    const stripe = getStripe();
    const customerId = await ensureStripeCustomer(org.id, profile.email);

    const origin = getRequestHeader("origin") ?? getRequestHeader("referer") ?? "";
    const base = origin.replace(/\/$/, "") || "https://inventoryflowapp.com";

    const lineItems: Array<{ price: string; quantity: number }> = [
      { price: recurringPriceId, quantity: 1 },
    ];
    let includesOnboarding = false;
    if (!(org as any).setup_fee_paid) {
      const setupPrice = setupPriceIdForPlan(data.plan as BillingPlan);
      if (setupPrice) {
        lineItems.push({ price: setupPrice, quantity: 1 });
        includesOnboarding = true;
      }
    }

    // Starter still offers a 7-day trial for upgrades from a never-trialed org.
    const subscriptionData: any = {
      metadata: { organization_id: org.id, selected_plan: data.plan },
    };
    if (data.plan === "starter" && !org.has_used_trial) {
      subscriptionData.trial_period_days = TRIAL_DAYS;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: lineItems,
      success_url: `${base}/settings?billing=success`,
      cancel_url: `${base}/payment-required?billing=cancelled`,
      allow_promotion_codes: true,
      automatic_tax: { enabled: true },
      billing_address_collection: "required",
      customer_update: { address: "auto", name: "auto" },
      tax_id_collection: { enabled: true },
      subscription_data: subscriptionData,
      metadata: {
        organization_id: org.id,
        selected_plan: data.plan,
        includes_onboarding: includesOnboarding ? "true" : "false",
      },
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return { url: session.url };
  });

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ url: string }> => {
    const { org } = await loadOwnerOrg(context.userId);
    if (!org.stripe_customer_id) {
      throw new Error("No billing account found.");
    }
    const stripe = getStripe();
    const origin = getRequestHeader("origin") ?? getRequestHeader("referer") ?? "";
    const base = origin.replace(/\/$/, "") || "https://inventoryflowapp.com";

    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${base}/settings`,
    });
    return { url: session.url };
  });

// ---------------------------------------------------------------------------
// Payment-first signup: anonymous Stripe Checkout that provisions the
// organization + user only after a successful payment / trial start.
// ---------------------------------------------------------------------------

const SignupCheckoutSchema = z.object({
  plan: z.enum(["starter", "pro"]),
  email: z.string().email().max(254),
});

export const createSignupCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SignupCheckoutSchema.parse(input))
  .handler(async ({ data }): Promise<{ url: string }> => {
    const stripe = getStripe();
    const email = data.email.trim().toLowerCase();

    // Don't allow re-signup for an email that already has an account.
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("email", email)
      .maybeSingle();
    if (existing) {
      throw new Error("An account with this email already exists. Please sign in instead.");
    }

    let recurringPriceId: string;
    try {
      recurringPriceId = priceIdForPlan(data.plan as BillingPlan);
    } catch {
      throw new Error("Billing is not fully configured. Please contact support.");
    }

    // Always include the one-time Onboarding Process line item for new signups.
    const lineItems: Array<{ price: string; quantity: number }> = [
      { price: recurringPriceId, quantity: 1 },
    ];
    const onboardingPrice = setupPriceIdForPlan(data.plan as BillingPlan);
    if (onboardingPrice) lineItems.push({ price: onboardingPrice, quantity: 1 });

    // Create a Stripe Customer up-front so the email/billing data is reusable.
    const customer = await stripe.customers.create({
      email,
      metadata: { signup_email: email, selected_plan: data.plan },
    });

    const origin = getRequestHeader("origin") ?? getRequestHeader("referer") ?? "";
    const base = origin.replace(/\/$/, "") || "https://inventoryflowapp.com";

    const subscriptionData: any = {
      metadata: {
        signup: "true",
        signup_email: email,
        selected_plan: data.plan,
      },
    };
    if (data.plan === "starter") {
      subscriptionData.trial_period_days = TRIAL_DAYS;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customer.id,
      line_items: lineItems,
      success_url: `${base}/signup-complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/?checkout=cancelled`,
      allow_promotion_codes: true,
      automatic_tax: { enabled: true },
      billing_address_collection: "required",
      customer_update: { address: "auto", name: "auto" },
      subscription_data: subscriptionData,
      metadata: {
        signup: "true",
        signup_email: email,
        selected_plan: data.plan,
        includes_onboarding: onboardingPrice ? "true" : "false",
      },
    });

    // Reserve a signup-session row so /signup-complete can poll for status.
    await supabaseAdmin.from("signup_sessions" as never).insert({
      session_id: session.id,
      email,
      plan: data.plan,
      status: "pending",
    } as never);

    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return { url: session.url };
  });

const SignupStatusSchema = z.object({
  session_id: z.string().min(10).max(200),
});

export type SignupStatus =
  | { status: "pending"; email: string }
  | { status: "ready"; email: string; temp_password: string | null }
  | { status: "missing" };

// Poll endpoint for /signup-complete. The Stripe checkout session id is
// long and unguessable, so it acts as the bearer token for this one-time
// handoff. The temp password is returned at most once (cleared after read).
export const getSignupSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SignupStatusSchema.parse(input))
  .handler(async ({ data }): Promise<SignupStatus> => {
    const { data: row } = await supabaseAdmin
      .from("signup_sessions" as never)
      .select("session_id, email, status, temp_password, consumed_at")
      .eq("session_id", data.session_id)
      .maybeSingle();
    if (!row) return { status: "missing" } as SignupStatus;
    const r = row as any;
    if (r.status !== "ready") {
      return { status: "pending", email: r.email };
    }
    const tempPassword: string | null = r.consumed_at ? null : (r.temp_password ?? null);
    if (tempPassword) {
      await supabaseAdmin
        .from("signup_sessions" as never)
        .update({ temp_password: null, consumed_at: new Date().toISOString() } as never)
        .eq("session_id", data.session_id);
    }
    return { status: "ready", email: r.email, temp_password: tempPassword };
  });
