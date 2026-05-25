import { gzipSync } from "node:zlib";
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

export type BackupType = "daily" | "monthly" | "manual";
export const BACKUP_BUCKET = "backups";

export async function assertSuperAdmin(userId: string) {
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

export async function runBackupCore(opts: {
  type: BackupType;
  operatorId?: string | null;
  operatorEmail?: string | null;
  upload?: boolean;
}) {
  const { type, operatorId = null, operatorEmail = null, upload = true } = opts;
  const generated_at = new Date().toISOString();
  const stamp = generated_at.replace(/[:.]/g, "-");
  const filename = `inventoryflow-backup-${type}-${stamp}.json.gz`;
  const storage_path = `${type}/${filename}`;

  try {
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
        type,
        generated_at,
        generated_by: operatorEmail ?? operatorId ?? "system",
        tables: BACKUP_TABLES,
        counts,
      },
      data: tables,
    };

    const json = JSON.stringify(payload);
    const gz = gzipSync(Buffer.from(json, "utf8"));
    const total_rows = Object.values(counts).reduce((a, b) => a + b, 0);

    if (upload) {
      const { error: upErr } = await supabaseAdmin.storage
        .from(BACKUP_BUCKET)
        .upload(storage_path, gz, { contentType: "application/gzip", upsert: false });
      if (upErr) throw new Error(`storage upload failed: ${upErr.message}`);
    }

    await supabaseAdmin.from("admin_audit_log" as never).insert({
      action_type: "backup_generated",
      target_type: "system",
      target_id: operatorId,
      target_label: `Backup (${type})`,
      performed_by: operatorId,
      performed_by_email: operatorEmail,
      new_status: "success",
      metadata: {
        type,
        status: "success",
        generated_at,
        compressed_size_bytes: gz.byteLength,
        uncompressed_size_bytes: json.length,
        total_rows,
        counts,
        storage_path: upload ? storage_path : null,
        filename,
      },
    } as never);

    return {
      status: "success" as const,
      type,
      generated_at,
      filename,
      storage_path: upload ? storage_path : null,
      compressed_size_bytes: gz.byteLength,
      uncompressed_size_bytes: json.length,
      total_rows,
      counts,
      base64: upload ? null : gz.toString("base64"),
    };
  } catch (e: any) {
    await supabaseAdmin.from("admin_audit_log" as never).insert({
      action_type: "backup_generated",
      target_type: "system",
      target_id: operatorId,
      target_label: `Backup (${type}) FAILED`,
      performed_by: operatorId,
      performed_by_email: operatorEmail,
      new_status: "failure",
      metadata: {
        type,
        status: "failure",
        generated_at,
        error: String(e?.message ?? e),
      },
    } as never);
    throw e;
  }
}

export async function cleanupBackupsCore() {
  const now = Date.now();
  const deleted: string[] = [];
  const retention: Record<"daily" | "monthly", number> = {
    daily: 30 * 24 * 60 * 60 * 1000,
    monthly: 365 * 24 * 60 * 60 * 1000,
  };

  for (const folder of ["daily", "monthly"] as const) {
    const cutoff = retention[folder];
    const { data, error } = await supabaseAdmin.storage
      .from(BACKUP_BUCKET)
      .list(folder, { limit: 1000, sortBy: { column: "name", order: "asc" } });
    if (error) continue;
    const expired = (data ?? [])
      .filter((f) => {
        const created = f.created_at ? new Date(f.created_at).getTime() : 0;
        return created && now - created > cutoff;
      })
      .map((f) => `${folder}/${f.name}`);
    if (expired.length) {
      await supabaseAdmin.storage.from(BACKUP_BUCKET).remove(expired);
      deleted.push(...expired);
    }
  }
  return { deleted };
}
