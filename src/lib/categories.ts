import { supabase } from "@/integrations/supabase/client";

export const PRODUCT_CATEGORIES = [
  "Auto Parts",
  "Detailing Products",
  "Warehouse Supplies",
  "Beauty Supply",
  "Electronics",
  "Tools",
  "Office Supplies",
  "Food & Beverage",
  "Other",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export type ProductCategoryRow = {
  id: string;
  organization_id: string | null;
  name: string;
  is_active: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function listProductCategories(): Promise<ProductCategoryRow[]> {
  const { data, error } = await (supabase as any)
    .from("product_categories")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProductCategoryRow[];
}

export async function listActiveCategoryNames(): Promise<string[]> {
  const rows = await listProductCategories();
  const names = rows.filter((r) => r.is_active).map((r) => r.name);
  const merged = Array.from(new Set([...PRODUCT_CATEGORIES, ...names]));
  return merged;
}

export async function createProductCategory(name: string): Promise<ProductCategoryRow> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Category name required");
  // Duplicate check (case-insensitive) against existing active rows in org
  const existing = await listProductCategories();
  const dupe = existing.find(
    (r) => r.is_active && r.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (dupe) return dupe;
  const { data, error } = await (supabase as any)
    .from("product_categories")
    .insert({ name: trimmed })
    .select()
    .single();
  if (error) throw error;
  return data as ProductCategoryRow;
}

export async function renameProductCategory(id: string, name: string) {
  const { error } = await (supabase as any)
    .from("product_categories")
    .update({ name: name.trim() })
    .eq("id", id);
  if (error) throw error;
}

export async function setCategoryActive(id: string, isActive: boolean) {
  const { error } = await (supabase as any)
    .from("product_categories")
    .update({
      is_active: isActive,
      archived_at: isActive ? null : new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}
