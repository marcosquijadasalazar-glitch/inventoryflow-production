// Granular RBAC permission catalog. Shared between client (gating) and server
// (validation). DB enum `app_permission` must stay in sync with this list.
export const ALL_PERMISSIONS = [
  "view_dashboard",
  "view_products",
  "create_products",
  "edit_products",
  "delete_products",
  "view_costs",
  "view_prices",
  "view_movements",
  "create_movements",
  "adjust_stock",
  "view_transaction_history",
  "export_data",
  "view_reports",
  "manage_purchase_orders",
  "manage_sales_orders",
  "record_payments",
  "manage_transfer_orders",
  "manage_internal_use",
  "use_barcode_scanner",
  "print_labels",
  "manage_alerts",
  "manage_locations",
  "manage_users",
  "manage_company_settings",
] as const;

export type AppPermission = (typeof ALL_PERMISSIONS)[number];

export type ManageableRole = "owner" | "manager" | "employee" | "custom";
export const MANAGEABLE_ROLES: ManageableRole[] = [
  "owner",
  "manager",
  "employee",
  "custom",
];

// Mirrors the SQL fallback in has_permission(). Used by the UI to show the
// "inherited" default for a (role, permission) cell when nothing in
// role_permissions overrides it.
export const DEFAULT_ROLE_PERMISSIONS: Record<ManageableRole, AppPermission[]> = {
  owner: [...ALL_PERMISSIONS],
  manager: [
    "view_dashboard",
    "view_products",
    "create_products",
    "edit_products",
    "delete_products",
    "view_costs",
    "view_prices",
    "view_movements",
    "create_movements",
    "adjust_stock",
    "view_transaction_history",
    "export_data",
    "view_reports",
    "manage_purchase_orders",
    "manage_sales_orders",
    "record_payments",
    "manage_transfer_orders",
    "manage_internal_use",
    "use_barcode_scanner",
    "print_labels",
    "manage_alerts",
    "manage_locations",
  ],
  employee: [
    "view_dashboard",
    "view_products",
    "view_movements",
    "create_movements",
    "use_barcode_scanner",
    "manage_internal_use",
  ],
  custom: [],
};

export function isDefaultGranted(role: ManageableRole, perm: AppPermission): boolean {
  return DEFAULT_ROLE_PERMISSIONS[role].includes(perm);
}

export const PERMISSION_GROUPS: { key: string; perms: AppPermission[] }[] = [
  { key: "general", perms: ["view_dashboard"] },
  {
    key: "products",
    perms: [
      "view_products",
      "create_products",
      "edit_products",
      "delete_products",
      "view_costs",
      "view_prices",
    ],
  },
  {
    key: "inventory",
    perms: [
      "view_movements",
      "create_movements",
      "adjust_stock",
      "view_transaction_history",
      "use_barcode_scanner",
      "print_labels",
    ],
  },
  {
    key: "orders",
    perms: [
      "manage_purchase_orders",
      "manage_sales_orders",
      "record_payments",
      "manage_transfer_orders",
      "manage_internal_use",
    ],
  },
  {
    key: "reports",
    perms: ["view_reports", "export_data"],
  },
  {
    key: "operations",
    perms: ["manage_alerts", "manage_locations"],
  },
  {
    key: "admin",
    perms: ["manage_users", "manage_company_settings"],
  },
];

// Sidebar/route -> required permission. Used to hide nav items and block
// direct route access. null = no permission required (public to authed users).
export const PERMISSION_FOR_PATH: Record<string, AppPermission | null> = {
  "/dashboard": "view_dashboard",
  "/products": "view_products",
  "/movements": "view_movements",
  "/purchase-orders": "manage_purchase_orders",
  "/sales-orders": "manage_sales_orders",
  "/customers": "manage_sales_orders",
  "/suppliers": "manage_purchase_orders",
  "/transfer-orders": "manage_transfer_orders",
  "/locations": "manage_locations",
  "/location-stock": "manage_locations",
  "/adjustments": "adjust_stock",
  "/internal-use": "manage_internal_use",
  "/history": "view_transaction_history",
  "/reports": "view_reports",
  "/scanner": "use_barcode_scanner",
  "/alerts": "manage_alerts",
  "/settings": "manage_company_settings",
  "/users": "manage_users",
};

export function permissionForPath(pathname: string): AppPermission | null {
  for (const route of Object.keys(PERMISSION_FOR_PATH)) {
    if (pathname === route || pathname.startsWith(route + "/")) {
      return PERMISSION_FOR_PATH[route];
    }
  }
  return null;
}
