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

export const PLAN_ORDER: PlanType[] = ["free", "starter", "pro", "enterprise"];

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
export function recommendedPlan(current: PlanType, kind?: UsageKind): PlanType {
  const start = PLAN_ORDER.indexOf(current);
  if (start === -1) return "pro";
  const key =
    kind === "users" ? "max_users"
    : kind === "products" ? "max_products"
    : kind === "locations" ? "max_locations"
    : null;
  if (!key) {
    return PLAN_ORDER[Math.min(start + 1, PLAN_ORDER.length - 1)];
  }
  const currentLim = PLAN_LIMITS[current][key];
  for (let i = start + 1; i < PLAN_ORDER.length; i++) {
    const next = PLAN_ORDER[i];
    const lim = PLAN_LIMITS[next][key];
    if (lim == null || (currentLim != null && lim > currentLim)) return next;
  }
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
