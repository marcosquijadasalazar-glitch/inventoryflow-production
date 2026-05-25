import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { StockBadge } from "./StockBadge";
import type { Product } from "@/lib/inventory";
import { usePermissions } from "@/lib/use-permissions";

export function ProductDetailsDialog({
  product,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  const perms = usePermissions();
  if (!product) return null;
  const canCost = perms.can("view_costs");
  const canPrice = perms.can("view_prices");
  const rows: [string, string | number | null][] = [
    ["SKU", product.sku],
    ["Barcode", product.barcode],
    ["Category", product.category],
    ["Location", product.location],
    ["Supplier", product.supplier],
    ...(canCost ? ([["Cost", `$${Number(product.cost).toFixed(2)}`]] as [string, string][]) : []),
    ...(canPrice ? ([["Price", `$${Number(product.price).toFixed(2)}`]] as [string, string][]) : []),
    ["Stock", product.stock],
    ["Min stock", product.min_stock],
    ...(canCost
      ? ([["Inventory value", `$${(Number(product.cost) * product.stock).toFixed(2)}`]] as [string, string][])
      : []),
  ];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-surface max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {product.name}
            <StockBadge product={product} />
          </DialogTitle>
          <DialogDescription>Product details</DialogDescription>
        </DialogHeader>
        <dl className="divide-y divide-border border border-border rounded-lg overflow-hidden">
          {rows.map(([k, v]) => (
            <div
              key={k}
              className="flex items-center justify-between px-3 py-2 text-sm odd:bg-surface-muted/40"
            >
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-medium text-right">{v ?? "—"}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
