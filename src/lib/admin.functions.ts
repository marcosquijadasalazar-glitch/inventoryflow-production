import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertSuperAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.role !== "super_admin") {
    throw new Error("Forbidden: super admin only");
  }
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

    // counts in parallel
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

    return (orgs ?? []).map((o) => ({
      ...o,
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
    await assertSuperAdmin(context.userId);
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
    await assertSuperAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("organizations")
      .update({ active_status: data.active_status })
      .eq("id", data.organization_id);
    if (error) throw new Error(error.message);
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
    await assertSuperAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("organizations")
      .update({ plan_type: data.plan_type })
      .eq("id", data.organization_id);
    if (error) throw new Error(error.message);
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
      .select("id, user_id, email, full_name, role, organization_id, created_at")
      .order("created_at", { ascending: false });
    if (data.organization_id) q = q.eq("organization_id", data.organization_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
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
    await assertSuperAdmin(context.userId);
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

    // Ensure profile row reflects intended role/org (trigger may have raced).
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
    await assertSuperAdmin(context.userId);
    const patch: { organization_id: string | null; role?: typeof data.role } = {
      organization_id: data.organization_id,
    };
    if (data.role) patch.role = data.role;
    const { error } = await supabaseAdmin
      .from("profiles")
      .update(patch)
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
