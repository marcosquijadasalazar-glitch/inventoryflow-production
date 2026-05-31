import { createFileRoute } from "@tanstack/react-router";
import type Stripe from "stripe";
import {
  getStripe,
  isSetupPriceId,
  subscriptionToOrgUpdate,
  type BillingPlan,
} from "@/lib/stripe.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createNotification } from "@/lib/notifications.server";
import { logSecurityEventServer } from "@/lib/security.server";

const GRACE_PERIOD_DAYS = 3;

async function updateOrgFromSubscription(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const orgIdFromMeta = (sub.metadata?.organization_id as string | undefined) ?? null;
  const selectedPlan = (sub.metadata?.selected_plan as BillingPlan | undefined) ?? null;

  let orgId = orgIdFromMeta;
  if (!orgId) {
    const { data } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    orgId = data?.id ?? null;
  }
  if (!orgId) {
    console.error("[stripe webhook] No org for customer", customerId);
    return;
  }

  const upd = subscriptionToOrgUpdate(sub);
  const isTrialing = sub.status === "trialing";
  const patch: Record<string, unknown> = {
    stripe_subscription_id: upd.stripe_subscription_id,
    stripe_price_id: upd.stripe_price_id,
    subscription_status: upd.subscription_status,
    current_period_end: upd.current_period_end,
    is_trialing: isTrialing,
  };
  if (isTrialing) patch.has_used_trial = true;
  // Prefer recurring price → plan mapping, fall back to checkout metadata.
  const plan = upd.plan ?? selectedPlan;
  if (plan) patch.plan_type = plan;

  if (sub.status === "active" || sub.status === "trialing") {
    patch.grace_period_ends_at = null;
  }
  if (sub.status === "canceled") {
    // Keep the org on Starter (no more Free plan); flag as cancelled.
    patch.plan_type = "starter";
    patch.stripe_subscription_id = null;
    patch.stripe_price_id = null;
    patch.is_trialing = false;
  }

  const { error } = await supabaseAdmin
    .from("organizations")
    .update(patch as any)
    .eq("id", orgId);
  if (error) console.error("[stripe webhook] update failed", error);
}

// Generate a cryptographically secure temporary password.
function generateTempPassword(length = 14): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

// Provision an org + owner user for a successful payment-first signup.
async function provisionSignupFromSession(session: Stripe.Checkout.Session) {
  const email = (session.metadata?.signup_email ?? session.customer_details?.email ?? "")
    .trim().toLowerCase();
  const plan = (session.metadata?.selected_plan as BillingPlan | undefined) ?? "starter";
  if (!email) {
    console.error("[stripe webhook] signup checkout missing email", session.id);
    return;
  }
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (!customerId) {
    console.error("[stripe webhook] signup checkout missing customer", session.id);
    return;
  }

  // Idempotency: if signup_sessions is already ready, do nothing.
  const { data: existing } = await supabaseAdmin
    .from("signup_sessions" as never)
    .select("status, user_id, organization_id")
    .eq("session_id", session.id)
    .maybeSingle();
  if (existing && (existing as any).status === "ready") return;

  // Create the organization first so handle_new_user trigger can link via meta.
  const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;
  const isStarter = plan === "starter";
  const { data: org, error: oErr } = await supabaseAdmin
    .from("organizations")
    .insert({
      company_name: email.split("@")[0],
      plan_type: plan,
      stripe_customer_id: customerId,
      stripe_subscription_id: subId,
      subscription_status: isStarter ? "trialing" : "active",
      is_trialing: isStarter,
      has_used_trial: isStarter,
    } as any)
    .select("id")
    .single();
  if (oErr || !org) {
    console.error("[stripe webhook] org provision failed", oErr);
    return;
  }

  // Create the auth user via admin client. The handle_new_user() trigger
  // creates the matching profile row from user_metadata.
  const tempPassword = generateTempPassword();
  const { data: created, error: uErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      role: "owner",
      organization_id: org.id,
      full_name: session.customer_details?.name ?? null,
    },
  });
  if (uErr || !created.user) {
    console.error("[stripe webhook] createUser failed", uErr);
    return;
  }

  // Force the profile to owner/active with must_change_password.
  await supabaseAdmin
    .from("profiles")
    .update({
      role: "owner",
      organization_id: org.id,
      account_status: "active" as any,
      must_change_password: true,
      trial_ends_at: null,
    } as any)
    .eq("user_id", created.user.id);

  // Hand off the temp password to the browser polling /signup-complete.
  await supabaseAdmin
    .from("signup_sessions" as never)
    .update({
      status: "ready",
      email,
      user_id: created.user.id,
      organization_id: org.id,
      temp_password: tempPassword,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("session_id", session.id);

  console.info("[stripe webhook] signup provisioned", { orgId: org.id, plan });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("id, grace_period_ends_at")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (!org) return;

  const graceEnd = org.grace_period_ends_at
    ? new Date(org.grace_period_ends_at as string)
    : new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  await supabaseAdmin
    .from("organizations")
    .update({
      subscription_status: "past_due",
      grace_period_ends_at: graceEnd.toISOString(),
    })
    .eq("id", org.id);

  await createNotification({
    organization_id: org.id,
    type: "payment_failed",
    title: "Payment failed",
    message: "We could not charge your payment method. Update your billing details to avoid service interruption.",
    entity_type: "billing",
    action_path: "/settings?tab=billing",
    metadata: { invoice_id: invoice.id ?? null, grace_period_ends_at: graceEnd.toISOString() },
  });
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;
  await supabaseAdmin
    .from("organizations")
    .update({ grace_period_ends_at: null, subscription_status: "active" })
    .eq("stripe_customer_id", customerId);
}

async function markSetupFeePaidIfPresent(
  session: Stripe.Checkout.Session,
  orgId: string,
) {
  try {
    const stripe = getStripe();
    const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 20 });
    let paidPlan: BillingPlan | null = null;
    for (const li of items.data) {
      const pid = li.price?.id ?? null;
      const setupPlan = isSetupPriceId(pid);
      if (setupPlan) {
        paidPlan = setupPlan;
        break;
      }
    }
    if (paidPlan) {
      await supabaseAdmin
        .from("organizations")
        .update({
          setup_fee_paid: true,
          setup_fee_paid_at: new Date().toISOString(),
          setup_fee_plan: paidPlan,
        } as any)
        .eq("id", orgId);
    }
  } catch (err) {
    console.error("[stripe webhook] setup-fee detection failed", err);
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  // Payment-first signup: provision org + auth user before anything else.
  if (session.metadata?.signup === "true") {
    try {
      await provisionSignupFromSession(session);
    } catch (err) {
      console.error("[stripe webhook] signup provisioning failed", err);
    }
  }

  const orgId = session.metadata?.organization_id
    ?? (await (async () => {
      // For signup flow we just created the org; look it up by customer.
      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
      if (!customerId) return null;
      const { data } = await supabaseAdmin
        .from("organizations").select("id").eq("stripe_customer_id", customerId).maybeSingle();
      return data?.id ?? null;
    })());
  if (!orgId) return;
  await logSecurityEventServer({
    organization_id: orgId,
    email: (session.customer_details?.email ?? session.metadata?.signup_email ?? null)?.toLowerCase?.() ?? null,
    action: "checkout_completed",
    status: "success",
  });
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const basePatch: Record<string, unknown> = { pending_plan: null };
  if (customerId) basePatch.stripe_customer_id = customerId;
  await supabaseAdmin
    .from("organizations")
    .update(basePatch as any)
    .eq("id", orgId);
  console.info("[stripe webhook] checkout completed", { orgId, plan: session.metadata?.selected_plan });

  // Detect & mark setup fee payment from line items.
  await markSetupFeePaidIfPresent(session, orgId);

  if (session.subscription) {
    const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(subId);
    // Carry the selected_plan metadata from checkout to subscription if missing.
    const selectedPlan = session.metadata?.selected_plan;
    if (selectedPlan && !sub.metadata?.selected_plan) {
      try {
        await stripe.subscriptions.update(subId, {
          metadata: {
            ...(sub.metadata ?? {}),
            organization_id: orgId,
            selected_plan: selectedPlan,
          },
        });
        (sub as any).metadata = {
          ...(sub.metadata ?? {}),
          organization_id: orgId,
          selected_plan: selectedPlan,
        };
      } catch (e) {
        console.error("[stripe webhook] failed to copy metadata to subscription", e);
      }
    }
    await updateOrgFromSubscription(sub);
  }
}

export const Route = createFileRoute("/api/public/hooks/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const sig = request.headers.get("stripe-signature");
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!sig || !secret) {
          return new Response("Webhook misconfigured", { status: 400 });
        }
        const body = await request.text();

        let event: Stripe.Event;
        try {
          const stripe = getStripe();
          event = await stripe.webhooks.constructEventAsync(body, sig, secret);
        } catch (err) {
          console.error("[stripe webhook] signature verification failed", err);
          return new Response("Invalid signature", { status: 400 });
        }

        try {
          switch (event.type) {
            case "checkout.session.completed":
              await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
              break;
            case "customer.subscription.created":
            case "customer.subscription.updated":
            case "customer.subscription.deleted":
              await updateOrgFromSubscription(event.data.object as Stripe.Subscription);
              break;
            case "invoice.payment_failed":
              await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
              break;
            case "invoice.paid":
            case "invoice.payment_succeeded":
              await handleInvoicePaid(event.data.object as Stripe.Invoice);
              break;
            default:
              break;
          }
        } catch (err) {
          console.error("[stripe webhook] handler error", event.type, err);
          return new Response("Handler error", { status: 500 });
        }

        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
