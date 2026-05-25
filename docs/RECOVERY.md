# InventoryFlow — Backup & Recovery

Lightweight disaster-recovery procedure for the beta stage.

## What gets backed up

The super-admin **Backups** panel (Admin → Backups tab) exports every
business-critical table as a single gzipped JSON file:

- `organizations`, `profiles`
- `products`, `product_categories`, `inventory_movements`, `transaction_history`
- `customers`, `suppliers`, `locations`
- `purchase_orders` (+ items), `sales_orders` (+ items + payments)
- `transfer_orders` (+ items)
- `role_permissions`, `user_permissions`
- `company_settings`

File format: `inventoryflow-backup-<timestamp>.json.gz`
```
{
  "meta": { "format": "inventoryflow.backup.v1", "generated_at", "counts", ... },
  "data": { "<table>": [ { ...row }, ... ], ... }
}
```

## Where backups live

- Generated **on demand** by a super_admin from the Admin → Backups tab.
- Downloaded directly to the operator's machine — **nothing is stored
  server-side** in this iteration.
- Recommended storage: a private Google Drive folder shared only with
  the founding team. Future iteration: push to AWS S3 (`s3://inventoryflow-backups/`).

## Who has access

- Generation: any user with `role = 'super_admin'` (enforced by RLS +
  server-function assertion).
- Every generation writes an entry to `admin_audit_log` with
  `action_type = 'backup_generated'`, size, row counts, and operator email.
- Downloaded files should be treated as **highly sensitive** (they contain
  all customer data) and stored encrypted at rest.

## Recommended schedule (beta)

| Cadence  | Who           | Storage                                 |
| -------- | ------------- | --------------------------------------- |
| Daily    | On-call admin | Google Drive `/Backups/Daily/` (keep 14) |
| Monthly  | Founder       | Google Drive `/Backups/Monthly/` (keep 12) |
| Pre-deploy | Releaser    | Local + Drive, retain until next deploy |

Move to automated S3 + lifecycle rules before public GA.

## How to restore

> Restores are **manual** in beta. Always test against a fresh Supabase
> project before touching production.

1. Decompress: `gunzip inventoryflow-backup-*.json.gz`
2. Inspect `meta.counts` to confirm the dump matches expectations.
3. For a **full restore** into a new Supabase project:
   - Run all migrations in `supabase/migrations/` so the schema matches.
   - For each table in `meta.tables` (in order), insert the rows using the
     service-role key. A small Node script is enough:
     ```js
     import { createClient } from "@supabase/supabase-js";
     import fs from "node:fs";
     const dump = JSON.parse(fs.readFileSync("backup.json", "utf8"));
     const sb = createClient(process.env.SUPABASE_URL, process.env.SERVICE_ROLE);
     for (const t of dump.meta.tables) {
       const rows = dump.data[t];
       if (!rows?.length) continue;
       // chunk to avoid payload limits
       for (let i = 0; i < rows.length; i += 500) {
         const { error } = await sb.from(t).insert(rows.slice(i, i + 500));
         if (error) throw new Error(`${t}: ${error.message}`);
       }
       console.log(`${t}: ${rows.length}`);
     }
     ```
   - Restore `auth.users` separately via Supabase's admin API or by asking
     users to re-sign up (profiles will rebind by `user_id` if you preserve
     the original auth user IDs).
4. For a **partial restore** (e.g. recover a single deleted org), open the
   JSON, filter rows by `organization_id`, and insert just those rows.
5. After restore, run a smoke test: log in as a known org owner, verify
   product / movement counts match `meta.counts`.

## Limits & future work

- Current export is JSON; switch to native `pg_dump` once we have a
  long-running job runner.
- Server-side encryption + S3 lifecycle rules are out of scope for beta but
  the server function is structured so it can stream straight to S3 with no
  schema change.
- No PITR yet — rely on Supabase's managed daily snapshots as the secondary
  safety net.
