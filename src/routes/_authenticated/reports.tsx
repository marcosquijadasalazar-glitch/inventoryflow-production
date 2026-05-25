import { createFileRoute } from "@tanstack/react-router";
import { FirstTimeTooltip } from "@/components/onboarding/FirstTimeTooltip";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  FileBarChart,
  AlertTriangle,
  PackageX,
  Warehouse,
  Receipt,
  CreditCard,
  ArrowRightLeft,
  Wrench,
  History as HistoryIcon,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { listProducts } from "@/lib/inventory";
import { listLocations } from "@/lib/locations";
import {
  listSalesOrders,
  listTransferOrders,
  listInternalUse,
  INTERNAL_DEPARTMENTS,
} from "@/lib/orders";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ExportMenu } from "@/components/ExportMenu";
import type { ExportColumn } from "@/lib/exporters";

const sb = supabase as any;

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

type PresetKey =
  | "low_stock"
  | "out_of_stock"
  | "inventory_by_location"
  | "sales_by_date"
  | "unpaid_sales"
  | "transfers_by_location"
  | "internal_by_department"
  | "movement_history";

function ReportsPage() {
  const { t } = useTranslation();
  const today = new Date();
  const monthAgo = new Date();
  monthAgo.setDate(today.getDate() - 30);

  const [active, setActive] = useState<PresetKey>("low_stock");
  const [from, setFrom] = useState(format(monthAgo, "yyyy-MM-dd"));
  const [to, setTo] = useState(format(today, "yyyy-MM-dd"));
  const [locationId, setLocationId] = useState<string>("all");
  const [department, setDepartment] = useState<string>("all");
  const [productId, setProductId] = useState<string>("all");

  const products = useQuery({ queryKey: ["products"], queryFn: listProducts });
  const locations = useQuery({
    queryKey: ["locations"],
    queryFn: () => listLocations(),
  });
  const sales = useQuery({
    queryKey: ["sales_orders"],
    queryFn: listSalesOrders,
  });
  const transfers = useQuery({
    queryKey: ["transfer_orders"],
    queryFn: listTransferOrders,
  });
  const transferItems = useQuery({
    queryKey: ["transfer_order_items_all"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("transfer_order_items")
        .select("transfer_order_id, product_id, product_name, sku, barcode, quantity");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const internal = useQuery({
    queryKey: ["internal_use"],
    queryFn: listInternalUse,
  });
  const txns = useQuery({
    queryKey: ["transaction_history_all"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("transaction_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const lastMovesByProduct = useQuery({
    queryKey: ["last_moves_by_product"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("inventory_movements")
        .select("product_id, created_at")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      const map = new Map<string, string>();
      for (const r of data ?? []) {
        if (!map.has(r.product_id)) map.set(r.product_id, r.created_at);
      }
      return map;
    },
  });

  const fromTs = useMemo(() => (from ? new Date(from + "T00:00:00") : null), [from]);
  const toTs = useMemo(() => (to ? new Date(to + "T23:59:59") : null), [to]);
  const inRange = (d: string | Date | null | undefined) => {
    if (!d) return false;
    const x = new Date(d);
    if (fromTs && x < fromTs) return false;
    if (toTs && x > toTs) return false;
    return true;
  };

  // ---- Presets ----
  const lowStock = useMemo(
    () =>
      (products.data ?? []).filter(
        (p) => p.min_stock > 0 && p.stock > 0 && p.stock <= p.min_stock,
      ),
    [products.data],
  );
  const outOfStock = useMemo(
    () => (products.data ?? []).filter((p) => (p.stock ?? 0) <= 0),
    [products.data],
  );

  // Inventory by location: derived from completed transfers (in/out) + filter to selected location
  const invByLocation = useMemo(() => {
    const items = transferItems.data ?? [];
    const tMap = new Map<string, any>(
      (transfers.data ?? []).map((tr: any) => [tr.id, tr]),
    );
    type Row = { location_id: string; location_name: string; product_id: string; product_name: string; sku: string; barcode: string; qty: number };
    const map = new Map<string, Row>();
    for (const it of items) {
      const tr = tMap.get(it.transfer_order_id);
      if (!tr || tr.status !== "completed") continue;
      const addTo = (locId: string | null, sign: 1 | -1) => {
        if (!locId) return;
        const key = `${locId}::${it.product_id}`;
        const loc = (locations.data ?? []).find((l) => l.id === locId);
        const cur =
          map.get(key) ??
          ({
            location_id: locId,
            location_name: loc?.name ?? "—",
            product_id: it.product_id,
            product_name: it.product_name ?? "",
            sku: it.sku ?? "",
            barcode: it.barcode ?? "",
            qty: 0,
          } as Row);
        cur.qty += sign * (it.quantity ?? 0);
        map.set(key, cur);
      };
      addTo(tr.to_location_id, 1);
      addTo(tr.from_location_id, -1);
    }
    let rows = Array.from(map.values()).filter((r) => r.qty !== 0);
    if (locationId !== "all") rows = rows.filter((r) => r.location_id === locationId);
    rows.sort((a, b) => a.location_name.localeCompare(b.location_name) || a.product_name.localeCompare(b.product_name));
    return rows;
  }, [transferItems.data, transfers.data, locations.data, locationId]);

  const salesInRange = useMemo(
    () =>
      (sales.data ?? []).filter((s: any) =>
        inRange(s.order_date ?? s.created_at),
      ),
    [sales.data, fromTs, toTs],
  );
  const unpaidSales = useMemo(
    () =>
      (sales.data ?? []).filter(
        (s: any) => s.payment_status !== "paid" && (s.balance_due ?? 0) > 0,
      ),
    [sales.data],
  );

  const transfersFiltered = useMemo(() => {
    let rows = (transfers.data ?? []).filter((tr: any) =>
      inRange(tr.transfer_date ?? tr.created_at),
    );
    if (locationId !== "all") {
      rows = rows.filter(
        (tr: any) =>
          tr.from_location_id === locationId || tr.to_location_id === locationId,
      );
    }
    return rows;
  }, [transfers.data, fromTs, toTs, locationId]);

  const internalFiltered = useMemo(() => {
    const rows = (internal.data ?? []).filter((r: any) => inRange(r.created_at));
    const parseDept = (reason: string | null) => {
      if (!reason) return "";
      const m = reason.match(/Dept:\s*([^|]+)/i);
      return (m ? m[1] : "").trim();
    };
    const enriched = rows.map((r: any) => ({ ...r, _dept: parseDept(r.reason) }));
    if (department === "all") return enriched;
    return enriched.filter((r: any) => r._dept.toLowerCase() === department.toLowerCase());
  }, [internal.data, fromTs, toTs, department]);

  const movementHistory = useMemo(() => {
    let rows = (txns.data ?? []).filter((r: any) => inRange(r.created_at));
    if (productId !== "all") rows = rows.filter((r: any) => r.product_id === productId);
    return rows;
  }, [txns.data, fromTs, toTs, productId]);

  const settings = { dateFrom: from, dateTo: to };
  const metaDate = [
    { label: t("reports.from", "From"), value: from || "—" },
    { label: t("reports.to", "To"), value: to || "—" },
  ];

  // ---- Column defs ----
  const productCols: ExportColumn<any>[] = [
    { key: "name", header: t("common.name", "Name") },
    { key: "sku", header: "SKU" },
    { key: "barcode", header: t("reports.barcode", "Barcode") },
    { key: "category", header: t("reports.category", "Category") },
    { key: "stock", header: t("reports.stock", "Stock"), align: "right" },
    { key: "min_stock", header: t("reports.min", "Min"), align: "right" },
  ];

  const invLocCols: ExportColumn<any>[] = [
    { key: "location_name", header: t("reports.location", "Location") },
    { key: "product_name", header: t("reports.product", "Product") },
    { key: "sku", header: "SKU" },
    { key: "barcode", header: t("reports.barcode", "Barcode") },
    { key: "qty", header: t("reports.qty", "Qty"), align: "right" },
  ];

  const salesCols: ExportColumn<any>[] = [
    { key: "so_number", header: t("reports.order", "Order #") },
    {
      key: "order_date",
      header: t("common.date", "Date"),
      get: (r) => (r.order_date ? format(new Date(r.order_date), "yyyy-MM-dd") : ""),
    },
    { key: "customer", header: t("reports.customer", "Customer"), get: (r) => r.customers?.name ?? "" },
    { key: "status", header: t("reports.status", "Status") },
    { key: "payment_status", header: t("reports.payment", "Payment") },
    { key: "total", header: t("reports.total", "Total"), align: "right" },
    { key: "balance_due", header: t("reports.balance", "Balance"), align: "right" },
  ];

  const unpaidCols: ExportColumn<any>[] = [
    { key: "so_number", header: t("reports.order", "Order #") },
    {
      key: "order_date",
      header: t("common.date", "Date"),
      get: (r) => (r.order_date ? format(new Date(r.order_date), "yyyy-MM-dd") : ""),
    },
    { key: "customer", header: t("reports.customer", "Customer"), get: (r) => r.customers?.name ?? "" },
    { key: "total", header: t("reports.total", "Total"), align: "right" },
    { key: "amount_paid", header: t("reports.paid", "Paid"), align: "right" },
    { key: "balance_due", header: t("reports.balance", "Balance"), align: "right" },
    { key: "payment_status", header: t("reports.payment", "Payment") },
  ];

  const transferCols: ExportColumn<any>[] = [
    { key: "transfer_number", header: "#" },
    {
      key: "transfer_date",
      header: t("common.date", "Date"),
      get: (r) =>
        r.transfer_date ? format(new Date(r.transfer_date), "yyyy-MM-dd") : "",
    },
    { key: "from_location", header: t("reports.from", "From") },
    { key: "to_location", header: t("reports.to", "To") },
    { key: "status", header: t("reports.status", "Status") },
  ];

  const internalCols: ExportColumn<any>[] = [
    {
      key: "created_at",
      header: t("common.date", "Date"),
      get: (r) => new Date(r.created_at).toLocaleString(),
    },
    { key: "product_name", header: t("reports.product", "Product") },
    { key: "sku", header: "SKU" },
    { key: "quantity_change", header: t("reports.qty", "Qty"), align: "right" },
    { key: "_dept", header: t("reports.department", "Department") },
    { key: "reason", header: t("common.reason", "Reason") },
    { key: "user_email", header: t("reports.user", "User") },
  ];

  const movementCols: ExportColumn<any>[] = [
    {
      key: "created_at",
      header: t("common.date", "Date"),
      get: (r) => new Date(r.created_at).toLocaleString(),
    },
    { key: "product_name", header: t("reports.product", "Product") },
    { key: "sku", header: "SKU" },
    { key: "type", header: t("reports.type", "Type") },
    { key: "source", header: t("reports.source", "Source") },
    { key: "quantity_change", header: t("reports.qty", "Qty"), align: "right" },
    { key: "previous_stock", header: t("reports.prev", "Prev"), align: "right" },
    { key: "new_stock", header: t("reports.new", "New"), align: "right" },
    { key: "user_email", header: t("reports.user", "User") },
  ];

  // ---- Preset list (cards) ----
  const presets: Array<{
    key: PresetKey;
    label: string;
    desc: string;
    icon: React.ComponentType<{ className?: string }>;
    count: number;
    tone: string;
  }> = [
    {
      key: "low_stock",
      label: t("reports.preset.low_stock", "Low Stock"),
      desc: t("reports.preset.low_stock_desc", "Items at or below minimum"),
      icon: AlertTriangle,
      count: lowStock.length,
      tone: "text-warning",
    },
    {
      key: "out_of_stock",
      label: t("reports.preset.out_of_stock", "Out of Stock"),
      desc: t("reports.preset.out_of_stock_desc", "Items with zero stock"),
      icon: PackageX,
      count: outOfStock.length,
      tone: "text-destructive",
    },
    {
      key: "inventory_by_location",
      label: t("reports.preset.inv_loc", "Inventory by Location"),
      desc: t("reports.preset.inv_loc_desc", "Stock distribution across warehouses"),
      icon: Warehouse,
      count: invByLocation.length,
      tone: "text-primary",
    },
    {
      key: "sales_by_date",
      label: t("reports.preset.sales_date", "Sales by Date Range"),
      desc: t("reports.preset.sales_date_desc", "Orders within selected dates"),
      icon: Receipt,
      count: salesInRange.length,
      tone: "text-success",
    },
    {
      key: "unpaid_sales",
      label: t("reports.preset.unpaid", "Unpaid Sales Orders"),
      desc: t("reports.preset.unpaid_desc", "Orders with outstanding balance"),
      icon: CreditCard,
      count: unpaidSales.length,
      tone: "text-destructive",
    },
    {
      key: "transfers_by_location",
      label: t("reports.preset.transfers", "Transfers by Location"),
      desc: t("reports.preset.transfers_desc", "Movements between warehouses"),
      icon: ArrowRightLeft,
      count: transfersFiltered.length,
      tone: "text-primary",
    },
    {
      key: "internal_by_department",
      label: t("reports.preset.internal", "Internal Use by Department"),
      desc: t("reports.preset.internal_desc", "Consumption tracked by team"),
      icon: Wrench,
      count: internalFiltered.length,
      tone: "text-primary",
    },
    {
      key: "movement_history",
      label: t("reports.preset.movements", "Product Movement History"),
      desc: t("reports.preset.movements_desc", "Full audit trail by product"),
      icon: HistoryIcon,
      count: movementHistory.length,
      tone: "text-primary",
    },
  ];

  const needsDate =
    active === "sales_by_date" ||
    active === "transfers_by_location" ||
    active === "internal_by_department" ||
    active === "movement_history";
  const needsLocation =
    active === "inventory_by_location" || active === "transfers_by_location";
  const needsDept = active === "internal_by_department";
  const needsProduct = active === "movement_history";

  return (
    <div className="space-y-6">
      <FirstTimeTooltip storageKey="reports" i18nKey="onboarding.tips.reports" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <FileBarChart className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("reports.title", "Reports")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t(
                "reports.subtitle",
                "Generate operational reports and export them in PDF, CSV, or Excel.",
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Quick report cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {presets.map((p) => {
          const Icon = p.icon;
          const isActive = active === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setActive(p.key)}
              className={`text-left rounded-lg border p-3 transition-all hover:shadow-soft hover:border-primary/50 ${
                isActive ? "border-primary bg-primary/5 shadow-soft" : "border-border bg-card"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <Icon className={`h-4 w-4 ${p.tone}`} />
                <Badge variant="secondary" className="text-[10px] px-1.5">
                  {p.count}
                </Badge>
              </div>
              <p className="mt-2 text-sm font-medium leading-tight">{p.label}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                {p.desc}
              </p>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <CardTitle className="text-base">
              {presets.find((p) => p.key === active)?.label}
            </CardTitle>
            <div className="flex flex-wrap items-end gap-2">
              {needsDate && (
                <>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[11px] text-muted-foreground">
                      {t("reports.from", "From")}
                    </Label>
                    <Input
                      type="date"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                      className="h-8 w-[140px]"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[11px] text-muted-foreground">
                      {t("reports.to", "To")}
                    </Label>
                    <Input
                      type="date"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      className="h-8 w-[140px]"
                    />
                  </div>
                </>
              )}
              {needsLocation && (
                <div className="flex flex-col gap-1">
                  <Label className="text-[11px] text-muted-foreground">
                    {t("reports.location", "Location")}
                  </Label>
                  <Select value={locationId} onValueChange={setLocationId}>
                    <SelectTrigger className="h-8 w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("common.all", "All")}</SelectItem>
                      {(locations.data ?? []).map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {needsDept && (
                <div className="flex flex-col gap-1">
                  <Label className="text-[11px] text-muted-foreground">
                    {t("reports.department", "Department")}
                  </Label>
                  <Select value={department} onValueChange={setDepartment}>
                    <SelectTrigger className="h-8 w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("common.all", "All")}</SelectItem>
                      {INTERNAL_DEPARTMENTS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {needsProduct && (
                <div className="flex flex-col gap-1">
                  <Label className="text-[11px] text-muted-foreground">
                    {t("reports.product", "Product")}
                  </Label>
                  <Select value={productId} onValueChange={setProductId}>
                    <SelectTrigger className="h-8 w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("common.all", "All")}</SelectItem>
                      {(products.data ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="self-end">
                {active === "low_stock" && (
                  <ExportMenu
                    title={t("reports.preset.low_stock", "Low Stock")}
                    filename="low-stock"
                    rows={lowStock}
                    columns={productCols}
                  />
                )}
                {active === "out_of_stock" && (
                  <ExportMenu
                    title={t("reports.preset.out_of_stock", "Out of Stock")}
                    filename="out-of-stock"
                    rows={outOfStock}
                    columns={productCols}
                  />
                )}
                {active === "inventory_by_location" && (
                  <ExportMenu
                    title={t("reports.preset.inv_loc", "Inventory by Location")}
                    filename="inventory-by-location"
                    rows={invByLocation}
                    columns={invLocCols}
                  />
                )}
                {active === "sales_by_date" && (
                  <ExportMenu
                    title={t("reports.preset.sales_date", "Sales by Date Range")}
                    filename="sales-by-date"
                    rows={salesInRange}
                    columns={salesCols}
                    meta={metaDate}
                  />
                )}
                {active === "unpaid_sales" && (
                  <ExportMenu
                    title={t("reports.preset.unpaid", "Unpaid Sales Orders")}
                    filename="unpaid-sales"
                    rows={unpaidSales}
                    columns={unpaidCols}
                  />
                )}
                {active === "transfers_by_location" && (
                  <ExportMenu
                    title={t("reports.preset.transfers", "Transfers by Location")}
                    filename="transfers-by-location"
                    rows={transfersFiltered}
                    columns={transferCols}
                    meta={metaDate}
                  />
                )}
                {active === "internal_by_department" && (
                  <ExportMenu
                    title={t("reports.preset.internal", "Internal Use by Department")}
                    filename="internal-by-department"
                    rows={internalFiltered}
                    columns={internalCols}
                    meta={metaDate}
                  />
                )}
                {active === "movement_history" && (
                  <ExportMenu
                    title={t("reports.preset.movements", "Product Movement History")}
                    filename="movement-history"
                    rows={movementHistory}
                    columns={movementCols}
                    meta={metaDate}
                  />
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ReportTable
            preset={active}
            data={{
              lowStock,
              outOfStock,
              invByLocation,
              salesInRange,
              unpaidSales,
              transfersFiltered,
              internalFiltered,
              movementHistory,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function ReportTable({
  preset,
  data,
}: {
  preset: PresetKey;
  data: {
    lowStock: any[];
    outOfStock: any[];
    invByLocation: any[];
    salesInRange: any[];
    unpaidSales: any[];
    transfersFiltered: any[];
    internalFiltered: any[];
    movementHistory: any[];
  };
}) {
  const { t } = useTranslation();

  const empty = (
    <div className="py-10 text-center text-sm text-muted-foreground">
      {t("common.noResults", "No results")}
    </div>
  );

  if (preset === "low_stock" || preset === "out_of_stock") {
    const rows = preset === "low_stock" ? data.lowStock : data.outOfStock;
    if (!rows.length) return empty;
    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.name", "Name")}</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="hidden sm:table-cell">{t("reports.category", "Category")}</TableHead>
              <TableHead className="text-right">{t("reports.stock", "Stock")}</TableHead>
              <TableHead className="text-right hidden sm:table-cell">{t("reports.min", "Min")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, 100).map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-muted-foreground">{p.sku}</TableCell>
                <TableCell className="hidden sm:table-cell">{p.category ?? "—"}</TableCell>
                <TableCell className="text-right">{p.stock}</TableCell>
                <TableCell className="text-right hidden sm:table-cell">{p.min_stock}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (preset === "inventory_by_location") {
    const rows = data.invByLocation;
    if (!rows.length) return empty;
    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("reports.location", "Location")}</TableHead>
              <TableHead>{t("reports.product", "Product")}</TableHead>
              <TableHead className="hidden sm:table-cell">SKU</TableHead>
              <TableHead className="text-right">{t("reports.qty", "Qty")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, 100).map((r) => (
              <TableRow key={`${r.location_id}-${r.product_id}`}>
                <TableCell className="font-medium">{r.location_name}</TableCell>
                <TableCell>{r.product_name}</TableCell>
                <TableCell className="text-muted-foreground hidden sm:table-cell">{r.sku}</TableCell>
                <TableCell className="text-right">{r.qty}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (preset === "sales_by_date" || preset === "unpaid_sales") {
    const rows = preset === "sales_by_date" ? data.salesInRange : data.unpaidSales;
    if (!rows.length) return empty;
    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("reports.order", "Order #")}</TableHead>
              <TableHead className="hidden sm:table-cell">{t("common.date", "Date")}</TableHead>
              <TableHead>{t("reports.customer", "Customer")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("reports.payment", "Payment")}</TableHead>
              <TableHead className="text-right">{t("reports.total", "Total")}</TableHead>
              <TableHead className="text-right hidden sm:table-cell">{t("reports.balance", "Balance")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, 100).map((s: any) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.so_number}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  {s.order_date ? format(new Date(s.order_date), "yyyy-MM-dd") : ""}
                </TableCell>
                <TableCell>{s.customers?.name ?? "—"}</TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge variant={s.payment_status === "paid" ? "secondary" : "outline"}>
                    {s.payment_status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{Number(s.total).toFixed(2)}</TableCell>
                <TableCell className="text-right hidden sm:table-cell">
                  {Number(s.balance_due ?? 0).toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (preset === "transfers_by_location") {
    const rows = data.transfersFiltered;
    if (!rows.length) return empty;
    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead className="hidden sm:table-cell">{t("common.date", "Date")}</TableHead>
              <TableHead>{t("reports.from", "From")}</TableHead>
              <TableHead>{t("reports.to", "To")}</TableHead>
              <TableHead className="hidden sm:table-cell">{t("reports.status", "Status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, 100).map((tr: any) => (
              <TableRow key={tr.id}>
                <TableCell className="font-medium">{tr.transfer_number}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  {tr.transfer_date ? format(new Date(tr.transfer_date), "yyyy-MM-dd") : ""}
                </TableCell>
                <TableCell>{tr.from_location ?? "—"}</TableCell>
                <TableCell>{tr.to_location ?? "—"}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Badge variant="secondary">{tr.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (preset === "internal_by_department") {
    const rows = data.internalFiltered;
    if (!rows.length) return empty;
    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.date", "Date")}</TableHead>
              <TableHead>{t("reports.product", "Product")}</TableHead>
              <TableHead className="hidden sm:table-cell">{t("reports.department", "Department")}</TableHead>
              <TableHead className="text-right">{t("reports.qty", "Qty")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, 100).map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap">
                  {new Date(r.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>{r.product_name}</TableCell>
                <TableCell className="hidden sm:table-cell">{r._dept || "—"}</TableCell>
                <TableCell className="text-right">{r.quantity_change}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  // movement_history
  const rows = data.movementHistory;
  if (!rows.length) return empty;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("common.date", "Date")}</TableHead>
            <TableHead>{t("reports.product", "Product")}</TableHead>
            <TableHead className="hidden sm:table-cell">{t("reports.type", "Type")}</TableHead>
            <TableHead className="text-right">{t("reports.qty", "Qty")}</TableHead>
            <TableHead className="text-right hidden md:table-cell">{t("reports.new", "New")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(0, 100).map((r: any) => (
            <TableRow key={r.id}>
              <TableCell className="whitespace-nowrap">
                {new Date(r.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell>{r.product_name}</TableCell>
              <TableCell className="hidden sm:table-cell">
                <Badge variant="outline">{r.type}</Badge>
              </TableCell>
              <TableCell className="text-right">{r.quantity_change ?? "—"}</TableCell>
              <TableCell className="text-right hidden md:table-cell">{r.new_stock ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
