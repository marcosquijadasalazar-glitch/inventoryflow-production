import type { QueryClient } from "@tanstack/react-query";

/**
 * Invalidate the derived/secondary query caches that watch any write
 * (audit log, security activity, notifications, approvals, insights).
 *
 * Mutation handlers should still invalidate their primary keys
 * (["products"], ["transfer_orders"], etc.) — this helper covers the
 * dependent panels that admin/owner accounts watch and that previously
 * went stale after writes because no one invalidated them.
 */
/** Invalidate caches that reflect on-hand / per-location stock after inventory writes. */
export function invalidateInventoryCaches(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["product_location_stock"] });
  qc.invalidateQueries({ queryKey: ["products"] });
  qc.invalidateQueries({ queryKey: ["movements"] });
  qc.invalidateQueries({ queryKey: ["transfer_orders"] });
  qc.invalidateQueries({ queryKey: ["product-reservations"] });
  qc.invalidateQueries({ queryKey: ["location_stock"] });
}

export function invalidateDerived(qc: QueryClient) {
  // Audit Logs (Settings → Audit)
  qc.invalidateQueries({ queryKey: ["op-audit"] });
  qc.invalidateQueries({ queryKey: ["op-audit-stats"] });
  qc.invalidateQueries({ queryKey: ["op-audit-actions"] });
  qc.invalidateQueries({ queryKey: ["admin", "audit"] });
  qc.invalidateQueries({ queryKey: ["org-audit"] });

  // Security Activity (Settings → Security)
  qc.invalidateQueries({ queryKey: ["security-activity"] });

  // Notifications bell
  qc.invalidateQueries({ queryKey: ["notifications"] });

  // Approvals tab (queued requests + analytics)
  qc.invalidateQueries({ queryKey: ["approval-requests"] });
  qc.invalidateQueries({ queryKey: ["approval-analytics"] });

  // Dashboard widgets that aggregate movements/products/orders
  qc.invalidateQueries({ queryKey: ["inventory-insights"] });
}
