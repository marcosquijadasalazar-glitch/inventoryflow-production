import type { TablesInsert } from "@/integrations/supabase/types";

/** Build location-aware inventory_movements rows for transfer completion. */
export function buildTransferMovementRows(opts: {
  product_id: string;
  quantity: number;
  from_location_id: string;
  to_location_id: string;
  noteOut: string;
  noteIn: string;
  organization_id?: string | null;
}): [TablesInsert<"inventory_movements">, TablesInsert<"inventory_movements">] {
  const org = opts.organization_id ? { organization_id: opts.organization_id } : {};
  return [
    {
      product_id: opts.product_id,
      type: "remove",
      quantity: opts.quantity,
      note: opts.noteOut,
      location_id: opts.from_location_id,
      from_location_id: opts.from_location_id,
      ...org,
    },
    {
      product_id: opts.product_id,
      type: "add",
      quantity: opts.quantity,
      note: opts.noteIn,
      location_id: opts.to_location_id,
      to_location_id: opts.to_location_id,
      ...org,
    },
  ];
}
