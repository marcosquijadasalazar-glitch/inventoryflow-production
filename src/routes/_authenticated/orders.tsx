import { createFileRoute, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ShoppingCart,
  Receipt,
  Plus,
  Download,
  Upload,
} from "lucide-react";
import {
  listPurchaseOrders,
  listSalesOrders,
} from "@/lib/orders";
import { PurchaseOrdersPage } from "./purchase-orders";
import { SalesOrdersPage } from "./sales-orders";

export const Route = createFileRoute("/_authenticated/orders")({
  component: OrdersHubPage,
});

function OrdersHubPage() {
  const { t } = useTranslation();
  const routerState = useRouterState();
  const tab = (routerState.location.search as any)?.tab || "purchase";
  const navigate = useNavigate({ from: "/orders" });

  const pos = useQuery({ queryKey: ["purchase_orders"], queryFn: listPurchaseOrders });
  const sos = useQuery({ queryKey: ["sales_orders"], queryFn: listSalesOrders });

  const poKpis = useMemo(() => {
    const list = pos.data ?? [];
    const openStatuses = new Set(["draft", "ordered", "partially_received"]);
    const open = list.filter((p) => openStatuses.has(p.status));
    const pendingReceipts = list.filter(
      (p) => p.status === "ordered" || p.status === "partially_received",
    ).length;
    const outstanding = open.reduce((s, p) => s + Number(p.total || 0), 0);
    const now = new Date();
    const monthTotal = list
      .filter((p) => {
        if (!p.order_date) return false;
        const d = new Date(p.order_date);
        return (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth()
        );
      })
      .reduce((s, p) => s + Number(p.total || 0), 0);
    return { open: open.length, pendingReceipts, outstanding, monthTotal };
  }, [pos.data]);

  const soKpis = useMemo(() => {
    const list = sos.data ?? [];
    const openStatuses = new Set(["draft", "confirmed"]);
    const open = list.filter((s) => openStatuses.has(s.status));
    const readyToShip = list.filter((s) => s.status === "confirmed").length;
    const outstanding = open.reduce(
      (sum, s) => sum + Number(s.balance_due ?? s.total ?? 0),
      0,
    );
    const now = new Date();
    const monthTotal = list
      .filter((s) => {
        if (!s.order_date) return false;
        const d = new Date(s.order_date);
        return (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth()
        );
      })
      .reduce((sum, s) => sum + Number(s.total || 0), 0);
    return { open: open.length, readyToShip, outstanding, monthTotal };
  }, [sos.data]);

  const fmt = (v: number) =>
    `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const triggerCreatePO = () => {
    if (tab !== "purchase") {
      navigate({
        to: "/orders",
        search: (prev: Record<string, any>) => ({ ...prev, tab: "purchase" }),
      });
    }
    setTimeout(() => window.dispatchEvent(new CustomEvent("orders:create-po")), 80);
  };
  const triggerCreateSO = () => {
    if (tab !== "sales") {
      navigate({
        to: "/orders",
        search: (prev: Record<string, any>) => ({ ...prev, tab: "sales" }),
      });
    }
    setTimeout(() => window.dispatchEvent(new CustomEvent("orders:create-so")), 80);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-primary mb-1.5">
            {t("orders.section", "Operations")}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {t("orders.title", "Orders")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t(
              "orders.subtitle",
              "Manage purchasing and sales orders in one place.",
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={triggerCreatePO}
            className="shadow-soft"
          >
            <Plus className="h-4 w-4" />{" "}
            {t("orders.newPO", "New Purchase Order")}
          </Button>
          <Button onClick={triggerCreateSO} className="shadow-soft">
            <Plus className="h-4 w-4" />{" "}
            {t("orders.newSO", "New Sales Order")}
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-soft">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <ShoppingCart className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-muted-foreground">
                  {t("orders.po.title", "Purchase Orders")}
                </p>
                <p className="text-2xl font-semibold tracking-tight mt-0.5">
                  {poKpis.open}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    {t("orders.po.open", "Open Orders")}
                  </span>
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {poKpis.pendingReceipts}{" "}
                {t("orders.po.pendingReceipts", "Pending Receipts")}
              </span>
              <span className="font-mono text-foreground font-medium">
                {fmt(poKpis.outstanding)}{" "}
                <span className="text-muted-foreground font-normal">
                  {t("orders.outstanding", "Outstanding")}
                </span>
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
                <Receipt className="h-5 w-5 text-[oklch(0.4_0.12_155)]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-muted-foreground">
                  {t("orders.so.title", "Sales Orders")}
                </p>
                <p className="text-2xl font-semibold tracking-tight mt-0.5">
                  {soKpis.open}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    {t("orders.so.open", "Open Orders")}
                  </span>
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {soKpis.readyToShip}{" "}
                {t("orders.so.readyToShip", "Ready to Ship")}
              </span>
              <span className="font-mono text-foreground font-medium">
                {fmt(soKpis.outstanding)}{" "}
                <span className="text-muted-foreground font-normal">
                  {t("orders.outstanding", "Outstanding")}
                </span>
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Download className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-muted-foreground">
                  {t("orders.purchasingMonth", "Purchasing This Month")}
                </p>
                <p className="text-2xl font-semibold tracking-tight mt-0.5 font-mono">
                  {fmt(poKpis.monthTotal)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("orders.totalValue", "Total Value")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
                <Upload className="h-5 w-5 text-[oklch(0.4_0.12_155)]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-muted-foreground">
                  {t("orders.salesMonth", "Sales This Month")}
                </p>
                <p className="text-2xl font-semibold tracking-tight mt-0.5 font-mono">
                  {fmt(soKpis.monthTotal)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("orders.totalValue", "Total Value")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs
        value={tab}
        onValueChange={(v) =>
          navigate({
            to: "/orders",
            search: (prev: Record<string, any>) => ({ ...prev, tab: v }),
          })
        }
      >
        <TabsList className="bg-muted h-auto flex-wrap gap-1 p-1">
          <TabsTrigger
            value="purchase"
            className="gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            {t("orders.tabPurchase", "Purchase Orders")}
          </TabsTrigger>
          <TabsTrigger
            value="sales"
            className="gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Receipt className="h-3.5 w-3.5" />
            {t("orders.tabSales", "Sales Orders")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="purchase" className="mt-4">
          <PurchaseOrdersPage embedded />
        </TabsContent>
        <TabsContent value="sales" className="mt-4">
          <SalesOrdersPage embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}
