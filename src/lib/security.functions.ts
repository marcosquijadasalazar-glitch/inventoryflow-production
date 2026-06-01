import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { SECURITY_ACTIONS } from "./security-constants";

const AuthEventSchema = z.object({
  action: z.enum(SECURITY_ACTIONS),
  status: z.enum(["success", "failed", "info"]).default("info"),
  user_agent: z.string().max(2000).optional().nullable(),
  device_fingerprint: z.string().max(128).optional().nullable(),
});

export const logAuthSecurityEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AuthEventSchema.parse(input))
  .handler(async ({ data }) => {
    const { getAuthenticatedUserId } = await import("./security-auth.server");
    const { getMyProfileAdmin, logSecurityEventServer, getClientIp } = await import(
      "./security.server"
    );
    const userId = await getAuthenticatedUserId();
    const me = await getMyProfileAdmin(userId);
    const ip = getClientIp(getRequest()?.headers ?? null);
    await logSecurityEventServer({
      user_id: me.user_id,
      organization_id: me.organization_id ?? null,
      email: me.email ?? null,
      action: data.action,
      status: data.status,
      user_agent: data.user_agent ?? null,
      ip_address: ip,
      device_fingerprint: data.device_fingerprint ?? null,
    });
    if (data.action === "sign_in_success" && me.role !== "owner" && me.must_change_password) {
      await logSecurityEventServer({
        user_id: me.user_id,
        organization_id: me.organization_id ?? null,
        email: me.email ?? null,
        action: "invite_accepted",
        status: "success",
        user_agent: data.user_agent ?? null,
        ip_address: ip,
        device_fingerprint: data.device_fingerprint ?? null,
      });
    }
    return { ok: true as const };
  });

const PresenceSchema = z.object({
  is_online: z.boolean().default(true),
  current_page: z.string().trim().max(300).optional().nullable(),
  user_agent: z.string().max(2000).optional().nullable(),
  device_fingerprint: z.string().max(128).optional().nullable(),
});

export const heartbeatPresence = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => PresenceSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getAuthenticatedUserId } = await import("./security-auth.server");
    const { getMyProfileAdmin, parseUserAgent, getClientIp } = await import(
      "./security.server"
    );
    const userId = await getAuthenticatedUserId();
    const me = await getMyProfileAdmin(userId);
    const ua = data.user_agent ?? null;
    const parsed = parseUserAgent(ua);
    const ip = getClientIp(getRequest()?.headers ?? null);
    await supabaseAdmin.from("user_presence" as never).upsert(
      {
        user_id: me.user_id,
        organization_id: me.organization_id ?? null,
        is_online: data.is_online,
        current_page: data.current_page ?? null,
        last_seen_at: new Date().toISOString(),
        browser: parsed.browser,
        device: parsed.device,
        os: parsed.os,
        user_agent: ua,
        ip_address: ip,
        device_fingerprint: data.device_fingerprint ?? null,
      } as never,
      { onConflict: "user_id" },
    );
    return { ok: true as const };
  });

export const getPresenceSnapshot = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getAuthenticatedUserId } = await import("./security-auth.server");
    const { assertSecurityViewer } = await import("./security.server");
    const userId = await getAuthenticatedUserId();
    const me = await assertSecurityViewer(userId);
    if (!me.organization_id) return { rows: [] as any[] };
    const { data, error } = await supabaseAdmin
      .from("user_presence" as never)
      .select(
        "user_id, organization_id, last_seen_at, is_online, current_page, browser, device, os, ip_address, device_fingerprint",
      )
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
  category: z.enum(["auth", "billing", "access", "security"]).optional().nullable(),
  severity: z.enum(["info", "warning", "critical"]).optional().nullable(),
  date_from: z.string().datetime().optional().nullable(),
  date_to: z.string().datetime().optional().nullable(),
  scope: z.enum(["org", "ecosystem"]).default("org"),
  limit: z.number().int().min(10).max(200).default(50),
  offset: z.number().int().min(0).max(100000).default(0),
});

export const getSecurityActivity = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ActivityFilterSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getAuthenticatedUserId } = await import("./security-auth.server");
    const { assertSecurityViewer } = await import("./security.server");
    const userId = await getAuthenticatedUserId();
    const me = await assertSecurityViewer(userId);
    const isSuper = me.role === "super_admin";
    const wantEcosystem = data.scope === "ecosystem" && isSuper;
    if (!wantEcosystem && !me.organization_id) {
      return { rows: [] as any[], total: 0, offset: data.offset, limit: data.limit, scope: "org" as const };
    }
    const to = data.offset + data.limit - 1;
    let q = supabaseAdmin
      .from("login_activity" as never)
      .select(
        "id, user_id, organization_id, email, action, status, severity, category, ip_address, browser, device, os, device_fingerprint, details, created_at",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(data.offset, to);
    if (!wantEcosystem) q = q.eq("organization_id", me.organization_id);
    if (data.user_id) q = q.eq("user_id", data.user_id);
    if (data.action) q = q.eq("action", data.action);
    if (data.category) q = q.eq("category", data.category);
    if (data.severity) q = q.eq("severity", data.severity);
    if (data.date_from) q = q.gte("created_at", data.date_from);
    if (data.date_to) q = q.lte("created_at", data.date_to);
    if (data.search) {
      const s = `%${data.search}%`;
      q = q.or(
        `email.ilike.${s},action.ilike.${s},browser.ilike.${s},device.ilike.${s},ip_address.ilike.${s}`,
      );
    }
    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);

    let orgMap = new Map<string, string>();
    if (wantEcosystem) {
      const orgIds = Array.from(
        new Set(((rows ?? []) as any[]).map((r) => r.organization_id).filter(Boolean)),
      );
      if (orgIds.length > 0) {
        const { data: orgs } = await supabaseAdmin
          .from("organizations")
          .select("id, company_name")
          .in("id", orgIds);
        orgMap = new Map<string, string>(
          ((orgs ?? []) as any[]).map((o) => [o.id, o.company_name]),
        );
      }
    }
    const enriched = ((rows ?? []) as any[]).map((r) => ({
      ...r,
      organization_name: orgMap.get(r.organization_id) ?? null,
    }));

    return {
      rows: enriched,
      total: count ?? enriched.length,
      offset: data.offset,
      limit: data.limit,
      scope: wantEcosystem ? ("ecosystem" as const) : ("org" as const),
    };
  });
