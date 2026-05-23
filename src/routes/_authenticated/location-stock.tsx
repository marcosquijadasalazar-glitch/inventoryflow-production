import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listLocations } from "@/lib/locations";
import { listProducts } from "@/lib/inventory";
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
import { ArrowLeft, MapPin, Search } from "lucide-react";

const sb = supabase as any;

export const Route = createFileRoute("/_authenticated/location-stock")({
  component: LocationStockPage,
});

function LocationStockPage() {
  const { t } = useTranslation();
  const [locId, setLocId] = useState<string>("");
  const [search, setSearch] = useState("");

  const locations = useQuery({
    queryKey: ["locations"],
    queryFn: () => listLocations(),
  });
  const products = useQuery({
    queryKey: ["products"],
    queryFn: listProducts,
  });

  // Per-location stock derived from completed transfers (in − out).
  // total product stock comes from products.stock.
  const perLoc = useQuery({
    queryKey: ["location_stock"],
    queryFn: async () => {
      const { data: transfers, error: tErr } = await sb
        .from("transfer_orders")
        .select("id, from_location_id, to_location_id, status")
        .eq("status", "completed");
      if (tErr) throw tErr;
      const ids = (transfers ?? []).map((t: any) => t.id);
      if (ids.length === 0) return {} as Record<string, Record<string, number>>;
      const { data: items, error: iErr } = await sb
        .from("transfer_order_items")
        .select("transfer_order_id, product_id, quantity")
        .in("transfer_order_id", ids);
      if (iErr) throw iErr;
      const tMap = new Map<string, any>(
        (transfers ?? []).map((t: any) => [t.id, t]),
      );
      const map: Record<string, Record<string, number>> = {};
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
      return map;
    },
  });

  const lastMoves = useQuery({
    queryKey: ["last_movements_by_product"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("inventory_movements")
        .select("product_id, created_at")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      const map = new Map<string, string>();
      for (const m of data ?? []) {
        if (!map.has(m.product_id)) map.set(m.product_id, m.created_at);
      }
      return map;
    },
  });

  const rows = useMemo(() => {
    const list = products.data ?? [];
    const stockMap = locId ? perLoc.data?.[locId] ?? {} : null;
    const q = search.trim().toLowerCase();
    return list
      .filter((p) => {
        if (!q) return true;
        return (
          p.name?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q)
        );
      })
      .map((p) => ({
        p,
        atLocation: stockMap ? stockMap[p.id] ?? 0 : null,
        lastMove: lastMoves.data?.get(p.id) ?? null,
      }));
  }, [products.data, perLoc.data, lastMoves.data, locId, search]);

  const selectedLoc = locations.data?.find((l) => l.id === locId);

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
              "ls.subtitle",
              "View stock by location, derived from completed transfers.",
            )}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/transfer-orders">
            <ArrowLeft className="h-4 w-4" /> {t("ls.back_to_transfers", "Back to Transfers")}
          </Link>
        </Button>
      </div>

      <Card className="border-border shadow-soft">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            {selectedLoc?.name ?? t("ls.pick", "Pick a location")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-[260px_1fr] gap-3">
            <div className="space-y-1.5">
              <Label>{t("loc.select", "Select location")}</Label>
              <Select value={locId} onValueChange={setLocId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("loc.select", "Select location")} />
                </SelectTrigger>
                <SelectContent>
                  {(locations.data ?? []).map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                      <span className="text-muted-foreground text-xs ml-2">
                        · {t(`loc.types.${l.type}`, l.type)}
                      </span>
                    </SelectItem>
                  ))}
                  {(locations.data ?? []).length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      {t("loc.empty_short", "No locations yet")}
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("common.search")}</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("ls.search_ph", "Search by name, SKU, barcode, category")}
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("po.product", "Product")}</TableHead>
                  <TableHead>{t("products.sku", "SKU")}</TableHead>
                  <TableHead>{t("products.barcode", "Barcode")}</TableHead>
                  <TableHead>{t("products.category", "Category")}</TableHead>
                  <TableHead className="text-right">
                    {t("ls.at_location", "At location")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("ls.total_stock", "Total stock")}
                  </TableHead>
                  <TableHead>{t("ls.last_move", "Last movement")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-sm text-muted-foreground">
                      {t("common.loading")}
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {t("common.noResults")}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map(({ p, atLocation, lastMove }) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.name}</TableCell>
                      <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                      <TableCell className="font-mono text-xs">{p.barcode ?? "—"}</TableCell>
                      <TableCell className="text-xs">{p.category ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {atLocation === null ? (
                          <span className="text-muted-foreground text-xs">
                            {t("ls.pick_first", "Pick a location")}
                          </span>
                        ) : (
                          <Badge
                            variant="outline"
                            className={
                              atLocation > 0
                                ? "bg-success/10 text-[oklch(0.4_0.12_155)]"
                                : atLocation < 0
                                  ? "bg-destructive/10 text-destructive"
                                  : "bg-muted text-muted-foreground"
                            }
                          >
                            {atLocation}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{p.stock ?? 0}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {lastMove ? new Date(lastMove).toLocaleString() : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {locId && (
            <p className="text-xs text-muted-foreground">
              {t(
                "ls.note",
                "Per-location stock is derived from completed transfer orders (incoming − outgoing).",
              )}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
