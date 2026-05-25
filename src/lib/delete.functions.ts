import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

async function verifyPassword(email: string, password: string) {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const c = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error("Invalid password");
}

async function writeAudit(input: {
  action_type: string;
  target_type: "user" | "organization";
  target_id: string;
  target_label?: string | null;
  performed_by: string;
  performed_by_email?: string | null;
  previous_status?: string | null;
  new_status?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  await supabaseAdmin.from("admin_audit_log" as never).insert(input as never);
}

const DeleteUserSchema = z.object({
  user_id: z.string().uuid(),
  password: z.string().min(1).max(200),
  confirmation: z.literal("DELETE"),
  reason: z.string().max(500).optional().nullable(),
});

export const deleteUserSecure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => DeleteUserSchema.parse(i))
  .handler(async ({ context, data }) => {
    if (data.user_id === context.userId) {
      throw new Error("You cannot delete your own account here");
    }

    const actorEmail = (context.claims as any)?.email as string | undefined;
    if (!actorEmail) throw new Error("Unable to verify current account email");

    const { data: actor } = await supabaseAdmin
      .from("profiles")
      .select("role, organization_id, email")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!actor) throw new Error("Actor profile not found");

    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("user_id, email, role, organization_id, account_status")
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (!target) throw new Error("User not found");

    const isSuper = actor.role === "super_admin";
    const isOwner = actor.role === "owner" || actor.role === "manager";

    if (!isSuper) {
      if (!isOwner) throw new Error("Forbidden");
      if (!actor.organization_id || actor.organization_id !== target.organization_id) {
        throw new Error("Cross-organization deletion is not allowed");
      }
      if (target.role === "super_admin") {
        throw new Error("Only a super admin can delete a super admin");
      }
    } else if (target.role === "super_admin" && actor.role !== "super_admin") {
      throw new Error("Only a super admin can delete a super admin");
    }

    await verifyPassword(actorEmail, data.password);

    const now = new Date().toISOString();
    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .update({
        is_active: false,
        archived_at: now,
        deleted_at: now,
        deleted_by: context.userId,
        deletion_reason: data.reason ?? null,
        account_status: "cancelled",
      } as never)
      .eq("user_id", data.user_id);
    if (upErr) throw new Error(upErr.message);

    // Disable auth login by banning the user
    try {
      await (supabaseAdmin.auth.admin as any).updateUserById(data.user_id, {
        ban_duration: "876000h",
      });
    } catch (e) {
      console.warn("[deleteUserSecure] ban_duration update failed", e);
    }

    await writeAudit({
      action_type: "delete_user",
      target_type: "user",
      target_id: data.user_id,
      target_label: target.email ?? null,
      performed_by: context.userId,
      performed_by_email: actorEmail,
      previous_status: target.account_status ?? null,
      new_status: "deleted",
      reason: data.reason ?? null,
    });

    return { ok: true };
  });

const DeleteOrgSchema = z.object({
  organization_id: z.string().uuid(),
  password: z.string().min(1).max(200),
  confirmation: z.literal("DELETE"),
  reason: z.string().max(500).optional().nullable(),
});

export const deleteOrganizationSecure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => DeleteOrgSchema.parse(i))
  .handler(async ({ context, data }) => {
    const actorEmail = (context.claims as any)?.email as string | undefined;
    if (!actorEmail) throw new Error("Unable to verify current account email");

    const { data: actor } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (actor?.role !== "super_admin") {
      throw new Error("Only super admins can delete companies");
    }

    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("id, company_name")
      .eq("id", data.organization_id)
      .maybeSingle();
    if (!org) throw new Error("Organization not found");

    await verifyPassword(actorEmail, data.password);

    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("organizations")
      .update({
        is_active: false,
        active_status: false,
        archived_at: now,
        deleted_at: now,
        deleted_by: context.userId,
        deletion_reason: data.reason ?? null,
      } as never)
      .eq("id", data.organization_id);
    if (error) throw new Error(error.message);

    await writeAudit({
      action_type: "delete_organization",
      target_type: "organization",
      target_id: data.organization_id,
      target_label: (org as any).company_name ?? null,
      performed_by: context.userId,
      performed_by_email: actorEmail,
      new_status: "deleted",
      reason: data.reason ?? null,
    });

    return { ok: true };
  });

// =============================================================================
// PURGE — permanently removes archived/deleted records. Super admin only.
// =============================================================================

const PurgeUserSchema = z.object({
  user_id: z.string().uuid(),
  password: z.string().min(1).max(200),
  confirmation: z.literal("PURGE"),
  reason: z.string().max(500).optional().nullable(),
});

export const purgeUserSecure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => PurgeUserSchema.parse(i))
  .handler(async ({ context, data }) => {
    if (data.user_id === context.userId) {
      throw new Error("You cannot purge your own account");
    }

    const actorEmail = (context.claims as any)?.email as string | undefined;
    if (!actorEmail) throw new Error("Unable to verify current account email");

    const { data: actor } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("user_id", context.userId)
      .maybeSingle();
    if ((actor as any)?.role !== "super_admin") {
      throw new Error("Only a super admin can purge users");
    }

    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("user_id, email, role, organization_id, archived_at, deleted_at")
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (!target) throw new Error("User not found");

    // Must already be archived or deleted
    const t = target as any;
    if (!t.archived_at && !t.deleted_at) {
      throw new Error("User must be archived or deleted before purging");
    }
    if (t.role === "super_admin") {
      throw new Error("Super admin accounts cannot be purged");
    }

    await verifyPassword(actorEmail, data.password);

    // Always log the attempt first so failures are auditable
    await writeAudit({
      action_type: "purge_user_attempt",
      target_type: "user",
      target_id: data.user_id,
      target_label: t.email ?? null,
      performed_by: context.userId,
      performed_by_email: actorEmail,
      reason: data.reason ?? null,
    });

    // Scrub related rows we own (preserve audit logs)
    await supabaseAdmin.from("user_permissions").delete().eq("user_id", data.user_id);

    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("user_id", data.user_id);
    if (profErr) throw new Error(profErr.message);

    try {
      await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    } catch (e) {
      console.warn("[purgeUserSecure] auth deleteUser failed", e);
    }

    await writeAudit({
      action_type: "purge_user",
      target_type: "user",
      target_id: data.user_id,
      target_label: t.email ?? null,
      performed_by: context.userId,
      performed_by_email: actorEmail,
      new_status: "purged",
      reason: data.reason ?? null,
    });

    return { ok: true };
  });

const PurgeOrgSchema = z.object({
  organization_id: z.string().uuid(),
  password: z.string().min(1).max(200),
  confirmation: z.literal("PURGE"),
  force_confirmation: z.string().optional().nullable(),
  reason: z.string().max(500).optional().nullable(),
});

export const purgeOrganizationSecure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => PurgeOrgSchema.parse(i))
  .handler(async ({ context, data }) => {
    const actorEmail = (context.claims as any)?.email as string | undefined;
    if (!actorEmail) throw new Error("Unable to verify current account email");

    const { data: actor } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("user_id", context.userId)
      .maybeSingle();
    if ((actor as any)?.role !== "super_admin") {
      throw new Error("Only a super admin can purge companies");
    }

    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("id, company_name, archived_at, deleted_at")
      .eq("id", data.organization_id)
      .maybeSingle();
    if (!org) throw new Error("Organization not found");
    const o = org as any;

    if (!o.archived_at && !o.deleted_at) {
      throw new Error("Organization must be archived or deleted before purging");
    }

    // Check for inventory/orders that would also be removed
    const [{ count: productCount }, { count: poCount }, { count: soCount }] = await Promise.all([
      supabaseAdmin.from("products").select("id", { count: "exact", head: true }).eq("organization_id", data.organization_id),
      supabaseAdmin.from("purchase_orders").select("id", { count: "exact", head: true }).eq("organization_id", data.organization_id),
      supabaseAdmin.from("sales_orders").select("id", { count: "exact", head: true }).eq("organization_id", data.organization_id),
    ]);
    const hasData = (productCount ?? 0) + (poCount ?? 0) + (soCount ?? 0) > 0;
    if (hasData && data.force_confirmation !== "PURGE COMPANY DATA") {
      throw new Error(
        `Company has ${productCount ?? 0} products, ${poCount ?? 0} purchase orders, ${soCount ?? 0} sales orders. Type "PURGE COMPANY DATA" to force purge.`,
      );
    }

    await verifyPassword(actorEmail, data.password);

    await writeAudit({
      action_type: "purge_organization_attempt",
      target_type: "organization",
      target_id: data.organization_id,
      target_label: o.company_name ?? null,
      performed_by: context.userId,
      performed_by_email: actorEmail,
      reason: data.reason ?? null,
      metadata: { products: productCount ?? 0, purchase_orders: poCount ?? 0, sales_orders: soCount ?? 0 },
    });

    // Collect users to purge their auth accounts after profile rows are gone.
    const { data: orgUsers } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("organization_id", data.organization_id);
    const userIds = (orgUsers ?? []).map((u: any) => u.user_id).filter(Boolean);

    // Best-effort cascade. Order: dependents first.
    const oid = data.organization_id;
    const supa = supabaseAdmin;
    await supa.from("user_permissions").delete().eq("organization_id", oid);
    await supa.from("role_permissions").delete().eq("organization_id", oid);
    await supa.from("inventory_movements").delete().eq("organization_id", oid);
    await supa.from("transaction_history").delete().eq("organization_id", oid);
    await supa.from("sales_order_payments").delete().eq("organization_id", oid);
    // Order items rely on parent FK lookups; delete via parents.
    const { data: pos } = await supa.from("purchase_orders").select("id").eq("organization_id", oid);
    const poIds = (pos ?? []).map((x: any) => x.id);
    if (poIds.length) await supa.from("purchase_order_items").delete().in("purchase_order_id", poIds);
    await supa.from("purchase_orders").delete().eq("organization_id", oid);
    const { data: sos } = await supa.from("sales_orders").select("id").eq("organization_id", oid);
    const soIds = (sos ?? []).map((x: any) => x.id);
    if (soIds.length) await supa.from("sales_order_items").delete().in("sales_order_id", soIds);
    await supa.from("sales_orders").delete().eq("organization_id", oid);
    const { data: tos } = await supa.from("transfer_orders").select("id").eq("organization_id", oid);
    const toIds = (tos ?? []).map((x: any) => x.id);
    if (toIds.length) await supa.from("transfer_order_items").delete().in("transfer_order_id", toIds);
    await supa.from("transfer_orders").delete().eq("organization_id", oid);
    await supa.from("products").delete().eq("organization_id", oid);
    await supa.from("product_categories").delete().eq("organization_id", oid);
    await supa.from("customers").delete().eq("organization_id", oid);
    await supa.from("suppliers").delete().eq("organization_id", oid);
    await supa.from("locations").delete().eq("organization_id", oid);
    await supa.from("company_settings").delete().eq("organization_id", oid);
    await supa.from("profiles").delete().eq("organization_id", oid);

    const { error: orgErr } = await supa.from("organizations").delete().eq("id", oid);
    if (orgErr) throw new Error(orgErr.message);

    for (const uid of userIds) {
      try {
        await supa.auth.admin.deleteUser(uid);
      } catch (e) {
        console.warn("[purgeOrganizationSecure] auth deleteUser failed", uid, e);
      }
    }

    await writeAudit({
      action_type: "purge_organization",
      target_type: "organization",
      target_id: oid,
      target_label: o.company_name ?? null,
      performed_by: context.userId,
      performed_by_email: actorEmail,
      new_status: "purged",
      reason: data.reason ?? null,
    });

    return { ok: true };
  });

