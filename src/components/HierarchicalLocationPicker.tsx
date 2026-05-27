import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listAllNodes,
  getChildren,
  type LocationNode,
  type NodeLevel,
} from "@/lib/location-tree";
import { LocationNodeDialog } from "./LocationNodeDialog";

const LEVELS: NodeLevel[] = ["location", "sublocation", "aisle", "bin"];

/**
 * Cascading hierarchy picker (Location → Sub-location → Aisle → Bin).
 * Emits the deepest selected node id via `onChange`.
 */
export function HierarchicalLocationPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (
    deepestId: string | null,
    info: { node: LocationNode | null; path: LocationNode[] },
  ) => void;
}) {
  const { t } = useTranslation();
  const { data: nodes = [] } = useQuery({
    queryKey: ["location-nodes-all"],
    queryFn: listAllNodes,
  });
  const [createLevel, setCreateLevel] = useState<NodeLevel | null>(null);

  // Derive selected ids at each level from current `value`.
  const selectedByLevel = useMemo(() => {
    const map: Record<NodeLevel, string | null> = {
      location: null,
      sublocation: null,
      aisle: null,
      bin: null,
    };
    const byId = new Map(nodes.map((n) => [n.id, n]));
    let cur = value ? byId.get(value) : undefined;
    while (cur) {
      map[cur.node_level] = cur.id;
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
    }
    return map;
  }, [nodes, value]);

  const emit = (deepestId: string | null) => {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const path: LocationNode[] = [];
    let cur = deepestId ? byId.get(deepestId) : undefined;
    while (cur) {
      path.unshift(cur);
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
    }
    onChange(deepestId, {
      node: deepestId ? (byId.get(deepestId) ?? null) : null,
      path,
    });
  };

  const handleSelect = (level: NodeLevel, id: string) => {
    // When picking at a higher level, drop deeper selections.
    if (!id) {
      const idx = LEVELS.indexOf(level);
      // Use the parent above this level as the new deepest.
      const above = LEVELS.slice(0, idx).reverse().map((l) => selectedByLevel[l]).find(Boolean);
      emit(above ?? null);
      return;
    }
    emit(id);
  };

  return (
    <div className="space-y-3">
      {LEVELS.map((level, i) => {
        const parentId = i === 0 ? null : selectedByLevel[LEVELS[i - 1]];
        const disabled = i > 0 && !parentId;
        const options = getChildren(nodes, parentId);
        const selected = selectedByLevel[level] ?? "";
        const label = t(`ln.levels.${level}`, fallbackLevel(level));
        return (
          <div key={level} className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              {label}
            </Label>
            <div className="flex gap-2">
              <Select
                value={selected}
                onValueChange={(v) => handleSelect(level, v)}
                disabled={disabled}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue
                    placeholder={
                      disabled
                        ? t("hp.pick_parent", "Select previous level first")
                        : options.length === 0
                          ? t("hp.empty", "No {{label}} yet", { label })
                          : t("hp.pick", "Pick {{label}}", { label })
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {options.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.code ? `${n.code} · ` : ""}
                      {n.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={disabled}
                onClick={() => setCreateLevel(level)}
                title={t("hp.create", "Create new")}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}

      {createLevel && (
        <LocationNodeDialog
          open
          level={createLevel}
          parentId={
            createLevel === "location"
              ? null
              : selectedByLevel[LEVELS[LEVELS.indexOf(createLevel) - 1]]
          }
          parentLabel={null}
          onClose={() => setCreateLevel(null)}
        />
      )}
    </div>
  );
}

function fallbackLevel(l: NodeLevel) {
  return l === "location"
    ? "Location"
    : l === "sublocation"
      ? "Sub-location"
      : l === "aisle"
        ? "Aisle"
        : "Bin";
}
