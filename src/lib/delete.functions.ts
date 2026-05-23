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
