import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
// route mounted under _authenticated layout (provides AppLayout)
import { listProducts, listMovements } from "@/lib/inventory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Package,
  AlertTriangle,
  DollarSign,
  ArrowLeftRight,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { getStockStatus } from "@/lib/stock";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
});

function Dashboard() {
  const products = useQuery({ queryKey: ["products"], queryFn: listProducts });
  const movements = useQuery({ queryKey: ["movements"], queryFn: listMovements });

  const total = products.data?.length ?? 0;
  const lowStock = products.data?.filter((p) => getStockStatus(p) === "low") ?? [];
  const outOfStock = products.data?.filter((p) => getStockStatus(p) === "out") ?? [];
  const healthy = products.data?.filter((p) => getStockStatus(p) === "healthy") ?? [];
  const inventoryValue =
    products.data?.reduce((sum, p) => sum + Number(p.cost) * p.stock, 0) ?? 0;
  const totalUnits = products.data?.reduce((s, p) => s + p.stock, 0) ?? 0;

  const healthScore = total > 0 ? Math.round((healthy.length / total) * 100) : 100;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-primary mb-1.5">
            Operations
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Live overview of your warehouse inventory.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/movements">
              <ArrowLeftRight className="h-4 w-4" />
              Record movement
            </Link>
          </Button>
          <Button asChild>
            <Link to="/products">
              <Package className="h-4 w-4" />
              Manage products
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          icon={Package}
          label="Total Products"
          value={products.isLoading ? null : total.toString()}
          sub={`${totalUnits.toLocaleString()} units on hand`}
          trend="up"
        />
        <Stat
          icon={DollarSign}
          label="Inventory Value"
          value={
            products.isLoading
              ? null
              : `$${inventoryValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
          }
          sub="Total stock value"
          trend="up"
          accent="primary"
        />
        <Stat
          icon={AlertTriangle}
          label="Low Stock"
          value={products.isLoading ? null : lowStock.length.toString()}
          sub={`${outOfStock.length} out of stock`}
          accent={lowStock.length + outOfStock.length > 0 ? "warning" : "default"}
        />
        <Stat
          icon={Activity}
          label="Inventory Health"
          value={products.isLoading ? null : `${healthScore}%`}
          sub={`${healthy.length} of ${total} products healthy`}
          accent={healthScore >= 80 ? "success" : healthScore >= 50 ? "warning" : "danger"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-border shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Recent Movements</CardTitle>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/movements">
                View all <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {movements.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between gap-4 py-2">
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                    <Skeleton className="h-6 w-14 rounded-full" />
                  </div>
                ))}
              </div>
            ) : movements.data && movements.data.length > 0 ? (
              <ul className="divide-y divide-border">
                {movements.data.slice(0, 7).map((m) => {
                  const isAdd = m.type === "add";
                  const isRemove = m.type === "remove";
                  return (
                    <li
                      key={m.id}
                      className="py-3 flex items-center justify-between gap-4 group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={
                            isAdd
                              ? "h-8 w-8 rounded-lg bg-success/10 text-success flex items-center justify-center shrink-0"
                              : isRemove
                                ? "h-8 w-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center shrink-0"
                                : "h-8 w-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0"
                          }
                        >
                          {isAdd ? (
                            <ArrowUpRight className="h-4 w-4" />
                          ) : isRemove ? (
                            <ArrowDownRight className="h-4 w-4" />
                          ) : (
                            <TrendingUp className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {m.products?.name ?? "Unknown product"}
                            <span className="text-muted-foreground font-normal ml-1.5 font-mono text-xs">
                              {m.products?.sku ?? "—"}
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {formatDistanceToNow(new Date(m.created_at), {
                              addSuffix: true,
                            })}
                            {m.note ? ` · ${m.note}` : ""}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          isAdd
                            ? "border-success/25 bg-success/10 text-[oklch(0.4_0.12_155)] font-mono"
                            : isRemove
                              ? "border-destructive/25 bg-destructive/10 text-destructive font-mono"
                              : "border-border bg-muted text-muted-foreground font-mono"
                        }
                      >
                        {isAdd ? "+" : isRemove ? "−" : "="}
                        {m.quantity}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                icon={ArrowLeftRight}
                title="No movements yet"
                description="Stock additions and removals will appear here."
                action={
                  <Button size="sm" asChild>
                    <Link to="/movements">Record first movement</Link>
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>

        <Card className="border-border shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[oklch(0.55_0.16_70)]" />
              <CardTitle className="text-base">Needs Attention</CardTitle>
            </div>
            {lowStock.length + outOfStock.length > 0 && (
              <Button variant="ghost" size="sm" asChild>
                <Link to="/alerts">
                  All <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            {products.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : [...outOfStock, ...lowStock].length > 0 ? (
              <ul className="space-y-2">
                {[...outOfStock, ...lowStock].slice(0, 6).map((p) => {
                  const status = getStockStatus(p);
                  return (
                    <li
                      key={p.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 hover:border-primary/30 hover:shadow-soft transition-all"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          {p.sku}
                        </p>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p
                          className={
                            status === "out"
                              ? "text-sm font-semibold text-destructive"
                              : "text-sm font-semibold text-[oklch(0.55_0.16_70)]"
                          }
                        >
                          {p.stock}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          min {p.min_stock}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                icon={Activity}
                title="All healthy"
                description="No products below their minimum stock level."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  accent = "default",
  trend,
}: {
  icon: any;
  label: string;
  value: string | null;
  sub?: string;
  accent?: "default" | "primary" | "warning" | "success" | "danger";
  trend?: "up" | "down";
}) {
  const iconBg = {
    default: "bg-muted text-foreground",
    primary: "bg-primary/10 text-primary",
    warning: "bg-warning/15 text-[oklch(0.5_0.14_70)]",
    success: "bg-success/10 text-[oklch(0.4_0.12_155)]",
    danger: "bg-destructive/10 text-destructive",
  }[accent];

  return (
    <Card className="border-border shadow-soft hover:shadow-card transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className={`h-10 w-10 rounded-xl ${iconBg} flex items-center justify-center`}>
            <Icon className="h-5 w-5" />
          </div>
          {trend === "up" && (
            <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-success">
              <TrendingUp className="h-3 w-3" />
            </span>
          )}
        </div>
        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </p>
          {value === null ? (
            <Skeleton className="h-8 w-24 mt-1.5" />
          ) : (
            <p className="text-2xl font-semibold tracking-tight mt-1">{value}</p>
          )}
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: any;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
