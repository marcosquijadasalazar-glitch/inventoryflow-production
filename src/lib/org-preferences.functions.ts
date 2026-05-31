import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "./security-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PrefsSchema = z.object({
  timezone: z.string().trim().max(80).nullable().optional(),
  currency: z.string().trim().max(10).nullable().optional(),
  language: z.string().trim().max(10).nullable().optional(),
  default_location_id: z.string().uuid().nullable().optional(),
  default_low_stock_threshold: z.number().int().min(0).max(100000).optional(),
  scanner_auto_commit: z.boolean().optional(),
  scanner_sound: z.boolean().optional(),
  scanner_haptics: z.boolean().optional(),
  notify_low_stock: z.boolean().optional(),
  notify_transfers: z.boolean().optional(),
  notify_security: z.boolean().optional(),
  notify_billing: z.boolean().optional(),
  manager_can_edit_org_settings: z.boolean().optional(),
  contact_phone: z.string().trim().max(50).nullable().optional(),
  contact_email: z.string().trim().max(255).email().nullable().optional().or(z.literal("")),
  contact_address: z.string().trim().max(500).nullable().optional(),
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

async function ensureRow(orgId: string) {
  const existing = await supabaseAdmin
    .from("organization_preferences")
    .select("*")
    .eq("organization_id", orgId)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) return existing.data;
  const ins = await supabaseAdmin
    .from("organization_preferences")
    .insert({ organization_id: orgId })
    .select("*")
    .single();
  if (ins.error) throw new Error(ins.error.message);
  return ins.data;
}

export const getOrganizationPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const actor = await getActor(context.userId);
    if (!actor.organization_id) throw new Error("No organization");
    if (!["owner", "manager", "super_admin"].includes(actor.role)) {
      throw new Error("Forbidden");
    }
    const row = await ensureRow(actor.organization_id);
    const canEdit =
      actor.role === "owner" ||
      actor.role === "super_admin" ||
      (actor.role === "manager" && !!row.manager_can_edit_org_settings);
    const canManageDelegation = actor.role === "owner" || actor.role === "super_admin";
    return { preferences: row, canEdit, canManageDelegation, role: actor.role };
  });

export const updateOrganizationPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ values: PrefsSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const actor = await getActor(context.userId);
    if (!actor.organization_id) throw new Error("No organization");

    const current = await ensureRow(actor.organization_id);
    const isOwner = actor.role === "owner" || actor.role === "super_admin";
    const isManagerAllowed =
      actor.role === "manager" && !!current.manager_can_edit_org_settings;
    if (!isOwner && !isManagerAllowed) throw new Error("Forbidden");

    const v: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(data.values)) {
      v[k] = typeof val === "string" && val.trim() === "" ? null : val;
    }
    // Only owners can change the delegation flag itself.
    if (!isOwner) delete v.manager_can_edit_org_settings;

    const upd = await supabaseAdmin
      .from("organization_preferences")
      .update({ ...v, updated_at: new Date().toISOString() })
      .eq("id", current.id)
      .select("*")
      .single();
    if (upd.error) throw new Error(upd.error.message);

    await supabaseAdmin.from("operational_audit_log").insert({
      organization_id: actor.organization_id,
      action_type: "org_preferences_updated",
      entity_type: "organization",
      entity_id: actor.organization_id,
      entity_label: null,
      summary: "Organization preferences updated",
      metadata: { fields: Object.keys(v) } as any,
      actor_user_id: context.userId,
      actor_email: actor.email,
    });

    return { preferences: upd.data };
  });
