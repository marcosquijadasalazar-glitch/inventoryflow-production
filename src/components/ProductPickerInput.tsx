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

export type ProductLite = Tables<"products">;

export function ProductPicker({
  value,
  onSelect,
  showStock = true,
}: {
  value: ProductLite | null;
  onSelect: (p: ProductLite) => void;
  showStock?: boolean;
}) {
  const products = useQuery({ queryKey: ["products"], queryFn: listProducts });
  const [open, setOpen] = useState(false);
  const list = products.data ?? [];

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className="flex-1 justify-between bg-surface font-normal"
          >
            {value ? (
              <span className="truncate">
                <Package className="inline h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                {value.name}{" "}
                <span className="text-muted-foreground text-xs">({value.sku})</span>
                {showStock && (
                  <span className="text-muted-foreground text-xs ml-1.5">
                    · stock {value.stock}
                  </span>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground">Select product…</span>
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 ml-2" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[360px]" align="start">
          <Command>
            <CommandInput placeholder="Search name, SKU, barcode…" />
            <CommandList>
              <CommandEmpty>No product</CommandEmpty>
              <CommandGroup>
                {list.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={`${p.name} ${p.sku} ${p.barcode ?? ""}`}
                    onSelect={() => {
                      onSelect(p);
                      setOpen(false);
                    }}
                  >
                    <div className="flex flex-col w-full">
                      <span className="text-sm">{p.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {p.sku} {p.barcode ? `· ${p.barcode}` : ""} · stock {p.stock}
                      </span>
                    </div>
                  </CommandItem>
                ))}
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
