import { createServerFn } from "@tanstack/react-start";
import { gzipSync } from "node:zlib";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BACKUP_TABLES = [
  "organizations",
  "profiles",
  "products",
  "product_categories",
  "inventory_movements",
  "transaction_history",
  "customers",
  "suppliers",
  "locations",
  "purchase_orders",
  "purchase_order_items",
  "sales_orders",
  "sales_order_items",
  "sales_order_payments",
  "transfer_orders",
  "transfer_order_items",
  "role_permissions",
  "user_permissions",
  "company_settings",
] as const;

async function assertSuperAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("role, email")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.role !== "super_admin") throw new Error("Forbidden: super admin only");
  return data;
}

async function dumpTable(name: string): Promise<unknown[]> {
  const rows: unknown[] = [];
  const pageSize = 1000;
  let from = 0;
  // paginate to bypass the default 1000-row limit
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabaseAdmin
      .from(name as never)
      .select("*")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${name}: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...(data as unknown[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

export const generateBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const admin = await assertSuperAdmin(userId);

    const generated_at = new Date().toISOString();
    const tables: Record<string, unknown[]> = {};
    const counts: Record<string, number> = {};

    for (const t of BACKUP_TABLES) {
      const rows = await dumpTable(t);
      tables[t] = rows;
      counts[t] = rows.length;
    }

    const payload = {
      meta: {
        format: "inventoryflow.backup.v1",
        generated_at,
        generated_by: admin.email ?? userId,
        tables: BACKUP_TABLES,
        counts,
      },
      data: tables,
    };

    const json = JSON.stringify(payload);
    const gz = gzipSync(Buffer.from(json, "utf8"));
    const base64 = gz.toString("base64");
    const total_rows = Object.values(counts).reduce((a, b) => a + b, 0);

    await supabaseAdmin.from("admin_audit_log" as never).insert({
      action_type: "backup_generated",
      target_type: "system",
      target_id: userId,
      target_label: "Full database backup",
      performed_by: userId,
      performed_by_email: admin.email ?? null,
      metadata: {
        generated_at,
        compressed_size_bytes: gz.byteLength,
        uncompressed_size_bytes: json.length,
        total_rows,
        counts,
      },
    } as never);

    return {
      generated_at,
      compressed_size_bytes: gz.byteLength,
      uncompressed_size_bytes: json.length,
      total_rows,
      counts,
      filename: `inventoryflow-backup-${generated_at.replace(/[:.]/g, "-")}.json.gz`,
      base64,
    };
  });

export const listBackups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("admin_audit_log")
      .select("id, created_at, performed_by_email, metadata")
      .eq("action_type", "backup_generated")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });
