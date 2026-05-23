import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PLAN_LIMITS, type OrgUsage, type PlanType } from "./plan-limits";

async function usageForOrg(orgId: string): Promise<OrgUsage | null> {
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("plan_type")
    .eq("id", orgId)
    .maybeSingle();
  if (!org) return null;
  const plan = ((org as any).plan_type ?? "free") as PlanType;

  const [{ count: users }, { count: products }, { count: locations }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("user_id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .is("archived_at", null)
      .eq("is_active", true),
    supabaseAdmin
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId),
    supabaseAdmin
      .from("locations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("is_active", true),
  ]);

  return {
    plan,
    limits: PLAN_LIMITS[plan],
    used: {
      users: users ?? 0,
      products: products ?? 0,
      locations: locations ?? 0,
    },
  };
}

// Current user's org usage. Super admins without an org get null.
export const getMyOrgUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OrgUsage | null> => {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("organization_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    const orgId = (profile as any)?.organization_id as string | null;
    if (!orgId) return null;
    return usageForOrg(orgId);
  });

const OrgSchema = z.object({ organization_id: z.string().uuid() });

export const adminGetOrgUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OrgSchema.parse(input))
  .handler(async ({ context, data }): Promise<OrgUsage | null> => {
    const { data: me } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("user_id", context.userId)
      .maybeSingle();
    if ((me as any)?.role !== "super_admin") throw new Error("Forbidden");
    return usageForOrg(data.organization_id);
  });
