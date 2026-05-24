import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import { PLAN_LIMITS } from "./plan-limits";

// Roles an owner/manager is allowed to assign within their org.
const ASSIGNABLE_ROLES = ["manager", "employee", "custom"] as const;
const AssignableRole = z.enum(ASSIGNABLE_ROLES);

async function getActor(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("user_id, role, organization_id, email")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Profile not found");
  return data;
}

async function assertOrgManager(userId: string) {
  const me = await getActor(userId);
  if (me.role !== "owner" && me.role !== "manager" && me.role !== "super_admin") {
    throw new Error("Forbidden: owner or manager required");
  }
  if (me.role !== "super_admin" && !me.organization_id) {
    throw new Error("No organization");
  }
  return me;
}

async function assertSameOrgTarget(actor: { role: string; organization_id: string | null }, targetUserId: string) {
  const { data: target, error } = await supabaseAdmin
    .from("profiles")
    .select("user_id, role, organization_id, email, full_name, is_active, suspended_at, archived_at")
    .eq("user_id", targetUserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!target) throw new Error("Target user not found");
  if (target.role === "super_admin") throw new Error("Cannot manage a super admin");
  if (actor.role !== "super_admin") {
    if (!actor.organization_id || actor.organization_id !== target.organization_id) {
      throw new Error("Cross-organization action is not allowed");
    }
  }
  return target as typeof target & {
    is_active: boolean | null;
    suspended_at: string | null;
    archived_at: string | null;
  };
}

async function writeAudit(input: {
  action_type: string;
  target_id: string;
  target_label?: string | null;
  performed_by: string;
  performed_by_email?: string | null;
  previous_status?: string | null;
  new_status?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  await supabaseAdmin.from("admin_audit_log" as never).insert({
    target_type: "user",
    ...input,
  } as never);
}

function getOrigin() {
  const request = getRequest();
  return request ? new URL(request.url).origin : "https://inventoryflowapp.com";
}

function publicAuthClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
}

// -------- List --------

export const orgListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await assertOrgManager(context.userId);
    if (!me.organization_id) return { users: [], plan: null as null | string, cap: null as number | null, used: 0 };

    const { data: rows, error } = await supabaseAdmin
      .from("profiles")
      .select("user_id, email, full_name, phone, role, account_status, is_active, suspended_at, archived_at, deleted_at, created_at, organization_id")
      .eq("organization_id", me.organization_id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    // Pull last_sign_in_at from auth.users for these uids.
    const ids = (rows ?? []).map((r) => r.user_id);
    const lastSignIn = new Map<string, string | null>();
    if (ids.length) {
      // admin.listUsers is paginated; for typical org sizes one page is enough.
      const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      for (const u of authData?.users ?? []) {
        if (ids.includes(u.id)) lastSignIn.set(u.id, u.last_sign_in_at ?? null);
      }
    }

    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("plan_type")
      .eq("id", me.organization_id)
      .maybeSingle();
    const plan = (org as any)?.plan_type as keyof typeof PLAN_LIMITS | undefined;
    const cap = plan ? PLAN_LIMITS[plan].max_users : null;
    const used = (rows ?? []).filter((r) => r.is_active && !r.archived_at).length;

    return {
      plan: plan ?? null,
      cap,
      used,
      users: (rows ?? []).map((r) => ({
        ...r,
        last_sign_in_at: lastSignIn.get(r.user_id) ?? null,
      })),
    };
  });

// -------- Invite (create + reset link) --------

const InviteSchema = z.object({
  email: z.string().trim().email().max(255),
  full_name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).optional().nullable(),
  role: AssignableRole,
});

export const orgInviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InviteSchema.parse(input))
  .handler(async ({ context, data }) => {
    const me = await assertOrgManager(context.userId);
    const orgId = me.organization_id!;
    if (!orgId) throw new Error("No organization");

    // Plan cap pre-check
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("plan_type")
      .eq("id", orgId)
      .maybeSingle();
    const plan = (org as any)?.plan_type as keyof typeof PLAN_LIMITS | undefined;
    const cap = plan ? PLAN_LIMITS[plan].max_users : null;
    if (cap != null) {
      const { count } = await supabaseAdmin
        .from("profiles")
        .select("user_id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .is("deleted_at", null)
        .is("archived_at", null)
        .eq("is_active", true);
      if ((count ?? 0) >= cap) {
        throw new Error(`PLAN_LIMIT_USERS:${count}:${cap}`);
      }
    }

    // Create auth user with random throwaway password.
    const tempPass = `Tmp_${crypto.randomUUID()}A1!`;
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: tempPass,
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name,
        role: data.role,
        organization_id: orgId,
        phone: data.phone ?? null,
      },
    });
    if (error) throw new Error(error.message);
    const uid = created.user?.id;
    if (!uid) throw new Error("Failed to create user");

    // Upsert profile with org + active status so they can use the app once they set password.
    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          user_id: uid,
          email: data.email,
          full_name: data.full_name,
          phone: data.phone ?? null,
          role: data.role as never,
          organization_id: orgId,
          account_status: "active" as never,
          is_active: true,
        } as never,
        { onConflict: "user_id" },
      );
    if (upErr) throw new Error(upErr.message);

    // Send password reset email so the invitee sets their own password.
    const c = publicAuthClient();
    const origin = getOrigin();
    const { error: rpErr } = await c.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${origin}/reset-password`,
    });
    if (rpErr) {
      // Don't fail invite if email transport hiccups; still log it.
      // eslint-disable-next-line no-console
      console.error("[orgInviteUser] reset email failed", rpErr.message);
    }

    await writeAudit({
      action_type: "invite",
      target_id: uid,
      target_label: data.email,
      performed_by: context.userId,
      performed_by_email: me.email ?? null,
      new_status: "active",
      metadata: { role: data.role, organization_id: orgId },
    });

    return { user_id: uid };
  });

// -------- Update profile (name / phone / role) --------

const UpdateSchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  role: AssignableRole.optional(),
});

export const orgUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateSchema.parse(input))
  .handler(async ({ context, data }) => {
    const me = await assertOrgManager(context.userId);
    if (data.user_id === context.userId && data.role) {
      throw new Error("You cannot change your own role");
    }
    const target = await assertSameOrgTarget(me, data.user_id);
    if (target.role === "owner" && data.role && data.role !== "owner") {
      throw new Error("Cannot change owner role");
    }

    const patch: Record<string, unknown> = {};
    if (data.full_name !== undefined) patch.full_name = data.full_name;
    if (data.phone !== undefined) patch.phone = data.phone;
    if (data.role !== undefined) patch.role = data.role;
    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await supabaseAdmin
      .from("profiles")
      .update(patch as never)
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);

    if (data.role && data.role !== target.role) {
      await writeAudit({
        action_type: "change_role",
        target_id: data.user_id,
        target_label: target.email,
        performed_by: context.userId,
        performed_by_email: me.email ?? null,
        previous_status: target.role,
        new_status: data.role,
      });
    } else {
      await writeAudit({
        action_type: "update_user",
        target_id: data.user_id,
        target_label: target.email,
        performed_by: context.userId,
        performed_by_email: me.email ?? null,
        metadata: patch,
      });
    }
    return { ok: true };
  });

// -------- Status (suspend / reactivate / archive / soft delete) --------

const StatusSchema = z.object({
  user_id: z.string().uuid(),
  status: z.enum(["active", "suspended", "archived"]),
  reason: z.string().max(500).optional().nullable(),
});

export const orgSetUserStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StatusSchema.parse(input))
  .handler(async ({ context, data }) => {
    const me = await assertOrgManager(context.userId);
    if (data.user_id === context.userId) {
      throw new Error("You cannot change your own status");
    }
    const target = await assertSameOrgTarget(me, data.user_id);
    if (target.role === "owner") {
      throw new Error("Cannot suspend or archive the organization owner");
    }

    const prev = target.archived_at ? "archived" : target.suspended_at ? "suspended" : target.is_active ? "active" : "inactive";
    const patch: Record<string, unknown> = {
      is_active: data.status === "active",
      suspended_at: data.status === "suspended" ? new Date().toISOString() : null,
      archived_at: data.status === "archived" ? new Date().toISOString() : null,
    };
    const { error } = await supabaseAdmin
      .from("profiles")
      .update(patch as never)
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);

    await writeAudit({
      action_type: `user_${data.status}`,
      target_id: data.user_id,
      target_label: (target as any).email ?? null,
      performed_by: context.userId,
      performed_by_email: me.email ?? null,
      previous_status: prev as never,
      new_status: data.status,
      reason: data.reason ?? null,
    });
    return { ok: true };
  });

// -------- Soft delete --------

const DeleteSchema = z.object({
  user_id: z.string().uuid(),
  reason: z.string().max(500).optional().nullable(),
});

export const orgDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DeleteSchema.parse(input))
  .handler(async ({ context, data }) => {
    const me = await assertOrgManager(context.userId);
    if (data.user_id === context.userId) {
      throw new Error("You cannot delete yourself");
    }
    const target = await assertSameOrgTarget(me, data.user_id);
    if (target.role === "owner") {
      throw new Error("Cannot delete the organization owner");
    }
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        is_active: false,
        archived_at: new Date().toISOString(),
        deleted_at: new Date().toISOString(),
        deleted_by: context.userId,
        deletion_reason: data.reason ?? null,
      } as never)
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);

    await writeAudit({
      action_type: "user_deleted",
      target_id: data.user_id,
      target_label: (target as any).email ?? null,
      performed_by: context.userId,
      performed_by_email: me.email ?? null,
      previous_status: "active",
      new_status: "deleted",
      reason: data.reason ?? null,
    });
    return { ok: true };
  });

// -------- Resend password reset --------

const ResetSchema = z.object({ user_id: z.string().uuid() });

export const orgResetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ResetSchema.parse(input))
  .handler(async ({ context, data }) => {
    const me = await assertOrgManager(context.userId);
    const target = await assertSameOrgTarget(me, data.user_id);
    if (!target.email) throw new Error("User has no email address");

    const c = publicAuthClient();
    const origin = getOrigin();
    const { error } = await c.auth.resetPasswordForEmail(target.email, {
      redirectTo: `${origin}/reset-password`,
    });
    if (error) throw new Error(error.message);

    await writeAudit({
      action_type: "reset_password",
      target_id: data.user_id,
      target_label: target.email,
      performed_by: context.userId,
      performed_by_email: me.email ?? null,
    });
    return { ok: true };
  });
