import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "./security-auth";

const ListInput = z.object({
  search: z.string().nullable().optional(),
  action: z.string().nullable().optional(),
  entity_type: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  date_from: z.string().nullable().optional(),
  date_to: z.string().nullable().optional(),
  scope: z.enum(["org", "ecosystem"]).default("org"),
  page: z.number().int().min(0).max(10000).default(0),
  page_size: z.number().int().min(1).max(200).default(50),
});

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [k: string]: JsonValue };

export type OperationalAuditRow = {
  id: string;
  created_at: string;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  entity_label: string | null;
  summary: string | null;
  metadata: JsonValue;
  actor_user_id: string | null;
  actor_email: string | null;
  organization_id: string | null;
};

/**
 * Categorize an action_type into a coarse operational category.
 * Used for filter UI and badge coloring.
 */
export function categorizeAction(action: string): string {
  if (action.startsWith("product_")) return "products";
  if (action.startsWith("inventory_") || action === "scanner_activity")
    return "inventory";
  if (action.startsWith("transfer_")) return "transfers";
  if (action.startsWith("location_")) return "locations";
  if (action === "role_changed") return "access";
  return "other";
}

export const listOperationalAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => ListInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const from = data.page * data.page_size;
    const to = from + data.page_size - 1;

    // Resolve caller role + org for scope enforcement.
    const { data: me } = await (supabase as any)
      .from("profiles")
      .select("role, organization_id")
      .maybeSingle();
    const isSuper = me?.role === "super_admin";

    let q = (supabase as any)
      .from("operational_audit_log")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    // Only super_admin can request ecosystem scope; everyone else is org-bound
    // both by RLS and explicitly here for clarity.
    if (!isSuper || data.scope === "org") {
      if (me?.organization_id) q = q.eq("organization_id", me.organization_id);
    }

    if (data.action) q = q.eq("action_type", data.action);
    if (data.entity_type) q = q.eq("entity_type", data.entity_type);
    if (data.date_from) q = q.gte("created_at", data.date_from);
    if (data.date_to) q = q.lte("created_at", data.date_to);
    if (data.search) {
      const s = data.search.replace(/[,%]/g, " ").trim();
      if (s) {
        q = q.or(
          `actor_email.ilike.%${s}%,entity_label.ilike.%${s}%,summary.ilike.%${s}%`,
        );
      }
    }

    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);

    let filtered = (rows ?? []) as OperationalAuditRow[];
    if (data.category) {
      filtered = filtered.filter(
        (r) => categorizeAction(r.action_type) === data.category,
      );
    }

    return {
      rows: filtered,
      total: count ?? 0,
      page: data.page,
      page_size: data.page_size,
      is_super_admin: !!isSuper,
    };
  });

export const listOperationalAuditActions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await (supabase as any)
      .from("operational_audit_log")
      .select("action_type")
      .limit(1000);
    if (error) throw new Error(error.message);
    const set = new Set<string>();
    for (const r of (data ?? []) as { action_type: string }[])
      set.add(r.action_type);
    return Array.from(set).sort();
  });

export const operationalAuditStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({ scope: z.enum(["org", "ecosystem"]).default("org") })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: me } = await (supabase as any)
      .from("profiles")
      .select("role, organization_id")
      .maybeSingle();
    const isSuper = me?.role === "super_admin";

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let q = (supabase as any)
      .from("operational_audit_log")
      .select("action_type, actor_user_id, created_at", { count: "exact" })
      .gte("created_at", since)
      .limit(5000);

    if (!isSuper || data.scope === "org") {
      if (me?.organization_id) q = q.eq("organization_id", me.organization_id);
    }

    const { data: rows, count } = await q;
    const list = (rows ?? []) as {
      action_type: string;
      actor_user_id: string | null;
    }[];

    const byCategory: Record<string, number> = {};
    const actors = new Set<string>();
    for (const r of list) {
      const cat = categorizeAction(r.action_type);
      byCategory[cat] = (byCategory[cat] ?? 0) + 1;
      if (r.actor_user_id) actors.add(r.actor_user_id);
    }

    return {
      total_24h: count ?? list.length,
      active_users_24h: actors.size,
      by_category: byCategory,
    };
  });
