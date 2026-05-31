import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listProducts, listMovements } from "@/lib/inventory";
import { AlertTriangle, CheckCircle2, Package, ArrowLeftRight } from "lucide-react";
import { getStockStatus } from "@/lib/stock";
import { StockBadge, StockHealthBar } from "@/components/StockBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExportMenu } from "@/components/ExportMenu";
import type { ExportColumn } from "@/lib/exporters";
import type { Product } from "@/lib/inventory";

const ALERT_EXPORT_COLUMNS: ExportColumn<Product>[] = [
  { key: "name", header: "Product" },
  { key: "sku", header: "SKU" },
  { key: "barcode", header: "Barcode" },
  { key: "category", header: "Category" },
  { key: "supplier", header: "Supplier" },
  { key: "location", header: "Location" },
  { key: "status", header: "Status", get: (p) => getStockStatus(p) },
  { key: "stock", header: "Stock", align: "right" },
  { key: "min_stock", header: "Min", align: "right" },
];

export const Route = createFileRoute("/_authenticated/alerts")({
  component: AlertsPage,
});

type AlertFilter = "all" | "low" | "out" | "stale" | "high-value-low";

const STALE_DAYS = 30;

function AlertsPage() {
  const products = useQuery({ queryKey: ["products"], queryFn: listProducts });
  const movements = useQuery({ queryKey: ["movements"], queryFn: listMovements });
  const [filter, setFilter] = useState<AlertFilter>("all");

  const lastMoveByProduct = useMemo(() => {
    const map = new Map<string, number>();
    movements.data?.forEach((m) => {
      const t = new Date(m.created_at).getTime();
      const cur = map.get(m.product_id) ?? 0;
      if (t > cur) map.set(m.product_id, t);
    });
    return map;
  }, [movements.data]);

  const data = products.data ?? [];
  const out = data.filter((p) => getStockStatus(p) === "out");
  const low = data.filter((p) => getStockStatus(p) === "low");
  const allAttention = [...out, ...low];
  const staleCutoff = Date.now() - STALE_DAYS * 86_400_000;
  const stale = data.filter((p) => {
    const last = lastMoveByProduct.get(p.id);
    return !last || last < staleCutoff;
  });
  const highValueLow = low
    .concat(out)
    .filter((p) => Number(p.price) * Math.max(p.min_stock, 1) >= 500);

  const list = useMemo(() => {
    switch (filter) {
      case "low":
        return low;
      case "out":
        return out;
      case "stale":
        return stale;
      case "high-value-low":
        return highValueLow;
      default:
        return allAttention;
    }
  }, [filter, low, out, stale, highValueLow, allAttention]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[oklch(0.55_0.16_70)] mb-1.5">
            Worth a look
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Stock that needs you</h1>
          <p className="text-muted-foreground mt-1">
            A calm view of products running low, sitting idle, or worth keeping an eye on.
          </p>
        </div>
        <ExportMenu
          title={`Stock that needs you — ${filter}`}
          filename={`alerts-${filter}`}
          rows={list}
          columns={ALERT_EXPORT_COLUMNS}
          meta={[{ label: "View", value: filter }]}
        />
      </div>


      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SummaryCard
          label="Out of stock"
          value={out.length}
          accent="danger"
          icon={AlertTriangle}
        />
        <SummaryCard
          label="Running low"
          value={low.length}
          accent="warning"
          icon={AlertTriangle}
        />
        <SummaryCard
          label="Sitting idle"
          value={stale.length}
          accent="muted"
          icon={ArrowLeftRight}
        />
        <SummaryCard
          label="High-value, low stock"
          value={highValueLow.length}
          accent="warning"
          icon={AlertTriangle}
        />

      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as AlertFilter)}>
        <TabsList className="bg-surface-muted">
          <TabsTrigger value="all">All ({allAttention.length})</TabsTrigger>
          <TabsTrigger value="low">Running low ({low.length})</TabsTrigger>
          <TabsTrigger value="out">Out of stock ({out.length})</TabsTrigger>
          <TabsTrigger value="stale">Sitting idle ({stale.length})</TabsTrigger>
          <TabsTrigger value="high-value-low">
            High value ({highValueLow.length})
          </TabsTrigger>

        </TabsList>
      </Tabs>

      <div className="border border-border rounded-xl overflow-hidden bg-surface shadow-soft">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-muted hover:bg-surface-muted border-border">
                <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground h-11">
                  Product
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                  Status
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                  Stock
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                  Supplier
                </TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i} className="border-border">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j} className="py-4">
                        <Skeleton className="h-4 w-full max-w-[120px]" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : list.length > 0 ? (
                list.map((p) => (
                  <TableRow
                    key={p.id}
                    className="border-border hover:bg-surface-muted/50 transition-colors"
                  >
                    <TableCell className="py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/15 flex items-center justify-center shrink-0">
                          <Package className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm">{p.name}</p>
                          <p className="font-mono text-[11px] text-muted-foreground">
                            {p.sku}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StockBadge product={p} />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1.5 min-w-[120px]">
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-semibold text-sm tabular-nums">
                            {p.stock}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            / {p.min_stock} min
                          </span>
                        </div>
                        <StockHealthBar stock={p.stock} min={p.min_stock} />
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.supplier ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" asChild>
                        <Link to="/movements">
                          <ArrowLeftRight className="h-3.5 w-3.5" />
                          Restock
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="py-16">
                    <div className="flex flex-col items-center text-center">
                      <div className="h-14 w-14 rounded-2xl bg-success/10 flex items-center justify-center mb-4">
                        <CheckCircle2 className="h-6 w-6 text-[oklch(0.4_0.12_155)]" />
                      </div>
                      <p className="font-medium">You're all caught up</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Nothing in this view needs your attention right now.
                      </p>

                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
  icon: Icon,
}: {
  label: string;
  value: number;
  accent: "danger" | "warning" | "success" | "muted";
  icon: any;
}) {
  const styles = {
    danger: "bg-destructive/10 text-destructive",
    warning: "bg-warning/15 text-[oklch(0.5_0.14_70)]",
    success: "bg-success/10 text-[oklch(0.4_0.12_155)]",
    muted: "bg-muted text-muted-foreground",
  }[accent];
  return (
    <Card className="border-border shadow-soft">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${styles}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </p>
          <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
