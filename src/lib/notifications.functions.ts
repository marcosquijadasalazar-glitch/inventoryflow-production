import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type NotificationType =
  | "low_stock"
  | "payment_failed"
  | "trial_ending"
  | "user_created"
  | "role_changed"
  | "system";

export type NotificationRow = {
  id: string;
  organization_id: string;
  user_id: string | null;
  type: NotificationType;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
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

// Insert helper used by other server-side modules (and the stripe webhook).
export async function createNotification(input: {
  organization_id: string;
  user_id?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin.from("notifications" as never).insert({
    organization_id: input.organization_id,
    user_id: input.user_id ?? null,
    type: input.type,
    title: input.title,
    message: input.message,
    metadata: input.metadata ?? {},
  } as never);
  if (error) console.error("[notifications] insert failed", error);
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
    metadata: { trial_ends_at: me.trial_ends_at },
  });
}

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await getMyOrg(context.userId);
    if (!me?.organization_id) return { notifications: [] as NotificationRow[], unread: 0 };

    await ensureTrialEndingNotification(me.organization_id, context.userId);

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
