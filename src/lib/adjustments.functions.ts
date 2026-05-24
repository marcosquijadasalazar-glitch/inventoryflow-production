import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Row = z.object({
  sku: z.string().trim().max(120).optional().or(z.literal("")),
  barcode: z.string().trim().max(120).optional().or(z.literal("")),
  adjustment_type: z.string().trim().min(1).max(20),
  quantity: z.string().trim().min(1),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
  location: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

const ImportInput = z.object({ rows: z.array(z.record(z.string(), z.string())).max(2000) });

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

export const importAdjustments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => ImportInput.parse(i))
  .handler(async ({ data, context }) => {
    const me = await getActor(context.userId);
    if (me.role !== "owner" && me.role !== "manager" && me.role !== "super_admin")
      throw new Error("Forbidden: owner or manager required");
    const orgId = me.organization_id;
    if (!orgId) throw new Error("No organization");

    const errors: { row: number; message: string }[] = [];
    let inserted = 0;

    for (let i = 0; i < data.rows.length; i++) {
      const raw = data.rows[i];
      const rowNum = i + 2;
      const p = Row.safeParse(raw);
      if (!p.success) {
        errors.push({ row: rowNum, message: p.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ") });
        continue;
      }
      const v = p.data;
      if (!v.sku && !v.barcode) {
        errors.push({ row: rowNum, message: "sku or barcode required" });
        continue;
      }
      const qty = Number(v.quantity);
      if (!Number.isFinite(qty)) {
        errors.push({ row: rowNum, message: "invalid quantity" });
        continue;
      }
      const typeRaw = v.adjustment_type.toLowerCase();
      const type = typeRaw === "add" || typeRaw === "in" || typeRaw === "increase" ? "add"
        : typeRaw === "remove" || typeRaw === "out" || typeRaw === "decrease" ? "remove"
        : typeRaw === "adjustment" || typeRaw === "set" || typeRaw === "adjust" ? "adjustment"
        : null;
      if (!type) {
        errors.push({ row: rowNum, message: `unknown adjustment_type "${v.adjustment_type}" (use add/remove/adjustment)` });
        continue;
      }
      if (type !== "adjustment" && qty <= 0) {
        errors.push({ row: rowNum, message: "quantity must be > 0 for add/remove" });
        continue;
      }
      if (type === "adjustment" && qty < 0) {
        errors.push({ row: rowNum, message: "adjustment quantity must be >= 0" });
        continue;
      }

      // Resolve product within org
      let q = supabaseAdmin.from("products").select("id, organization_id").eq("organization_id", orgId).limit(1);
      if (v.sku) q = q.eq("sku", v.sku);
      else q = q.eq("barcode", v.barcode!);
      const { data: prod, error: pe } = await q.maybeSingle();
      if (pe) { errors.push({ row: rowNum, message: pe.message }); continue; }
      if (!prod) { errors.push({ row: rowNum, message: "product not found in your organization" }); continue; }

      const note = [v.reason, v.location ? `@${v.location}` : null, v.notes].filter(Boolean).join(" | ") || null;
      const { error: insErr } = await supabaseAdmin.from("inventory_movements").insert({
        product_id: prod.id,
        organization_id: orgId,
        type: type as any,
        quantity: Math.abs(qty),
        note,
      } as any);
      if (insErr) { errors.push({ row: rowNum, message: insErr.message }); continue; }
      inserted++;
    }

    await supabaseAdmin.from("admin_audit_log" as never).insert({
      action_type: "import",
      target_type: "inventory_adjustments",
      target_id: orgId,
      target_label: `Imported ${inserted} adjustments`,
      performed_by: me.user_id,
      performed_by_email: me.email,
      metadata: { total: data.rows.length, inserted, failed: errors.length, organization_id: orgId } as never,
    } as never);

    return { inserted, failed: errors.length, errors };
  });
