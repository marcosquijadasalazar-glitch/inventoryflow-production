import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listProducts, type Product } from "@/lib/inventory";
import {
  listAllNodes,
  getChildren,
  getDescendantIds,
  type LocationNode,
} from "@/lib/location-tree";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  ChevronRight,
  Info,
  MapPin,
  MoreHorizontal,
  Plus,
  Search,
  Boxes,
  Grid2X2,
  List,
  Package,
  LayoutGrid,
  Archive,
  ScanLine,
  ChevronLeft,
} from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { StockActionDialog } from "@/components/StockActionDialog";
import { LocationNodeDialog } from "@/components/LocationNodeDialog";
import { LocationNodeActions } from "@/components/LocationNodeActions";
import { ImportLocationsDialog } from "@/components/ImportLocationsDialog";
import { ProductDetailsDialog } from "@/components/ProductDetailsDialog";
import { usePermissions } from "@/lib/use-permissions";
import { cn } from "@/lib/utils";
import { getStockStatus } from "@/lib/stock";
import { Upload } from "lucide-react";

const sb = supabase as any;

export const Route = createFileRoute("/_authenticated/location-stock")({
  component: LocationStockPage,
});

function SectionBadge({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
      {n}
    </span>
  );
}

type StockStatusKey = "in_stock" | "low_stock" | "critical";

function statusFor(p: Pick<Product, "stock" | "min_stock">): StockStatusKey {
  const s = getStockStatus(p);
  if (s === "out") return "critical";
  if (s === "low") return p.stock <= Math.max(1, p.min_stock / 2) ? "critical" : "low_stock";
  return "in_stock";
}

const STATUS_META: Record<
  StockStatusKey,
  { label: string; bar: string; chip: string }
> = {
  in_stock: {
    label: "In Stock",
    bar: "bg-success",
    chip: "bg-success/10 text-[oklch(0.4_0.12_155)] border-success/25",
  },
  low_stock: {
    label: "Low Stock",
    bar: "bg-warning",
    chip: "bg-warning/15 text-[oklch(0.45_0.12_70)] border-warning/30",
  },
  critical: {
    label: "Low (Critical)",
    bar: "bg-destructive",
    chip: "bg-destructive/10 text-destructive border-destructive/20",
  },
};

function LocationStockPage() {
  const { t } = useTranslation();
  const perms = usePermissions();

  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [selectedAisleId, setSelectedAisleId] = useState<string | null>(null);
  const [selectedBinId, setSelectedBinId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [binSearch, setBinSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("__all");
  const [stockFilter, setStockFilter] = useState<string>("__all");
  const [lowOnly, setLowOnly] = useState(false);
  const [binView, setBinView] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [createParent, setCreateParent] = useState<{
    parentId: string | null;
    level: "location" | "sublocation" | "aisle" | "bin";
  } | null>(null);
  const [action, setAction] = useState<{
    product: Product;
    mode: "add" | "remove" | "adjust" | "move";
  } | null>(null);
  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const [showImport, setShowImport] = useState(false);

  const nodesQ = useQuery({ queryKey: ["location-nodes-all"], queryFn: listAllNodes });
  const productsQ = useQuery({ queryKey: ["products"], queryFn: listProducts });

  const nodes: LocationNode[] = nodesQ.data ?? [];
  const products = productsQ.data ?? [];

  // ── Sections derivation ────────────────────────────────────────────────
  const locations = useMemo(
    () => nodes.filter((n) => n.node_level === "location"),
    [nodes],
  );

  // Aisles under selected location = all descendants at aisle level; fall back to direct children
  const aisles = useMemo(() => {
    if (!selectedLocationId) return [];
    const descendantIds = getDescendantIds(nodes, selectedLocationId);
    const aisleNodes = nodes.filter(
      (n) => descendantIds.includes(n.id) && n.node_level === "aisle",
    );
    if (aisleNodes.length > 0) return aisleNodes;
    // Fallback: direct children that aren't bins (sub-locations acting as aisles)
    return getChildren(nodes, selectedLocationId).filter(
      (n) => n.node_level !== "bin",
    );
  }, [nodes, selectedLocationId]);

  const bins = useMemo(() => {
    if (!selectedAisleId) return [];
    const ids = getDescendantIds(nodes, selectedAisleId);
    return nodes.filter((n) => ids.includes(n.id) && n.node_level === "bin");
  }, [nodes, selectedAisleId]);

  // Auto-select first available items
  useEffect(() => {
    if (!selectedLocationId && locations.length > 0) {
      setSelectedLocationId(locations[0].id);
    }
  }, [locations, selectedLocationId]);
  useEffect(() => {
    setSelectedAisleId(aisles[0]?.id ?? null);
  }, [selectedLocationId]); // eslint-disable-line
  useEffect(() => {
    if (aisles.length > 0 && !aisles.find((a) => a.id === selectedAisleId)) {
      setSelectedAisleId(aisles[0].id);
    }
  }, [aisles, selectedAisleId]);
  useEffect(() => {
    setSelectedBinId(bins[0]?.id ?? null);
  }, [selectedAisleId]); // eslint-disable-line
  useEffect(() => {
    if (bins.length > 0 && !bins.find((b) => b.id === selectedBinId)) {
      setSelectedBinId(bins[0].id);
    }
  }, [bins, selectedBinId]);

  // ── Per-location stock (kept identical math to prior version) ──────────
  const perLocQ = useQuery({
    queryKey: ["location_stock", nodes.length, products.length],
    enabled: nodes.length > 0 && !!productsQ.data,
    queryFn: async () => {
      const map: Record<string, Record<string, number>> = {};
      const nameToId = new Map<string, string>();
      for (const l of nodes) {
        if (l.node_level === "location")
          nameToId.set((l.name ?? "").trim().toLowerCase(), l.id);
      }
      for (const p of products) {
        const locName = (p as any).location?.trim().toLowerCase();
        if (locName) {
          const lid = nameToId.get(locName);
          if (lid) {
            map[lid] ??= {};
            map[lid][p.id] = (map[lid][p.id] ?? 0) + (p.stock ?? 0);
          }
        }
        if ((p as any).bin_id) {
          const bid = (p as any).bin_id as string;
          map[bid] ??= {};
          map[bid][p.id] = (map[bid][p.id] ?? 0) + (p.stock ?? 0);
        }
      }
      const { data: transfers } = await sb
        .from("transfer_orders")
        .select("id, from_location_id, to_location_id, status")
        .eq("status", "completed");
      const ids = (transfers ?? []).map((t: any) => t.id);
      if (ids.length > 0) {
        const { data: items } = await sb
          .from("transfer_order_items")
          .select("transfer_order_id, product_id, quantity")
          .in("transfer_order_id", ids);
        const tMap = new Map<string, any>(
          (transfers ?? []).map((t: any) => [t.id, t]),
        );
        for (const it of items ?? []) {
          if (!it.product_id) continue;
          const tr = tMap.get(it.transfer_order_id);
          if (!tr) continue;
          if (tr.to_location_id) {
            map[tr.to_location_id] ??= {};
            map[tr.to_location_id][it.product_id] =
              (map[tr.to_location_id][it.product_id] ?? 0) + it.quantity;
          }
          if (tr.from_location_id) {
            map[tr.from_location_id] ??= {};
            map[tr.from_location_id][it.product_id] =
              (map[tr.from_location_id][it.product_id] ?? 0) - it.quantity;
          }
        }
      }
      return map;
    },
  });

  const lastMovesQ = useQuery({
    queryKey: ["last_movements_by_product"],
    queryFn: async () => {
      const { data } = await sb
        .from("inventory_movements")
        .select("product_id, created_at")
        .order("created_at", { ascending: false })
        .limit(1000);
      const map = new Map<string, string>();
      for (const m of data ?? []) {
        if (!map.has(m.product_id)) map.set(m.product_id, m.created_at);
      }
      return map;
    },
  });

  // Helper: items count for a node (descendant SKUs with qty > 0)
  const itemsCount = (nodeId: string) => {
    const perLoc = perLocQ.data ?? {};
    const ids = getDescendantIds(nodes, nodeId);
    const skus = new Set<string>();
    for (const id of ids) {
      const sm = perLoc[id];
      if (!sm) continue;
      for (const [pid, qty] of Object.entries(sm)) {
        if ((qty ?? 0) > 0) skus.add(pid);
      }
    }
    return skus.size;
  };

  // Top stat cards (counts under selected location)
  const stats = useMemo(() => {
    if (!selectedLocationId) {
      return { total: 0, aisles: 0, bins: 0, products: 0 };
    }
    const descendantIds = getDescendantIds(nodes, selectedLocationId);
    const sub = nodes.filter((n) => descendantIds.includes(n.id));
    const total = itemsCount(selectedLocationId);
    return {
      total,
      aisles: sub.filter((n) => n.node_level === "aisle").length,
      bins: sub.filter((n) => n.node_level === "bin").length,
      products: total,
    };
    // eslint-disable-next-line
  }, [nodes, perLocQ.data, selectedLocationId]);

  // ── Stock rows for selected bin ────────────────────────────────────────
  const binStock = useMemo(() => {
    if (!selectedBinId) return {} as Record<string, number>;
    return perLocQ.data?.[selectedBinId] ?? {};
  }, [perLocQ.data, selectedBinId]);

  const categoryOptions = useMemo(() => {
    const s = new Set<string>();
    for (const p of products) if (p.category) s.add(p.category);
    return Array.from(s).sort();
  }, [products]);

  const stockRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .map((p) => ({
        p,
        qty: binStock[p.id] ?? 0,
        lastMove: lastMovesQ.data?.get(p.id) ?? null,
        status: statusFor(p),
      }))
      .filter(({ p, qty, status }) => {
        if ((qty ?? 0) <= 0 && selectedBinId) return false;
        if (q) {
          if (
            !(
              p.name?.toLowerCase().includes(q) ||
              p.sku?.toLowerCase().includes(q) ||
              p.barcode?.toLowerCase().includes(q) ||
              p.category?.toLowerCase().includes(q)
            )
          )
            return false;
        }
        if (categoryFilter !== "__all" && p.category !== categoryFilter)
          return false;
        if (stockFilter === "low" && status === "in_stock") return false;
        if (stockFilter === "critical" && status !== "critical") return false;
        if (stockFilter === "in" && status !== "in_stock") return false;
        if (lowOnly && status === "in_stock") return false;
        return true;
      });
  }, [products, binStock, lastMovesQ.data, search, categoryFilter, stockFilter, lowOnly, selectedBinId]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * perPage;
    return stockRows.slice(start, start + perPage);
  }, [stockRows, page, perPage]);
  const totalPages = Math.max(1, Math.ceil(stockRows.length / perPage));
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  // Bins filtered by search
  const binsFiltered = useMemo(() => {
    const q = binSearch.trim().toLowerCase();
    if (!q) return bins;
    return bins.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        (b.code ?? "").toLowerCase().includes(q),
    );
  }, [bins, binSearch]);

  const canCreateLoc = perms.can("manage_locations");
  const canAdjust = perms.can("adjust_stock");
  const canMove = perms.can("manage_transfer_orders");
  const canMovements = perms.can("create_movements");

  const selectedLocation = locations.find((l) => l.id === selectedLocationId) ?? null;
  const selectedAisle = aisles.find((a) => a.id === selectedAisleId) ?? null;
  const selectedBin = bins.find((b) => b.id === selectedBinId) ?? null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <nav className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
            <span>{t("ls.crumb_inventory", "Inventory")}</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-primary">{t("ls.crumb_location_stock", "Location Stock")}</span>
          </nav>
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
            {t("ls.title", "Location Stock")}
            <Info className="h-4 w-4 text-muted-foreground" />
          </h1>
          <p className="text-muted-foreground mt-1">
            {t(
              "ls.subtitle_ref",
              "View and manage stock organized by locations, aisles and bins.",
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" asChild>
            <Link to="/transfer-orders">
              <ArrowLeft className="h-4 w-4" />
              {t("ls.back_to_transfers", "Back to Transfers")}
            </Link>
          </Button>
          {canCreateLoc && (
            <Button variant="outline" onClick={() => setShowImport(true)}>
              <Upload className="h-4 w-4" />
              {t("ln.import", "Import")}
            </Button>
          )}
          <ExportMenu
            title={`${t("ls.title", "Location Stock")}${selectedBin ? " — " + (selectedBin.code || selectedBin.name) : ""}`}
            filename={`location-stock${selectedBin ? "-" + selectedBin.name.toLowerCase().replace(/\s+/g, "-") : ""}`}
            rows={stockRows}
            columns={[
              { key: "name", header: "Product", get: (r: any) => r.p.name },
              { key: "sku", header: "SKU", get: (r: any) => r.p.sku },
              { key: "barcode", header: "Barcode", get: (r: any) => r.p.barcode ?? "" },
              { key: "category", header: "Category", get: (r: any) => r.p.category ?? "" },
              { key: "qty", header: "Quantity", align: "right", get: (r: any) => r.qty ?? 0 },
              { key: "lastMove", header: "Last movement", get: (r: any) => r.lastMove ? new Date(r.lastMove).toLocaleString() : "" },
              { key: "status", header: "Status", get: (r: any) => STATUS_META[r.status as StockStatusKey].label },
            ]}
          />
        </div>
      </div>

      {/* ── Section 1: Select Location ─────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <SectionBadge n={1} />
          <h2 className="font-semibold">{t("ls.s1_select_location", "Select Location")}</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-3">
          <Card className="border-border shadow-soft">
            <CardContent className="p-4">
              <Select
                value={selectedLocationId ?? ""}
                onValueChange={(v) => setSelectedLocationId(v)}
              >
                <SelectTrigger className="h-auto py-2 border-0 shadow-none bg-transparent focus:ring-0">
                  <div className="flex items-center gap-3 min-w-0 text-left">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
                      <MapPin className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      {selectedLocation ? (
                        <>
                          <p className="font-medium truncate">{selectedLocation.name}</p>
                          {selectedLocation.address && (
                            <p className="text-xs text-muted-foreground truncate">
                              {selectedLocation.address}
                            </p>
                          )}
                        </>
                      ) : (
                        <SelectValue placeholder={t("ls.pick", "Pick a location")} />
                      )}
                    </div>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                      {l.address && (
                        <span className="text-muted-foreground text-xs ml-2">
                          {l.address}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                  {locations.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      {t("ls.no_locations", "No locations yet")}
                    </div>
                  )}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatCard icon={Package} label={t("ls.stat_total", "Total Items")} value={stats.total} />
            <StatCard icon={LayoutGrid} label={t("ls.stat_aisles", "Aisles")} value={stats.aisles} />
            <StatCard icon={Archive} label={t("ls.stat_bins", "Bins")} value={stats.bins} />
            <StatCard icon={Boxes} label={t("ls.stat_products", "Products")} value={stats.products} />
          </div>
        </div>
      </section>

      {/* ── Section 2: Browse by Aisle ─────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <SectionBadge n={2} />
            <h2 className="font-semibold">{t("ls.s2_browse_aisle", "Browse by Aisle")}</h2>
          </div>
          {canCreateLoc && selectedLocationId && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setCreateParent({ parentId: selectedLocationId, level: "aisle" })
              }
            >
              <Plus className="h-4 w-4" />
              {t("ln.new_aisle", "New Aisle")}
            </Button>
          )}
        </div>
        {aisles.length === 0 ? (
          <EmptyHint
            label={t("ls.no_aisles", "No aisles in this location yet.")}
            cta={
              canCreateLoc && selectedLocationId
                ? {
                    label: t("ln.new_aisle", "New Aisle"),
                    onClick: () =>
                      setCreateParent({
                        parentId: selectedLocationId,
                        level: "aisle",
                      }),
                  }
                : undefined
            }
          />
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
            {aisles.map((a) => {
              const active = a.id === selectedAisleId;
              const count = itemsCount(a.id);
              return (
                <button
                  key={a.id}
                  onClick={() => setSelectedAisleId(a.id)}
                  className={cn(
                    "snap-start text-left shrink-0 w-[200px] rounded-lg border bg-card p-3 transition-all hover:shadow-soft",
                    active
                      ? "border-primary ring-1 ring-primary text-primary"
                      : "border-border",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <LayoutGrid
                      className={cn(
                        "h-4 w-4 shrink-0",
                        active ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                    <span
                      className={cn(
                        "text-xs font-semibold rounded-md px-1.5 py-0.5",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {count}
                    </span>
                  </div>
                  <p
                    className={cn(
                      "mt-2 font-medium truncate text-sm",
                      active ? "text-primary" : "text-foreground",
                    )}
                  >
                    {a.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {a.code || t("ls.items_count", { defaultValue: "{{n}} items", n: count })}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Section 3: Bins in Aisle ───────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <SectionBadge n={3} />
            <h2 className="font-semibold truncate">
              {t("ls.s3_bins_in", "Bins in")} {selectedAisle?.name ?? "—"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-9 w-[200px]"
                placeholder={t("ls.search_bins", "Search bins…")}
                value={binSearch}
                onChange={(e) => setBinSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center rounded-md border border-border overflow-hidden">
              <button
                onClick={() => setBinView("grid")}
                className={cn(
                  "h-9 w-9 inline-flex items-center justify-center",
                  binView === "grid"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted",
                )}
                aria-label="Grid view"
              >
                <Grid2X2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setBinView("list")}
                className={cn(
                  "h-9 w-9 inline-flex items-center justify-center",
                  binView === "list"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted",
                )}
                aria-label="List view"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
            {canCreateLoc && selectedAisleId && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setCreateParent({ parentId: selectedAisleId, level: "bin" })
                }
              >
                <Plus className="h-4 w-4" />
                {t("ln.new_bin", "New Bin")}
              </Button>
            )}
          </div>
        </div>
        {binsFiltered.length === 0 ? (
          <EmptyHint
            label={t("ls.no_bins", "No bins in this aisle yet.")}
            cta={
              canCreateLoc && selectedAisleId
                ? {
                    label: t("ln.new_bin", "New Bin"),
                    onClick: () =>
                      setCreateParent({ parentId: selectedAisleId, level: "bin" }),
                  }
                : undefined
            }
          />
        ) : binView === "grid" ? (
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
            {binsFiltered.map((b) => {
              const active = b.id === selectedBinId;
              const count = itemsCount(b.id);
              return (
                <button
                  key={b.id}
                  onClick={() => setSelectedBinId(b.id)}
                  className={cn(
                    "snap-start shrink-0 inline-flex items-center gap-2 rounded-full border px-3.5 h-10 transition-all hover:shadow-soft",
                    active
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-card text-foreground",
                  )}
                >
                  <MapPin
                    className={cn(
                      "h-3.5 w-3.5",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  <span className="text-sm font-medium">
                    {b.code || b.name}
                  </span>
                  <span
                    className={cn(
                      "text-xs rounded-full px-1.5 py-0.5",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {count} {t("ls.items", "items")}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-md border border-border overflow-hidden">
            {binsFiltered.map((b) => {
              const active = b.id === selectedBinId;
              const count = itemsCount(b.id);
              return (
                <button
                  key={b.id}
                  onClick={() => setSelectedBinId(b.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-left border-b border-border last:border-b-0",
                    active ? "bg-primary/5 text-primary" : "hover:bg-muted/50",
                  )}
                >
                  <span className="inline-flex items-center gap-2 text-sm font-medium">
                    <MapPin className="h-3.5 w-3.5" />
                    {b.code || b.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {count} {t("ls.items", "items")}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Section 4: Stock in Bin ────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <SectionBadge n={4} />
          <h2 className="font-semibold truncate">
            {t("ls.s4_stock_in", "Stock in")} {selectedBin?.code || selectedBin?.name || "—"}
          </h2>
        </div>
        <Card className="border-border shadow-soft">
          <CardContent className="p-4 space-y-4">
            {/* Top controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="pl-8 h-9"
                  placeholder={t("ls.search_in_bin", "Search products in this bin…")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-9 w-[160px]">
                  <span className="text-muted-foreground text-xs mr-1">
                    {t("ls.category", "Category")}
                  </span>
                  <SelectValue placeholder={t("common.all", "All")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">{t("common.all", "All")}</SelectItem>
                  {categoryOptions.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={stockFilter} onValueChange={setStockFilter}>
                <SelectTrigger className="h-9 w-[160px]">
                  <span className="text-muted-foreground text-xs mr-1">
                    {t("ls.stock", "Stock")}
                  </span>
                  <SelectValue placeholder={t("common.all", "All")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">{t("common.all", "All")}</SelectItem>
                  <SelectItem value="in">{t("stock.healthy", "In Stock")}</SelectItem>
                  <SelectItem value="low">{t("stock.low", "Low Stock")}</SelectItem>
                  <SelectItem value="critical">{t("ls.critical", "Low (Critical)")}</SelectItem>
                </SelectContent>
              </Select>
              <label className="inline-flex items-center gap-2 text-xs text-muted-foreground ml-auto">
                <button
                  type="button"
                  onClick={() => setLowOnly((v) => !v)}
                  className={cn(
                    "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                    lowOnly ? "bg-primary" : "bg-muted",
                  )}
                  role="switch"
                  aria-checked={lowOnly}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-background transition-transform shadow",
                      lowOnly ? "translate-x-4" : "translate-x-0.5",
                    )}
                  />
                </button>
                {t("ls.low_only", "Low stock only")}
                <Info className="h-3 w-3" />
              </label>
              <span className="text-xs text-muted-foreground">
                {stockRows.length} {t("ls.items", "items")}
              </span>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("po.product", "Product")}</TableHead>
                    <TableHead>{t("products.sku", "SKU")}</TableHead>
                    <TableHead>{t("products.barcode", "Barcode")}</TableHead>
                    <TableHead>{t("products.category", "Category")}</TableHead>
                    <TableHead>{t("sa.quantity", "Quantity")}</TableHead>
                    <TableHead>{t("ls.last_move", "Last Movement")}</TableHead>
                    <TableHead>{t("ls.status", "Status")}</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!selectedBinId ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-10 text-sm">
                        <ScanLine className="h-5 w-5 mx-auto mb-2 text-muted-foreground/60" />
                        {t("ls.pick_bin", "Select a bin to view its stock.")}
                      </TableCell>
                    </TableRow>
                  ) : productsQ.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-sm text-muted-foreground">
                        {t("common.loading", "Loading…")}
                      </TableCell>
                    </TableRow>
                  ) : pagedRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-10 text-sm">
                        {t("common.noResults", "No results")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagedRows.map(({ p, qty, lastMove, status }) => {
                      const meta = STATUS_META[status];
                      return (
                        <TableRow key={p.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-muted text-muted-foreground shrink-0">
                                <Package className="h-3.5 w-3.5" />
                              </span>
                              <span className="font-medium">{p.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {p.barcode ?? "—"}
                          </TableCell>
                          <TableCell className="text-xs">{p.category ?? "—"}</TableCell>
                          <TableCell>
                            <div className="inline-flex items-center gap-2">
                              <span className={cn("h-4 w-1 rounded-sm", meta.bar)} />
                              <span className="font-semibold tabular-nums">{qty}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {lastMove ? new Date(lastMove).toLocaleString() : "—"}
                          </TableCell>
                          <TableCell>
                            <span
                              className={cn(
                                "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
                                meta.chip,
                              )}
                            >
                              {t(`ls.status_${status}`, meta.label)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                {canMovements && (
                                  <DropdownMenuItem onClick={() => setAction({ product: p, mode: "add" })}>
                                    {t("sa.add_title", "Add stock")}
                                  </DropdownMenuItem>
                                )}
                                {canMovements && (
                                  <DropdownMenuItem onClick={() => setAction({ product: p, mode: "remove" })}>
                                    {t("sa.remove_title", "Remove stock")}
                                  </DropdownMenuItem>
                                )}
                                {canAdjust && (
                                  <DropdownMenuItem onClick={() => setAction({ product: p, mode: "adjust" })}>
                                    {t("sa.adjust_title", "Adjust quantity")}
                                  </DropdownMenuItem>
                                )}
                                {canMove && (
                                  <DropdownMenuItem onClick={() => setAction({ product: p, mode: "move" })}>
                                    {t("sa.move_title", "Move product")}
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setViewProduct(p)}>
                                  {t("sa.view", "View product")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Footer pagination */}
            {stockRows.length > 0 && (
              <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                <p className="text-xs text-muted-foreground">
                  {t("ls.showing", "Showing")} {(page - 1) * perPage + 1}–
                  {Math.min(page * perPage, stockRows.length)} {t("ls.of", "of")}{" "}
                  {stockRows.length} {t("ls.items", "items")}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {t("common.prev", "Prev")}
                  </Button>
                  <span className="text-xs px-2 py-1 rounded border border-border bg-card font-medium">
                    {page}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    {t("common.next", "Next")}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Select value={String(perPage)} onValueChange={(v) => setPerPage(Number(v))}>
                    <SelectTrigger className="h-8 w-[120px]">
                      <span className="text-xs text-muted-foreground mr-1">
                        {t("ls.per_page", "Items per page")}
                      </span>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 20, 50, 100].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Dialogs */}
      <StockActionDialog
        product={action?.product ?? null}
        mode={action?.mode ?? null}
        contextLocationLabel={
          [selectedLocation?.name, selectedAisle?.name, selectedBin?.code || selectedBin?.name]
            .filter(Boolean)
            .join(" / ") || undefined
        }
        onClose={() => setAction(null)}
      />
      <LocationNodeDialog
        open={!!createParent}
        level={createParent?.level ?? "location"}
        parentId={createParent?.parentId ?? null}
        parentLabel={
          createParent?.parentId
            ? nodes.find((n) => n.id === createParent.parentId)?.name ?? null
            : null
        }
        onClose={() => setCreateParent(null)}
      />
      <ProductDetailsDialog
        product={viewProduct}
        onClose={() => setViewProduct(null)}
      />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
}) {
  return (
    <Card className="border-border shadow-soft">
      <CardContent className="p-3 flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground truncate">
            {label}
          </p>
          <p className="text-lg font-semibold leading-tight tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyHint({
  label,
  cta,
}: {
  label: string;
  cta?: { label: string; onClick: () => void };
}) {
  return (
    <Card className="border-dashed border-border">
      <CardContent className="py-8 text-center space-y-3">
        <Boxes className="h-6 w-6 mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{label}</p>
        {cta && (
          <Button size="sm" onClick={cta.onClick}>
            <Plus className="h-4 w-4" />
            {cta.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
