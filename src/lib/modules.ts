// Module catalog + presets for org-level feature gating.
export const MODULE_KEYS = [
  "dashboard",
  "products",
  "movements",
  "scanner",
  "history",
  "purchase_orders",
  "sales_orders",
  "transfer_orders",
  "internal_use",
  "location_stock",
  "alerts",
  "reports",
  "exports",
  "settings",
  "users",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];
export type ModuleMap = Record<ModuleKey, boolean>;

export const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: "Dashboard",
  products: "Products",
  movements: "Movements",
  scanner: "Barcode Scanner",
  history: "Transaction History",
  purchase_orders: "Purchase Orders",
  sales_orders: "Sales Orders",
  transfer_orders: "Transfer Orders",
  internal_use: "Internal Use",
  location_stock: "Location Stock",
  alerts: "Alerts",
  reports: "Reports",
  exports: "Exports",
  settings: "Settings",
  users: "Users",
};

// Map module -> sidebar/route paths that should be hidden/blocked when disabled.
export const MODULE_ROUTES: Record<ModuleKey, string[]> = {
  dashboard: ["/dashboard"],
  products: ["/products"],
  movements: ["/movements"],
  scanner: ["/scanner"],
  history: ["/history"],
  purchase_orders: ["/purchase-orders"],
  sales_orders: ["/sales-orders"],
  transfer_orders: ["/transfer-orders"],
  internal_use: ["/internal-use"],
  location_stock: ["/location-stock"],
  alerts: ["/alerts"],
  reports: ["/reports"],
  exports: [],
  settings: ["/settings"],
  users: [],
};

// Plan presets. Names mirror public.org_plan + "custom" for overrides.
// MUST mirror public.plan_modules() in SQL.
export const PRESET_NAMES = ["free", "starter", "pro", "enterprise", "custom"] as const;
export type PresetName = (typeof PRESET_NAMES)[number];
export type PlanPresetName = Exclude<PresetName, "custom">;

// Under the current pricing model, monetization is by capacity (users,
// products, locations) — NOT by feature locks. All paid plans get every
// module. The "free" preset is kept only for historical/legacy orgs.
const FREE: ModuleKey[] = [...MODULE_KEYS];
const STARTER: ModuleKey[] = [...MODULE_KEYS];
const PRO_PRESET: ModuleKey[] = [...MODULE_KEYS];

function toMap(enabled: ModuleKey[]): ModuleMap {
  const map = {} as ModuleMap;
  for (const k of MODULE_KEYS) map[k] = enabled.includes(k);
  return map;
}

export const MODULE_PRESETS: Record<PlanPresetName, ModuleMap> = {
  free: toMap(FREE),
  starter: toMap(STARTER),
  pro: toMap(PRO_PRESET),
  enterprise: toMap([...MODULE_KEYS]),
};

export const ALL_ENABLED: ModuleMap = toMap([...MODULE_KEYS]);

export function normalizeModules(input: unknown): ModuleMap {
  const src = (input && typeof input === "object" ? (input as Record<string, unknown>) : {});
  const map = {} as ModuleMap;
  for (const k of MODULE_KEYS) {
    const v = src[k];
    map[k] = v === undefined ? true : v === true;
  }
  return map;
}

export function detectPreset(modules: ModuleMap): PresetName {
  const sig = (m: ModuleMap) => MODULE_KEYS.map((k) => (m[k] ? "1" : "0")).join("");
  const cur = sig(modules);
  for (const name of ["free", "starter", "pro", "enterprise"] as const) {
    if (sig(MODULE_PRESETS[name]) === cur) return name;
  }
  return "custom";
}

// Module keys where current map differs from the plan preset.
export function diffModulesFromPlan(modules: ModuleMap, plan: PlanPresetName): ModuleKey[] {
  const preset = MODULE_PRESETS[plan];
  return MODULE_KEYS.filter((k) => modules[k] !== preset[k]);
}

// Returns the module key associated with a given pathname, or null if none.
export function moduleForPath(pathname: string): ModuleKey | null {
  for (const key of MODULE_KEYS) {
    for (const route of MODULE_ROUTES[key]) {
      if (pathname === route || pathname.startsWith(route + "/")) return key;
    }
  }
  return null;
}

// Minimum plan tier required to access each module. Drives the "visible
// locked" upsell UX in the sidebar — modules above the org's current plan
// are shown but rendered as locked; clicking opens the Upgrade dialog.
import type { PlanType } from "./plan-limits";

export const MODULE_MIN_PLAN: Record<ModuleKey, PlanType> = {
  dashboard: "free",
  products: "free",
  movements: "free",
  scanner: "free",
  alerts: "free",
  settings: "free",
  users: "free",
  purchase_orders: "starter",
  sales_orders: "starter",
  history: "starter",
  transfer_orders: "pro",
  internal_use: "pro",
  location_stock: "pro",
  reports: "pro",
  exports: "pro",
};

const PLAN_RANK: Record<PlanType, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  enterprise: 3,
};

export function isPlanSufficient(current: PlanType, required: PlanType): boolean {
  return PLAN_RANK[current] >= PLAN_RANK[required];
}

export function isModuleLockedByPlan(key: ModuleKey, plan: PlanType): boolean {
  return !isPlanSufficient(plan, MODULE_MIN_PLAN[key]);
}

