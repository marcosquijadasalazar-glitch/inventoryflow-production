import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScanFieldButton } from "./ScanFieldButton";
import { Package, ChevronsUpDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { listProducts } from "@/lib/inventory";
import type { Tables } from "@/integrations/supabase/types";
import {
  formatProductLocationBreakdown,
  getStockRowsForProduct,
  useProductLocationStock,
  type ProductLocationStockData,
} from "@/lib/product-location-stock";

export type ProductLite = Tables<"products">;

export function ProductPicker({
  value,
  onSelect,
  showStock = true,
  showGlobalStock = false,
  locationStock: locationStockProp,
}: {
  value: ProductLite | null;
  onSelect: (p: ProductLite) => void;
  showStock?: boolean;
  /** @deprecated Use location-aware stock from product_location_stock */
  showGlobalStock?: boolean;
  locationStock?: ProductLocationStockData;
}) {
  const products = useQuery({ queryKey: ["products"], queryFn: listProducts });
  const stockQ = useProductLocationStock();
  const locationStock = locationStockProp ?? stockQ.data;
  const [open, setOpen] = useState(false);
  const list = products.data ?? [];

  const selectedBreakdown = useMemo(
    () =>
      value && showStock && !showGlobalStock
        ? formatProductLocationBreakdown(value.id, locationStock, "inline")
        : null,
    [value, showStock, showGlobalStock, locationStock],
  );

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className="flex-1 justify-between bg-surface font-normal h-auto min-h-9 py-1.5"
          >
            {value ? (
              <span className="truncate text-left">
                <Package className="inline h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                {value.name}{" "}
                <span className="text-muted-foreground text-xs">({value.sku})</span>
                {showStock && showGlobalStock && (
                  <span className="text-muted-foreground text-xs ml-1.5">
                    · stock {value.stock}
                  </span>
                )}
                {showStock && !showGlobalStock && selectedBreakdown && (
                  <span className="block text-muted-foreground text-xs mt-0.5 font-normal truncate">
                    {selectedBreakdown}
                  </span>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground">Select product…</span>
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 ml-2 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[360px]" align="start">
          <Command>
            <CommandInput placeholder="Search name, SKU, barcode…" />
            <CommandList>
              <CommandEmpty>No product</CommandEmpty>
              <CommandGroup>
                {list.map((p) => {
                  const locRows = getStockRowsForProduct(p.id, locationStock).filter(
                    (r) => r.on_hand > 0 || r.available > 0,
                  );
                  return (
                    <CommandItem
                      key={p.id}
                      value={`${p.name} ${p.sku} ${p.barcode ?? ""}`}
                      onSelect={() => {
                        onSelect(p);
                        setOpen(false);
                      }}
                    >
                      <div className="flex flex-col w-full gap-0.5">
                        <span className="text-sm">{p.name}</span>
                        {showStock && !showGlobalStock ? (
                          locRows.length > 0 ? (
                            locRows.map((r) => (
                              <span
                                key={r.location_id}
                                className="text-xs text-muted-foreground"
                              >
                                {r.location_name ?? "Location"}: {r.available}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground font-mono">
                              {p.sku} · no location stock
                            </span>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground font-mono">
                            {p.sku} {p.barcode ? `· ${p.barcode}` : ""}
                            {showGlobalStock ? ` · stock ${p.stock}` : ""}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <ScanFieldButton
        onScan={(code) => {
          const found = list.find((p) => (p.barcode ?? "").trim() === code.trim());
          if (found) onSelect(found);
        }}
      />
    </div>
  );
}
