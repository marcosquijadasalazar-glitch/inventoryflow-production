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

export type BackupType = "daily" | "monthly" | "manual";
const BUCKET = "backups";

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

/**
 * Core backup runner — used by manual download, scheduled cron, and the
 * public cron endpoint. Always writes audit log; uploads to storage when
 * `upload` is true.
 */
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
        .from(BUCKET)
        .upload(storage_path, gz, {
          contentType: "application/gzip",
          upsert: false,
        });
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

/**
 * Retention sweep: daily backups kept 30 days, monthly 12 months.
 * Manual backups are kept indefinitely.
 */
export async function cleanupBackupsCore() {
  const now = Date.now();
  const deleted: string[] = [];
  const retention: Record<BackupType, number | null> = {
    daily: 30 * 24 * 60 * 60 * 1000,
    monthly: 365 * 24 * 60 * 60 * 1000,
    manual: null,
  };

  for (const folder of ["daily", "monthly"] as const) {
    const cutoff = retention[folder]!;
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .list(folder, { limit: 1000, sortBy: { column: "name", order: "asc" } });
    if (error) continue;
    const expired = (data ?? [])
      .filter((f) => {
        const created = f.created_at ? new Date(f.created_at).getTime() : 0;
        return created && now - created > cutoff;
      })
      .map((f) => `${folder}/${f.name}`);
    if (expired.length) {
      await supabaseAdmin.storage.from(BUCKET).remove(expired);
      deleted.push(...expired);
    }
  }
  return { deleted };
}

// ----- server functions exposed to the client -----

export const generateBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const admin = await assertSuperAdmin(userId);
    // Manual: upload AND return base64 so the operator gets a direct download.
    const result = await runBackupCore({
      type: "manual",
      operatorId: userId,
      operatorEmail: admin.email ?? null,
      upload: true,
    });
    // Generate base64 for immediate download
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .download(result.storage_path!);
    if (error || !data) throw new Error(error?.message ?? "download failed");
    const buf = Buffer.from(await data.arrayBuffer());
    return { ...result, base64: buf.toString("base64") };
  });

export const runScheduledBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { type: "daily" | "monthly" }) => d)
  .handler(async ({ data, context }) => {
    const admin = await assertSuperAdmin(context.userId);
    return runBackupCore({
      type: data.type,
      operatorId: context.userId,
      operatorEmail: admin.email ?? null,
      upload: true,
    });
  });

export const listBackups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("admin_audit_log")
      .select("id, created_at, performed_by_email, new_status, metadata")
      .eq("action_type", "backup_generated")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);

    const items = (data ?? []).map((row: any) => {
      const meta = row.metadata ?? {};
      return {
        id: row.id,
        created_at: row.created_at,
        performed_by_email: row.performed_by_email,
        status: meta.status ?? row.new_status ?? "success",
        type: (meta.type ?? "manual") as BackupType,
        size: meta.compressed_size_bytes ?? null,
        total_rows: meta.total_rows ?? null,
        storage_path: meta.storage_path ?? null,
        filename: meta.filename ?? null,
        error: meta.error ?? null,
      };
    });

    // Summaries
    const lastBy = (t: BackupType) =>
      items.find((i) => i.type === t && i.status === "success") ?? null;

    return {
      items,
      summary: {
        last_daily: lastBy("daily"),
        last_monthly: lastBy("monthly"),
        last_manual: lastBy("manual"),
      },
    };
  });

export const getBackupDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { storage_path: string }) => d)
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { data: signed, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(data.storage_path, 300);
    if (error || !signed?.signedUrl) throw new Error(error?.message ?? "sign failed");
    return { url: signed.signedUrl };
  });

export const cleanupBackups = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    return cleanupBackupsCore();
  });
