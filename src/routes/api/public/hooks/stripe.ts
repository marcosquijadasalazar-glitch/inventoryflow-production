import { createFileRoute } from "@tanstack/react-router";
import type Stripe from "stripe";
import {
  getStripe,
  isSetupPriceId,
  subscriptionToOrgUpdate,
  type BillingPlan,
} from "@/lib/stripe.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createNotification } from "@/lib/notifications.functions";

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
  const patch: Record<string, unknown> = {
    stripe_subscription_id: upd.stripe_subscription_id,
    stripe_price_id: upd.stripe_price_id,
    subscription_status: upd.subscription_status,
    current_period_end: upd.current_period_end,
  };
  // Prefer recurring price → plan mapping, fall back to checkout metadata.
  const plan = upd.plan ?? selectedPlan;
  if (plan) patch.plan_type = plan;

  if (sub.status === "active" || sub.status === "trialing") {
    patch.grace_period_ends_at = null;
  }
  if (sub.status === "canceled") {
    patch.plan_type = "free";
    patch.stripe_subscription_id = null;
    patch.stripe_price_id = null;
  }

  const { error } = await supabaseAdmin
    .from("organizations")
    .update(patch as any)
    .eq("id", orgId);
  if (error) console.error("[stripe webhook] update failed", error);
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
  const orgId = session.metadata?.organization_id;
  if (!orgId) return;
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
