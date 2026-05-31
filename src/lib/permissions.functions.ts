import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "./security-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ALL_PERMISSIONS } from "@/lib/permissions";

const PermissionEnum = z.enum(ALL_PERMISSIONS as unknown as [string, ...string[]]);
const RoleEnum = z.enum(["owner", "manager", "employee", "custom"]);

async function getCallerProfile(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("role, organization_id, email")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Profile not found");
  return data;
}

async function assertCanManageOrg(callerId: string, orgId: string) {
  const me = await getCallerProfile(callerId);
  if (me.role === "super_admin") return me;
  if (me.organization_id !== orgId) throw new Error("Forbidden: cross-organization");
  if (me.role !== "owner" && me.role !== "manager") {
    throw new Error("Forbidden: owner/manager only");
  }
  return me;
}

// ---------------- Reads ----------------

export const getMyPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const out: Record<string, boolean> = {};
    for (const p of ALL_PERMISSIONS) {
      const { data, error } = await supabaseAdmin.rpc("has_permission", {
        _user_id: context.userId,
        _perm: p,
      });
      if (error) throw new Error(error.message);
      out[p] = !!data;
    }
    return out as Record<(typeof ALL_PERMISSIONS)[number], boolean>;
  });

export const getOrgPermissionMatrix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ organizationId: z.string().uuid().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const me = await getCallerProfile(context.userId);
    const orgId =
      me.role === "super_admin"
        ? data.organizationId ?? me.organization_id
        : me.organization_id;
    if (!orgId) throw new Error("No organization");
    await assertCanManageOrg(context.userId, orgId);

    const [{ data: rolePerms, error: rpErr }, { data: userPerms, error: upErr }, { data: members, error: mErr }] =
      await Promise.all([
        supabaseAdmin.from("role_permissions").select("*").eq("organization_id", orgId),
        supabaseAdmin.from("user_permissions").select("*").eq("organization_id", orgId),
        supabaseAdmin
          .from("profiles")
          .select("user_id, email, full_name, role")
          .eq("organization_id", orgId)
          .neq("role", "super_admin"),
      ]);
    if (rpErr) throw new Error(rpErr.message);
    if (upErr) throw new Error(upErr.message);
    if (mErr) throw new Error(mErr.message);

    return {
      organizationId: orgId,
      rolePermissions: rolePerms ?? [],
      userPermissions: userPerms ?? [],
      members: members ?? [],
    };
  });

// ---------------- Writes ----------------

export const setRolePermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        role: RoleEnum,
        permission: PermissionEnum,
        granted: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCanManageOrg(context.userId, data.organizationId);
    if ((data.role as string) === "super_admin") {
      throw new Error("Forbidden: cannot edit super_admin permissions");
    }
    const { error } = await supabaseAdmin
      .from("role_permissions")
      .upsert(
        {
          organization_id: data.organizationId,
          role: data.role as never,
          permission: data.permission as never,
          granted: data.granted,
        } as never,
        { onConflict: "organization_id,role,permission" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetRolePermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        role: RoleEnum,
        permission: PermissionEnum,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCanManageOrg(context.userId, data.organizationId);
    const { error } = await supabaseAdmin
      .from("role_permissions")
      .delete()
      .eq("organization_id", data.organizationId)
      .eq("role", data.role as never)
      .eq("permission", data.permission as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setUserPermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        userId: z.string().uuid(),
        permission: PermissionEnum,
        granted: z.boolean().nullable(), // null = clear override (inherit)
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const target = await supabaseAdmin
      .from("profiles")
      .select("organization_id, role")
      .eq("user_id", data.userId)
      .maybeSingle();
    if (target.error) throw new Error(target.error.message);
    if (!target.data?.organization_id) throw new Error("Target has no organization");
    if (target.data.role === "super_admin") {
      throw new Error("Forbidden: cannot override super_admin permissions");
    }
    await assertCanManageOrg(context.userId, target.data.organization_id);

    if (data.granted === null) {
      const { error } = await supabaseAdmin
        .from("user_permissions")
        .delete()
        .eq("user_id", data.userId)
        .eq("permission", data.permission as never);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_permissions")
        .upsert(
          {
            user_id: data.userId,
            organization_id: target.data.organization_id,
            permission: data.permission as never,
            granted: data.granted,
          } as never,
          { onConflict: "user_id,permission" },
        );
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
