import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type TransactionRow = {
  id: string;
  created_at: string;
  type:
    | "product_created"
    | "product_updated"
    | "product_deleted"
    | "stock_added"
    | "stock_removed"
    | "stock_adjusted"
    | "low_stock";
  source: "manual" | "barcode_scan" | "adjustment" | "system";
  product_id: string | null;
  product_name: string | null;
  sku: string | null;
  barcode: string | null;
  quantity_change: number | null;
  previous_stock: number | null;
  new_stock: number | null;
  reason: string | null;
  user_id: string | null;
  user_email: string | null;
};

export async function listTransactionHistory(): Promise<TransactionRow[]> {
  const { data, error } = await (supabase as any)
    .from("transaction_history")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []) as TransactionRow[];
}

type ProductLite = Pick<
  Tables<"products">,
  "id" | "name" | "sku" | "barcode" | "stock"
>;

export async function logProductTransaction(
  type: "product_created" | "product_updated" | "product_deleted",
  product: ProductLite,
  opts?: { reason?: string; previous?: ProductLite | null },
) {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    await (supabase as any).from("transaction_history").insert({
      type,
      source: "manual",
      product_id: type === "product_deleted" ? null : product.id,
      product_name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      new_stock: product.stock,
      previous_stock: opts?.previous?.stock ?? null,
      reason: opts?.reason ?? null,
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
    });
  } catch (e) {
    console.error("[history] failed to log", e);
  }
}
