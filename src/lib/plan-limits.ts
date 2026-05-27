// Shared plan metadata (kept in sync with public.plan_limits SQL function)
//
// NOTE: "free" remains in the type to tolerate legacy organization rows that
// were provisioned before the Starter/Pro-only model. The UI never offers free
// as a choice and recommendedPlan() promotes legacy free orgs straight to
// Starter. Growth is gated by capacity, not by hiding modules.
export type PlanType = "free" | "starter" | "pro" | "enterprise";

export type PlanLimits = {
  max_users: number | null;
  max_products: number | null;
  max_locations: number | null;
};

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  // Legacy free rows are treated as Starter for limit purposes.
  free:       { max_users: 3,    max_products: 500,  max_locations: 2 },
  starter:    { max_users: 3,    max_products: 500,  max_locations: 2 },
  pro:        { max_users: 25,   max_products: null, max_locations: 10 },
  enterprise: { max_users: null, max_products: null, max_locations: null },
};

// UI/selection order — Starter and Pro are the only sellable plans.
export const PLAN_ORDER: PlanType[] = ["starter", "pro", "enterprise"];

export type UsageKind = "users" | "products" | "locations";

export type OrgUsage = {
  plan: PlanType;
  limits: PlanLimits;
  used: { users: number; products: number; locations: number };
  trial_ends_at: string | null;
  organization_name: string | null;
};

export function isAtLimit(usage: OrgUsage | undefined, kind: UsageKind): boolean {
  if (!usage) return false;
  const limit = limitFor(usage, kind);
  if (limit == null) return false;
  return usage.used[kind] >= limit;
}

export function limitFor(usage: OrgUsage, kind: UsageKind): number | null {
  return kind === "users" ? usage.limits.max_users
    : kind === "products" ? usage.limits.max_products
    : usage.limits.max_locations;
}

export function remainingFor(usage: OrgUsage, kind: UsageKind): number | null {
  const lim = limitFor(usage, kind);
  if (lim == null) return null;
  return Math.max(0, lim - usage.used[kind]);
}

export function fmtLimit(n: number | null | undefined): string {
  return n == null ? "∞" : String(n);
}

// Recommend the next plan that increases the given resource over current.
// Legacy "free" rows promote to Starter; everything else climbs the ladder.
export function recommendedPlan(current: PlanType, _kind?: UsageKind): PlanType {
  if (current === "free" || current === "starter") return "pro";
  if (current === "pro") return "enterprise";
  return "enterprise";
}

export function trialDaysRemaining(trialEndsAt: string | null | undefined): number | null {
  if (!trialEndsAt) return null;
  const end = new Date(trialEndsAt).getTime();
  if (isNaN(end)) return null;
  const diff = end - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / 86_400_000);
}

// Map raw DB errors (from BEFORE INSERT trigger) to a friendly i18n key.
export function parsePlanLimitError(err: unknown): UsageKind | null {
  const msg = (err as any)?.message ?? String(err ?? "");
  const m = /PLAN_LIMIT_(USERS|PRODUCTS|LOCATIONS)/.exec(msg);
  if (!m) return null;
  return m[1].toLowerCase() as UsageKind;
}
