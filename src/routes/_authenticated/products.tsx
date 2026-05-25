import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Package,
  SlidersHorizontal,
  X,
  MoreHorizontal,
  Eye,
  ArrowUp,
  ArrowDown,
  Download,
  Tag,
  MapPin,
  Filter,
  ScanLine,
} from "lucide-react";
import {
  deleteProduct,
  listProducts,
  upsertProduct,
  type Product,
} from "@/lib/inventory";
import { ProductForm } from "@/components/ProductForm";
import { QuickMovementDialog } from "@/components/QuickMovementDialog";
import { ProductDetailsDialog } from "@/components/ProductDetailsDialog";
import { StockBadge, StockHealthBar } from "@/components/StockBadge";
import { BarcodeScanDialog } from "@/components/BarcodeScanDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { PRODUCT_CATEGORIES } from "@/lib/categories";
import { getStockStatus, type StockStatus } from "@/lib/stock";
import { productsToCsv, downloadCsv } from "@/lib/csv";
import { ExportMenu } from "@/components/ExportMenu";
import type { ExportColumn } from "@/lib/exporters";
import { usePermissions } from "@/lib/use-permissions";
import { useOrgUsage } from "@/lib/use-org-usage";
import { PlanLimitBanner } from "@/components/PlanLimitBanner";
import { isAtLimit } from "@/lib/plan-limits";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { Upload } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { ImportDialog } from "@/components/ImportDialog";
import type { ImportSchema } from "@/lib/import-utils";
import { importProducts } from "@/lib/products-import.functions";

const PRODUCTS_IMPORT_SCHEMA: ImportSchema = {
  entity: "products",
  sheetName: "Products",
  fields: [
    { key: "product_name", required: true, aliases: ["name"], example: "Wireless Mouse" },
    { key: "sku", required: true, example: "SKU-001" },
    { key: "barcode", example: "0123456789012" },
    { key: "category", example: "Electronics" },
    { key: "description", example: "Optical wireless mouse" },
    { key: "cost_price", aliases: ["cost"], example: "5.50" },
    { key: "sale_price", aliases: ["price"], example: "12.99" },
    { key: "stock_quantity", aliases: ["stock", "quantity"], example: "100" },
    { key: "minimum_stock", aliases: ["min_stock", "min"], example: "10" },
    { key: "location", example: "Main Warehouse" },
    { key: "supplier", example: "ACME Distributors" },
    { key: "status", example: "active" },
  ],
};

export const Route = createFileRoute("/_authenticated/products")({
  component: ProductsPage,
});

type SortKey =
  | "name-asc"
  | "name-desc"
  | "stock-asc"
  | "stock-desc"
  | "newest"
  | "oldest"
  | "category"
  | "location";

type SavedView = "low-stock" | "out-of-stock" | "recent" | "high-value";

const SORT_OPTIONS: { value: SortKey; key: string }[] = [
  { value: "newest", key: "products.sort.newest" },
  { value: "oldest", key: "products.sort.oldest" },
  { value: "name-asc", key: "products.sort.nameAsc" },
  { value: "name-desc", key: "products.sort.nameDesc" },
  { value: "stock-asc", key: "products.sort.stockAsc" },
  { value: "stock-desc", key: "products.sort.stockDesc" },
  { value: "category", key: "products.sort.category" },
  { value: "location", key: "products.sort.location" },
];

const PRODUCT_EXPORT_BASE_COLUMNS: ExportColumn<Product>[] = [
  { key: "name", header: "Name" },
  { key: "sku", header: "SKU" },
  { key: "barcode", header: "Barcode" },
  { key: "category", header: "Category" },
  { key: "supplier", header: "Supplier" },
  { key: "location", header: "Location" },
  { key: "stock", header: "Stock", align: "right" },
  { key: "min_stock", header: "Min", align: "right" },
];
const PRODUCT_EXPORT_COST_COLUMN: ExportColumn<Product> = {
  key: "cost", header: "Cost", align: "right", get: (p) => Number(p.cost).toFixed(2),
};
const PRODUCT_EXPORT_PRICE_COLUMN: ExportColumn<Product> = {
  key: "price", header: "Price", align: "right", get: (p) => Number(p.price).toFixed(2),
};
const PRODUCT_EXPORT_VALUE_COLUMN: ExportColumn<Product> = {
  key: "value", header: "Value", align: "right", get: (p) => (Number(p.cost) * p.stock).toFixed(2),
};

function ProductsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: listProducts,
  });
  const perms = usePermissions();
  const canCost = perms.can("view_costs");
  const canPrice = perms.can("view_prices");
  const exportColumns = useMemo<ExportColumn<Product>[]>(() => {
    const cols = [...PRODUCT_EXPORT_BASE_COLUMNS];
    if (canCost) cols.push(PRODUCT_EXPORT_COST_COLUMN);
    if (canPrice) cols.push(PRODUCT_EXPORT_PRICE_COLUMN);
    if (canCost) cols.push(PRODUCT_EXPORT_VALUE_COLUMN);
    return cols;
  }, [canCost, canPrice]);
  const usageQ = useOrgUsage();
  const productsAtLimit = isAtLimit(usageQ.data ?? undefined, "products");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [viewing, setViewing] = useState<Product | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [prefillBarcode, setPrefillBarcode] = useState<string | null>(null);
  const [quickMove, setQuickMove] = useState<{
    product: Product;
    type: "add" | "remove";
  } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkCategoryOpen, setBulkCategoryOpen] = useState(false);
  const [bulkLocationOpen, setBulkLocationOpen] = useState(false);
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkLocation, setBulkLocation] = useState("");

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("__all");
  const [supplier, setSupplier] = useState("__all");
  const [location, setLocation] = useState("__all");
  const [status, setStatus] = useState<"__all" | StockStatus>("__all");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [costMin, setCostMin] = useState("");
  const [costMax, setCostMax] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [importOpen, setImportOpen] = useState(false);
  const [autoCreateSuppliers, setAutoCreateSuppliers] = useState(false);
  const runImport = useServerFn(importProducts);


  const [selected, setSelected] = useState<Set<string>>(new Set());

  const refresh = () => qc.invalidateQueries({ queryKey: ["products"] });

  const suppliers = useMemo(() => {
    const s = new Set<string>();
    data?.forEach((p) => p.supplier && s.add(p.supplier));
    return Array.from(s).sort();
  }, [data]);
  const locations = useMemo(() => {
    const s = new Set<string>();
    data?.forEach((p) => p.location && s.add(p.location));
    return Array.from(s).sort();
  }, [data]);

  const applyView = (view: SavedView) => {
    setQuery("");
    setCategory("__all");
    setSupplier("__all");
    setLocation("__all");
    setStatus("__all");
    setPriceMin("");
    setPriceMax("");
    setCostMin("");
    setCostMax("");
    if (view === "low-stock") {
      setStatus("low");
      setSort("stock-asc");
    } else if (view === "out-of-stock") {
      setStatus("out");
      setSort("stock-asc");
    } else if (view === "recent") {
      setSort("newest");
    } else if (view === "high-value") {
      setStatus("low");
      setSort("stock-asc");
      setPriceMin("50");
    }
  };

  const resetFilters = () => {
    setQuery("");
    setCategory("__all");
    setSupplier("__all");
    setLocation("__all");
    setStatus("__all");
    setPriceMin("");
    setPriceMax("");
    setCostMin("");
    setCostMax("");
    setSort("newest");
  };

  const activeFilterCount =
    (category !== "__all" ? 1 : 0) +
    (supplier !== "__all" ? 1 : 0) +
    (location !== "__all" ? 1 : 0) +
    (status !== "__all" ? 1 : 0) +
    (priceMin || priceMax ? 1 : 0) +
    (costMin || costMax ? 1 : 0);

  const filtered = useMemo(() => {
    if (!data) return [] as Product[];
    const q = query.trim().toLowerCase();
    const pMin = priceMin ? Number(priceMin) : -Infinity;
    const pMax = priceMax ? Number(priceMax) : Infinity;
    const cMin = costMin ? Number(costMin) : -Infinity;
    const cMax = costMax ? Number(costMax) : Infinity;

    let res = data.filter((p) => {
      if (q) {
        const hay = [
          p.name,
          p.sku,
          p.barcode,
          p.supplier,
          p.location,
          p.category,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (category !== "__all" && (p.category ?? "") !== category) return false;
      if (supplier !== "__all" && (p.supplier ?? "") !== supplier) return false;
      if (location !== "__all" && (p.location ?? "") !== location) return false;
      if (status !== "__all" && getStockStatus(p) !== status) return false;
      const price = Number(p.price);
      const cost = Number(p.cost);
      if (price < pMin || price > pMax) return false;
      if (cost < cMin || cost > cMax) return false;
      return true;
    });

    const cmp = (a: Product, b: Product) => {
      switch (sort) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "stock-asc":
          return a.stock - b.stock;
        case "stock-desc":
          return b.stock - a.stock;
        case "oldest":
          return (
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        case "newest":
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        case "category":
          return (a.category ?? "").localeCompare(b.category ?? "");
        case "location":
          return (a.location ?? "").localeCompare(b.location ?? "");
      }
    };
    res = [...res].sort(cmp);
    return res;
  }, [
    data,
    query,
    category,
    supplier,
    location,
    status,
    priceMin,
    priceMax,
    costMin,
    costMax,
    sort,
  ]);

  const allSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));
  const someSelected = filtered.some((p) => selected.has(p.id));

  const toggleAll = () => {
    if (allSelected) {
      const next = new Set(selected);
      filtered.forEach((p) => next.delete(p.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      filtered.forEach((p) => next.add(p.id));
      setSelected(next);
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const onDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteProduct(deleteId);
      toast.success(t("products.deleted"));
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeleteId(null);
    }
  };

  const onBulkDelete = async () => {
    const ids = Array.from(selected);
    try {
      await Promise.all(ids.map((id) => deleteProduct(id)));
      toast.success(t("products.deletedMany", { count: ids.length }));
      setSelected(new Set());
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBulkDeleteOpen(false);
    }
  };

  const onBulkCategory = async () => {
    if (!bulkCategory) return;
    const ids = Array.from(selected);
    const items = (data ?? []).filter((p) => ids.includes(p.id));
    try {
      await Promise.all(
        items.map((p) => upsertProduct({ ...p, category: bulkCategory })),
      );
      toast.success(t("products.updatedCategory", { count: items.length }));
      refresh();
      setBulkCategoryOpen(false);
      setBulkCategory("");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const onBulkLocation = async () => {
    if (!bulkLocation.trim()) return;
    const ids = Array.from(selected);
    const items = (data ?? []).filter((p) => ids.includes(p.id));
    try {
      await Promise.all(
        items.map((p) => upsertProduct({ ...p, location: bulkLocation })),
      );
      toast.success(t("products.updatedLocation", { count: items.length }));
      refresh();
      setBulkLocationOpen(false);
      setBulkLocation("");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const exportSelected = () => {
    const items = (data ?? []).filter((p) => selected.has(p.id));
    if (items.length === 0) return toast.error(t("products.selectToExport"));
    downloadCsv(`products-${Date.now()}.csv`, productsToCsv(items, { includeCost: canCost, includePrice: canPrice }));
    toast.success(t("products.exported", { count: items.length }));
  };

  const exportAll = () => {
    if (!filtered.length) return toast.error(t("products.nothingToExport"));
    downloadCsv(`products-${Date.now()}.csv`, productsToCsv(filtered, { includeCost: canCost, includePrice: canPrice }));
    toast.success(t("products.exported", { count: filtered.length }));
  };

  const filterPanel = (
    <FilterPanel
      categories={PRODUCT_CATEGORIES as readonly string[]}
      suppliers={suppliers}
      locations={locations}
      category={category}
      setCategory={setCategory}
      supplier={supplier}
      setSupplier={setSupplier}
      location={location}
      setLocation={setLocation}
      status={status}
      setStatus={setStatus}
      priceMin={priceMin}
      setPriceMin={setPriceMin}
      priceMax={priceMax}
      setPriceMax={setPriceMax}
      costMin={costMin}
      setCostMin={setCostMin}
      costMax={costMax}
      setCostMax={setCostMax}
      showPrice={canPrice}
      showCost={canCost}
      reset={resetFilters}
    />
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-primary mb-1.5">
            {t("products.section")}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">{t("products.title")}</h1>
          <p className="text-muted-foreground mt-1">
            {t("products.subtitle")}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ExportMenu
            title={t("products.title", "Products")}
            filename="products"
            rows={filtered}
            selectedRows={(data ?? []).filter((p) => selected.has(p.id))}
            columns={exportColumns}
          />
          <Button variant="outline" onClick={() => setImportOpen(true)} disabled={productsAtLimit}>
            <Upload className="h-4 w-4" /> {t("importer.button", "Import")}
          </Button>
          <Button variant="outline" onClick={() => setScanOpen(true)}>
            <ScanLine className="h-4 w-4" /> {t("common.scanBarcode")}
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setPrefillBarcode(null);
              setOpen(true);
            }}
            className="shadow-soft"
            disabled={productsAtLimit}
            title={productsAtLimit ? t("plan.limitReached") : undefined}
          >
            <Plus className="h-4 w-4" /> {t("products.addProduct")}
          </Button>
        </div>
      </div>

      <PlanLimitBanner usage={usageQ.data ?? undefined} kind="products" />

      {/* Saved views */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground mr-1">
          {t("products.quickViews")}
        </span>
        <ViewChip label={t("products.view.lowStock")} onClick={() => applyView("low-stock")} />
        <ViewChip label={t("products.view.outOfStock")} onClick={() => applyView("out-of-stock")} />
        <ViewChip label={t("products.view.recent")} onClick={() => applyView("recent")} />
        <ViewChip label={t("products.view.highValue")} onClick={() => applyView("high-value")} />
      </div>

      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("products.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 bg-surface"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-md grid place-content-center text-muted-foreground hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Desktop: popover filters */}
          <div className="hidden md:block">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="relative">
                  <SlidersHorizontal className="h-4 w-4" />
                  {t("products.filters")}
                  {activeFilterCount > 0 && (
                    <span className="ml-1 h-5 min-w-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold inline-flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[360px] p-0 bg-surface" align="end">
                {filterPanel}
              </PopoverContent>
            </Popover>
          </div>

          {/* Mobile: sheet filters */}
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="relative">
                  <Filter className="h-4 w-4" />
                  {activeFilterCount > 0 && (
                    <span className="ml-1 h-5 min-w-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold inline-flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto bg-surface">
                <SheetHeader>
                  <SheetTitle>{t("products.filters")}</SheetTitle>
                </SheetHeader>
                <div className="mt-4">{filterPanel}</div>
              </SheetContent>
            </Sheet>
          </div>

          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-[180px] bg-surface">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {t(o.key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {category !== "__all" && (
            <FilterChip
              label={t("products.chip.category", { value: category })}
              onRemove={() => setCategory("__all")}
            />
          )}
          {supplier !== "__all" && (
            <FilterChip
              label={t("products.chip.supplier", { value: supplier })}
              onRemove={() => setSupplier("__all")}
            />
          )}
          {location !== "__all" && (
            <FilterChip
              label={t("products.chip.location", { value: location })}
              onRemove={() => setLocation("__all")}
            />
          )}
          {status !== "__all" && (
            <FilterChip
              label={t("products.chip.status", { value: t(`stock.${status}`) })}
              onRemove={() => setStatus("__all")}
            />
          )}
          {(priceMin || priceMax) && (
            <FilterChip
              label={t("products.chip.price", { min: priceMin || "0", max: priceMax || "∞" })}
              onRemove={() => {
                setPriceMin("");
                setPriceMax("");
              }}
            />
          )}
          {(costMin || costMax) && (
            <FilterChip
              label={t("products.chip.cost", { min: costMin || "0", max: costMax || "∞" })}
              onRemove={() => {
                setCostMin("");
                setCostMax("");
              }}
            />
          )}
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            {t("products.resetAll")}
          </Button>
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5">
          <p className="text-sm font-medium">
            {t("products.selectedCount", { count: selected.size })}
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="ml-3 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              {t("products.clear")}
            </button>
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={exportSelected}>
              <Download className="h-3.5 w-3.5" /> {t("products.exportCsv")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBulkCategoryOpen(true)}>
              <Tag className="h-3.5 w-3.5" /> {t("products.category")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBulkLocationOpen(true)}>
              <MapPin className="h-3.5 w-3.5" /> {t("products.location")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" /> {t("products.delete")}
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {data
            ? t("products.ofProducts", { shown: filtered.length, total: data.length })
            : t("common.loading")}
        </span>
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-surface shadow-soft">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-muted hover:bg-surface-muted border-border">
                <TableHead className="w-10 pl-4">
                  <Checkbox
                    checked={
                      allSelected ? true : someSelected ? ("indeterminate" as any) : false
                    }
                    onCheckedChange={toggleAll}
                    aria-label={t("products.selectAll")}
                  />
                </TableHead>
                <TableHeadCell label={t("products.table.product")} />
                <TableHeadCell label={t("products.table.category")} />
                <TableHeadCell label={t("products.table.stock")} />
                <TableHeadCell label={t("products.table.status")} />
                <TableHeadCell label={t("products.table.location")} />
                <TableHeadCell label={t("products.table.supplier")} />
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-border">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j} className="py-4">
                        <Skeleton className="h-4 w-full max-w-[120px]" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length > 0 ? (
                filtered.map((p) => (
                  <TableRow
                    key={p.id}
                    className={cn(
                      "border-border hover:bg-surface-muted/50 transition-colors group",
                      selected.has(p.id) && "bg-primary/5",
                    )}
                  >
                    <TableCell className="pl-4">
                      <Checkbox
                        checked={selected.has(p.id)}
                        onCheckedChange={() => toggleOne(p.id)}
                        aria-label={t("products.selectRow", { name: p.name })}
                      />
                    </TableCell>
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
                      {p.category ? (
                        <Badge
                          variant="outline"
                          className="font-normal border-border bg-muted/60"
                        >
                          {p.category}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1.5 min-w-[100px]">
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-semibold text-sm tabular-nums">
                            {p.stock}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {t("products.table.minSuffix", { min: p.min_stock })}
                          </span>
                        </div>
                        <StockHealthBar stock={p.stock} min={p.min_stock} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <StockBadge product={p} />
                    </TableCell>
                    <TableCell>
                      {p.location ? (
                        <Badge
                          variant="outline"
                          className="font-normal gap-1 border-border bg-muted/40"
                        >
                          <MapPin className="h-3 w-3" />
                          {p.location}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.supplier ?? "—"}
                    </TableCell>
                    <TableCell className="text-right pr-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuLabel className="text-xs">{t("products.actions")}</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => setViewing(p)}>
                            <Eye className="h-4 w-4" /> {t("products.viewDetails")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setEditing(p);
                              setOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" /> {t("products.edit")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setQuickMove({ product: p, type: "add" })}
                          >
                            <ArrowUp className="h-4 w-4" /> {t("products.addStock")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setQuickMove({ product: p, type: "remove" })}
                          >
                            <ArrowDown className="h-4 w-4" /> {t("products.removeStock")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeleteId(p.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" /> {t("products.delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="py-16">
                    <div className="flex flex-col items-center text-center">
                      <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                        <Package className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="font-medium">
                        {data && data.length > 0
                          ? t("products.noMatch")
                          : t("products.noneYet")}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                        {data && data.length > 0
                          ? t("products.noMatchHint")
                          : t("products.noneYetHint")}
                      </p>
                      {data && data.length > 0 ? (
                        <Button className="mt-4" variant="outline" onClick={resetFilters}>
                          {t("products.resetFilters")}
                        </Button>
                      ) : (
                        <Button
                          className="mt-4"
                          onClick={() => {
                            setEditing(null);
                            setOpen(true);
                          }}
                        >
                          <Plus className="h-4 w-4" /> {t("products.addProduct")}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <BarcodeScanDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        onScan={(code: string) => {
          const found = data?.find(
            (p) => (p.barcode ?? "").trim() === code.trim(),
          );
          if (found) {
            setViewing(found);
            toast.success(t("products.scanFound", { name: found.name }));
          } else {
            setPrefillBarcode(code);
            setEditing(null);
            setOpen(true);
            toast.message(t("products.scanCreate"));
          }
        }}
      />

      {open && (
        <ProductForm
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setPrefillBarcode(null);
          }}
          product={
            editing ??
            (prefillBarcode
              ? ({ barcode: prefillBarcode } as unknown as Product)
              : null)
          }
          onSaved={refresh}
        />
      )}

      {viewing && (
        <ProductDetailsDialog product={viewing} onClose={() => setViewing(null)} />
      )}

      {quickMove && (
        <QuickMovementDialog
          product={quickMove.product}
          type={quickMove.type}
          onClose={() => setQuickMove(null)}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="bg-surface">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("products.deleteOne")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("products.deleteOneDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent className="bg-surface">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("products.deleteMany", { count: selected.size })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("products.deleteManyDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={onBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("products.deleteAll")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkCategoryOpen} onOpenChange={setBulkCategoryOpen}>
        <AlertDialogContent className="bg-surface">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("products.updateCategory")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("products.updateCategoryDesc", { count: selected.size })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Select value={bulkCategory} onValueChange={setBulkCategory}>
            <SelectTrigger>
              <SelectValue placeholder={t("products.selectCategory")} />
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={onBulkCategory} disabled={!bulkCategory}>
              {t("products.apply")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkLocationOpen} onOpenChange={setBulkLocationOpen}>
        <AlertDialogContent className="bg-surface">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("products.updateLocation")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("products.updateLocationDesc", { count: selected.size })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={bulkLocation}
            onChange={(e) => setBulkLocation(e.target.value)}
            placeholder={t("products.locationPlaceholder")}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={onBulkLocation} disabled={!bulkLocation.trim()}>
              {t("products.apply")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        schema={PRODUCTS_IMPORT_SCHEMA}
        title={t("products.importTitle", "Import products")}
        extraControls={
          <label className="inline-flex items-center gap-2 text-xs">
            <Checkbox
              checked={autoCreateSuppliers}
              onCheckedChange={(v) => setAutoCreateSuppliers(v === true)}
            />
            <span>
              {t(
                "products.importAutoCreateSuppliers",
                "Auto-create missing suppliers",
              )}
            </span>
          </label>
        }
        onImport={async (rows) =>
          runImport({
            data: {
              rows,
              auto_create_categories: true,
              auto_create_suppliers: autoCreateSuppliers,
            },
          })
        }
        onDone={refresh}
      />

    </div>
  );
}

function TableHeadCell({ label }: { label: string }) {
  return (
    <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground h-11">
      {label}
    </TableHead>
  );
}

function ViewChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium hover:border-primary/40 hover:bg-primary/5 transition-colors"
    >
      {label}
    </button>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="hover:bg-primary/20 rounded-full p-0.5"
        aria-label={`Remove ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function FilterPanel(props: {
  categories: readonly string[];
  suppliers: string[];
  locations: string[];
  category: string;
  setCategory: (v: string) => void;
  supplier: string;
  setSupplier: (v: string) => void;
  location: string;
  setLocation: (v: string) => void;
  status: string;
  setStatus: (v: any) => void;
  priceMin: string;
  setPriceMin: (v: string) => void;
  priceMax: string;
  setPriceMax: (v: string) => void;
  costMin: string;
  setCostMin: (v: string) => void;
  costMax: string;
  setCostMax: (v: string) => void;
  showPrice?: boolean;
  showCost?: boolean;
  reset: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="p-4 space-y-4">
      <FilterRow label={t("products.category")}>
        <Select value={props.category} onValueChange={props.setCategory}>
          <SelectTrigger className="bg-surface">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">{t("products.allCategories")}</SelectItem>
            {props.categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterRow>

      <FilterRow label={t("products.supplier")}>
        <Select value={props.supplier} onValueChange={props.setSupplier}>
          <SelectTrigger className="bg-surface">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">{t("products.allSuppliers")}</SelectItem>
            {props.suppliers.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterRow>

      <FilterRow label={t("products.location")}>
        <Select value={props.location} onValueChange={props.setLocation}>
          <SelectTrigger className="bg-surface">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">{t("products.allLocations")}</SelectItem>
            {props.locations.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterRow>

      <FilterRow label={t("products.stockStatus")}>
        <Select value={props.status} onValueChange={props.setStatus}>
          <SelectTrigger className="bg-surface">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">{t("products.all")}</SelectItem>
            <SelectItem value="healthy">{t("stock.healthy")}</SelectItem>
            <SelectItem value="low">{t("stock.low")}</SelectItem>
            <SelectItem value="out">{t("stock.out")}</SelectItem>
            <SelectItem value="overstocked">{t("stock.overstocked")}</SelectItem>
          </SelectContent>
        </Select>
      </FilterRow>

      <FilterRow label={t("products.priceRange")}>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder={t("products.min")}
            value={props.priceMin}
            onChange={(e) => props.setPriceMin(e.target.value)}
            className="bg-surface"
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="number"
            placeholder={t("products.max")}
            value={props.priceMax}
            onChange={(e) => props.setPriceMax(e.target.value)}
            className="bg-surface"
          />
        </div>
      </FilterRow>

      <FilterRow label={t("products.costRange")}>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder={t("products.min")}
            value={props.costMin}
            onChange={(e) => props.setCostMin(e.target.value)}
            className="bg-surface"
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="number"
            placeholder={t("products.max")}
            value={props.costMax}
            onChange={(e) => props.setCostMax(e.target.value)}
            className="bg-surface"
          />
        </div>
      </FilterRow>

      <div className="flex justify-end pt-2 border-t border-border">
        <Button variant="ghost" size="sm" onClick={props.reset}>
          {t("products.resetFilters")}
        </Button>
      </div>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}
