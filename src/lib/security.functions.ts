import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const SECURITY_ACTIONS = [
  "sign_in_success",
  "sign_in_failed",
  "logout",
  "session_refresh",
  "signup_started",
  "checkout_started",
  "checkout_completed",
  "checkout_abandoned",
  "password_reset_requested",
  "password_changed",
  "invite_accepted",
] as const;

type SecurityAction = (typeof SECURITY_ACTIONS)[number];

function parseUserAgent(ua: string | null) {
  const agent = ua ?? "";
  const browser = /edg/i.test(agent)
    ? "Edge"
    : /chrome/i.test(agent)
      ? "Chrome"
      : /safari/i.test(agent) && !/chrome/i.test(agent)
        ? "Safari"
        : /firefox/i.test(agent)
          ? "Firefox"
          : /opr|opera/i.test(agent)
            ? "Opera"
            : "Unknown";

  const os = /windows/i.test(agent)
    ? "Windows"
    : /mac os|macintosh/i.test(agent)
      ? "macOS"
      : /android/i.test(agent)
        ? "Android"
        : /iphone|ipad|ios/i.test(agent)
          ? "iOS"
          : /linux/i.test(agent)
            ? "Linux"
            : "Unknown";

  const device = /mobile|android|iphone|ipad/i.test(agent) ? "Mobile" : "Desktop";
  return { browser, os, device };
}

export async function logSecurityEventServer(input: {
  user_id?: string | null;
  organization_id?: string | null;
  email?: string | null;
  action: SecurityAction;
  status: "success" | "failed" | "info";
  ip_address?: string | null;
  user_agent?: string | null;
  browser?: string | null;
  device?: string | null;
  os?: string | null;
  country?: string | null;
}) {
  const ua = input.user_agent ?? null;
  const parsed = parseUserAgent(ua);
  await supabaseAdmin.from("login_activity" as never).insert({
    user_id: input.user_id ?? null,
    organization_id: input.organization_id ?? null,
    email: input.email ?? null,
    action: input.action,
    status: input.status,
    ip_address: input.ip_address ?? null,
    user_agent: ua ?? null,
    browser: input.browser ?? parsed.browser,
    device: input.device ?? parsed.device,
    os: input.os ?? parsed.os,
    country: input.country ?? null,
  } as never);
}

async function getMyProfile(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("user_id, email, role, organization_id, must_change_password")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) throw new Error("Profile not found");
  return data as any;
}

async function assertSecurityViewer(userId: string) {
  const me = await getMyProfile(userId);
  if (!["owner", "manager", "super_admin"].includes(me.role)) {
    throw new Error("Forbidden");
  }
  return me;
}

const PublicEventSchema = z.object({
  email: z.string().email().max(254).optional().nullable(),
  action: z.enum(SECURITY_ACTIONS),
  status: z.enum(["success", "failed", "info"]).default("info"),
  user_agent: z.string().max(2000).optional().nullable(),
});

export const logPublicSecurityEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => PublicEventSchema.parse(input))
  .handler(async ({ data }) => {
    await logSecurityEventServer({
      email: data.email ?? null,
      action: data.action,
      status: data.status,
      user_agent: data.user_agent ?? null,
    });
    return { ok: true as const };
  });

const AuthEventSchema = z.object({
  action: z.enum(SECURITY_ACTIONS),
  status: z.enum(["success", "failed", "info"]).default("info"),
  user_agent: z.string().max(2000).optional().nullable(),
});

export const logAuthSecurityEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AuthEventSchema.parse(input))
  .handler(async ({ context, data }) => {
    const me = await getMyProfile(context.userId);
    await logSecurityEventServer({
      user_id: me.user_id,
      organization_id: me.organization_id ?? null,
      email: me.email ?? null,
      action: data.action,
      status: data.status,
      user_agent: data.user_agent ?? null,
    });
    if (data.action === "sign_in_success" && me.role !== "owner" && me.must_change_password) {
      await logSecurityEventServer({
        user_id: me.user_id,
        organization_id: me.organization_id ?? null,
        email: me.email ?? null,
        action: "invite_accepted",
        status: "success",
        user_agent: data.user_agent ?? null,
      });
    }
    return { ok: true as const };
  });

const PresenceSchema = z.object({
  is_online: z.boolean().default(true),
  current_page: z.string().trim().max(300).optional().nullable(),
  user_agent: z.string().max(2000).optional().nullable(),
});

export const heartbeatPresence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PresenceSchema.parse(input))
  .handler(async ({ context, data }) => {
    const me = await getMyProfile(context.userId);
    const ua = data.user_agent ?? null;
    const parsed = parseUserAgent(ua);
    await supabaseAdmin.from("user_presence" as never).upsert(
      {
        user_id: me.user_id,
        organization_id: me.organization_id ?? null,
        is_online: data.is_online,
        current_page: data.current_page ?? null,
        last_seen_at: new Date().toISOString(),
        browser: parsed.browser,
        device: parsed.device,
      } as never,
      { onConflict: "user_id" },
    );
    return { ok: true as const };
  });

export const getPresenceSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await assertSecurityViewer(context.userId);
    if (!me.organization_id) return { rows: [] as any[] };
    const { data, error } = await supabaseAdmin
      .from("user_presence" as never)
      .select("user_id, organization_id, last_seen_at, is_online, current_page, browser, device")
      .eq("organization_id", me.organization_id)
      .order("last_seen_at", { ascending: false });
    if (error) throw new Error(error.message);

    const userIds = ((data ?? []) as any[]).map((r) => r.user_id).filter(Boolean);
    const { data: users } = await supabaseAdmin
      .from("profiles")
      .select("user_id, full_name, email, role")
      .in("user_id", userIds);

    const userMap = new Map<string, any>((users ?? []).map((u: any) => [u.user_id, u]));
    const rows = ((data ?? []) as any[]).map((r) => ({
      ...r,
      full_name: userMap.get(r.user_id)?.full_name ?? null,
      email: userMap.get(r.user_id)?.email ?? null,
      role: userMap.get(r.user_id)?.role ?? null,
    }));
    return { rows };
  });

const ActivityFilterSchema = z.object({
  search: z.string().trim().max(200).optional().nullable(),
  user_id: z.string().uuid().optional().nullable(),
  action: z.enum(SECURITY_ACTIONS).optional().nullable(),
  date_from: z.string().datetime().optional().nullable(),
  date_to: z.string().datetime().optional().nullable(),
  limit: z.number().int().min(10).max(500).default(200),
});

export const getSecurityActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ActivityFilterSchema.parse(input))
  .handler(async ({ context, data }) => {
    const me = await assertSecurityViewer(context.userId);
    if (!me.organization_id) return { rows: [] as any[] };
    let q = supabaseAdmin
      .from("login_activity" as never)
      .select("id, user_id, organization_id, email, action, status, ip_address, browser, device, os, created_at")
      .eq("organization_id", me.organization_id)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.user_id) q = q.eq("user_id", data.user_id);
    if (data.action) q = q.eq("action", data.action);
    if (data.date_from) q = q.gte("created_at", data.date_from);
    if (data.date_to) q = q.lte("created_at", data.date_to);
    if (data.search) {
      const s = `%${data.search}%`;
      q = q.or(`email.ilike.${s},action.ilike.${s},browser.ilike.${s},device.ilike.${s}`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as any[] };
  });

