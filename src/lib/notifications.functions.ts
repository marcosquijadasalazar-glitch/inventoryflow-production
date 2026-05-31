import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "./security-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createNotification, type NotificationType } from "./notifications.server";

export type { NotificationType } from "./notifications.server";

export type NotificationRow = {
  id: string;
  organization_id: string;
  user_id: string | null;
  type: NotificationType;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  action_path: string | null;
  metadata: Record<string, string | number | boolean | null> | null;
  read: boolean;
  read_at: string | null;
  created_at: string;
};

async function getMyOrg(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("organization_id, role, trial_ends_at, account_status")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

// Ensures a trial_ending notification exists for the current org if it's within
// 3 days of trial expiration. Idempotent within a 24h window.
async function ensureTrialEndingNotification(orgId: string, userId: string) {
  const me = await getMyOrg(userId);
  if (!me?.trial_ends_at || me.account_status !== "trial_active") return;
  const ends = new Date(me.trial_ends_at).getTime();
  const now = Date.now();
  const days = (ends - now) / (1000 * 60 * 60 * 24);
  if (days > 3 || days < 0) return;

  const since = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await supabaseAdmin
    .from("notifications" as never)
    .select("id")
    .eq("organization_id", orgId)
    .eq("type", "trial_ending")
    .gte("created_at", since)
    .limit(1);
  if (existing && existing.length) return;

  const daysLeft = Math.max(0, Math.ceil(days));
  await createNotification({
    organization_id: orgId,
    type: "trial_ending",
    title: "Trial ending soon",
    message:
      daysLeft <= 0
        ? "Your trial ends today. Upgrade to keep full access."
        : `Your trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Upgrade to keep full access.`,
    entity_type: "billing",
    action_path: "/settings?tab=billing",
    metadata: { trial_ends_at: me.trial_ends_at },
  });
}

// Idempotency helper: returns true if a notification of `type` already exists
// for this org within the past `hours` window (optionally filtered by metadata key).
async function recentlyNotified(
  orgId: string,
  type: NotificationType,
  hours: number,
  metaKey?: string,
  metaValue?: string,
) {
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  let q = supabaseAdmin
    .from("notifications" as never)
    .select("id, metadata")
    .eq("organization_id", orgId)
    .eq("type", type)
    .gte("created_at", since)
    .limit(50);
  const { data } = await q;
  if (!data || !data.length) return false;
  if (!metaKey) return true;
  return (data as Array<{ metadata: Record<string, unknown> | null }>).some(
    (r) => String(r.metadata?.[metaKey] ?? "") === String(metaValue ?? ""),
  );
}

// Low stock — alerts when a product reaches or falls below its min_stock.
// Idempotent per product within 24h.
async function ensureLowStockNotifications(orgId: string) {
  const { data } = await supabaseAdmin
    .from("products")
    .select("id, name, stock, min_stock, location")
    .eq("organization_id", orgId)
    .gt("min_stock", 0)
    .limit(500);
  if (!data?.length) return;
  const low = data.filter((p: any) => (p.stock ?? 0) <= (p.min_stock ?? 0));
  for (const p of low.slice(0, 10)) {
    const already = await recentlyNotified(orgId, "low_stock", 24, "product_id", p.id);
    if (already) continue;
    const where = p.location ? ` at ${p.location}` : "";
    await createNotification({
      organization_id: orgId,
      type: "low_stock",
      title: "Stock is getting low",
      message:
        (p.stock ?? 0) <= 0
          ? `${p.name} is out of stock${where}. Time to reorder.`
          : `${p.name} stock is getting low${where} — only ${p.stock} left.`,
      entity_type: "product",
      entity_id: p.id,
      action_path: `/products?focus=${p.id}`,
      metadata: { product_id: p.id, stock: p.stock, min_stock: p.min_stock },
    });
  }
}

// Transfer received — fires when a transfer order is marked completed.
// Idempotent per transfer_id, and only scans transfers completed in the last 24h.
async function ensureTransferReceivedNotifications(orgId: string) {
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data } = await supabaseAdmin
    .from("transfer_orders")
    .select("id, transfer_number, to_location, completed_date, created_at")
    .eq("organization_id", orgId)
    .eq("status", "completed")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20);
  if (!data?.length) return;
  for (const t of data as any[]) {
    const already = await recentlyNotified(orgId, "transfer_received", 72, "transfer_id", t.id);
    if (already) continue;
    const dest = t.to_location ? ` to ${t.to_location}` : "";
    await createNotification({
      organization_id: orgId,
      type: "transfer_received",
      title: "Transfer received",
      message: `Transfer ${t.transfer_number} arrived${dest}. Stock is updated.`,
      entity_type: "transfer_order",
      entity_id: t.id,
      action_path: `/transfer-orders?focus=${t.id}`,
      metadata: { transfer_id: t.id, transfer_number: t.transfer_number },
    });
  }
}

// Suspicious activity — surfaces any high-severity login_activity rows
// from the last 24h. Idempotent per source row.
async function ensureSuspiciousActivityNotifications(orgId: string) {
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data } = await supabaseAdmin
    .from("login_activity" as never)
    .select("id, action, email, ip_address, country, created_at, severity")
    .eq("organization_id", orgId)
    .eq("severity", "high")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(10);
  if (!data?.length) return;
  for (const ev of data as any[]) {
    const already = await recentlyNotified(orgId, "suspicious_activity", 72, "event_id", ev.id);
    if (already) continue;
    const where = ev.country ? ` from ${ev.country}` : ev.ip_address ? ` from ${ev.ip_address}` : "";
    await createNotification({
      organization_id: orgId,
      type: "suspicious_activity",
      title: "Unusual sign-in activity",
      message: `We noticed ${ev.action.replace(/_/g, " ")}${where}${ev.email ? ` for ${ev.email}` : ""}. Review your Security Activity if this wasn't you.`,
      entity_type: "login_event",
      entity_id: ev.id,
      action_path: "/settings?tab=security",
      metadata: { event_id: ev.id, action: ev.action },
    });
  }
}

// Onboarding incomplete — gentle nudge if setup hasn't been finished.
// Fires once per 48h, only after the user has been around for >1h.
async function ensureOnboardingNudge(orgId: string) {
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("onboarding_completed, onboarding_started_at, onboarding_dismissed, company_name, created_at")
    .eq("id", orgId)
    .maybeSingle();
  if (!org || org.onboarding_completed) return;
  const startedMs = new Date((org.onboarding_started_at ?? org.created_at) as string).getTime();
  if (Date.now() - startedMs < 60 * 60_000) return;
  const already = await recentlyNotified(orgId, "onboarding_incomplete", 48);
  if (already) return;
  await createNotification({
    organization_id: orgId,
    type: "onboarding_incomplete",
    title: "Your setup is almost complete",
    message: "Pick up where you left off — a few quick steps and you're ready to start scanning.",
    entity_type: "onboarding",
    action_path: "/setup",
    metadata: {},
  });
}

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await getMyOrg(context.userId);
    if (!me?.organization_id) return { notifications: [] as NotificationRow[], unread: 0 };

    // Best-effort auto-generators — never let one failure block the bell.
    await Promise.allSettled([
      ensureTrialEndingNotification(me.organization_id, context.userId),
      ensureLowStockNotifications(me.organization_id),
      ensureTransferReceivedNotifications(me.organization_id),
      ensureSuspiciousActivityNotifications(me.organization_id),
      ensureOnboardingNudge(me.organization_id),
    ]);


    const { data, error } = await supabaseAdmin
      .from("notifications" as never)
      .select("*")
      .eq("organization_id", me.organization_id)
      .or(`user_id.is.null,user_id.eq.${context.userId}`)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as unknown as NotificationRow[];
    const unread = rows.filter((r) => !r.read).length;
    return { notifications: rows, unread };
  });

const MarkReadSchema = z.object({ id: z.string().uuid() });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => MarkReadSchema.parse(i))
  .handler(async ({ context, data }) => {
    const me = await getMyOrg(context.userId);
    if (!me?.organization_id) throw new Error("No organization");
    const { error } = await supabaseAdmin
      .from("notifications" as never)
      .update({ read: true, read_at: new Date().toISOString() } as never)
      .eq("id", data.id)
      .eq("organization_id", me.organization_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await getMyOrg(context.userId);
    if (!me?.organization_id) throw new Error("No organization");
    const { error } = await supabaseAdmin
      .from("notifications" as never)
      .update({ read: true, read_at: new Date().toISOString() } as never)
      .eq("organization_id", me.organization_id)
      .or(`user_id.is.null,user_id.eq.${context.userId}`)
      .eq("read", false);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
