import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ALL_ENABLED, MODULE_KEYS, normalizeModules, type ModuleMap } from "./modules";

// Returns the current user's enabled module map. Super admins always get all enabled.
export const getMyEnabledModules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ModuleMap> => {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role, organization_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    const p = profile as any;
    if (!p) return ALL_ENABLED;
    if (p.role === "super_admin") return ALL_ENABLED;
    if (!p.organization_id) return ALL_ENABLED;
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("enabled_modules")
      .eq("id", p.organization_id)
      .maybeSingle();
    return normalizeModules((org as any)?.enabled_modules);
  });

const ModulesSchema = z.object(
  Object.fromEntries(MODULE_KEYS.map((k) => [k, z.boolean()])) as Record<
    (typeof MODULE_KEYS)[number],
    z.ZodBoolean
  >,
);

const UpdateSchema = z.object({
  organization_id: z.string().uuid(),
  modules: ModulesSchema,
});

export const adminUpdateOrgModules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { data: me } = await supabaseAdmin
      .from("profiles")
      .select("role, email")
      .eq("user_id", context.userId)
      .maybeSingle();
    if ((me as any)?.role !== "super_admin") {
      throw new Error("Forbidden: super admin only");
    }

    // Block manual module edits when overrides are not enabled — modules are
    // plan-controlled by default.
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("module_overrides_enabled")
      .eq("id", data.organization_id)
      .maybeSingle();
    if (!(org as any)?.module_overrides_enabled) {
      throw new Error(
        "Module overrides are disabled for this company. Enable custom module overrides first.",
      );
    }

    const modules = normalizeModules(data.modules);
    const { error } = await supabaseAdmin
      .from("organizations")
      .update({ enabled_modules: modules } as never)
      .eq("id", data.organization_id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("admin_audit_log" as never).insert({
      action_type: "update_modules",
      target_type: "organization",
      target_id: data.organization_id,
      performed_by: context.userId,
      performed_by_email: (me as any)?.email ?? null,
      metadata: { modules } as any,
    } as never);

    return { ok: true, modules };
  });

const OverrideSchema = z.object({
  organization_id: z.string().uuid(),
  enabled: z.boolean(),
});

// Toggle whether the org's modules can deviate from the plan preset.
// When disabled, the DB trigger re-syncs modules to the plan preset.
export const adminSetModuleOverrides = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OverrideSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { data: me } = await supabaseAdmin
      .from("profiles")
      .select("role, email")
      .eq("user_id", context.userId)
      .maybeSingle();
    if ((me as any)?.role !== "super_admin") {
      throw new Error("Forbidden: super admin only");
    }

    const { error } = await supabaseAdmin
      .from("organizations")
      .update({ module_overrides_enabled: data.enabled } as never)
      .eq("id", data.organization_id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("admin_audit_log" as never).insert({
      action_type: data.enabled ? "enable_module_overrides" : "disable_module_overrides",
      target_type: "organization",
      target_id: data.organization_id,
      performed_by: context.userId,
      performed_by_email: (me as any)?.email ?? null,
      new_status: data.enabled ? "overrides_enabled" : "plan_controlled",
    } as never);

    return { ok: true };
  });

