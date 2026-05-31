export const SECURITY_ACTIONS = [
  // auth
  "sign_in_success",
  "sign_in_failed",
  "logout",
  "session_refresh",
  "signup_started",
  "password_reset_requested",
  "password_changed",
  "new_device_detected",
  "suspicious_activity",
  // billing
  "checkout_started",
  "checkout_completed",
  "checkout_abandoned",
  "payment_failed",
  // access (user lifecycle / roles)
  "invite_accepted",
  "user_invited",
  "user_created",
  "user_disabled",
  "user_enabled",
  "role_changed",
] as const;

export type SecurityAction = (typeof SECURITY_ACTIONS)[number];

export type SecuritySeverity = "info" | "warning" | "critical";
export type SecurityCategory = "auth" | "billing" | "access" | "security";

export const ACTION_CATEGORY: Record<SecurityAction, SecurityCategory> = {
  sign_in_success: "auth",
  sign_in_failed: "auth",
  logout: "auth",
  session_refresh: "auth",
  signup_started: "auth",
  password_reset_requested: "auth",
  password_changed: "auth",
  new_device_detected: "security",
  suspicious_activity: "security",
  checkout_started: "billing",
  checkout_completed: "billing",
  checkout_abandoned: "billing",
  payment_failed: "billing",
  invite_accepted: "access",
  user_invited: "access",
  user_created: "access",
  user_disabled: "access",
  user_enabled: "access",
  role_changed: "access",
};

export function defaultSeverity(
  action: SecurityAction,
  status: "success" | "failed" | "info",
): SecuritySeverity {
  if (action === "suspicious_activity") return "critical";
  if (action === "payment_failed" || action === "user_disabled") return "warning";
  if (action === "new_device_detected" || action === "role_changed") return "warning";
  if (status === "failed") return "warning";
  return "info";
}

export const SECURITY_CATEGORIES: SecurityCategory[] = ["auth", "billing", "access", "security"];
export const SECURITY_SEVERITIES: SecuritySeverity[] = ["info", "warning", "critical"];
