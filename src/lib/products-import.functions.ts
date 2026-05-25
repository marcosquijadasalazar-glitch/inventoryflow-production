import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PLAN_LIMITS, type PlanType } from "./plan-limits";

const Row = z.object({
  product_name: z.string().trim().min(1).max(200),
  sku: z.string().trim().min(1).max(120),
  barcode: z.string().trim().max(120).optional().or(z.literal("")),
  category: z.string().trim().max(120).optional().or(z.literal("")),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  cost_price: z.string().trim().optional().or(z.literal("")),
  sale_price: z.string().trim().optional().or(z.literal("")),
  stock_quantity: z.string().trim().optional().or(z.literal("")),
  minimum_stock: z.string().trim().optional().or(z.literal("")),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  supplier: z.string().trim().max(200).optional().or(z.literal("")),
  status: z.string().trim().max(20).optional().or(z.literal("")),
});

const ImportInput = z.object({
  rows: z.array(z.record(z.string(), z.string())).max(2000),
  auto_create_categories: z.boolean().optional().default(true),
  auto_create_suppliers: z.boolean().optional().default(false),
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

function num(s: string | undefined, fallback = 0): number {
  if (!s) return fallback;
  const n = Number(String(s).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

export const importProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => ImportInput.parse(i))
  .handler(async ({ data, context }) => {
    const me = await getActor(context.userId);
    if (me.role !== "owner" && me.role !== "manager" && me.role !== "super_admin")
      throw new Error("Forbidden: owner or manager required");
    const orgId = me.organization_id;
    if (!orgId) throw new Error("No organization");

    // Plan cap
    const { data: org } = await supabaseAdmin
      .from("organizations").select("plan_type").eq("id", orgId).maybeSingle();
    const plan = ((org as any)?.plan_type ?? "free") as PlanType;
    const cap = PLAN_LIMITS[plan].max_products;
    let used = 0;
    if (cap != null) {
      const { count } = await supabaseAdmin
        .from("products").select("id", { count: "exact", head: true })
        .eq("organization_id", orgId);
      used = count ?? 0;
    }

    // Existing SKUs / barcodes in this org
    const { data: existing } = await supabaseAdmin
      .from("products").select("sku, barcode").eq("organization_id", orgId);
    const existingSkus = new Set((existing ?? []).map((p: any) => (p.sku ?? "").toLowerCase()).filter(Boolean));
    const existingBars = new Set((existing ?? []).map((p: any) => (p.barcode ?? "").toLowerCase()).filter(Boolean));

    // Org locations / suppliers for ownership validation (case-insensitive name match)
    const [{ data: locs }, { data: sups }, { data: cats }] = await Promise.all([
      supabaseAdmin.from("locations").select("name").eq("organization_id", orgId).eq("is_active", true),
      supabaseAdmin.from("suppliers").select("name").eq("organization_id", orgId),
      supabaseAdmin.from("product_categories").select("name").eq("organization_id", orgId).eq("is_active", true),
    ]);
    const locNames = new Set((locs ?? []).map((l: any) => l.name.toLowerCase()));
    const supNames = new Set((sups ?? []).map((s: any) => s.name.toLowerCase()));
    const catNames = new Set((cats ?? []).map((c: any) => c.name.toLowerCase()));

    const errors: { row: number; message: string }[] = [];
    const batchSkus = new Set<string>();
    const batchBars = new Set<string>();
    const toInsert: any[] = [];
    const stockOps: { tmpIdx: number; qty: number }[] = [];
    const newCategories = new Set<string>();
    const newSuppliers = new Map<string, string>(); // lower -> original name


    data.rows.forEach((raw, idx) => {
      const rowNum = idx + 2;
      const p = Row.safeParse(raw);
      if (!p.success) {
        errors.push({ row: rowNum, message: p.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ") });
        return;
      }
      const v = p.data;
      const skuLower = v.sku.toLowerCase();
      const barLower = (v.barcode || "").toLowerCase();

      if (existingSkus.has(skuLower)) {
        errors.push({ row: rowNum, message: `duplicate sku "${v.sku}" already exists` });
        return;
      }
      if (batchSkus.has(skuLower)) {
        errors.push({ row: rowNum, message: `duplicate sku "${v.sku}" in upload` });
        return;
      }
      if (barLower) {
        if (existingBars.has(barLower)) {
          errors.push({ row: rowNum, message: `duplicate barcode "${v.barcode}" already exists` });
          return;
        }
        if (batchBars.has(barLower)) {
          errors.push({ row: rowNum, message: `duplicate barcode "${v.barcode}" in upload` });
          return;
        }
      }

      const cost = num(v.cost_price, 0);
      const price = num(v.sale_price, 0);
      const minStock = num(v.minimum_stock, 0);
      const qty = num(v.stock_quantity, 0);
      if ([cost, price, minStock, qty].some((n) => !Number.isFinite(n))) {
        errors.push({ row: rowNum, message: "invalid numeric value in cost/price/stock fields" });
        return;
      }
      if (cost < 0 || price < 0 || minStock < 0 || qty < 0) {
        errors.push({ row: rowNum, message: "numeric values must be >= 0" });
        return;
      }

      // Validate ownership (location/supplier) if provided
      if (v.location && !locNames.has(v.location.toLowerCase())) {
        errors.push({ row: rowNum, message: `location "${v.location}" not found in your organization` });
        return;
      }
      if (v.supplier && !supNames.has(v.supplier.toLowerCase())) {
        if (data.auto_create_suppliers) {
          const key = v.supplier.toLowerCase();
          if (!newSuppliers.has(key)) newSuppliers.set(key, v.supplier);
          supNames.add(key);
        } else {
          errors.push({ row: rowNum, message: `supplier "${v.supplier}" not found in your organization` });
          return;
        }
      }


      // Plan limit check (count what we will insert)
      if (cap != null && used + toInsert.length >= cap) {
        errors.push({ row: rowNum, message: `PLAN_LIMIT_PRODUCTS:${cap}` });
        return;
      }

      // Category auto-create
      if (v.category && !catNames.has(v.category.toLowerCase())) {
        if (data.auto_create_categories !== false) {
          newCategories.add(v.category);
          catNames.add(v.category.toLowerCase());
        }
      }

      batchSkus.add(skuLower);
      if (barLower) batchBars.add(barLower);

      const tmpIdx = toInsert.length;
      toInsert.push({
        organization_id: orgId,
        name: v.product_name,
        sku: v.sku,
        barcode: v.barcode || null,
        category: v.category || null,
        supplier: v.supplier || null,
        location: v.location || null,
        cost,
        price,
        min_stock: Math.trunc(minStock),
        stock: 0, // initial inventory recorded via movement below for audit
      });
      if (qty > 0) stockOps.push({ tmpIdx, qty: Math.trunc(qty) });
    });

    // Create new categories first
    if (newCategories.size > 0) {
      const catRows = Array.from(newCategories).map((name) => ({
        organization_id: orgId,
        name,
        is_active: true,
      }));
      await supabaseAdmin.from("product_categories").insert(catRows as any);
    }

    let inserted = 0;
    if (toInsert.length > 0) {
      const { data: ins, error } = await supabaseAdmin.from("products").insert(toInsert).select("id");
      if (error) {
        errors.push({ row: 0, message: error.message });
      } else {
        inserted = ins?.length ?? 0;
        // Initial inventory movements (trigger updates products.stock)
        const moves = stockOps
          .map((op) => {
            const id = ins?.[op.tmpIdx]?.id;
            return id
              ? { product_id: id, organization_id: orgId, type: "add" as const, quantity: op.qty, note: "[import] initial stock" }
              : null;
          })
          .filter(Boolean);
        if (moves.length > 0) {
          await supabaseAdmin.from("inventory_movements").insert(moves as any);
        }
      }
    }

    await supabaseAdmin.from("admin_audit_log" as never).insert({
      action_type: "import",
      target_type: "products",
      target_id: orgId,
      target_label: `Imported ${inserted} products`,
      performed_by: me.user_id,
      performed_by_email: me.email,
      metadata: {
        total: data.rows.length,
        inserted,
        failed: errors.length,
        organization_id: orgId,
        new_categories: Array.from(newCategories),
      } as never,
    } as never);

    return { inserted, failed: errors.length, errors };
  });
