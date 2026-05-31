import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "./security-auth";
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

const Resolution = z.object({
  action: z.enum(["skip", "update", "replace_stock", "new_sku"]),
  new_sku: z.string().trim().min(1).max(120).optional(),
});

const ImportInput = z.object({
  rows: z.array(z.record(z.string(), z.string())).max(2000),
  auto_create_categories: z.boolean().optional().default(true),
  auto_create_suppliers: z.boolean().optional().default(false),
  auto_create_locations: z.boolean().optional().default(false),
  /** Lowercase raw location name -> canonical existing or new location name. */
  location_mappings: z.record(z.string(), z.string()).optional().default({}),
  /** Per-SKU (lowercased) resolution for existing-SKU conflicts. */
  sku_resolutions: z.record(z.string(), Resolution).optional().default({}),
});

const PreviewInput = z.object({
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

function num(s: string | undefined, fallback = 0): number {
  if (!s) return fallback;
  const n = Number(String(s).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

/** Translate database errors into calm operational language. */
function humanizeDbError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("duplicate key") && m.includes("sku")) {
    return "One of these products has a SKU that already exists in your catalog.";
  }
  if (m.includes("duplicate key") && m.includes("barcode")) {
    return "One of these products has a barcode that already exists in your catalog.";
  }
  if (m.includes("duplicate key")) {
    return "Some of these products conflict with items already in your catalog.";
  }
  if (m.includes("violates")) {
    return "We couldn't save one of the rows — please review your data and try again.";
  }
  return "Something went wrong while saving. Please try again or contact support.";
}

/** Returns conflict info so the UI can offer guided resolution. */
export const previewProductsImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => PreviewInput.parse(i))
  .handler(async ({ data, context }) => {
    const me = await getActor(context.userId);
    if (me.role !== "owner" && me.role !== "manager" && me.role !== "super_admin")
      throw new Error("Forbidden: owner or manager required");
    const orgId = me.organization_id;
    if (!orgId) throw new Error("No organization");

    const skus = new Set<string>();
    const barcodes = new Set<string>();
    data.rows.forEach((r) => {
      const s = (r.sku ?? "").trim().toLowerCase();
      const b = (r.barcode ?? "").trim().toLowerCase();
      if (s) skus.add(s);
      if (b) barcodes.add(b);
    });

    const { data: existing } = await supabaseAdmin
      .from("products")
      .select("id, name, sku, barcode, location, stock")
      .eq("organization_id", orgId);

    const skuMatches: any[] = [];
    const barcodeMatches: any[] = [];
    (existing ?? []).forEach((p: any) => {
      const skl = (p.sku ?? "").toLowerCase();
      const bcl = (p.barcode ?? "").toLowerCase();
      if (skl && skus.has(skl)) {
        skuMatches.push({
          sku: p.sku,
          existing: { id: p.id, name: p.name, location: p.location, stock: p.stock, barcode: p.barcode },
        });
      }
      if (bcl && barcodes.has(bcl)) {
        barcodeMatches.push({
          barcode: p.barcode,
          existing: { id: p.id, name: p.name, location: p.location, stock: p.stock, sku: p.sku },
        });
      }
    });

    return {
      sku_conflicts: skuMatches,
      barcode_conflicts: barcodeMatches,
    };
  });

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
      .from("products").select("id, sku, barcode").eq("organization_id", orgId);
    const existingBySku = new Map<string, any>();
    const existingByBar = new Map<string, any>();
    (existing ?? []).forEach((p: any) => {
      if (p.sku) existingBySku.set(p.sku.toLowerCase(), p);
      if (p.barcode) existingByBar.set(p.barcode.toLowerCase(), p);
    });

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
    const updates: { productId: string; patch: any; stock?: number | null; mode: "update" | "replace_stock" }[] = [];
    const newCategories = new Set<string>();
    const newSuppliers = new Map<string, string>();
    const newLocations = new Map<string, string>();
    const locMap = data.location_mappings ?? {};
    const resolutions = data.sku_resolutions ?? {};
    let skipped = 0;

    data.rows.forEach((raw, idx) => {
      const rowNum = idx + 2;
      const p = Row.safeParse(raw);
      if (!p.success) {
        errors.push({ row: rowNum, message: "Some required fields are missing or invalid in this row." });
        return;
      }
      const v = p.data;
      let skuLower = v.sku.toLowerCase();
      let effectiveSku = v.sku;
      const barLower = (v.barcode || "").toLowerCase();
      const existingProduct = existingBySku.get(skuLower);
      const resolution = resolutions[skuLower];

      // Handle existing-SKU conflicts via per-row resolution
      if (existingProduct) {
        if (!resolution) {
          errors.push({
            row: rowNum,
            message: `A product with SKU "${v.sku}" already exists. Choose how to handle it.`,
          });
          return;
        }
        if (resolution.action === "skip") {
          skipped++;
          return;
        }
        if (resolution.action === "new_sku") {
          const ns = (resolution.new_sku ?? "").trim();
          if (!ns) {
            errors.push({ row: rowNum, message: `Please provide a new SKU for "${v.product_name}".` });
            return;
          }
          if (existingBySku.has(ns.toLowerCase()) || batchSkus.has(ns.toLowerCase())) {
            errors.push({ row: rowNum, message: `The new SKU "${ns}" is also already in use.` });
            return;
          }
          effectiveSku = ns;
          skuLower = ns.toLowerCase();
        }
        // update / replace_stock branches fall through to the update path below
      } else if (batchSkus.has(skuLower)) {
        errors.push({ row: rowNum, message: `SKU "${v.sku}" appears more than once in this file.` });
        return;
      }

      if (barLower) {
        const barConflict = existingByBar.get(barLower);
        if (barConflict && barConflict.id !== existingProduct?.id) {
          errors.push({
            row: rowNum,
            message: `Barcode "${v.barcode}" already belongs to another product in your catalog.`,
          });
          return;
        }
        if (batchBars.has(barLower)) {
          errors.push({ row: rowNum, message: `Barcode "${v.barcode}" appears more than once in this file.` });
          return;
        }
      }

      const cost = num(v.cost_price, 0);
      const price = num(v.sale_price, 0);
      const minStock = num(v.minimum_stock, 0);
      const qty = num(v.stock_quantity, 0);
      if ([cost, price, minStock, qty].some((n) => !Number.isFinite(n))) {
        errors.push({ row: rowNum, message: "We couldn't read a cost, price or stock value as a number." });
        return;
      }
      if (cost < 0 || price < 0 || minStock < 0 || qty < 0) {
        errors.push({ row: rowNum, message: "Cost, price and stock can't be negative." });
        return;
      }

      // Resolve location (apply user mapping first)
      let locationName = v.location?.trim() || "";
      if (locationName) {
        const rawKey = locationName.toLowerCase();
        const mapped = locMap[rawKey];
        if (mapped) locationName = mapped;
        const lowered = locationName.toLowerCase();
        if (!locNames.has(lowered)) {
          if (data.auto_create_locations) {
            if (!newLocations.has(lowered)) newLocations.set(lowered, locationName);
            locNames.add(lowered);
          } else {
            errors.push({ row: rowNum, message: `We couldn't find the location "${v.location}". Map it or create it before importing.` });
            return;
          }
        }
      }
      if (v.supplier && !supNames.has(v.supplier.toLowerCase())) {
        if (data.auto_create_suppliers) {
          const key = v.supplier.toLowerCase();
          if (!newSuppliers.has(key)) newSuppliers.set(key, v.supplier);
          supNames.add(key);
        } else {
          errors.push({ row: rowNum, message: `We couldn't find the supplier "${v.supplier}". Map it or enable auto-create.` });
          return;
        }
      }

      // Update path for existing products
      if (existingProduct && resolution && (resolution.action === "update" || resolution.action === "replace_stock")) {
        const patch: any = {
          name: v.product_name,
          barcode: v.barcode || null,
          category: v.category || null,
          supplier: v.supplier || null,
          location: locationName || null,
          cost,
          price,
          min_stock: Math.trunc(minStock),
        };
        updates.push({
          productId: existingProduct.id,
          patch,
          stock: resolution.action === "replace_stock" ? Math.trunc(qty) : null,
          mode: resolution.action,
        });
        if (v.category && !catNames.has(v.category.toLowerCase()) && data.auto_create_categories !== false) {
          newCategories.add(v.category);
          catNames.add(v.category.toLowerCase());
        }
        return;
      }

      // Plan limit check (count what we will insert)
      if (cap != null && used + toInsert.length >= cap) {
        errors.push({ row: rowNum, message: `PLAN_LIMIT_PRODUCTS:${cap}` });
        return;
      }

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
        sku: effectiveSku,
        barcode: v.barcode || null,
        category: v.category || null,
        supplier: v.supplier || null,
        location: locationName || null,
        cost,
        price,
        min_stock: Math.trunc(minStock),
        stock: 0,
      });
      if (qty > 0) stockOps.push({ tmpIdx, qty: Math.trunc(qty) });
    });

    // Create new categories / suppliers / locations
    if (newCategories.size > 0) {
      await supabaseAdmin.from("product_categories").insert(
        Array.from(newCategories).map((name) => ({ organization_id: orgId, name, is_active: true })) as any,
      );
    }
    if (newSuppliers.size > 0) {
      await supabaseAdmin.from("suppliers").insert(
        Array.from(newSuppliers.values()).map((name) => ({ organization_id: orgId, name })) as any,
      );
    }
    if (newLocations.size > 0) {
      await supabaseAdmin.from("locations").insert(
        Array.from(newLocations.values()).map((name) => ({
          organization_id: orgId, name, type: "warehouse" as const, node_level: "location", is_active: true,
        })) as any,
      );
    }

    let inserted = 0;
    let updated = 0;
    if (toInsert.length > 0) {
      const { data: ins, error } = await supabaseAdmin.from("products").insert(toInsert).select("id");
      if (error) {
        errors.push({ row: 0, message: humanizeDbError(error.message) });
      } else {
        inserted = ins?.length ?? 0;
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

    // Apply updates for existing products
    for (const u of updates) {
      const { error: upErr } = await supabaseAdmin.from("products").update(u.patch).eq("id", u.productId);
      if (upErr) {
        errors.push({ row: 0, message: humanizeDbError(upErr.message) });
        continue;
      }
      if (u.mode === "replace_stock" && u.stock != null) {
        // Use a movement so audit/history is preserved; trigger updates products.stock
        const { data: cur } = await supabaseAdmin.from("products").select("stock").eq("id", u.productId).maybeSingle();
        const currentStock = (cur as any)?.stock ?? 0;
        const delta = u.stock - currentStock;
        if (delta !== 0) {
          await supabaseAdmin.from("inventory_movements").insert({
            product_id: u.productId,
            organization_id: orgId,
            type: delta > 0 ? ("add" as const) : ("remove" as const),
            quantity: Math.abs(delta),
            note: "[import] stock replaced",
          } as any);
        }
      }
      updated++;
    }

    await supabaseAdmin.from("admin_audit_log" as never).insert({
      action_type: "import",
      target_type: "products",
      target_id: orgId,
      target_label: `Imported ${inserted} products, updated ${updated}`,
      performed_by: me.user_id,
      performed_by_email: me.email,
      metadata: {
        total: data.rows.length,
        inserted,
        updated,
        skipped,
        failed: errors.length,
        organization_id: orgId,
        new_categories: Array.from(newCategories),
        new_suppliers: Array.from(newSuppliers.values()),
        new_locations: Array.from(newLocations.values()),
      } as never,
    } as never);

    return { inserted, updated, skipped, failed: errors.length, errors };
  });
