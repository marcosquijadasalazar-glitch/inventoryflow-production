// Shared plan metadata (kept in sync with public.plan_limits SQL function)
export type PlanType = "free" | "starter" | "pro" | "enterprise";

export type PlanLimits = {
  max_users: number | null;
  max_products: number | null;
  max_locations: number | null;
};

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  free:       { max_users: 2,    max_products: 100,  max_locations: 1 },
  starter:    { max_users: 3,    max_products: 500,  max_locations: 2 },
  pro:        { max_users: 25,   max_products: null, max_locations: 10 },
  enterprise: { max_users: null, max_products: null, max_locations: null },
};

export type UsageKind = "users" | "products" | "locations";

export type OrgUsage = {
  plan: PlanType;
  limits: PlanLimits;
  used: { users: number; products: number; locations: number };
};

export function isAtLimit(usage: OrgUsage | undefined, kind: UsageKind): boolean {
  if (!usage) return false;
  const limit =
    kind === "users" ? usage.limits.max_users
    : kind === "products" ? usage.limits.max_products
    : usage.limits.max_locations;
  if (limit == null) return false;
  return usage.used[kind] >= limit;
}

export function fmtLimit(n: number | null | undefined): string {
  return n == null ? "∞" : String(n);
}

// Map raw DB errors (from BEFORE INSERT trigger) to a friendly i18n key.
export function parsePlanLimitError(err: unknown): UsageKind | null {
  const msg = (err as any)?.message ?? String(err ?? "");
  const m = /PLAN_LIMIT_(USERS|PRODUCTS|LOCATIONS)/.exec(msg);
  if (!m) return null;
  return m[1].toLowerCase() as UsageKind;
}
