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

export const PRESET_NAMES = ["basic", "operations", "pro", "enterprise", "custom"] as const;
export type PresetName = (typeof PRESET_NAMES)[number];

const BASIC: ModuleKey[] = ["dashboard", "products", "movements", "scanner", "alerts", "settings", "users"];
const OPERATIONS: ModuleKey[] = [...BASIC, "purchase_orders", "sales_orders", "history"];
const PRO: ModuleKey[] = [...OPERATIONS, "transfer_orders", "internal_use", "reports", "exports"];

function toMap(enabled: ModuleKey[]): ModuleMap {
  const map = {} as ModuleMap;
  for (const k of MODULE_KEYS) map[k] = enabled.includes(k);
  return map;
}

export const MODULE_PRESETS: Record<Exclude<PresetName, "custom">, ModuleMap> = {
  basic: toMap(BASIC),
  operations: toMap(OPERATIONS),
  pro: toMap(PRO),
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
  for (const name of ["basic", "operations", "pro", "enterprise"] as const) {
    if (sig(MODULE_PRESETS[name]) === cur) return name;
  }
  return "custom";
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
