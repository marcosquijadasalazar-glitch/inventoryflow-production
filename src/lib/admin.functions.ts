import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertSuperAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("role, email")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.role !== "super_admin") {
    throw new Error("Forbidden: super admin only");
  }
  return data;
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

type Status = "active" | "inactive" | "suspended" | "archived";

function deriveOrgStatus(o: {
  is_active?: boolean | null;
  active_status?: boolean | null;
  suspended_at?: string | null;
  archived_at?: string | null;
}): Status {
  if (o.archived_at) return "archived";
  if (o.suspended_at) return "suspended";
  if (o.is_active === false || o.active_status === false) return "inactive";
  return "active";
}
function deriveUserStatus(u: {
  is_active?: boolean | null;
  suspended_at?: string | null;
  archived_at?: string | null;
}): Status {
  if (u.archived_at) return "archived";
  if (u.suspended_at) return "suspended";
  if (u.is_active === false) return "inactive";
  return "active";
}

export const adminListOrganizations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const { data: orgs, error } = await supabaseAdmin
      .from("organizations")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const [users, products] = await Promise.all([
      supabaseAdmin.from("profiles").select("organization_id"),
      supabaseAdmin.from("products").select("organization_id"),
    ]);

    const usersByOrg = new Map<string, number>();
    users.data?.forEach((p) => {
      if (!p.organization_id) return;
      usersByOrg.set(p.organization_id, (usersByOrg.get(p.organization_id) ?? 0) + 1);
    });
    const productsByOrg = new Map<string, number>();
    products.data?.forEach((p) => {
      if (!p.organization_id) return;
      productsByOrg.set(p.organization_id, (productsByOrg.get(p.organization_id) ?? 0) + 1);
    });

    return (orgs ?? []).map((o: any) => ({
      ...o,
      status: deriveOrgStatus(o),
      user_count: usersByOrg.get(o.id) ?? 0,
      product_count: productsByOrg.get(o.id) ?? 0,
    }));
  });

export const adminGetStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const [orgs, users, products, movements] = await Promise.all([
      supabaseAdmin.from("organizations").select("id, active_status"),
      supabaseAdmin.from("profiles").select("id"),
      supabaseAdmin.from("products").select("id"),
      supabaseAdmin.from("inventory_movements").select("id"),
    ]);
    return {
      organizations: orgs.data?.length ?? 0,
      activeOrganizations: orgs.data?.filter((o) => o.active_status).length ?? 0,
      users: users.data?.length ?? 0,
      products: products.data?.length ?? 0,
      movements: movements.data?.length ?? 0,
    };
  });

const CreateOrgSchema = z.object({
  company_name: z.string().min(1).max(120),
  business_type: z.string().max(120).optional().nullable(),
  plan_type: z.enum(["free", "starter", "pro", "enterprise"]).default("free"),
});

export const adminCreateOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateOrgSchema.parse(input))
  .handler(async ({ context, data }) => {
    const me = await assertSuperAdmin(context.userId);
    const { data: org, error } = await supabaseAdmin
      .from("organizations")
      .insert({
        company_name: data.company_name,
        business_type: data.business_type ?? null,
        plan_type: data.plan_type,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await writeAudit({
      action_type: "create",
      target_type: "organization",
      target_id: org.id,
      target_label: org.company_name,
      performed_by: context.userId,
      performed_by_email: me?.email ?? null,
      new_status: "active",
    });
    return org;
  });

const ToggleSchema = z.object({
  organization_id: z.string().uuid(),
  active_status: z.boolean(),
});

export const adminToggleOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ToggleSchema.parse(input))
  .handler(async ({ context, data }) => {
    const me = await assertSuperAdmin(context.userId);
    const { data: existing } = await supabaseAdmin
      .from("organizations")
      .select("*")
      .eq("id", data.organization_id)
      .maybeSingle();
    const prev = existing ? deriveOrgStatus(existing as any) : null;
    const { error } = await supabaseAdmin
      .from("organizations")
      .update({ active_status: data.active_status, is_active: data.active_status } as never)
      .eq("id", data.organization_id);
    if (error) throw new Error(error.message);
    await writeAudit({
      action_type: data.active_status ? "reactivate" : "deactivate",
      target_type: "organization",
      target_id: data.organization_id,
      target_label: (existing as any)?.company_name ?? null,
      performed_by: context.userId,
      performed_by_email: me?.email ?? null,
      previous_status: prev,
      new_status: data.active_status ? "active" : "inactive",
    });
    return { ok: true };
  });

const OrgStatusSchema = z.object({
  organization_id: z.string().uuid(),
  status: z.enum(["active", "inactive", "suspended", "archived"]),
  reason: z.string().max(500).optional().nullable(),
});

export const adminSetOrganizationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OrgStatusSchema.parse(input))
  .handler(async ({ context, data }) => {
    const me = await assertSuperAdmin(context.userId);
    const { data: existing } = await supabaseAdmin
      .from("organizations")
      .select("*")
      .eq("id", data.organization_id)
      .maybeSingle();
    if (!existing) throw new Error("Organization not found");
    const prev = deriveOrgStatus(existing as any);

    const patch: Record<string, unknown> = {
      is_active: data.status === "active",
      active_status: data.status === "active",
      suspended_at: data.status === "suspended" ? new Date().toISOString() : null,
      archived_at: data.status === "archived" ? new Date().toISOString() : null,
    };
    const { error } = await supabaseAdmin
      .from("organizations")
      .update(patch as never)
      .eq("id", data.organization_id);
    if (error) throw new Error(error.message);

    await writeAudit({
      action_type: `org_${data.status}`,
      target_type: "organization",
      target_id: data.organization_id,
      target_label: (existing as any).company_name ?? null,
      performed_by: context.userId,
      performed_by_email: me?.email ?? null,
      previous_status: prev,
      new_status: data.status,
      reason: data.reason ?? null,
    });
    return { ok: true };
  });

const UpdatePlanSchema = z.object({
  organization_id: z.string().uuid(),
  plan_type: z.enum(["free", "starter", "pro", "enterprise"]),
});

export const adminUpdateOrgPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdatePlanSchema.parse(input))
  .handler(async ({ context, data }) => {
    const me = await assertSuperAdmin(context.userId);
    const { data: existing } = await supabaseAdmin
      .from("organizations")
      .select("plan_type, company_name")
      .eq("id", data.organization_id)
      .maybeSingle();
    const { error } = await supabaseAdmin
      .from("organizations")
      .update({ plan_type: data.plan_type })
      .eq("id", data.organization_id);
    if (error) throw new Error(error.message);
    await writeAudit({
      action_type: "change_plan",
      target_type: "organization",
      target_id: data.organization_id,
      target_label: (existing as any)?.company_name ?? null,
      performed_by: context.userId,
      performed_by_email: me?.email ?? null,
      previous_status: (existing as any)?.plan_type ?? null,
      new_status: data.plan_type,
    });
    return { ok: true };
  });

const ListUsersSchema = z.object({
  organization_id: z.string().uuid().optional(),
});

export const adminListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListUsersSchema.parse(input ?? {}))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.userId);
    let q = supabaseAdmin
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (data.organization_id) q = q.eq("organization_id", data.organization_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((u: any) => ({ ...u, status: deriveUserStatus(u) }));
  });

const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  full_name: z.string().max(120).optional().nullable(),
  organization_id: z.string().uuid().nullable(),
  role: z.enum(["super_admin", "owner", "manager", "employee"]).default("owner"),
});

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateUserSchema.parse(input))
  .handler(async ({ context, data }) => {
    const me = await assertSuperAdmin(context.userId);

    // Hard plan-limit pre-check (the BEFORE INSERT trigger on profiles is the
    // real gate; this avoids leaving an orphan auth user when over the cap).
    if (data.organization_id) {
      const { data: orgRow } = await supabaseAdmin
        .from("organizations")
        .select("plan_type")
        .eq("id", data.organization_id)
        .maybeSingle();
      const plan = (orgRow as any)?.plan_type as
        | "free" | "starter" | "pro" | "enterprise" | undefined;
      const { PLAN_LIMITS } = await import("./plan-limits");
      const cap = plan ? PLAN_LIMITS[plan].max_users : null;
      if (cap != null) {
        const { count } = await supabaseAdmin
          .from("profiles")
          .select("user_id", { count: "exact", head: true })
          .eq("organization_id", data.organization_id)
          .is("deleted_at", null)
          .is("archived_at", null)
          .eq("is_active", true);
        if ((count ?? 0) >= cap) {
          throw new Error(`PLAN_LIMIT_USERS:${count}:${cap}`);
        }
      }
    }

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name ?? null,
        role: data.role,
        organization_id: data.organization_id,
      },
    });
    if (error) throw new Error(error.message);
    const uid = created.user?.id;
    if (!uid) throw new Error("Failed to create user");

    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          user_id: uid,
          email: data.email,
          full_name: data.full_name ?? null,
          role: data.role,
          organization_id: data.organization_id,
        },
        { onConflict: "user_id" },
      );
    if (upErr) throw new Error(upErr.message);

    await writeAudit({
      action_type: "create",
      target_type: "user",
      target_id: uid,
      target_label: data.email,
      performed_by: context.userId,
      performed_by_email: me?.email ?? null,
      new_status: "active",
    });
    return { user_id: uid };
  });

const AssignSchema = z.object({
  user_id: z.string().uuid(),
  organization_id: z.string().uuid().nullable(),
  role: z.enum(["super_admin", "owner", "manager", "employee"]).optional(),
});

export const adminAssignUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AssignSchema.parse(input))
  .handler(async ({ context, data }) => {
    const me = await assertSuperAdmin(context.userId);
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("organization_id, role, email")
      .eq("user_id", data.user_id)
      .maybeSingle();
    const patch: { organization_id: string | null; role?: typeof data.role } = {
      organization_id: data.organization_id,
    };
    if (data.role) patch.role = data.role;
    const { error } = await supabaseAdmin
      .from("profiles")
      .update(patch)
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);

    if (data.role && (existing as any)?.role !== data.role) {
      await writeAudit({
        action_type: "change_role",
        target_type: "user",
        target_id: data.user_id,
        target_label: (existing as any)?.email ?? null,
        performed_by: context.userId,
        performed_by_email: me?.email ?? null,
        previous_status: (existing as any)?.role ?? null,
        new_status: data.role,
      });
    }
    if ((existing as any)?.organization_id !== data.organization_id) {
      await writeAudit({
        action_type: "change_organization",
        target_type: "user",
        target_id: data.user_id,
        target_label: (existing as any)?.email ?? null,
        performed_by: context.userId,
        performed_by_email: me?.email ?? null,
        previous_status: (existing as any)?.organization_id ?? null,
        new_status: data.organization_id,
      });
    }
    return { ok: true };
  });

const UserStatusSchema = z.object({
  user_id: z.string().uuid(),
  status: z.enum(["active", "inactive", "suspended", "archived"]),
  reason: z.string().max(500).optional().nullable(),
});

export const adminSetUserStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UserStatusSchema.parse(input))
  .handler(async ({ context, data }) => {
    const me = await assertSuperAdmin(context.userId);
    if (data.user_id === context.userId) {
      throw new Error("You cannot change your own status");
    }
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (!existing) throw new Error("User profile not found");
    const prev = deriveUserStatus(existing as any);

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
      target_type: "user",
      target_id: data.user_id,
      target_label: (existing as any).email ?? null,
      performed_by: context.userId,
      performed_by_email: me?.email ?? null,
      previous_status: prev,
      new_status: data.status,
      reason: data.reason ?? null,
    });
    return { ok: true };
  });

export const adminListAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("admin_audit_log" as never)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      id: string;
      action_type: string;
      target_type: string;
      target_id: string;
      target_label: string | null;
      performed_by_email: string | null;
      previous_status: string | null;
      new_status: string | null;
      reason: string | null;
      created_at: string;
    }>;
  });

// Access status for current user (used by gate)
export const getMyAccessStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!profile) {
      return { ok: true as const, reason: null, scope: "no_profile" as const };
    }
    const p = profile as any;
    if (p.role === "super_admin") {
      return { ok: true as const, reason: null, scope: "super_admin" as const, account_status: "active" as const, trial_ends_at: null };
    }
    const accountStatus = (p.account_status ?? "active") as
      | "pending_approval" | "trial_active" | "active" | "suspended" | "cancelled" | "rejected";
    const trialEndsAt = p.trial_ends_at ? new Date(p.trial_ends_at).getTime() : null;
    const trialExpired = accountStatus === "trial_active" && trialEndsAt !== null && trialEndsAt <= Date.now();
    if (!(accountStatus === "active" || (accountStatus === "trial_active" && !trialExpired))) {
      return {
        ok: false as const,
        reason: trialExpired ? "trial_expired" : accountStatus,
        scope: "account" as const,
        account_status: accountStatus,
        trial_ends_at: p.trial_ends_at ?? null,
      };
    }
    const userStatus = deriveUserStatus(p);
    if (userStatus !== "active") {
      return { ok: false as const, reason: userStatus, scope: "user" as const, account_status: accountStatus, trial_ends_at: p.trial_ends_at ?? null };
    }
    if (p.organization_id) {
      const { data: org } = await supabaseAdmin
        .from("organizations")
        .select("*")
        .eq("id", p.organization_id)
        .maybeSingle();
      if (org) {
        const orgStatus = deriveOrgStatus(org as any);
        if (orgStatus !== "active") {
          return { ok: false as const, reason: orgStatus, scope: "organization" as const, account_status: accountStatus, trial_ends_at: p.trial_ends_at ?? null };
        }
      }
    }
    return { ok: true as const, reason: null, scope: "ok" as const, account_status: accountStatus, trial_ends_at: p.trial_ends_at ?? null };
  });

// ---------- Account status management (approval workflow) ----------

const AccountStatusSchema = z.object({
  user_id: z.string().uuid(),
  status: z.enum(["pending_approval", "trial_active", "active", "suspended", "cancelled", "rejected"]),
  trial_days: z.number().int().min(1).max(365).optional().nullable(),
  reason: z.string().max(500).optional().nullable(),
});

export const adminSetAccountStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AccountStatusSchema.parse(input))
  .handler(async ({ context, data }) => {
    const me = await assertSuperAdmin(context.userId);
    if (data.user_id === context.userId) {
      throw new Error("You cannot change your own account status");
    }
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("user_id, email, account_status, trial_ends_at")
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (!existing) throw new Error("User not found");

    const patch: Record<string, unknown> = { account_status: data.status };
    if (data.status === "trial_active") {
      const days = data.trial_days ?? 14;
      patch.trial_ends_at = new Date(Date.now() + days * 86400000).toISOString();
    } else if (data.status === "active") {
      patch.trial_ends_at = null;
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update(patch as never)
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);

    await writeAudit({
      action_type: `account_${data.status}`,
      target_type: "user",
      target_id: data.user_id,
      target_label: (existing as any).email ?? null,
      performed_by: context.userId,
      performed_by_email: me?.email ?? null,
      previous_status: (existing as any).account_status ?? null,
      new_status: data.status,
      reason: data.reason ?? null,
      metadata: patch.trial_ends_at ? { trial_ends_at: patch.trial_ends_at as string } : null,
    });
    return { ok: true };
  });

const ResetPasswordSchema = z.object({
  user_id: z.string().uuid(),
});

export const adminResetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ResetPasswordSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { data: actor } = await supabaseAdmin
      .from("profiles")
      .select("role, organization_id, email")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!actor) throw new Error("Actor profile not found");

    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("user_id, email, role, organization_id")
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (!target) throw new Error("User not found");
    if (!target.email) throw new Error("User has no email address");

    const isSuper = actor.role === "super_admin";
    const isOwner = actor.role === "owner" || actor.role === "manager";

    if (!isSuper) {
      if (!isOwner) throw new Error("Forbidden: insufficient privileges");
      if (!actor.organization_id || actor.organization_id !== target.organization_id) {
        throw new Error("Cross-organization action is not allowed");
      }
      if (target.role === "super_admin") {
        throw new Error("Only a super admin can reset a super admin password");
      }
    }

    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const c = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });

    const request = getRequest();
    const origin = request ? new URL(request.url).origin : "https://inventoryflowapp.com";

    const { error } = await c.auth.resetPasswordForEmail(target.email, {
      redirectTo: `${origin}/login`,
    });
    if (error) throw new Error(error.message);

    await writeAudit({
      action_type: "reset_password",
      target_type: "user",
      target_id: data.user_id,
      target_label: target.email,
      performed_by: context.userId,
      performed_by_email: (actor as any).email ?? null,
    });

    return { ok: true };
  });
