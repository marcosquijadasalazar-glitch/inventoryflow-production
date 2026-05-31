import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "./security-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  assertSuperAdmin,
  BACKUP_BUCKET,
  cleanupBackupsCore,
  runBackupCore,
  type BackupType,
} from "./backup.server";

export const generateBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const admin = await assertSuperAdmin(userId);
    const result = await runBackupCore({
      type: "manual",
      operatorId: userId,
      operatorEmail: admin.email ?? null,
      upload: true,
    });
    const { data, error } = await supabaseAdmin.storage
      .from(BACKUP_BUCKET)
      .download(result.storage_path!);
    if (error || !data) throw new Error(error?.message ?? "download failed");
    const buf = Buffer.from(await data.arrayBuffer());
    return { ...result, base64: buf.toString("base64") };
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
      .from(BACKUP_BUCKET)
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
