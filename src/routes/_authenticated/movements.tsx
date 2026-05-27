import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  listProducts,
  listMovements,
  createMovement,
} from "@/lib/inventory";
import { getCompanySettings } from "@/lib/settings";
import {
  exportMovementsCsv,
  exportMovementsXlsx,
  exportMovementsPdf,
} from "@/lib/movements-export";
import { ExportMenu } from "@/components/ExportMenu";
import type { ExportColumn } from "@/lib/exporters";
import type { MovementWithProduct } from "@/lib/inventory";
import { ScanBarcodeButton } from "@/components/ScanBarcodeButton";
import { ScanFieldButton } from "@/components/ScanFieldButton";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Plus,
  Minus,
  Sliders,
  ArrowLeftRight,
  Search,
  X,
  Download,
  Filter,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/movements")({
  component: MovementsPage,
});

const MOVEMENT_EXPORT_COLUMNS: ExportColumn<MovementWithProduct>[] = [
  { key: "date", header: "Date", get: (m) => new Date(m.created_at).toLocaleString() },
  { key: "type", header: "Type" },
  { key: "product", header: "Product", get: (m) => m.products?.name ?? "" },
  { key: "sku", header: "SKU", get: (m) => m.products?.sku ?? "" },
  { key: "barcode", header: "Barcode", get: (m) => m.products?.barcode ?? "" },
  { key: "category", header: "Category", get: (m) => m.products?.category ?? "" },
  { key: "location", header: "Location", get: (m) => m.products?.location ?? "" },
  { key: "qty", header: "Qty", align: "right", get: (m) => m.quantity },
  { key: "note", header: "Reason", get: (m) => m.note ?? "" },
];

type MovementType = "add" | "remove" | "adjustment";
type SourceFilter = "__all" | "manual" | "barcode_scan";
type SortKey =
  | "newest"
  | "oldest"
  | "qty-desc"
  | "qty-asc"
  | "name-asc"
  | "name-desc";

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

function MovementsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const products = useQuery({ queryKey: ["products"], queryFn: listProducts });
  const movements = useQuery({ queryKey: ["movements"], queryFn: listMovements });
  const settings = useQuery({ queryKey: ["settings"], queryFn: getCompanySettings });

  const [productId, setProductId] = useState<string>("");
  const [type, setType] = useState<MovementType>("add");
  const [quantity, setQuantity] = useState<string>("1");
  const [adjustReason, setAdjustReason] = useState<string>("physical_count");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedProduct = useMemo(
    () => products.data?.find((p) => p.id === productId) ?? null,
    [products.data, productId],
  );
  const currentStock = selectedProduct?.stock ?? 0;
  const adjustDiff =
    type === "adjustment" && quantity !== ""
      ? (parseInt(quantity, 10) || 0) - currentStock
      : 0;

  // Filters
  const [search, setSearch] = useState("");
  const [fType, setFType] = useState<"__all" | MovementType>("__all");
  const [fCategory, setFCategory] = useState("__all");
  const [fSupplier, setFSupplier] = useState("__all");
  const [fLocation, setFLocation] = useState("__all");
  const [fSource, setFSource] = useState<SourceFilter>("__all");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [fMinQty, setFMinQty] = useState("");
  const [fMaxQty, setFMaxQty] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const typeOptions = useMemo(
    () => [
      { value: "add" as const, label: t("movements.typeAdd"), icon: Plus, desc: t("movements.addDesc") },
      { value: "remove" as const, label: t("movements.typeRemove"), icon: Minus, desc: t("movements.removeDesc") },
      { value: "adjustment" as const, label: t("movements.typeAdjustment"), icon: Sliders, desc: t("movements.adjustDesc") },
    ],
    [t],
  );

  const categories = useMemo(() => {
    const s = new Set<string>();
    products.data?.forEach((p) => p.category && s.add(p.category));
    return Array.from(s).sort();
  }, [products.data]);
  const suppliers = useMemo(() => {
    const s = new Set<string>();
    products.data?.forEach((p) => p.supplier && s.add(p.supplier));
    return Array.from(s).sort();
  }, [products.data]);
  const locations = useMemo(() => {
    const s = new Set<string>();
    products.data?.forEach((p) => p.location && s.add(p.location));
    return Array.from(s).sort();
  }, [products.data]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId) return toast.error("Select a product");
    const q = parseInt(quantity, 10);
    if (isNaN(q) || q < 0) return toast.error("Enter a valid quantity");
    if (type !== "adjustment" && q <= 0)
      return toast.error("Enter a valid quantity");
    if (type === "adjustment" && q === currentStock) {
      toast.info(t("movements.noChange", "New quantity matches current stock"));
      return;
    }
    setSaving(true);
    try {
      const finalNote =
        type === "adjustment"
          ? `[${adjustReason}] ${note || ""}`.trim()
          : note || null;
      await createMovement({
        product_id: productId,
        type,
        quantity: q,
        note: finalNote,
      });
      toast.success(
        type === "adjustment"
          ? t("movements.adjustedTo", "Stock set to {{qty}}", { qty: q })
          : t("scanner.saveMovement"),
      );
      setQuantity(type === "adjustment" ? String(q) : "1");
      setNote("");
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["history"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    if (!movements.data) return [];
    const q = search.trim().toLowerCase();
    const fromT = fFrom ? new Date(fFrom).getTime() : -Infinity;
    const toT = fTo ? new Date(fTo).getTime() + 86_400_000 : Infinity;
    const minQ = fMinQty ? parseInt(fMinQty, 10) : -Infinity;
    const maxQ = fMaxQty ? parseInt(fMaxQty, 10) : Infinity;

    let res = movements.data.filter((m) => {
      if (fType !== "__all" && m.type !== fType) return false;
      const p = m.products;
      if (fCategory !== "__all" && p?.category !== fCategory) return false;
      if (fSupplier !== "__all" && p?.supplier !== fSupplier) return false;
      if (fLocation !== "__all" && p?.location !== fLocation) return false;
      if (fSource !== "__all") {
        const isScan = (m.note ?? "").startsWith("[scan]");
        if (fSource === "barcode_scan" && !isScan) return false;
        if (fSource === "manual" && isScan) return false;
      }
      const t = new Date(m.created_at).getTime();
      if (t < fromT || t > toT) return false;
      if (m.quantity < minQ || m.quantity > maxQ) return false;
      if (q) {
        const hay = [
          p?.name,
          p?.sku,
          p?.barcode,
          p?.supplier,
          p?.location,
          p?.category,
          m.note,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    res = [...res].sort((a, b) => {
      switch (sort) {
        case "newest":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "qty-desc":
          return b.quantity - a.quantity;
        case "qty-asc":
          return a.quantity - b.quantity;
        case "name-asc":
          return (a.products?.name ?? "").localeCompare(b.products?.name ?? "");
        case "name-desc":
          return (b.products?.name ?? "").localeCompare(a.products?.name ?? "");
      }
    });
    return res;
  }, [
    movements.data,
    search,
    fType,
    fCategory,
    fSupplier,
    fLocation,
    fSource,
    fFrom,
    fTo,
    fMinQty,
    fMaxQty,
    sort,
  ]);

  const activeFilterCount =
    (fType !== "__all" ? 1 : 0) +
    (fCategory !== "__all" ? 1 : 0) +
    (fSupplier !== "__all" ? 1 : 0) +
    (fLocation !== "__all" ? 1 : 0) +
    (fSource !== "__all" ? 1 : 0) +
    (fFrom || fTo ? 1 : 0) +
    (fMinQty || fMaxQty ? 1 : 0) +
    (search ? 1 : 0);

  const resetFilters = () => {
    setSearch("");
    setFType("__all");
    setFCategory("__all");
    setFSupplier("__all");
    setFLocation("__all");
    setFSource("__all");
    setFFrom("");
    setFTo("");
    setFMinQty("");
    setFMaxQty("");
    setSort("newest");
  };

  const applyQuickRange = (range: "today" | "week" | "month") => {
    const now = new Date();
    const start = startOfDay(now);
    if (range === "week") start.setDate(start.getDate() - 7);
    if (range === "month") start.setMonth(start.getMonth() - 1);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    setFFrom(fmt(start));
    setFTo(fmt(now));
  };

  const handleExport = async (format: "csv" | "xlsx" | "pdf") => {
    if (filtered.length === 0) return toast.error(t("common.noResults"));
    try {
      if (format === "csv") exportMovementsCsv(filtered);
      else if (format === "xlsx") exportMovementsXlsx(filtered);
      else await exportMovementsPdf(filtered, settings.data ?? null);
    } catch (e: any) {
      toast.error(e.message ?? "Export failed");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-primary mb-1.5">
            Operations
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {t("movements.title")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("movements.subtitle")}</p>
        </div>
        <ScanBarcodeButton />
      </div>

      <Card className="border-border shadow-soft overflow-hidden">
        <CardHeader className="border-b border-border bg-surface-muted/50">
          <CardTitle className="text-base">{t("movements.newMovement")}</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={submit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {typeOptions.map((opt) => {
                const Icon = opt.icon;
                const active = type === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setType(opt.value)}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all",
                      active
                        ? "border-primary bg-primary/5 shadow-soft ring-1 ring-primary/20"
                        : "border-border bg-surface hover:border-primary/30 hover:bg-surface-muted/40",
                    )}
                  >
                    <div
                      className={cn(
                        "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {opt.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label>{t("movements.product")}</Label>
                <div className="flex gap-2">
                  <Select value={productId} onValueChange={setProductId}>
                    <SelectTrigger className="bg-surface">
                      <SelectValue placeholder={t("movements.selectProduct")} />
                    </SelectTrigger>
                    <SelectContent>
                      {products.data?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} ({p.sku}) · {p.stock}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <ScanFieldButton
                    onScan={(code) => {
                      const found = products.data?.find(
                        (p) => (p.barcode ?? "").trim() === code.trim(),
                      );
                      if (found) {
                        setProductId(found.id);
                        toast.success(`${found.name}`);
                      } else {
                        toast.error(t("scanner.productNotFound"));
                      }
                    }}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t("movements.quantity")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="bg-surface"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t("movements.reasonNote")}</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="bg-surface resize-none"
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={saving} className="shadow-soft">
                {saving ? (
                  <>
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin" />
                    {t("common.loading")}
                  </>
                ) : (
                  <>
                    <ArrowLeftRight className="h-4 w-4" />
                    {t("movements.record")}
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border shadow-soft">
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">{t("movements.history")}</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {movements.data
                  ? t("movements.showing", {
                      shown: filtered.length,
                      total: movements.data.length,
                    })
                  : ""}
              </span>
              <ExportMenu
                title={t("movements.title", "Inventory Movements")}
                filename="movements"
                rows={filtered}
                columns={MOVEMENT_EXPORT_COLUMNS}
                orientation="landscape"
              />
            </div>
          </div>

          {/* Search + filter toggle */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("movements.searchPlaceholder")}
                className="pl-8 bg-surface"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFiltersOpen((v) => !v)}
              className="md:hidden"
            >
              <Filter className="h-3.5 w-3.5" />
              {filtersOpen ? t("movements.hideFilters") : t("movements.showFilters")}
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </div>

          {/* Quick chips */}
          <div className="flex flex-wrap gap-1.5">
            <QuickChip onClick={() => applyQuickRange("today")}>
              {t("movements.today")}
            </QuickChip>
            <QuickChip onClick={() => applyQuickRange("week")}>
              {t("movements.thisWeek")}
            </QuickChip>
            <QuickChip onClick={() => applyQuickRange("month")}>
              {t("movements.thisMonth")}
            </QuickChip>
            <QuickChip
              active={fType === "add"}
              onClick={() => setFType(fType === "add" ? "__all" : "add")}
            >
              {t("movements.addedStock")}
            </QuickChip>
            <QuickChip
              active={fType === "remove"}
              onClick={() => setFType(fType === "remove" ? "__all" : "remove")}
            >
              {t("movements.removedStock")}
            </QuickChip>
            <QuickChip
              active={fType === "adjustment"}
              onClick={() =>
                setFType(fType === "adjustment" ? "__all" : "adjustment")
              }
            >
              {t("movements.adjustments")}
            </QuickChip>
            <QuickChip
              active={fSource === "barcode_scan"}
              onClick={() =>
                setFSource(fSource === "barcode_scan" ? "__all" : "barcode_scan")
              }
            >
              {t("movements.barcodeScans")}
            </QuickChip>
          </div>

          {/* Filter grid (collapsible on mobile) */}
          <div
            className={cn(
              "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2",
              !filtersOpen && "hidden md:grid",
            )}
          >
            <Select value={fType} onValueChange={(v) => setFType(v as any)}>
              <SelectTrigger className="bg-surface">
                <SelectValue placeholder={t("movements.type")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">{t("movements.allTypes")}</SelectItem>
                <SelectItem value="add">{t("movements.typeAdd")}</SelectItem>
                <SelectItem value="remove">{t("movements.typeRemove")}</SelectItem>
                <SelectItem value="adjustment">
                  {t("movements.typeAdjustment")}
                </SelectItem>
              </SelectContent>
            </Select>
            <Select value={fCategory} onValueChange={setFCategory}>
              <SelectTrigger className="bg-surface">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">{t("movements.allCategories")}</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={fSupplier} onValueChange={setFSupplier}>
              <SelectTrigger className="bg-surface">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">{t("movements.allSuppliers")}</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={fLocation} onValueChange={setFLocation}>
              <SelectTrigger className="bg-surface">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">{t("movements.allLocations")}</SelectItem>
                {locations.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={fSource} onValueChange={(v) => setFSource(v as SourceFilter)}>
              <SelectTrigger className="bg-surface">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">{t("movements.allSources")}</SelectItem>
                <SelectItem value="manual">{t("history.sources.manual")}</SelectItem>
                <SelectItem value="barcode_scan">
                  {t("history.sources.barcode_scan")}
                </SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="bg-surface">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">{t("movements.sortNewest")}</SelectItem>
                <SelectItem value="oldest">{t("movements.sortOldest")}</SelectItem>
                <SelectItem value="qty-desc">{t("movements.sortQtyDesc")}</SelectItem>
                <SelectItem value="qty-asc">{t("movements.sortQtyAsc")}</SelectItem>
                <SelectItem value="name-asc">{t("movements.sortNameAsc")}</SelectItem>
                <SelectItem value="name-desc">{t("movements.sortNameDesc")}</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={fFrom}
              onChange={(e) => setFFrom(e.target.value)}
              className="bg-surface"
              aria-label={t("movements.from")}
            />
            <Input
              type="date"
              value={fTo}
              onChange={(e) => setFTo(e.target.value)}
              className="bg-surface"
              aria-label={t("movements.to")}
            />
            <Input
              type="number"
              min={0}
              value={fMinQty}
              onChange={(e) => setFMinQty(e.target.value)}
              className="bg-surface"
              placeholder={t("movements.minQty")}
            />
            <Input
              type="number"
              min={0}
              value={fMaxQty}
              onChange={(e) => setFMaxQty(e.target.value)}
              className="bg-surface"
              placeholder={t("movements.maxQty")}
            />
          </div>

          {activeFilterCount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {t("movements.activeFilters", { count: activeFilterCount })}
              </span>
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <X className="h-3.5 w-3.5" />
                {t("movements.resetFilters")}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {movements.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-4 py-2">
                  <div className="flex items-center gap-3 flex-1">
                    <Skeleton className="h-9 w-9 rounded-lg" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-1/2" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-14 rounded-full" />
                </div>
              ))}
            </div>
          ) : filtered.length > 0 ? (
            <ul className="divide-y divide-border">
              {filtered.map((m) => {
                const isAdd = m.type === "add";
                const isRemove = m.type === "remove";
                const isScan = (m.note ?? "").startsWith("[scan]");
                const cleanNote = isScan
                  ? m.note?.replace(/^\[scan\]\s*/, "")
                  : m.note;
                return (
                  <li
                    key={m.id}
                    className="py-3.5 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={
                          isAdd
                            ? "h-9 w-9 rounded-lg bg-success/10 text-success flex items-center justify-center shrink-0"
                            : isRemove
                              ? "h-9 w-9 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center shrink-0"
                              : "h-9 w-9 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0"
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
                          {m.products?.name ?? "Unknown"}
                          <span className="text-muted-foreground font-normal ml-1.5 font-mono text-xs">
                            {m.products?.sku ?? "—"}
                          </span>
                          {isScan && (
                            <Badge
                              variant="outline"
                              className="ml-2 h-4 px-1.5 text-[10px] font-normal"
                            >
                              {t("history.sources.barcode_scan")}
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {formatDistanceToNow(new Date(m.created_at), {
                            addSuffix: true,
                          })}
                          {cleanNote ? ` · ${cleanNote}` : ""}
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
            <div className="flex flex-col items-center text-center py-12">
              <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <ArrowLeftRight className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-medium">
                {(movements.data?.length ?? 0) > 0
                  ? t("movements.emptyTitle")
                  : t("movements.noMovementsYet")}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {(movements.data?.length ?? 0) > 0
                  ? t("movements.emptyHint")
                  : t("movements.noMovementsYetHint")}
              </p>
              {activeFilterCount > 0 && (
                <Button className="mt-4" variant="outline" onClick={resetFilters}>
                  {t("movements.resetFilters")}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function QuickChip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-7 px-3 rounded-full text-xs font-medium border transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-surface hover:bg-muted/50 text-foreground/80",
      )}
    >
      {children}
    </button>
  );
}
