import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "./security-auth";

export type LowStockRisk = {
  product_id: string;
  name: string;
  sku: string;
  stock: number;
  min_stock: number;
  avg_daily_usage: number;
  days_remaining: number | null;
};

export type ReorderSuggestion = {
  product_id: string;
  name: string;
  sku: string;
  stock: number;
  min_stock: number;
  recent_velocity: number; // units/day last 7d
  baseline_velocity: number; // units/day last 30d
  days_remaining: number | null;
  suggested_reorder: number;
};

export type Anomaly = {
  product_id: string;
  name: string;
  sku: string;
  kind: "spike_removals" | "spike_adjustments" | "repeated_scans";
  detail: string;
};

export type MoverRow = {
  product_id: string;
  name: string;
  sku: string;
  total_units: number;
  movement_count: number;
};

export type DeadStockRow = {
  product_id: string;
  name: string;
  sku: string;
  stock: number;
  last_activity: string | null;
  days_inactive: number;
};

export type FrequentScan = {
  product_id: string;
  name: string;
  sku: string;
  scan_count: number;
};

export type InsightsBundle = {
  generated_at: string;
  low_stock_risk: LowStockRisk[];
  reorder_suggestions: ReorderSuggestion[];
  anomalies: Anomaly[];
  fast_movers: MoverRow[];
  slow_movers: MoverRow[];
  dead_inventory: DeadStockRow[];
  frequently_scanned: FrequentScan[];
  summary: {
    low_stock_risk_count: number;
    fast_movers_count: number;
    anomalies_count: number;
    dead_inventory_count: number;
  };
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const getInventoryInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InsightsBundle> => {
    const { supabase } = context;
    const now = Date.now();
    const since30 = new Date(now - 30 * DAY_MS).toISOString();
    const since7 = new Date(now - 7 * DAY_MS).toISOString();
    const since45 = new Date(now - 45 * DAY_MS).toISOString();

    const [productsRes, movements30Res] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, sku, stock, min_stock, updated_at, created_at")
        .limit(2000),
      supabase
        .from("inventory_movements")
        .select("product_id, type, quantity, note, created_at")
        .gte("created_at", since30)
        .limit(5000),
    ]);

    if (productsRes.error) throw new Error(productsRes.error.message);
    if (movements30Res.error) throw new Error(movements30Res.error.message);

    const products = productsRes.data ?? [];
    const movements = movements30Res.data ?? [];
    const productById = new Map(products.map((p: any) => [p.id, p]));

    // Per-product aggregates
    type Agg = {
      removed30: number;
      removed7: number;
      adjustments30: number;
      adjustments7: number;
      added30: number;
      moves30: number;
      moves7: number;
      lastActivity: string | null;
      scanCountToday: number;
      scans: { ts: number }[];
    };
    const agg = new Map<string, Agg>();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();

    for (const m of movements as any[]) {
      const a = agg.get(m.product_id) ?? {
        removed30: 0,
        removed7: 0,
        adjustments30: 0,
        adjustments7: 0,
        added30: 0,
        moves30: 0,
        moves7: 0,
        lastActivity: null,
        scanCountToday: 0,
        scans: [],
      };
      const ts = new Date(m.created_at).getTime();
      const within7 = ts >= now - 7 * DAY_MS;
      a.moves30 += 1;
      if (within7) a.moves7 += 1;
      if (m.type === "remove") {
        a.removed30 += m.quantity;
        if (within7) a.removed7 += m.quantity;
      } else if (m.type === "adjustment") {
        a.adjustments30 += 1;
        if (within7) a.adjustments7 += 1;
      } else if (m.type === "add") {
        a.added30 += m.quantity;
      }
      if (!a.lastActivity || ts > new Date(a.lastActivity).getTime()) {
        a.lastActivity = m.created_at;
      }
      const isScan = typeof m.note === "string" && m.note.startsWith("[scan]");
      if (isScan) {
        a.scans.push({ ts });
        if (ts >= todayMs) a.scanCountToday += 1;
      }
      agg.set(m.product_id, a);
    }

    // 1. Low stock risk + reorder suggestions
    const lowStockRisk: LowStockRisk[] = [];
    const reorderSuggestions: ReorderSuggestion[] = [];
    for (const p of products as any[]) {
      const a = agg.get(p.id);
      const removed30 = a?.removed30 ?? 0;
      const removed7 = a?.removed7 ?? 0;
      const avgDaily = removed30 / 30;
      const recentDaily = removed7 / 7;
      const usage = Math.max(avgDaily, recentDaily * 0.7); // weighted toward recent
      const daysRemaining =
        usage > 0 ? Math.floor(p.stock / usage) : null;

      if (
        usage > 0 &&
        daysRemaining !== null &&
        daysRemaining <= 7 &&
        p.stock > 0
      ) {
        lowStockRisk.push({
          product_id: p.id,
          name: p.name,
          sku: p.sku,
          stock: p.stock,
          min_stock: p.min_stock,
          avg_daily_usage: Number(usage.toFixed(2)),
          days_remaining: daysRemaining,
        });
      }

      // Reorder: stock at/below threshold OR depleting in <=14 days
      const atThreshold = p.min_stock > 0 && p.stock <= p.min_stock * 1.5;
      const depletingSoon = daysRemaining !== null && daysRemaining <= 14;
      if (
        (atThreshold || depletingSoon) &&
        usage > 0 &&
        p.stock >= 0
      ) {
        const suggested = Math.max(
          p.min_stock * 2,
          Math.ceil(usage * 21), // 3 weeks supply
        );
        reorderSuggestions.push({
          product_id: p.id,
          name: p.name,
          sku: p.sku,
          stock: p.stock,
          min_stock: p.min_stock,
          recent_velocity: Number(recentDaily.toFixed(2)),
          baseline_velocity: Number(avgDaily.toFixed(2)),
          days_remaining: daysRemaining,
          suggested_reorder: suggested,
        });
      }
    }

    lowStockRisk.sort(
      (a, b) => (a.days_remaining ?? 999) - (b.days_remaining ?? 999),
    );
    reorderSuggestions.sort(
      (a, b) => (a.days_remaining ?? 999) - (b.days_remaining ?? 999),
    );

    // 2. Anomalies
    const anomalies: Anomaly[] = [];
    for (const [pid, a] of agg.entries()) {
      const p: any = productById.get(pid);
      if (!p) continue;

      // Spike: removed7 > 3x (avg weekly = removed30/4.3)
      const avgWeekly = a.removed30 / (30 / 7);
      if (a.removed7 >= 10 && a.removed7 > avgWeekly * 3 && avgWeekly > 0) {
        anomalies.push({
          product_id: pid,
          name: p.name,
          sku: p.sku,
          kind: "spike_removals",
          detail: `${a.removed7} units removed in 7d (avg ${avgWeekly.toFixed(1)})`,
        });
        continue;
      }
      if (a.adjustments7 >= 5) {
        anomalies.push({
          product_id: pid,
          name: p.name,
          sku: p.sku,
          kind: "spike_adjustments",
          detail: `${a.adjustments7} adjustments in last 7 days`,
        });
        continue;
      }
      // Repeated scans: 5+ scans today on same product
      if (a.scanCountToday >= 5) {
        anomalies.push({
          product_id: pid,
          name: p.name,
          sku: p.sku,
          kind: "repeated_scans",
          detail: `${a.scanCountToday} scans today`,
        });
      }
    }

    // 3. Fast / slow movers
    const movers: MoverRow[] = [];
    for (const [pid, a] of agg.entries()) {
      const p: any = productById.get(pid);
      if (!p) continue;
      movers.push({
        product_id: pid,
        name: p.name,
        sku: p.sku,
        total_units: a.removed30 + a.added30,
        movement_count: a.moves30,
      });
    }
    const fastMovers = [...movers]
      .sort((a, b) => b.total_units - a.total_units)
      .slice(0, 5);
    const slowMovers = [...movers]
      .filter((m) => m.movement_count > 0)
      .sort((a, b) => a.movement_count - b.movement_count)
      .slice(0, 5);

    // 4. Dead inventory: products with stock > 0 and no activity in 45 days
    const deadInventory: DeadStockRow[] = [];
    for (const p of products as any[]) {
      if (p.stock <= 0) continue;
      const a = agg.get(p.id);
      const last = a?.lastActivity ?? p.updated_at ?? p.created_at;
      const lastMs = new Date(last).getTime();
      if (lastMs <= now - 45 * DAY_MS) {
        deadInventory.push({
          product_id: p.id,
          name: p.name,
          sku: p.sku,
          stock: p.stock,
          last_activity: a?.lastActivity ?? null,
          days_inactive: Math.floor((now - lastMs) / DAY_MS),
        });
      }
    }
    deadInventory.sort((a, b) => b.days_inactive - a.days_inactive);

    // 5. Frequently scanned (today)
    const frequentlyScanned: FrequentScan[] = [];
    for (const [pid, a] of agg.entries()) {
      if (a.scanCountToday <= 0) continue;
      const p: any = productById.get(pid);
      if (!p) continue;
      frequentlyScanned.push({
        product_id: pid,
        name: p.name,
        sku: p.sku,
        scan_count: a.scanCountToday,
      });
    }
    frequentlyScanned.sort((a, b) => b.scan_count - a.scan_count);

    // touch since45 to keep typescript happy; used implicitly above
    void since45;

    return {
      generated_at: new Date().toISOString(),
      low_stock_risk: lowStockRisk.slice(0, 10),
      reorder_suggestions: reorderSuggestions.slice(0, 10),
      anomalies: anomalies.slice(0, 10),
      fast_movers: fastMovers,
      slow_movers: slowMovers,
      dead_inventory: deadInventory.slice(0, 10),
      frequently_scanned: frequentlyScanned.slice(0, 5),
      summary: {
        low_stock_risk_count: lowStockRisk.length,
        fast_movers_count: fastMovers.length,
        anomalies_count: anomalies.length,
        dead_inventory_count: deadInventory.length,
      },
    };
  });
