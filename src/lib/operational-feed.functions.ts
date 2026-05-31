import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "./security-auth";

/**
 * Operational feed = lightweight, human-friendly view of recent activity for
 * everyday users (employees, managers, owners). Sourced from
 * operational_audit_log but stripped of raw metadata payloads. This is the
 * read-side used by the History page.
 *
 * For investigation-grade detail (before/after, full metadata, ecosystem
 * scope), use the Audit Logs page + lib/audit.functions.
 */

const FEED_ACTIONS = [
  "product_created",
  "product_updated",
  "product_deleted",
  "inventory_added",
  "inventory_removed",
  "inventory_adjusted",
  "scanner_activity",
  "transfer_created",
  "transfer_completed",
  "transfer_status_changed",
  "adjustments_imported",
  "location_created",
  "location_updated",
] as const;

const Input = z.object({
  category: z.enum(["all", "inventory", "transfers", "scanner", "products", "locations"]).default("all"),
  search: z.string().nullable().optional(),
  limit: z.number().int().min(1).max(200).default(60),
  before: z.string().nullable().optional(), // ISO timestamp cursor
});

export type FeedItem = {
  id: string;
  created_at: string;
  category: "inventory" | "transfers" | "scanner" | "products" | "locations" | "other";
  action: string;
  title: string;
  subtitle: string | null;
  delta: string | null;
  actor: string | null;
};

function categoryFor(action: string): FeedItem["category"] {
  if (action === "scanner_activity") return "scanner";
  if (action.startsWith("inventory_") || action === "adjustments_imported") return "inventory";
  if (action.startsWith("transfer_")) return "transfers";
  if (action.startsWith("product_")) return "products";
  if (action.startsWith("location_")) return "locations";
  return "other";
}

function humanize(row: {
  action_type: string;
  entity_label: string | null;
  summary: string | null;
  metadata: any;
}): { title: string; subtitle: string | null; delta: string | null } {
  const m = (row.metadata ?? {}) as Record<string, any>;
  const label = row.entity_label ?? "item";

  switch (row.action_type) {
    case "inventory_added": {
      const qty = m.quantity ?? "—";
      const where = m.location ? ` at ${m.location}` : "";
      return { title: `${qty} units added to ${label}${where}`, subtitle: null, delta: `+${qty}` };
    }
    case "inventory_removed": {
      const qty = m.quantity ?? "—";
      return { title: `${qty} units removed from ${label}`, subtitle: null, delta: `-${qty}` };
    }
    case "inventory_adjusted": {
      return { title: `Stock updated for ${label}`, subtitle: m.note ?? null, delta: m.quantity != null ? `set ${m.quantity}` : null };
    }
    case "scanner_activity": {
      return { title: `Scanner updated ${label}`, subtitle: m.note ?? null, delta: m.quantity != null ? `${m.type === "remove" ? "-" : "+"}${m.quantity}` : null };
    }
    case "transfer_created":
      return { title: `Transfer started · ${label}`, subtitle: null, delta: null };
    case "transfer_completed":
      return { title: `Transfer completed · ${label}`, subtitle: null, delta: null };
    case "transfer_status_changed":
      return { title: `Transfer ${label} updated`, subtitle: m.from_status && m.to_status ? `${m.from_status} → ${m.to_status}` : null, delta: null };
    case "adjustments_imported": {
      const ok = m.inserted ?? 0;
      return { title: `${ok} stock adjustments imported`, subtitle: m.products_touched ? `${m.products_touched} products updated` : null, delta: null };
    }
    case "product_created":
      return { title: `New product added · ${label}`, subtitle: null, delta: null };
    case "product_updated": {
      let delta: string | null = null;
      if (typeof m.stock_before === "number" && typeof m.stock_after === "number" && m.stock_before !== m.stock_after) {
        const d = m.stock_after - m.stock_before;
        delta = `${d > 0 ? "+" : ""}${d}`;
      }
      return { title: `${label} details updated`, subtitle: null, delta };
    }
    case "product_deleted":
      return { title: `Product removed · ${label}`, subtitle: null, delta: null };
    case "location_created":
      return { title: `New location · ${label}`, subtitle: null, delta: null };
    case "location_updated":
      return { title: `${label} details updated`, subtitle: null, delta: null };
    default:
      return { title: row.summary ?? row.action_type, subtitle: null, delta: null };
  }
}

export const listOperationalFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Input.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = (supabase as any)
      .from("operational_audit_log")
      .select("id, created_at, action_type, entity_label, summary, metadata, actor_email")
      .in("action_type", FEED_ACTIONS as unknown as string[])
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.before) q = q.lt("created_at", data.before);
    if (data.search) {
      const s = data.search.replace(/[,%]/g, " ").trim();
      if (s) q = q.or(`entity_label.ilike.%${s}%,summary.ilike.%${s}%,actor_email.ilike.%${s}%`);
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    let items: FeedItem[] = (rows ?? []).map((r: any) => {
      const h = humanize(r);
      return {
        id: r.id,
        created_at: r.created_at,
        category: categoryFor(r.action_type),
        action: r.action_type,
        title: h.title,
        subtitle: h.subtitle,
        delta: h.delta,
        actor: r.actor_email ?? null,
      };
    });

    if (data.category !== "all") {
      items = items.filter((i) => i.category === data.category);
    }

    return { items, next_cursor: items.length === data.limit ? items[items.length - 1]?.created_at ?? null : null };
  });
