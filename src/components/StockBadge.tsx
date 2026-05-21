import { cn } from "@/lib/utils";
import { getStockStatus, stockStatusMeta } from "@/lib/stock";
import type { Product } from "@/lib/inventory";

export function StockBadge({
  product,
  className,
}: {
  product: Pick<Product, "stock" | "min_stock">;
  className?: string;
}) {
  const status = getStockStatus(product);
  const meta = stockStatusMeta[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        meta.className,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

export function StockHealthBar({
  stock,
  min,
}: {
  stock: number;
  min: number;
}) {
  const target = Math.max(min * 3, 10);
  const pct = Math.max(2, Math.min(100, (stock / target) * 100));
  const status = getStockStatus({ stock, min_stock: min });
  const color =
    status === "out" || status === "low"
      ? "bg-destructive"
      : status === "overstocked"
        ? "bg-primary"
        : "bg-success";
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all", color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
