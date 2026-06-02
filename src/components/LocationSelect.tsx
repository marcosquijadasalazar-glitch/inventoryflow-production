import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectSeparator,
} from "@/components/ui/select";
import { listLocations, type Location } from "@/lib/locations";
import { listAllNodes } from "@/lib/location-tree";
import {
  descendantHasStock,
  getAvailableAtLocation,
  type ProductLocationStockData,
} from "@/lib/product-location-stock";
import { LocationFormDialog } from "./LocationFormDialog";

const CREATE_VALUE = "__create__";

export function LocationSelect({
  value,
  onChange,
  placeholder,
  excludeId,
  productId = null,
  stockData,
  requireDirectStock = false,
}: {
  value: string | null;
  onChange: (id: string | null, location?: Location) => void;
  placeholder?: string;
  excludeId?: string | null;
  /** When set with requireDirectStock, locations without direct available stock are disabled. */
  productId?: string | null;
  stockData?: ProductLocationStockData;
  requireDirectStock?: boolean;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const locations = useQuery({
    queryKey: ["locations"],
    queryFn: () => listLocations(),
  });
  const nodesQ = useQuery({
    queryKey: ["location-nodes-all"],
    queryFn: listAllNodes,
    staleTime: 60_000,
    enabled: requireDirectStock && !!productId,
  });

  const options = (locations.data ?? []).filter(
    (l) => !excludeId || l.id !== excludeId,
  );

  const stockHints = useMemo(() => {
    const hints = new Map<string, { disabled: boolean; suffix: string }>();
    if (!requireDirectStock || !productId || !stockData) return hints;

    const nodes = nodesQ.data ?? [];
    for (const loc of options) {
      const available = getAvailableAtLocation(productId, loc.id, stockData) ?? 0;
      if (available > 0) {
        hints.set(loc.id, {
          disabled: false,
          suffix: ` · avail ${available}`,
        });
        continue;
      }
      const inChildren =
        nodes.length > 0 &&
        descendantHasStock(productId, loc.id, nodes, stockData);
      hints.set(loc.id, {
        disabled: true,
        suffix: inChildren
          ? t("loc.stock_in_children", " · stock in sub-locations")
          : t("loc.no_direct_stock", " · no stock here"),
      });
    }
    return hints;
  }, [requireDirectStock, productId, stockData, options, nodesQ.data, t]);

  return (
    <>
      <Select
        value={value ?? ""}
        onValueChange={(v) => {
          if (v === CREATE_VALUE) {
            setCreateOpen(true);
            return;
          }
          const hint = stockHints.get(v);
          if (hint?.disabled) return;
          const found = options.find((l) => l.id === v);
          onChange(v || null, found);
        }}
      >
        <SelectTrigger>
          <SelectValue
            placeholder={placeholder ?? t("loc.select", "Select location")}
          />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.length === 0 && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                {t("loc.empty_short", "No locations yet")}
              </div>
            )}
            {options.map((l) => {
              const hint = stockHints.get(l.id);
              const disabled = hint?.disabled ?? false;
              return (
                <SelectItem key={l.id} value={l.id} disabled={disabled}>
                  {l.name}
                  <span className="text-muted-foreground text-xs ml-2">
                    · {t(`loc.types.${l.type}`, l.type)}
                    {hint?.suffix ?? ""}
                  </span>
                </SelectItem>
              );
            })}
          </SelectGroup>
          <SelectSeparator />
          <SelectItem value={CREATE_VALUE}>
            <span className="flex items-center gap-2 text-primary font-medium">
              <Plus className="h-3.5 w-3.5" />
              {t("loc.create_new", "Create new location")}
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
      <LocationFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={async (loc) => {
          await qc.invalidateQueries({ queryKey: ["locations"] });
          onChange(loc.id, loc);
        }}
      />
    </>
  );
}
