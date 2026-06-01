import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  ACTION_CATEGORY,
  defaultSeverity,
  type SecurityAction,
  type SecurityCategory,
  type SecuritySeverity,
} from "./security-constants";

export function parseUserAgent(ua: string | null) {
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

/**
 * Best-effort client IP from common edge/proxy headers.
 * Order matters: Cloudflare first (most reliable on this stack),
 * then standard forwarded headers, then a generic real-ip fallback.
 */
export function getClientIp(headers: Headers | null | undefined): string | null {
  if (!headers) return null;
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  return null;
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
  severity?: SecuritySeverity | null;
  category?: SecurityCategory | null;
  device_fingerprint?: string | null;
  details?: Record<string, unknown> | null;
}) {
  const ua = input.user_agent ?? null;
  const parsed = parseUserAgent(ua);
  const severity = input.severity ?? defaultSeverity(input.action, input.status);
  const category = input.category ?? ACTION_CATEGORY[input.action] ?? "auth";

  // For unauthenticated events (e.g. sign_in_failed), resolve organization_id
  // and user_id from the attempted email so org Owners/Managers can see the
  // event in their Security dashboard. Never reveal account existence to the
  // caller — this is server-side only.
  let resolvedUserId = input.user_id ?? null;
  let resolvedOrgId = input.organization_id ?? null;
  const normalizedEmail = input.email ? input.email.trim().toLowerCase() : null;
  if (!resolvedOrgId && normalizedEmail) {
    try {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("user_id, organization_id")
        .ilike("email", normalizedEmail)
        .maybeSingle();
      if (prof) {
        resolvedUserId = resolvedUserId ?? (prof as any).user_id ?? null;
        resolvedOrgId = (prof as any).organization_id ?? null;
      }
    } catch {
      // best-effort; unknown emails remain org-less (super_admin only)
    }
  }

  const mergedDetails: Record<string, unknown> = { ...(input.details ?? {}) };
  if (input.action === "sign_in_failed" && normalizedEmail) {
    mergedDetails.attempted_email = normalizedEmail;
  }

  await supabaseAdmin.from("login_activity" as never).insert({
    user_id: resolvedUserId,
    organization_id: resolvedOrgId,
    email: input.email ?? null,
    action: input.action,
    status: input.status,
    ip_address: input.ip_address ?? null,
    user_agent: ua ?? null,
    browser: input.browser ?? parsed.browser,
    device: input.device ?? parsed.device,
    os: input.os ?? parsed.os,
    country: input.country ?? null,
    severity,
    category,
    device_fingerprint: input.device_fingerprint ?? null,
    details: mergedDetails,
  } as never);

  // Propagate resolved org for downstream suspicious-activity inserts below.
  input.organization_id = resolvedOrgId;
  input.user_id = resolvedUserId;

  // ───────── New device detection ─────────
  // First successful sign-in from a never-before-seen fingerprint for this
  // user → emit `new_device_detected` (warning). Skip when no fingerprint
  // was supplied to avoid noise.
  if (
    input.action === "sign_in_success" &&
    input.user_id &&
    input.device_fingerprint
  ) {
    try {
      const { count: priorCount } = await supabaseAdmin
        .from("login_activity" as never)
        .select("id", { count: "exact", head: true })
        .eq("user_id", input.user_id)
        .eq("device_fingerprint", input.device_fingerprint)
        .neq("action", "new_device_detected");
      // priorCount includes the row we just inserted, so first-time = 1.
      if ((priorCount ?? 0) <= 1) {
        await supabaseAdmin.from("login_activity" as never).insert({
          user_id: input.user_id,
          organization_id: input.organization_id ?? null,
          email: input.email ?? null,
          action: "new_device_detected",
          status: "info",
          ip_address: input.ip_address ?? null,
          user_agent: ua,
          browser: input.browser ?? parsed.browser,
          device: input.device ?? parsed.device,
          os: input.os ?? parsed.os,
          severity: "warning",
          category: "security",
          device_fingerprint: input.device_fingerprint,
          details: { reason: "first_seen_fingerprint" },
        } as never);
      }
    } catch {
      // best-effort
    }
  }

  // ───────── Suspicious activity detection ─────────
  // Triggers (dedup'd per hour per email/ip):
  //   a) 5+ failed sign-ins for the same email within 15 min
  //   b) 5+ failed sign-ins from the same IP within 15 min
  //   c) successful sign-in after 3+ recent failures for the same email
  const since15 = new Date(Date.now() - 15 * 60_000).toISOString();
  const dedupeSince = new Date(Date.now() - 60 * 60_000).toISOString();

  async function emitSuspicious(reason: string, details: Record<string, unknown>) {
    try {
      let dedupeQ = supabaseAdmin
        .from("login_activity" as never)
        .select("id", { count: "exact", head: true })
        .eq("action", "suspicious_activity")
        .gte("created_at", dedupeSince);
      if (input.email) dedupeQ = dedupeQ.eq("email", input.email);
      else if (input.ip_address) dedupeQ = dedupeQ.eq("ip_address", input.ip_address);
      const { count: recent } = await dedupeQ;
      if ((recent ?? 0) > 0) return;
      await supabaseAdmin.from("login_activity" as never).insert({
        user_id: input.user_id ?? null,
        organization_id: input.organization_id ?? null,
        email: input.email ?? null,
        action: "suspicious_activity",
        status: "failed",
        ip_address: input.ip_address ?? null,
        user_agent: ua,
        browser: input.browser ?? parsed.browser,
        device: input.device ?? parsed.device,
        os: input.os ?? parsed.os,
        severity: "critical",
        category: "security",
        device_fingerprint: input.device_fingerprint ?? null,
        details: { reason, ...details },
      } as never);
    } catch {
      // best-effort
    }
  }

  if (input.action === "sign_in_failed") {
    if (input.email) {
      try {
        const { count } = await supabaseAdmin
          .from("login_activity" as never)
          .select("id", { count: "exact", head: true })
          .eq("email", input.email)
          .eq("action", "sign_in_failed")
          .gte("created_at", since15);
        if ((count ?? 0) >= 5) {
          await emitSuspicious("failed_logins_email_burst", { window_minutes: 15, count });
        }
      } catch { /* ignore */ }
    }
    if (input.ip_address) {
      try {
        const { count } = await supabaseAdmin
          .from("login_activity" as never)
          .select("id", { count: "exact", head: true })
          .eq("ip_address", input.ip_address)
          .eq("action", "sign_in_failed")
          .gte("created_at", since15);
        if ((count ?? 0) >= 5) {
          await emitSuspicious("failed_logins_ip_burst", { window_minutes: 15, count });
        }
      } catch { /* ignore */ }
    }
  } else if (input.action === "sign_in_success" && input.email) {
    try {
      const { count } = await supabaseAdmin
        .from("login_activity" as never)
        .select("id", { count: "exact", head: true })
        .eq("email", input.email)
        .eq("action", "sign_in_failed")
        .gte("created_at", since15);
      if ((count ?? 0) >= 3) {
        await emitSuspicious("success_after_failures", { window_minutes: 15, prior_failures: count });
      }
    } catch { /* ignore */ }
  }
}

export async function getMyProfileAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("user_id, email, role, organization_id, must_change_password")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) throw new Error("Profile not found");
  return data as any;
}

export async function assertSecurityViewer(userId: string) {
  const me = await getMyProfileAdmin(userId);
  if (!["owner", "manager", "super_admin"].includes(me.role)) {
    throw new Error("Forbidden");
  }
  return me;
}
