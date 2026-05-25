import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ProfileSchema = z.object({
  company_name: z.string().trim().max(200).nullable().optional(),
  logo_url: z.string().trim().max(2000).url().nullable().optional().or(z.literal("")),
  business_type: z.string().trim().max(100).nullable().optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  email: z.string().trim().max(255).email().nullable().optional().or(z.literal("")),
  address: z.string().trim().max(500).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  country: z.string().trim().max(120).nullable().optional(),
  timezone: z.string().trim().max(80).nullable().optional(),
  currency: z.string().trim().max(10).nullable().optional(),
  tax_id: z.string().trim().max(80).nullable().optional(),
  website: z.string().trim().max(500).nullable().optional(),
  footer_notes: z.string().trim().max(1000).nullable().optional(),
});

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

function resolveTargetOrg(actor: { role: string; organization_id: string | null }, requested?: string | null) {
  if (actor.role === "super_admin") {
    if (!requested) throw new Error("organizationId required for super admin");
    return requested;
  }
  if (!actor.organization_id) throw new Error("No organization");
  if (requested && requested !== actor.organization_id) {
    throw new Error("Cross-organization action is not allowed");
  }
  return actor.organization_id;
}

export const getCompanyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ organizationId: z.string().uuid().nullable().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const actor = await getActor(context.userId);
    const orgId = resolveTargetOrg(actor, data.organizationId ?? null);

    let { data: row, error } = await supabaseAdmin
      .from("company_settings")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (!row) {
      const { data: org } = await supabaseAdmin
        .from("organizations")
        .select("company_name, business_type")
        .eq("id", orgId)
        .maybeSingle();
      const ins = await supabaseAdmin
        .from("company_settings")
        .insert({
          organization_id: orgId,
          company_name: org?.company_name ?? null,
          business_type: org?.business_type ?? null,
        })
        .select("*")
        .single();
      if (ins.error) throw new Error(ins.error.message);
      row = ins.data;
    }
    return { profile: row, canEdit: actor.role === "super_admin" || actor.role === "owner" };
  });

export const updateCompanyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      organizationId: z.string().uuid().nullable().optional(),
      values: ProfileSchema,
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const actor = await getActor(context.userId);
    if (actor.role !== "super_admin" && actor.role !== "owner") {
      throw new Error("Forbidden: owner role required");
    }
    const orgId = resolveTargetOrg(actor, data.organizationId ?? null);

    // Normalize empty strings to null
    const v: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(data.values)) {
      v[k] = typeof val === "string" && val.trim() === "" ? null : val;
    }

    // Find existing row
    const existing = await supabaseAdmin
      .from("company_settings")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);

    let updated;
    if (existing.data) {
      const upd = await supabaseAdmin
        .from("company_settings")
        .update({ ...v, updated_at: new Date().toISOString() })
        .eq("id", existing.data.id)
        .select("*")
        .single();
      if (upd.error) throw new Error(upd.error.message);
      updated = upd.data;
    } else {
      const ins = await supabaseAdmin
        .from("company_settings")
        .insert({ organization_id: orgId, ...v })
        .select("*")
        .single();
      if (ins.error) throw new Error(ins.error.message);
      updated = ins.data;
    }

    // Mirror company_name to organizations for consistency
    if (typeof v.company_name === "string" && v.company_name) {
      await supabaseAdmin
        .from("organizations")
        .update({ company_name: v.company_name as string, business_type: (v.business_type as string) ?? null })
        .eq("id", orgId);
    }

    // Audit log
    const changed: Record<string, { from: unknown; to: unknown }> = {};
    if (existing.data) {
      for (const k of Object.keys(v)) {
        const before = (existing.data as Record<string, unknown>)[k] ?? null;
        const after = v[k] ?? null;
        if (before !== after) changed[k] = { from: before, to: after };
      }
    }
    await supabaseAdmin.from("admin_audit_log").insert({
      action_type: "company_profile_update",
      target_type: "organization",
      target_id: orgId,
      performed_by: context.userId,
      performed_by_email: actor.email,
      metadata: { changed } as any,
    });

    return { profile: updated };
  });
