import type { Product } from "./inventory";

export type StockStatus = "out" | "low" | "healthy" | "overstocked";

export function getStockStatus(p: Pick<Product, "stock" | "min_stock">): StockStatus {
  if (p.stock <= 0) return "out";
  if (p.stock <= p.min_stock) return "low";
  if (p.min_stock > 0 && p.stock >= p.min_stock * 5) return "overstocked";
  return "healthy";
}

export const stockStatusMeta: Record<
  StockStatus,
  { label: string; className: string; dot: string }
> = {
  out: {
    label: "Out of stock",
    className:
      "border-destructive/20 bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
  low: {
    label: "Low stock",
    className: "border-warning/30 bg-warning/15 text-[oklch(0.45_0.12_70)]",
    dot: "bg-warning",
  },
  healthy: {
    label: "In stock",
    className: "border-success/25 bg-success/10 text-[oklch(0.4_0.12_155)]",
    dot: "bg-success",
  },
  overstocked: {
    label: "Overstocked",
    className: "border-primary/25 bg-primary/10 text-primary",
    dot: "bg-primary",
  },
};
