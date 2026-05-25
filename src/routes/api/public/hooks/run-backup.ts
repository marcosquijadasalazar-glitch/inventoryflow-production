import { createFileRoute } from "@tanstack/react-router";
import { runBackupCore, cleanupBackupsCore } from "@/lib/backup.server";

/**
 * Public cron endpoint to trigger scheduled backups.
 *
 * Secured by requiring the Supabase publishable/anon key in the `apikey`
 * header — matches the standard pg_cron pattern documented for this stack.
 */
export const Route = createFileRoute("/api/public/hooks/run-backup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ??
          process.env.SUPABASE_ANON_KEY ??
          "";
        const apikey =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        if (!expected || apikey !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }

        let body: { type?: "daily" | "monthly" } = {};
        try {
          body = (await request.json()) as { type?: "daily" | "monthly" };
        } catch {
          body = {};
        }
        const type = body.type === "monthly" ? "monthly" : "daily";

        try {
          const result = await runBackupCore({
            type,
            operatorEmail: "cron@inventoryflow",
            upload: true,
          });
          // Best-effort retention sweep after each scheduled run.
          let cleanup: { deleted: string[] } = { deleted: [] };
          try {
            cleanup = await cleanupBackupsCore();
          } catch {
            // ignore — already logged via try/catch in core
          }
          return new Response(
            JSON.stringify({
              ok: true,
              type: result.type,
              filename: result.filename,
              storage_path: result.storage_path,
              size: result.compressed_size_bytes,
              total_rows: result.total_rows,
              cleanup,
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        } catch (e: any) {
          return new Response(
            JSON.stringify({ ok: false, error: String(e?.message ?? e) }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
      },
    },
  },
});
