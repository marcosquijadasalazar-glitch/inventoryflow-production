import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { logProductTransaction } from "./history";

export type Product = Tables<"products">;
export type Movement = Tables<"inventory_movements">;

export async function listProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function upsertProduct(values: TablesInsert<"products"> & { id?: string }) {
  if (values.id) {
    const { id, ...rest } = values;
    const { data: prev } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    const res = await supabase.from("products").update(rest).eq("id", id).select();
    if (res.error) {
      console.error("[products.update] error:", res.error);
      throw res.error;
    }
    const updated = res.data?.[0];
    if (updated) {
      await logProductTransaction("product_updated", updated as Product, {
        previous: (prev ?? null) as Product | null,
      });
    }
    return res.data;
  } else {
    const res = await supabase.from("products").insert(values).select();
    if (res.error) {
      console.error("[products.insert] error:", res.error);
      throw res.error;
    }
    const created = res.data?.[0];
    if (created) {
      await logProductTransaction("product_created", created as Product);
    }
    return res.data;
  }
}

export async function deleteProduct(id: string) {
  const { data: prev } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
  if (prev) {
    await logProductTransaction("product_deleted", prev as Product);
  }
}

export type MovementWithProduct = Movement & {
  products: Pick<
    Product,
    "name" | "sku" | "barcode" | "category" | "supplier" | "location"
  > | null;
};

export type CreateMovementInput = TablesInsert<"inventory_movements"> & {
  location_id?: string | null;
};

export async function listMovements(): Promise<MovementWithProduct[]> {
  const { data, error } = await supabase
    .from("inventory_movements")
    .select(
      "*, products(name, sku, barcode, category, supplier, location)",
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data as any) ?? [];
}

/** Map UI location selection to movement row location columns. */
function movementLocationFields(
  type: TablesInsert<"inventory_movements">["type"],
  locationId: string | null | undefined,
): Record<string, string> {
  if (!locationId) return {};
  const fields: Record<string, string> = { location_id: locationId };
  if (type === "add") fields.to_location_id = locationId;
  else if (type === "remove") fields.from_location_id = locationId;
  return fields;
}

export async function createMovement(values: CreateMovementInput) {
  const { location_id, ...rest } = values;
  const payload = {
    ...rest,
    ...movementLocationFields(rest.type, location_id),
  };
  const { error } = await supabase.from("inventory_movements").insert(payload as never);
  if (error) throw error;
}
