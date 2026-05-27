import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  listAllNodes,
  getBreadcrumb,
  type LocationNode,
} from "@/lib/location-tree";

type Props = {
  /** Deepest hierarchy node id assigned to this inventory row. */
  nodeId?: string | null;
  /** Optional legacy text location (e.g. `products.location`) used as a fallback when no node id is set. */
  fallback?: string | null;
  /** Pre-fetched nodes — pass when rendering many rows to avoid duplicate fetches. */
  nodes?: LocationNode[];
  /** Visual variant. */
  variant?: "inline" | "block";
  /** Show the leading map pin icon. */
  showIcon?: boolean;
  /** Override separator character. */
  separator?: string;
  className?: string;
  /** Hide the component completely when no path and no fallback. */
  hideEmpty?: boolean;
};

/**
 * Renders the full storage hierarchy path for an inventory item, e.g.
 *   Main Warehouse → Beverage Area → Aisle B → Bin B-04
 *
 * Falls back to a legacy text location when no hierarchy node is assigned,
 * and to "Unassigned" when nothing is available.
 */
export function LocationPath({
  nodeId,
  fallback,
  nodes: nodesProp,
  variant = "inline",
  showIcon = true,
  separator = "→",
  className,
  hideEmpty = false,
}: Props) {
  const enabled = !!nodeId && !nodesProp;
  const { data: fetched = [] } = useQuery({
    queryKey: ["location-nodes-all"],
    queryFn: listAllNodes,
    enabled,
    staleTime: 60_000,
  });
  const nodes = nodesProp ?? fetched;

  const path = useMemo(
    () => (nodeId ? getBreadcrumb(nodes, nodeId) : []),
    [nodes, nodeId],
  );

  if (path.length === 0) {
    if (hideEmpty && !fallback) return null;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-xs text-muted-foreground",
          variant === "block" && "flex",
          className,
        )}
      >
        {showIcon && <MapPin className="h-3 w-3 shrink-0" />}
        <span className={fallback ? "" : "italic"}>
          {fallback || "Unassigned"}
        </span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex flex-wrap items-center gap-1 text-xs",
        variant === "block" && "flex",
        className,
      )}
    >
      {showIcon && (
        <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
      )}
      {path.map((n, i) => (
        <span key={n.id} className="inline-flex items-center gap-1">
          {i > 0 && (
            <span className="text-muted-foreground/60" aria-hidden>
              {separator}
            </span>
          )}
          <span
            className={
              i === path.length - 1
                ? "font-medium text-foreground"
                : "text-muted-foreground"
            }
          >
            {n.name}
          </span>
        </span>
      ))}
    </span>
  );
}
