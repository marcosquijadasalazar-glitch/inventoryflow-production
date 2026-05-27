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

export const PARENT_LEVEL: Record<NodeLevel, NodeLevel | null> = {
  location: null,
  sublocation: "location",
  aisle: "sublocation",
  bin: "aisle",
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

export async function listAllNodesIncludingArchived(): Promise<LocationNode[]> {
  const { data, error } = await sb.from("locations").select("*").order("name");
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

export async function updateNode(
  id: string,
  patch: Partial<Pick<LocationNode, "name" | "code" | "notes" | "type" | "address" | "parent_id">>,
): Promise<LocationNode> {
  const clean: any = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    clean[k] = typeof v === "string" ? v.trim() || null : v;
  }
  if (clean.name === null) throw new Error("Name is required");
  const { data, error } = await sb
    .from("locations")
    .update(clean)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as LocationNode;
}

export async function archiveNode(id: string): Promise<void> {
  const { error } = await sb.from("locations").update({ is_active: false }).eq("id", id);
  if (error) throw error;
}

export async function restoreNode(id: string): Promise<void> {
  const { error } = await sb.from("locations").update({ is_active: true }).eq("id", id);
  if (error) throw error;
}

export async function deleteNode(id: string): Promise<void> {
  const { error } = await sb.from("locations").delete().eq("id", id);
  if (error) throw error;
}

/** Validate move: target must be at parent level for `node`, and not a descendant of `node`. */
export function canMoveTo(
  nodes: LocationNode[],
  nodeId: string,
  newParentId: string | null,
): { ok: boolean; reason?: string } {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return { ok: false, reason: "Node not found" };
  const requiredParent = PARENT_LEVEL[node.node_level];
  if (requiredParent === null) {
    if (newParentId !== null) return { ok: false, reason: "Locations have no parent" };
    return { ok: true };
  }
  if (!newParentId) return { ok: false, reason: "Parent required" };
  const parent = nodes.find((n) => n.id === newParentId);
  if (!parent) return { ok: false, reason: "Parent not found" };
  if (parent.node_level !== requiredParent)
    return { ok: false, reason: `Parent must be a ${requiredParent}` };
  // Cycle check
  const descendants = getDescendantIds(nodes, nodeId);
  if (descendants.includes(newParentId))
    return { ok: false, reason: "Cannot move into its own descendant" };
  return { ok: true };
}

export async function moveNode(
  nodes: LocationNode[],
  nodeId: string,
  newParentId: string | null,
): Promise<void> {
  const v = canMoveTo(nodes, nodeId, newParentId);
  if (!v.ok) throw new Error(v.reason ?? "Invalid move");
  const { error } = await sb
    .from("locations")
    .update({ parent_id: newParentId })
    .eq("id", nodeId);
  if (error) throw error;
}

export type NodeUsage = {
  children: number;
  productsAtBins: number;
  stockUnits: number;
  canDelete: boolean;
  reasons: string[];
};

/** Inspect a node to decide whether it's safe to delete. */
export async function getNodeUsage(
  nodes: LocationNode[],
  nodeId: string,
): Promise<NodeUsage> {
  const node = nodes.find((n) => n.id === nodeId);
  const descendants = getDescendantIds(nodes, nodeId);
  const binIds = nodes
    .filter((n) => descendants.includes(n.id) && n.node_level === "bin")
    .map((n) => n.id);
  const childrenCount = nodes.filter((n) => n.parent_id === nodeId && n.is_active).length;

  let productsAtBins = 0;
  let stockUnits = 0;
  if (binIds.length > 0) {
    const { data } = await sb
      .from("products")
      .select("id, stock")
      .in("bin_id", binIds);
    productsAtBins = (data ?? []).length;
    stockUnits = (data ?? []).reduce(
      (s: number, p: any) => s + Number(p.stock ?? 0),
      0,
    );
  }

  const reasons: string[] = [];
  if (childrenCount > 0) reasons.push("has_children");
  if (stockUnits > 0) reasons.push("has_stock");
  if (productsAtBins > 0 && stockUnits === 0) reasons.push("has_products");

  return {
    children: childrenCount,
    productsAtBins,
    stockUnits,
    canDelete: reasons.length === 0 && !!node,
    reasons,
  };
}

/** Import hierarchy rows: reuse existing nodes (by name within same parent), create missing. */
export type HierarchyImportRow = {
  location_name?: string;
  sub_location_name?: string;
  aisle_name?: string;
  bin_name?: string;
  code?: string;
  notes?: string;
};

export type HierarchyImportResult = {
  created: Record<NodeLevel, number>;
  reused: Record<NodeLevel, number>;
  failed: number;
  errors: { row: number; message: string }[];
};

export async function importHierarchy(
  rows: HierarchyImportRow[],
): Promise<HierarchyImportResult> {
  const result: HierarchyImportResult = {
    created: { location: 0, sublocation: 0, aisle: 0, bin: 0 },
    reused: { location: 0, sublocation: 0, aisle: 0, bin: 0 },
    failed: 0,
    errors: [],
  };
  // Refresh cache each call to detect newly inserted siblings
  let cache: LocationNode[] = await listAllNodesIncludingArchived();

  const findChild = (parentId: string | null, level: NodeLevel, name: string) =>
    cache.find(
      (n) =>
        (n.parent_id ?? null) === parentId &&
        n.node_level === level &&
        n.name.trim().toLowerCase() === name.trim().toLowerCase(),
    );

  const ensure = async (
    parentId: string | null,
    level: NodeLevel,
    name: string,
    extras: { code?: string; notes?: string } = {},
  ): Promise<LocationNode> => {
    const existing = findChild(parentId, level, name);
    if (existing) {
      result.reused[level]++;
      return existing;
    }
    const created = await createNode({
      name,
      node_level: level,
      parent_id: parentId,
      code: extras.code ?? null,
      notes: extras.notes ?? null,
      type: level === "bin" ? "bin" : level === "location" ? "warehouse" : "shelf",
    });
    cache = [...cache, created];
    result.created[level]++;
    return created;
  };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    try {
      const locName = (r.location_name ?? "").trim();
      if (!locName) throw new Error("location_name is required");
      const loc = await ensure(null, "location", locName);
      let parentId: string = loc.id;
      const subName = (r.sub_location_name ?? "").trim();
      if (subName) {
        const sub = await ensure(parentId, "sublocation", subName);
        parentId = sub.id;
      }
      const aisleName = (r.aisle_name ?? "").trim();
      if (aisleName) {
        // Aisles require a sub-location parent. Auto-create a default one if missing.
        if (!subName) {
          const def = await ensure(loc.id, "sublocation", "General");
          parentId = def.id;
        }
        const aisle = await ensure(parentId, "aisle", aisleName, {
          code: r.code,
        });
        parentId = aisle.id;
      }
      const binName = (r.bin_name ?? "").trim();
      if (binName) {
        if (!aisleName) throw new Error("aisle_name is required when bin_name is set");
        await ensure(parentId, "bin", binName, { code: r.code, notes: r.notes });
      }
    } catch (e: any) {
      result.failed++;
      result.errors.push({ row: i + 2, message: e?.message ?? String(e) });
    }
  }
  return result;
}
