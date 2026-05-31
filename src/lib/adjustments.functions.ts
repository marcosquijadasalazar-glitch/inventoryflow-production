import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "./security-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { recordOperationalEvent } from "./audit.server";

const Row = z.object({
  sku: z.string().trim().max(120).optional().or(z.literal("")),
  barcode: z.string().trim().max(120).optional().or(z.literal("")),
  adjustment_type: z.string().trim().min(1).max(20),
  quantity: z.string().trim().min(1),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
  location: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

const RowsInput = z.array(z.record(z.string(), z.string())).max(2000);
const PreviewInput = z.object({ rows: RowsInput });
const ImportInput = z.object({
  rows: RowsInput,
  batch_reason: z.string().trim().max(500).optional().or(z.literal("")),
  confirm_large: z.boolean().optional().default(false),
});

const LARGE_DELTA_THRESHOLD = 100; // absolute units
const LARGE_VARIANCE_PCT = 50; // % vs current stock

async function getActor(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("user_id, role, organization_id, email, full_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Profile not found");
  return data;
}

function normalizeType(t: string): "add" | "remove" | "adjustment" | null {
  const x = t.toLowerCase();
  if (x === "add" || x === "in" || x === "increase") return "add";
  if (x === "remove" || x === "out" || x === "decrease") return "remove";
  if (x === "adjustment" || x === "set" || x === "adjust") return "adjustment";
  return null;
}

export type PreviewRow = {
  row: number;
  sku: string | null;
  barcode: string | null;
  product_id: string | null;
  product_name: string | null;
  current_stock: number | null;
  type: "add" | "remove" | "adjustment" | null;
  quantity: number | null;
  new_stock: number | null;
  delta: number | null;
  reason: string | null;
  location: string | null;
  warnings: string[];
  error: string | null;
};

export const previewAdjustments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => PreviewInput.parse(i))
  .handler(async ({ data, context }) => {
    const me = await getActor(context.userId);
    const orgId = me.organization_id;
    if (!orgId) throw new Error("No organization");

    // Pre-fetch all products once for speed
    const skus = new Set<string>();
    const codes = new Set<string>();
    for (const r of data.rows) {
      if (r.sku) skus.add(String(r.sku).trim());
      if (r.barcode) codes.add(String(r.barcode).trim());
    }
    const productMap = new Map<string, { id: string; name: string; stock: number; sku: string; barcode: string | null }>();
    if (skus.size || codes.size) {
      const { data: prods } = await supabaseAdmin
        .from("products")
        .select("id, name, sku, barcode, stock")
        .eq("organization_id", orgId)
        .or(
          [
            skus.size ? `sku.in.(${[...skus].map((s) => `"${s.replace(/"/g, "")}"`).join(",")})` : "",
            codes.size ? `barcode.in.(${[...codes].map((s) => `"${s.replace(/"/g, "")}"`).join(",")})` : "",
          ]
            .filter(Boolean)
            .join(","),
        );
      for (const p of prods ?? []) {
        if (p.sku) productMap.set("sku:" + p.sku, p as any);
        if (p.barcode) productMap.set("bc:" + p.barcode, p as any);
      }
    }

    const seen = new Map<string, number>(); // dedupe key -> row#
    const out: PreviewRow[] = [];
    for (let i = 0; i < data.rows.length; i++) {
      const raw = data.rows[i];
      const rowNum = i + 2;
      const p = Row.safeParse(raw);
      if (!p.success) {
        out.push({
          row: rowNum, sku: null, barcode: null, product_id: null, product_name: null,
          current_stock: null, type: null, quantity: null, new_stock: null, delta: null,
          reason: null, location: null, warnings: [],
          error: p.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; "),
        });
        continue;
      }
      const v = p.data;
      const sku = v.sku || null;
      const bc = v.barcode || null;
      const warnings: string[] = [];

      if (!sku && !bc) {
        out.push({ row: rowNum, sku, barcode: bc, product_id: null, product_name: null, current_stock: null, type: null, quantity: null, new_stock: null, delta: null, reason: v.reason || null, location: v.location || null, warnings, error: "Provide a SKU or barcode" });
        continue;
      }
      const type = normalizeType(v.adjustment_type);
      const qty = Number(v.quantity);
      if (!type) {
        out.push({ row: rowNum, sku, barcode: bc, product_id: null, product_name: null, current_stock: null, type: null, quantity: null, new_stock: null, delta: null, reason: v.reason || null, location: v.location || null, warnings, error: `Unknown type "${v.adjustment_type}". Use add, remove, or set.` });
        continue;
      }
      if (!Number.isFinite(qty)) {
        out.push({ row: rowNum, sku, barcode: bc, product_id: null, product_name: null, current_stock: null, type, quantity: null, new_stock: null, delta: null, reason: v.reason || null, location: v.location || null, warnings, error: "Invalid quantity" });
        continue;
      }
      if (type !== "adjustment" && qty <= 0) {
        out.push({ row: rowNum, sku, barcode: bc, product_id: null, product_name: null, current_stock: null, type, quantity: qty, new_stock: null, delta: null, reason: v.reason || null, location: v.location || null, warnings, error: "Quantity must be greater than 0 for add/remove" });
        continue;
      }
      if (type === "adjustment" && qty < 0) {
        out.push({ row: rowNum, sku, barcode: bc, product_id: null, product_name: null, current_stock: null, type, quantity: qty, new_stock: null, delta: null, reason: v.reason || null, location: v.location || null, warnings, error: "Set quantity cannot be negative" });
        continue;
      }

      const prod = sku ? productMap.get("sku:" + sku) : productMap.get("bc:" + bc!);
      if (!prod) {
        out.push({ row: rowNum, sku, barcode: bc, product_id: null, product_name: null, current_stock: null, type, quantity: qty, new_stock: null, delta: null, reason: v.reason || null, location: v.location || null, warnings, error: "Product not found in your organization" });
        continue;
      }

      const current = prod.stock ?? 0;
      const newStock =
        type === "add" ? current + qty : type === "remove" ? current - qty : qty;
      const delta = newStock - current;

      // Dedupe
      const key = `${prod.id}|${type}|${qty}`;
      if (seen.has(key)) warnings.push(`Duplicate of row ${seen.get(key)}`);
      else seen.set(key, rowNum);

      if (newStock < 0) warnings.push("Would result in negative stock");
      if (Math.abs(delta) >= LARGE_DELTA_THRESHOLD) warnings.push("Large change");
      if (current > 0 && Math.abs(delta) / current * 100 >= LARGE_VARIANCE_PCT)
        warnings.push("Unusual variance vs current stock");

      out.push({
        row: rowNum, sku, barcode: bc,
        product_id: prod.id, product_name: prod.name,
        current_stock: current, type, quantity: qty,
        new_stock: newStock, delta,
        reason: v.reason || null, location: v.location || null,
        warnings, error: null,
      });
    }

    const summary = {
      total: out.length,
      valid: out.filter((r) => !r.error).length,
      errors: out.filter((r) => !!r.error).length,
      warnings: out.filter((r) => r.warnings.length > 0).length,
      large: out.filter((r) => r.warnings.includes("Large change") || r.warnings.includes("Unusual variance vs current stock")).length,
      negatives: out.filter((r) => r.warnings.includes("Would result in negative stock")).length,
      net_delta: out.reduce((s, r) => s + (r.delta ?? 0), 0),
    };

    return { rows: out, summary };
  });

export const importAdjustments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => ImportInput.parse(i))
  .handler(async ({ data, context }) => {
    const me = await getActor(context.userId);
    if (me.role !== "owner" && me.role !== "manager" && me.role !== "super_admin")
      throw new Error("Only owners and managers can import adjustments");
    const orgId = me.organization_id;
    if (!orgId) throw new Error("No organization");

    const errors: { row: number; message: string }[] = [];
    let inserted = 0;
    let largeChanges = 0;
    let negativeResults = 0;
    const productsTouched = new Set<string>();

    for (let i = 0; i < data.rows.length; i++) {
      const raw = data.rows[i];
      const rowNum = i + 2;
      const p = Row.safeParse(raw);
      if (!p.success) {
        errors.push({ row: rowNum, message: p.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ") });
        continue;
      }
      const v = p.data;
      if (!v.sku && !v.barcode) { errors.push({ row: rowNum, message: "Provide a SKU or barcode" }); continue; }
      const qty = Number(v.quantity);
      if (!Number.isFinite(qty)) { errors.push({ row: rowNum, message: "Invalid quantity" }); continue; }
      const type = normalizeType(v.adjustment_type);
      if (!type) { errors.push({ row: rowNum, message: `Unknown type "${v.adjustment_type}". Use add, remove, or set.` }); continue; }
      if (type !== "adjustment" && qty <= 0) { errors.push({ row: rowNum, message: "Quantity must be > 0 for add/remove" }); continue; }
      if (type === "adjustment" && qty < 0) { errors.push({ row: rowNum, message: "Set quantity cannot be negative" }); continue; }

      let q = supabaseAdmin.from("products").select("id, name, stock, organization_id").eq("organization_id", orgId).limit(1);
      if (v.sku) q = q.eq("sku", v.sku);
      else q = q.eq("barcode", v.barcode!);
      const { data: prod, error: pe } = await q.maybeSingle();
      if (pe) { errors.push({ row: rowNum, message: pe.message }); continue; }
      if (!prod) { errors.push({ row: rowNum, message: "Product not found in your organization" }); continue; }

      const current = (prod as any).stock ?? 0;
      const newStock = type === "add" ? current + qty : type === "remove" ? current - qty : qty;
      const delta = newStock - current;
      if (newStock < 0) negativeResults++;
      if (Math.abs(delta) >= LARGE_DELTA_THRESHOLD) {
        largeChanges++;
        if (!data.confirm_large) {
          errors.push({ row: rowNum, message: `Large change (${delta > 0 ? "+" : ""}${delta}). Confirm large changes to proceed.` });
          continue;
        }
      }

      const noteParts = [
        v.reason || data.batch_reason || null,
        v.location ? `@${v.location}` : null,
        v.notes || null,
      ].filter(Boolean);
      const note = noteParts.length ? `[import] ${noteParts.join(" | ")}` : "[import] bulk adjustment";

      const { error: insErr } = await supabaseAdmin.from("inventory_movements").insert({
        product_id: (prod as any).id,
        organization_id: orgId,
        type: type as any,
        quantity: Math.abs(qty),
        note,
      } as any);
      if (insErr) { errors.push({ row: rowNum, message: insErr.message }); continue; }
      inserted++;
      productsTouched.add((prod as any).id);
    }

    // Operational audit: batch summary
    await recordOperationalEvent({
      organization_id: orgId,
      action_type: "adjustments_imported",
      entity_type: "inventory_adjustments",
      entity_label: `Bulk import: ${inserted} adjustments`,
      summary: `Imported ${inserted} stock adjustments (${errors.length} skipped)`,
      metadata: {
        inserted,
        failed: errors.length,
        total: data.rows.length,
        products_touched: productsTouched.size,
        large_changes: largeChanges,
        negative_results: negativeResults,
        batch_reason: data.batch_reason || null,
        confirm_large: !!data.confirm_large,
      },
      actor_user_id: me.user_id,
      actor_email: me.email,
    });

    return {
      inserted,
      failed: errors.length,
      errors,
      summary: {
        products_touched: productsTouched.size,
        large_changes: largeChanges,
        negative_results: negativeResults,
      },
    };
  });

export const recentAdjustmentImports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await getActor(context.userId);
    if (!me.organization_id) return { items: [] as Array<{ id: string; created_at: string; actor_email: string | null; summary: string | null; metadata: any }> };
    const { data } = await supabaseAdmin
      .from("operational_audit_log")
      .select("id, created_at, actor_email, summary, metadata")
      .eq("organization_id", me.organization_id)
      .eq("action_type", "adjustments_imported")
      .order("created_at", { ascending: false })
      .limit(10);
    return { items: (data ?? []) as any };
  });
