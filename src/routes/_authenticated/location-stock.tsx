import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listProducts, type Product } from "@/lib/inventory";
import {
  listAllNodes,
  getChildren,
  getBreadcrumb,
  getDescendantIds,
  NEXT_LEVEL,
  LEVEL_LABEL,
  type LocationNode,
  type NodeLevel,
} from "@/lib/location-tree";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Home,
  MapPin,
  MoreHorizontal,
  Plus,
  Search,
  Boxes,
} from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { StockBadge } from "@/components/StockBadge";
import { StockActionDialog } from "@/components/StockActionDialog";
import { LocationNodeDialog } from "@/components/LocationNodeDialog";
import { ProductDetailsDialog } from "@/components/ProductDetailsDialog";
import { usePermissions } from "@/lib/use-permissions";

const sb = supabase as any;

type FilterKey = "low" | "out" | "recent" | "empty_bin";

export const Route = createFileRoute("/_authenticated/location-stock")({
  component: LocationStockPage,
});

function LocationStockPage() {
  const { t } = useTranslation();
  const perms = usePermissions();
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey | null>(null);
  const [action, setAction] = useState<{
    product: Product;
    mode: "add" | "remove" | "adjust" | "move";
  } | null>(null);
  const [createLevel, setCreateLevel] = useState<NodeLevel | null>(null);
  const [viewProduct, setViewProduct] = useState<Product | null>(null);

  const nodesQ = useQuery({
    queryKey: ["location-nodes-all"],
    queryFn: listAllNodes,
  });
  const productsQ = useQuery({
    queryKey: ["products"],
    queryFn: listProducts,
  });

  const nodes = nodesQ.data ?? [];
  const breadcrumb = getBreadcrumb(nodes, currentId);
  const currentNode = breadcrumb[breadcrumb.length - 1] ?? null;
  const currentLevel: NodeLevel | "root" = currentNode?.node_level ?? "root";
  const childLevel: NodeLevel | null = currentNode
    ? NEXT_LEVEL[currentNode.node_level]
    : "location";
  const children = getChildren(nodes, currentId);

  // Per-location stock (re-uses transfer-derived math).
  const perLocQ = useQuery({
    queryKey: ["location_stock", nodes.length, productsQ.data?.length ?? 0],
    enabled: nodes.length > 0 && !!productsQ.data,
    queryFn: async () => {
      const map: Record<string, Record<string, number>> = {};
      const nameToId = new Map<string, string>();
      for (const l of nodes) {
        if (l.node_level === "location")
          nameToId.set((l.name ?? "").trim().toLowerCase(), l.id);
      }
      for (const p of productsQ.data ?? []) {
        const locName = (p as any).location?.trim().toLowerCase();
        if (!locName) continue;
        const lid = nameToId.get(locName);
        if (!lid) continue;
        map[lid] ??= {};
        map[lid][p.id] = (map[lid][p.id] ?? 0) + (p.stock ?? 0);
        // also attribute to bin_id if set
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

  // Aggregate stock for current node + descendants
  const scopedStock = useMemo(() => {
    if (!currentId) return null;
    const ids = getDescendantIds(nodes, currentId);
    const agg: Record<string, number> = {};
    const perLoc = perLocQ.data ?? {};
    for (const id of ids) {
      const sm = perLoc[id];
      if (!sm) continue;
      for (const [pid, qty] of Object.entries(sm)) {
        agg[pid] = (agg[pid] ?? 0) + qty;
      }
    }
    return agg;
  }, [currentId, nodes, perLocQ.data]);

  const rows = useMemo(() => {
    const list = productsQ.data ?? [];
    const q = search.trim().toLowerCase();
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return list
      .map((p) => ({
        p,
        atLocation: scopedStock ? scopedStock[p.id] ?? 0 : null,
        lastMove: lastMovesQ.data?.get(p.id) ?? null,
      }))
      .filter(({ p, atLocation, lastMove }) => {
        if (q) {
          const node = currentNode;
          const matchesNode =
            (node?.name ?? "").toLowerCase().includes(q) ||
            (node?.code ?? "").toLowerCase().includes(q);
          if (
            !(
              p.name?.toLowerCase().includes(q) ||
              p.sku?.toLowerCase().includes(q) ||
              p.barcode?.toLowerCase().includes(q) ||
              p.category?.toLowerCase().includes(q) ||
              matchesNode
            )
          )
            return false;
        }
        if (filter === "low")
          return p.min_stock > 0 && p.stock > 0 && p.stock <= p.min_stock;
        if (filter === "out") return p.stock <= 0;
        if (filter === "recent")
          return !!lastMove && new Date(lastMove).getTime() >= sevenDaysAgo;
        if (filter === "empty_bin") return (atLocation ?? 0) <= 0;
        return true;
      });
  }, [productsQ.data, scopedStock, lastMovesQ.data, search, filter, currentNode]);

  const canCreateLoc = perms.can("manage_locations");
  const canAdjust = perms.can("adjust_stock");
  const canMove = perms.can("manage_transfer_orders");
  const canMovements = perms.can("create_movements");

  const contextLabel = breadcrumb.map((b) => b.code || b.name).join(" / ");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-primary mb-1.5">
            {t("ls.section", "Inventory")}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {t("ls.title", "Location Stock")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t(
              "ls.subtitle_v2",
              "Browse stock by location, sub-location, aisle, and bin.",
            )}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/transfer-orders">
            <ArrowLeft className="h-4 w-4" />{" "}
            {t("ls.back_to_transfers", "Back to Transfers")}
          </Link>
        </Button>
      </div>

      {/* Breadcrumb + create buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav className="flex items-center gap-1 text-sm flex-wrap">
          <button
            onClick={() => setCurrentId(null)}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Home className="h-3.5 w-3.5" />
            {t("ls.all_locations", "Locations")}
          </button>
          {breadcrumb.map((n, i) => (
            <span key={n.id} className="flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              <button
                onClick={() => setCurrentId(n.id)}
                className={`hover:text-foreground transition-colors ${
                  i === breadcrumb.length - 1
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {n.code ? `${n.name} (${n.code})` : n.name}
              </button>
            </span>
          ))}
        </nav>

        <div className="flex items-center gap-2 flex-wrap">
          {canCreateLoc && childLevel && (
            <Button
              size="sm"
              onClick={() => setCreateLevel(childLevel)}
            >
              <Plus className="h-4 w-4" />{" "}
              {t(`ln.new_${childLevel}`, `New ${LEVEL_LABEL[childLevel]}`)}
            </Button>
          )}
          <ExportMenu
            title={`${t("ls.title", "Location Stock")}${currentNode ? " — " + contextLabel : ""}`}
            filename={`location-stock${currentNode ? "-" + currentNode.name.toLowerCase().replace(/\s+/g, "-") : ""}`}
            rows={rows}
            columns={[
              { key: "name", header: "Product", get: (r: any) => r.p.name },
              { key: "sku", header: "SKU", get: (r: any) => r.p.sku },
              { key: "barcode", header: "Barcode", get: (r: any) => r.p.barcode ?? "" },
              { key: "category", header: "Category", get: (r: any) => r.p.category ?? "" },
              { key: "atLocation", header: "At location", align: "right", get: (r: any) => r.atLocation ?? "" },
              { key: "total", header: "Total stock", align: "right", get: (r: any) => r.p.stock ?? 0 },
              { key: "lastMove", header: "Last movement", get: (r: any) => r.lastMove ? new Date(r.lastMove).toLocaleString() : "" },
            ]}
            meta={currentNode ? [{ label: "Location", value: contextLabel }] : undefined}
          />
        </div>
      </div>

      {/* Children cards grid */}
      {children.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {children.map((c) => {
            const stockMap = perLocQ.data?.[c.id] ?? {};
            const totalSkus = Object.keys(stockMap).filter(
              (k) => (stockMap[k] ?? 0) > 0,
            ).length;
            return (
              <button
                key={c.id}
                onClick={() => setCurrentId(c.id)}
                className="text-left"
              >
                <Card className="border-border shadow-soft hover:border-primary/40 hover:shadow-md transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                          <p className="font-medium truncate">
                            {c.name}
                            {c.code && (
                              <span className="ml-1 text-xs text-muted-foreground font-mono">
                                ({c.code})
                              </span>
                            )}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 capitalize">
                          {t(`ln.levels.${c.node_level}`, LEVEL_LABEL[c.node_level])}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-semibold leading-none">
                          {totalSkus}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {t("ls.skus", "SKUs")}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      {/* Empty hierarchy hint */}
      {currentLevel === "root" && children.length === 0 && (
        <Card className="border-dashed border-border">
          <CardContent className="py-10 text-center space-y-3">
            <Boxes className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {t("ls.empty_root", "No locations yet. Create your first one to get started.")}
            </p>
            {canCreateLoc && (
              <Button onClick={() => setCreateLevel("location")}>
                <Plus className="h-4 w-4" /> {t("ln.new_location", "New Location")}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stock table */}
      <Card className="border-border shadow-soft">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            {currentNode
              ? contextLabel
              : t("ls.all_products", "All products")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
            <div className="space-y-1.5">
              <Label>{t("common.search")}</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t(
                    "ls.search_ph_v2",
                    "Search product, SKU, barcode, aisle, bin…",
                  )}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(["low", "out", "recent", "empty_bin"] as FilterKey[]).map((k) => (
                <Button
                  key={k}
                  size="sm"
                  variant={filter === k ? "default" : "outline"}
                  onClick={() => setFilter(filter === k ? null : k)}
                >
                  {t(`ls.filters.${k}`, k)}
                </Button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("po.product", "Product")}</TableHead>
                  <TableHead>{t("products.sku", "SKU")}</TableHead>
                  <TableHead>{t("products.category", "Category")}</TableHead>
                  <TableHead>{t("ls.status", "Status")}</TableHead>
                  <TableHead className="text-right">
                    {t("ls.at_location", "At location")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("ls.total_stock", "Total stock")}
                  </TableHead>
                  <TableHead>{t("ls.last_move", "Last movement")}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {productsQ.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-sm text-muted-foreground">
                      {t("common.loading")}
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      {t("common.noResults")}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map(({ p, atLocation, lastMove }) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                      <TableCell className="text-xs">{p.category ?? "—"}</TableCell>
                      <TableCell>
                        <StockBadge product={p} />
                      </TableCell>
                      <TableCell className="text-right">
                        {atLocation === null ? (
                          <span className="text-muted-foreground text-xs">—</span>
                        ) : (
                          <span
                            className={`font-medium ${
                              atLocation > 0
                                ? "text-foreground"
                                : "text-muted-foreground"
                            }`}
                          >
                            {atLocation}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{p.stock ?? 0}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {lastMove ? new Date(lastMove).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {canMovements && (
                              <DropdownMenuItem
                                onClick={() =>
                                  setAction({ product: p, mode: "add" })
                                }
                              >
                                {t("sa.add_title", "Add stock")}
                              </DropdownMenuItem>
                            )}
                            {canMovements && (
                              <DropdownMenuItem
                                onClick={() =>
                                  setAction({ product: p, mode: "remove" })
                                }
                              >
                                {t("sa.remove_title", "Remove stock")}
                              </DropdownMenuItem>
                            )}
                            {canAdjust && (
                              <DropdownMenuItem
                                onClick={() =>
                                  setAction({ product: p, mode: "adjust" })
                                }
                              >
                                {t("sa.adjust_title", "Adjust quantity")}
                              </DropdownMenuItem>
                            )}
                            {canMove && (
                              <DropdownMenuItem
                                onClick={() =>
                                  setAction({ product: p, mode: "move" })
                                }
                              >
                                {t("sa.move_title", "Move product")}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setViewProduct(p)}
                            >
                              {t("sa.view", "View product")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {currentNode && (
            <p className="text-xs text-muted-foreground">
              {t(
                "ls.note",
                "Per-location stock = product's assigned location (initial stock) plus completed transfers in/out.",
              )}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <StockActionDialog
        product={action?.product ?? null}
        mode={action?.mode ?? null}
        contextLocationLabel={contextLabel || undefined}
        onClose={() => setAction(null)}
      />
      <LocationNodeDialog
        open={!!createLevel}
        level={createLevel ?? "location"}
        parentId={currentId}
        parentLabel={contextLabel || null}
        onClose={() => setCreateLevel(null)}
      />
      <ProductDetailsDialog
        product={viewProduct}
        onClose={() => setViewProduct(null)}
      />
    </div>
  );
}
