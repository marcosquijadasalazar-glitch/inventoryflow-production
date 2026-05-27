import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export type NodeLevel = "location" | "sublocation" | "aisle" | "bin";

export type LocationNode = {
  id: string;
  organization_id: string | null;
  name: string;
  type: string;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  parent_id: string | null;
  node_level: NodeLevel;
  code: string | null;
  created_at: string;
  updated_at: string;
};

export const NEXT_LEVEL: Record<NodeLevel, NodeLevel | null> = {
  location: "sublocation",
  sublocation: "aisle",
  aisle: "bin",
  bin: null,
};

export const LEVEL_LABEL: Record<NodeLevel, string> = {
  location: "Location",
  sublocation: "Sub-location",
  aisle: "Aisle",
  bin: "Bin",
};

export async function listAllNodes(): Promise<LocationNode[]> {
  const { data, error } = await sb
    .from("locations")
    .select("*")
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return (data ?? []) as LocationNode[];
}

export function getChildren(
  nodes: LocationNode[],
  parentId: string | null,
): LocationNode[] {
  return nodes.filter((n) => (n.parent_id ?? null) === parentId);
}

export function getBreadcrumb(
  nodes: LocationNode[],
  nodeId: string | null,
): LocationNode[] {
  if (!nodeId) return [];
  const map = new Map(nodes.map((n) => [n.id, n]));
  const path: LocationNode[] = [];
  let current = map.get(nodeId);
  while (current) {
    path.unshift(current);
    current = current.parent_id ? map.get(current.parent_id) : undefined;
  }
  return path;
}

export function getDescendantIds(
  nodes: LocationNode[],
  rootId: string,
): string[] {
  const result: string[] = [];
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    result.push(id);
    for (const n of nodes) {
      if (n.parent_id === id) stack.push(n.id);
    }
  }
  return result;
}

export async function createNode(input: {
  name: string;
  node_level: NodeLevel;
  parent_id: string | null;
  type?: string;
  address?: string | null;
  notes?: string | null;
  code?: string | null;
}): Promise<LocationNode> {
  const name = (input.name ?? "").trim();
  if (!name) throw new Error("Name is required");
  if (name.length > 120) throw new Error("Name too long");
  const payload: any = {
    name,
    node_level: input.node_level,
    parent_id: input.parent_id,
    type: input.type ?? (input.node_level === "bin" ? "bin" : "warehouse"),
    address: input.address?.trim() || null,
    notes: input.notes?.trim() || null,
    code: input.code?.trim() || null,
    is_active: true,
  };
  const { data, error } = await sb
    .from("locations")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as LocationNode;
}
