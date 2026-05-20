import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

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
    const res = await supabase.from("products").update(rest).eq("id", id).select();
    console.log("[products.update] response:", res);
    if (res.error) {
      console.error("[products.update] error:", res.error);
      throw res.error;
    }
    return res.data;
  } else {
    const res = await supabase.from("products").insert(values).select();
    console.log("[products.insert] response:", res);
    if (res.error) {
      console.error("[products.insert] error:", res.error);
      throw res.error;
    }
    return res.data;
  }
}

export async function deleteProduct(id: string) {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
}

export async function listMovements(): Promise<(Movement & { products: Pick<Product, "name" | "sku"> | null })[]> {
  const { data, error } = await supabase
    .from("inventory_movements")
    .select("*, products(name, sku)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data as any) ?? [];
}

export async function createMovement(values: TablesInsert<"inventory_movements">) {
  const { error } = await supabase.from("inventory_movements").insert(values);
  if (error) throw error;
}
