import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart,
  Receipt,
  TrendingUp,
  Wrench,
  PackagePlus,
  PackageMinus,
  Trophy,
  AlertTriangle,
  ArrowUpRight,
} from "lucide-react";
import { listPurchaseOrders, listSalesOrders, listInternalUse } from "@/lib/orders";
import { listMovements, listProducts } from "@/lib/inventory";
import { getStockStatus } from "@/lib/stock";

function startOfWeek() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 7);
  return d;
}
function startOfMonth() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 30);
  return d;
}

export function OperationsWidgets() {
  const { t } = useTranslation();
  const pos = useQuery({ queryKey: ["purchase_orders"], queryFn: listPurchaseOrders });
  const sos = useQuery({ queryKey: ["sales_orders"], queryFn: listSalesOrders });
  const iu = useQuery({ queryKey: ["internal_use"], queryFn: listInternalUse });
  const movs = useQuery({ queryKey: ["movements"], queryFn: listMovements });
  const products = useQuery({ queryKey: ["products"], queryFn: listProducts });

  const weekAgo = useMemo(() => startOfWeek(), []);
  const monthAgo = useMemo(() => startOfMonth(), []);

  const openPOs = (pos.data ?? []).filter(
    (p) => p.status === "draft" || p.status === "ordered" || p.status === "partially_received",
  );
  const pendingSOs = (sos.data ?? []).filter(
    (s) => s.status === "draft" || s.status === "confirmed",
  );
  const salesWeek = (sos.data ?? []).filter(
    (s) => s.status === "fulfilled" && s.fulfilled_date && new Date(s.fulfilled_date) >= weekAgo,
  );
  const salesWeekTotal = salesWeek.reduce((a, s) => a + Number(s.total ?? 0), 0);
  const iuMonthUnits = (iu.data ?? [])
    .filter((r: any) => new Date(r.created_at) >= monthAgo)
    .reduce((a: number, r: any) => a + Number(r.quantity ?? 0), 0);

  const movsList: any[] = movs.data ?? [];
  const receivedWeek = movsList
    .filter(
      (m) =>
        m.type === "add" &&
        typeof m.note === "string" &&
        m.note.startsWith("[po-receive]") &&
        new Date(m.created_at) >= weekAgo,
    )
    .reduce((a, m) => a + Number(m.quantity ?? 0), 0);
  const shippedWeek = movsList
    .filter(
      (m) =>
        m.type === "remove" &&
        typeof m.note === "string" &&
        m.note.startsWith("[so-fulfill]") &&
        new Date(m.created_at) >= weekAgo,
    )
    .reduce((a, m) => a + Number(m.quantity ?? 0), 0);

  // Top sellers — sum SO item quantities over last 30 days from fulfilled SOs
  const topSellers = useMemo(() => {
    const map = new Map<string, { name: string; qty: number }>();
    for (const s of sos.data ?? []) {
      if (s.status !== "fulfilled") continue;
      if (!s.fulfilled_date || new Date(s.fulfilled_date) < monthAgo) continue;
      for (const it of s.items ?? []) {
        const key = it.product_id ?? it.product_name ?? "unknown";
        const cur = map.get(key) ?? { name: it.product_name ?? "—", qty: 0 };
        cur.qty += Number(it.quantity ?? 0);
        map.set(key, cur);
      }
    }
    // Fallback: derive from movements with [so-fulfill] when SO items aren't loaded
    if (map.size === 0) {
      for (const m of movsList) {
        if (m.type !== "remove") continue;
        if (typeof m.note !== "string" || !m.note.startsWith("[so-fulfill]")) continue;
        if (new Date(m.created_at) < monthAgo) continue;
        const key = m.product_id ?? "unknown";
        const cur = map.get(key) ?? {
          name: m.products?.name ?? "—",
          qty: 0,
        };
        cur.qty += Number(m.quantity ?? 0);
        map.set(key, cur);
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [sos.data, movsList, monthAgo]);

  const lowAfterSales = (products.data ?? [])
    .filter((p) => {
      const s = getStockStatus(p);
      return s === "low" || s === "out";
    })
    .slice(0, 6);

  const loading = pos.isLoading || sos.isLoading || iu.isLoading || movs.isLoading;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniStat
          icon={ShoppingCart}
          label={t("dashboard.openPOs")}
          sub={t("dashboard.openPOsSub")}
          value={loading ? null : openPOs.length.toString()}
          to="/purchase-orders"
          accent="primary"
        />
        <MiniStat
          icon={Receipt}
          label={t("dashboard.pendingSOs")}
          sub={t("dashboard.pendingSOsSub")}
          value={loading ? null : pendingSOs.length.toString()}
          to="/sales-orders"
          accent="primary"
        />
        <MiniStat
          icon={TrendingUp}
          label={t("dashboard.salesThisWeek")}
          sub={t("dashboard.salesThisWeekSub")}
          value={
            loading
              ? null
              : `$${salesWeekTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
          }
          to="/sales-orders"
          accent="success"
        />
        <MiniStat
          icon={Wrench}
          label={t("dashboard.internalUseMonth")}
          sub={t("dashboard.internalUseMonthSub")}
          value={loading ? null : `${iuMonthUnits} ${t("dashboard.units")}`}
          to="/internal-use"
        />
        <MiniStat
          icon={PackagePlus}
          label={t("dashboard.receivedWeek")}
          sub={t("dashboard.receivedWeekSub")}
          value={loading ? null : `${receivedWeek} ${t("dashboard.units")}`}
          to="/purchase-orders"
          accent="success"
        />
        <MiniStat
          icon={PackageMinus}
          label={t("dashboard.shippedWeek")}
          sub={t("dashboard.shippedWeekSub")}
          value={loading ? null : `${shippedWeek} ${t("dashboard.units")}`}
          to="/sales-orders"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">{t("dashboard.topSellers")}</CardTitle>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/sales-orders">
                {t("dashboard.viewAll")} <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground mb-2">
              {t("dashboard.topSellersSub")}
            </p>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : topSellers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                {t("dashboard.noData")}
              </p>
            ) : (
              <ul className="space-y-2">
                {topSellers.map((p, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-mono text-muted-foreground w-5">
                        #{i + 1}
                      </span>
                      <p className="text-sm font-medium truncate">{p.name}</p>
                    </div>
                    <Badge variant="outline" className="font-mono">
                      {p.qty} {t("dashboard.units")}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-border shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[oklch(0.55_0.16_70)]" />
              <CardTitle className="text-base">{t("dashboard.lowAfterSales")}</CardTitle>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/alerts">
                {t("dashboard.viewAll")} <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground mb-2">
              {t("dashboard.lowAfterSalesSub")}
            </p>
            {products.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : lowAfterSales.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                {t("dashboard.noData")}
              </p>
            ) : (
              <ul className="space-y-2">
                {lowAfterSales.map((p) => {
                  const s = getStockStatus(p);
                  return (
                    <li
                      key={p.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{p.sku}</p>
                      </div>
                      <div className="text-right ml-3">
                        <p
                          className={
                            s === "out"
                              ? "text-sm font-semibold text-destructive"
                              : "text-sm font-semibold text-[oklch(0.55_0.16_70)]"
                          }
                        >
                          {p.stock}
                        </p>
                        <p className="text-[10px] text-muted-foreground">min {p.min_stock}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  sub,
  value,
  to,
  accent = "default",
}: {
  icon: any;
  label: string;
  sub?: string;
  value: string | null;
  to: string;
  accent?: "default" | "primary" | "success" | "warning";
}) {
  const iconBg = {
    default: "bg-muted text-foreground",
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-[oklch(0.4_0.12_155)]",
    warning: "bg-warning/15 text-[oklch(0.5_0.14_70)]",
  }[accent];

  return (
    <Link to={to} className="block group">
      <Card className="border-border shadow-soft hover:shadow-card hover:border-primary/30 transition-all h-full">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div
              className={`h-9 w-9 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}
            >
              <Icon className="h-4 w-4" />
            </div>
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="mt-3">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              {label}
            </p>
            {value === null ? (
              <Skeleton className="h-6 w-16 mt-1" />
            ) : (
              <p className="text-xl font-semibold tracking-tight mt-0.5">{value}</p>
            )}
            {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
