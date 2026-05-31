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
}) {
  const ua = input.user_agent ?? null;
  const parsed = parseUserAgent(ua);
  const severity = input.severity ?? defaultSeverity(input.action, input.status);
  const category = input.category ?? ACTION_CATEGORY[input.action] ?? "auth";
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
    severity,
    category,
  } as never);

  // Lightweight suspicious activity detection: 5+ failed sign-ins for the same
  // email within 15 minutes triggers a critical security event (deduped per hour).
  if (input.action === "sign_in_failed" && input.email) {
    try {
      const since = new Date(Date.now() - 15 * 60_000).toISOString();
      const { count } = await supabaseAdmin
        .from("login_activity" as never)
        .select("id", { count: "exact", head: true })
        .eq("email", input.email)
        .eq("action", "sign_in_failed")
        .gte("created_at", since);
      if ((count ?? 0) >= 5) {
        const dedupeSince = new Date(Date.now() - 60 * 60_000).toISOString();
        const { count: recentSuspicious } = await supabaseAdmin
          .from("login_activity" as never)
          .select("id", { count: "exact", head: true })
          .eq("email", input.email)
          .eq("action", "suspicious_activity")
          .gte("created_at", dedupeSince);
        if ((recentSuspicious ?? 0) === 0) {
          await supabaseAdmin.from("login_activity" as never).insert({
            user_id: input.user_id ?? null,
            organization_id: input.organization_id ?? null,
            email: input.email,
            action: "suspicious_activity",
            status: "failed",
            ip_address: input.ip_address ?? null,
            user_agent: ua,
            browser: input.browser ?? parsed.browser,
            device: input.device ?? parsed.device,
            os: input.os ?? parsed.os,
            severity: "critical",
            category: "security",
          } as never);
        }
      }
    } catch {
      // best-effort; never block the original event
    }
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
