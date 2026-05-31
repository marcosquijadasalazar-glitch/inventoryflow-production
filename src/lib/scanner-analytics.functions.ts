import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "./security-auth";

export type ScannerAnalytics = {
  scansToday: number;
  receivingToday: number;
  transfersToday: number;
  topProducts: { product_id: string | null; name: string; count: number }[];
  busiestLocation: { name: string; count: number } | null;
};

export type ScannerActivityEntry = {
  id: string;
  created_at: string;
  type: string;
  product_name: string | null;
  sku: string | null;
  quantity_change: number | null;
  reason: string | null;
  user_email: string | null;
};

/**
 * Aggregate today's scanner activity from transaction_history filtered to
 * source = 'barcode_scan'. Org isolation is enforced by RLS.
 */
export const getScannerAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ScannerAnalytics> => {
    const { supabase } = context;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from("transaction_history")
      .select("type, product_id, product_name, reason")
      .eq("source", "barcode_scan")
      .gte("created_at", startOfDay.toISOString())
      .limit(2000);
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    let receiving = 0;
    let transfers = 0;
    const productCounts = new Map<
      string,
      { product_id: string | null; name: string; count: number }
    >();
    const locationCounts = new Map<string, number>();

    for (const r of rows) {
      if (r.type === "stock_added") receiving++;
      // Transfers in this app create a remove+add pair on barcode_scan;
      // we approximate by counting "Transfer" mentions in note.
      const reason = (r.reason ?? "").toLowerCase();
      if (reason.includes("transfer")) transfers++;

      const key = r.product_id ?? `name:${r.product_name ?? ""}`;
      const existing = productCounts.get(key);
      if (existing) existing.count += 1;
      else
        productCounts.set(key, {
          product_id: r.product_id ?? null,
          name: r.product_name ?? "—",
          count: 1,
        });

      // Naive parse: notes look like "[scan] ... @LocationName ..."
      const at = (r.reason ?? "").match(/@([^|]+?)(?:\s|$|→|\|)/);
      if (at) {
        const loc = at[1].trim();
        locationCounts.set(loc, (locationCounts.get(loc) ?? 0) + 1);
      }
    }

    const topProducts = [...productCounts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    let busiestLocation: ScannerAnalytics["busiestLocation"] = null;
    for (const [name, count] of locationCounts) {
      if (!busiestLocation || count > busiestLocation.count) {
        busiestLocation = { name, count };
      }
    }

    return {
      scansToday: rows.length,
      receivingToday: receiving,
      transfersToday: transfers,
      topProducts,
      busiestLocation,
    };
  });

/**
 * Recent scanner activity feed (last 50). RLS scopes to caller's org.
 */
export const getScannerActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ScannerActivityEntry[]> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("transaction_history")
      .select(
        "id, created_at, type, product_name, sku, quantity_change, reason, user_email",
      )
      .eq("source", "barcode_scan")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []) as ScannerActivityEntry[];
  });
