import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export type ProductLocationStockRow = {
  product_id: string;
  location_id: string;
  location_name: string | null;
  on_hand: number;
  available: number;
  reserved: number;
};

export type ProductLocationStockData = {
  /** location_id → product_id → on_hand (matches StockTab shape) */
  byLocation: Record<string, Record<string, number>>;
  byProduct: Record<string, ProductLocationStockRow[]>;
  rows: ProductLocationStockRow[];
};

/** Shared fetch for product_location_stock — queryKey ["product_location_stock"]. */
export async function fetchProductLocationStock(): Promise<ProductLocationStockData> {
  const { data, error } = await sb
    .from("product_location_stock")
    .select("product_id, location_id, location_name, on_hand, available, reserved");
  if (error) throw error;

  const byLocation: Record<string, Record<string, number>> = {};
  const byProduct: Record<string, ProductLocationStockRow[]> = {};
  const rows: ProductLocationStockRow[] = [];

  for (const raw of (data ?? []) as Array<{
    product_id: string | null;
    location_id: string | null;
    location_name: string | null;
    on_hand: number | null;
    available: number | null;
    reserved: number | null;
  }>) {
    if (!raw.product_id || !raw.location_id) continue;
    const row: ProductLocationStockRow = {
      product_id: raw.product_id,
      location_id: raw.location_id,
      location_name: raw.location_name,
      on_hand: Number(raw.on_hand ?? 0),
      available: Number(raw.available ?? raw.on_hand ?? 0),
      reserved: Number(raw.reserved ?? 0),
    };
    rows.push(row);
    byLocation[row.location_id] ??= {};
    byLocation[row.location_id][row.product_id] =
      (byLocation[row.location_id][row.product_id] ?? 0) + row.on_hand;
    byProduct[row.product_id] ??= [];
    byProduct[row.product_id].push(row);
  }

  for (const pid of Object.keys(byProduct)) {
    byProduct[pid].sort((a, b) =>
      (a.location_name ?? "").localeCompare(b.location_name ?? ""),
    );
  }

  return { byLocation, byProduct, rows };
}

export function useProductLocationStock() {
  return useQuery({
    queryKey: ["product_location_stock"],
    queryFn: fetchProductLocationStock,
    staleTime: 30_000,
  });
}

export function getStockRowsForProduct(
  productId: string,
  data: ProductLocationStockData | undefined,
): ProductLocationStockRow[] {
  return data?.byProduct[productId] ?? [];
}

export function getOnHandAtLocation(
  productId: string,
  locationId: string | null,
  data: ProductLocationStockData | undefined,
): number | null {
  if (!locationId || !data) return null;
  const row = data.byProduct[productId]?.find((r) => r.location_id === locationId);
  return row?.on_hand ?? 0;
}

export function getAvailableAtLocation(
  productId: string,
  locationId: string | null,
  data: ProductLocationStockData | undefined,
): number | null {
  if (!locationId || !data) return null;
  const row = data.byProduct[productId]?.find((r) => r.location_id === locationId);
  return row?.available ?? 0;
}

export function formatProductLocationBreakdown(
  productId: string,
  data: ProductLocationStockData | undefined,
  style: "inline" | "multiline" = "inline",
): string {
  const rows = getStockRowsForProduct(productId, data).filter(
    (r) => r.on_hand > 0 || r.available > 0,
  );
  if (rows.length === 0) return "No location stock";
  const parts = rows.map(
    (r) => `${r.location_name ?? "Location"}: ${r.available}`,
  );
  return style === "multiline" ? parts.join("\n") : parts.join(" | ");
}

export function validateLocationQuantity(opts: {
  movementType: "add" | "remove" | "adjustment";
  quantity: number;
  productId: string | null;
  locationId: string | null;
  locationName: string | null;
  stockData: ProductLocationStockData | undefined;
  requireLocation?: boolean;
}): { blocked: boolean; message?: string } {
  const {
    movementType,
    quantity,
    productId,
    locationId,
    locationName,
    stockData,
    requireLocation = true,
  } = opts;

  if (requireLocation && !locationId) {
    return { blocked: true, message: "Select a location" };
  }
  if (!productId || !locationId) return { blocked: false };

  const available = getAvailableAtLocation(productId, locationId, stockData);
  const onHand = getOnHandAtLocation(productId, locationId, stockData);
  const locLabel = locationName ?? "selected location";

  if (movementType === "remove" && available != null && quantity > available) {
    return {
      blocked: true,
      message: `Available at ${locLabel}: ${available}\nRequested: ${quantity}`,
    };
  }

  if (
    movementType === "adjustment" &&
    onHand != null &&
    available != null &&
    quantity < onHand &&
    onHand - quantity > available
  ) {
    return {
      blocked: true,
      message: `Available at ${locLabel}: ${available}\nRequested reduction: ${onHand - quantity}`,
    };
  }

  return { blocked: false };
}
