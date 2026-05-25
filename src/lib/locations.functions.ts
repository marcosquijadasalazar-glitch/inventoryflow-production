import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PLAN_LIMITS, type PlanType } from "./plan-limits";

const Row = z.object({
  location_name: z.string().trim().min(1).max(120),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  country: z.string().trim().max(120).optional().or(z.literal("")),
  manager: z.string().trim().max(120).optional().or(z.literal("")),
  status: z.string().trim().max(20).optional().or(z.literal("")),
  type: z.string().trim().max(40).optional().or(z.literal("")),
});

const ImportInput = z.object({ rows: z.array(z.record(z.string(), z.string())).max(2000) });

const VALID_TYPES = new Set(["warehouse", "store", "shelf", "bin", "truck", "other"]);

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

export const listLocationsAll = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await getActor(context.userId);
    if (!me.organization_id && me.role !== "super_admin") return { locations: [] };
    let q = supabaseAdmin.from("locations").select("*").order("name");
    if (me.role !== "super_admin") q = q.eq("organization_id", me.organization_id!);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { locations: data ?? [] };
  });

export const importLocations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => ImportInput.parse(i))
  .handler(async ({ data, context }) => {
    const me = await getActor(context.userId);
    if (me.role !== "owner" && me.role !== "manager" && me.role !== "super_admin")
      throw new Error("Forbidden: owner or manager required");
    const orgId = me.organization_id;
    if (!orgId) throw new Error("No organization");

    // Plan cap (active locations only)
    const { data: org } = await supabaseAdmin
      .from("organizations").select("plan_type").eq("id", orgId).maybeSingle();
    const plan = ((org as any)?.plan_type ?? "free") as PlanType;
    const cap = PLAN_LIMITS[plan].max_locations;
    let used = 0;
    if (cap != null) {
      const { count } = await supabaseAdmin
        .from("locations").select("id", { count: "exact", head: true })
        .eq("organization_id", orgId).eq("is_active", true);
      used = count ?? 0;
    }

    const errors: { row: number; message: string }[] = [];
    const valid: any[] = [];
    let activeAdded = 0;

    data.rows.forEach((raw, idx) => {
      const p = Row.safeParse(raw);
      if (!p.success) {
        errors.push({ row: idx + 2, message: p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
        return;
      }
      const v = p.data;
      const isActive = !v.status || v.status.toLowerCase() === "active";
      if (cap != null && isActive && used + activeAdded >= cap) {
        errors.push({ row: idx + 2, message: `PLAN_LIMIT_LOCATIONS:${cap}` });
        return;
      }
      if (isActive) activeAdded++;
      const addrParts = [v.address, v.city, v.country].filter(Boolean).join(", ");
      const notes = v.manager ? `Manager: ${v.manager}` : null;
      const type = v.type && VALID_TYPES.has(v.type.toLowerCase()) ? v.type.toLowerCase() : "warehouse";
      valid.push({
        organization_id: orgId,
        name: v.name,
        type,
        address: addrParts || null,
        notes,
        is_active: isActive,
      });
    });

    let inserted = 0;
    if (valid.length > 0) {
      const { data: ins, error } = await supabaseAdmin.from("locations").insert(valid).select("id");
      if (error) errors.push({ row: 0, message: error.message });
      else inserted = ins?.length ?? 0;
    }

    await supabaseAdmin.from("admin_audit_log" as never).insert({
      action_type: "import",
      target_type: "locations",
      target_id: orgId,
      target_label: `Imported ${inserted} locations`,
      performed_by: me.user_id,
      performed_by_email: me.email,
      metadata: { total: data.rows.length, inserted, failed: errors.length, organization_id: orgId } as never,
    } as never);

    return { inserted, failed: errors.length, errors };
  });
