import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export type LocationType =
  | "warehouse"
  | "store"
  | "shelf"
  | "bin"
  | "truck"
  | "other";

export type Location = {
  id: string;
  organization_id: string | null;
  name: string;
  type: LocationType;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export const LOCATION_TYPES: LocationType[] = [
  "warehouse",
  "store",
  "shelf",
  "bin",
  "truck",
  "other",
];

export async function listLocations(opts?: {
  includeInactive?: boolean;
}): Promise<Location[]> {
  let q = sb.from("locations").select("*").order("name");
  if (!opts?.includeInactive) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function createLocation(input: {
  name: string;
  type: LocationType;
  address?: string | null;
  notes?: string | null;
  is_active?: boolean;
}): Promise<Location> {
  const name = (input.name ?? "").trim();
  if (!name) throw new Error("Name is required");
  if (name.length > 120) throw new Error("Name too long");
  const { data, error } = await sb
    .from("locations")
    .insert({
      name,
      type: input.type,
      address: input.address?.trim() || null,
      notes: input.notes?.trim() || null,
      is_active: input.is_active ?? true,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Location;
}

export async function updateLocation(
  id: string,
  patch: Partial<Pick<Location, "name" | "type" | "address" | "notes" | "is_active">>,
): Promise<Location> {
  const { data, error } = await sb
    .from("locations")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Location;
}
