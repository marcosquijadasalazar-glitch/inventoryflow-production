import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CustomerRow = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

const ImportInput = z.object({
  rows: z.array(z.record(z.string(), z.string())).max(2000),
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

export const listCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await getActor(context.userId);
    if (!me.organization_id && me.role !== "super_admin") return { customers: [] };
    let q = supabaseAdmin.from("customers").select("*").order("name");
    if (me.role !== "super_admin") q = q.eq("organization_id", me.organization_id!);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { customers: data ?? [] };
  });

export const importCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ImportInput.parse(input))
  .handler(async ({ data, context }) => {
    const me = await getActor(context.userId);
    if (me.role !== "owner" && me.role !== "manager" && me.role !== "super_admin") {
      throw new Error("Forbidden: owner or manager required");
    }
    const orgId = me.organization_id;
    if (!orgId) throw new Error("No organization");

    const errors: { row: number; message: string }[] = [];
    const valid: Array<{
      organization_id: string;
      name: string;
      email: string | null;
      phone: string | null;
      address: string | null;
      notes: string | null;
    }> = [];

    data.rows.forEach((raw, idx) => {
      const parsed = CustomerRow.safeParse(raw);
      if (!parsed.success) {
        errors.push({ row: idx + 2, message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
        return;
      }
      const v = parsed.data;
      valid.push({
        organization_id: orgId,
        name: v.name,
        email: v.email ? v.email : null,
        phone: v.phone ? v.phone : null,
        address: v.address ? v.address : null,
        notes: v.notes ? v.notes : null,
      });
    });

    let inserted = 0;
    if (valid.length > 0) {
      const { data: ins, error } = await supabaseAdmin.from("customers").insert(valid).select("id");
      if (error) {
        errors.push({ row: 0, message: error.message });
      } else {
        inserted = ins?.length ?? 0;
      }
    }

    await supabaseAdmin.from("admin_audit_log" as never).insert({
      action_type: "import",
      target_type: "customers",
      target_id: orgId,
      target_label: `Imported ${inserted} customers`,
      performed_by: me.user_id,
      performed_by_email: me.email,
      metadata: { total: data.rows.length, inserted, failed: errors.length, organization_id: orgId } as never,
    } as never);

    return { inserted, failed: errors.length, errors };
  });
