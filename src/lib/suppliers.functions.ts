import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Row = z.object({
  supplier_name: z.string().trim().min(1).max(200),
  contact_name: z.string().trim().max(120).optional().or(z.literal("")),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  payment_terms: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  status: z.string().trim().max(20).optional().or(z.literal("")),
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

export const listSuppliers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await getActor(context.userId);
    if (!me.organization_id && me.role !== "super_admin") return { suppliers: [] };
    let q = supabaseAdmin.from("suppliers").select("*").order("name");
    if (me.role !== "super_admin") q = q.eq("organization_id", me.organization_id!);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { suppliers: data ?? [] };
  });

export const importSuppliers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => ImportInput.parse(i))
  .handler(async ({ data, context }) => {
    const me = await getActor(context.userId);
    if (me.role !== "owner" && me.role !== "manager" && me.role !== "super_admin")
      throw new Error("Forbidden: owner or manager required");
    const orgId = me.organization_id;
    if (!orgId) throw new Error("No organization");

    const errors: { row: number; message: string }[] = [];
    const valid: any[] = [];
    data.rows.forEach((raw, idx) => {
      const p = Row.safeParse(raw);
      if (!p.success) {
        errors.push({ row: idx + 2, message: p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
        return;
      }
      const v = p.data;
      const meta = [
        v.contact_name ? `Contact: ${v.contact_name}` : null,
        v.payment_terms ? `Terms: ${v.payment_terms}` : null,
        v.status ? `Status: ${v.status}` : null,
        v.notes || null,
      ].filter(Boolean).join(" | ");
      valid.push({
        organization_id: orgId,
        name: v.supplier_name,
        email: v.email || null,
        phone: v.phone || null,
        notes: meta || null,
      });
    });

    let inserted = 0;
    if (valid.length > 0) {
      const { data: ins, error } = await supabaseAdmin.from("suppliers").insert(valid).select("id");
      if (error) errors.push({ row: 0, message: error.message });
      else inserted = ins?.length ?? 0;
    }

    await supabaseAdmin.from("admin_audit_log" as never).insert({
      action_type: "import",
      target_type: "suppliers",
      target_id: orgId,
      target_label: `Imported ${inserted} suppliers`,
      performed_by: me.user_id,
      performed_by_email: me.email,
      metadata: { total: data.rows.length, inserted, failed: errors.length, organization_id: orgId } as never,
    } as never);

    return { inserted, failed: errors.length, errors };
  });
