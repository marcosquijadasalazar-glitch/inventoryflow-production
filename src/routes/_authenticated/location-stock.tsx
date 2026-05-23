import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { listProducts } from "@/lib/inventory";
import { listLocations } from "@/lib/locations";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, FileDown } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/location-stock")({
  component: LocationStockPage,
});

type LastMovementRow = {
  product_id: string;
  created_at: string;
};

async function fetchLastMovements(): Promise<Record<string, string>> {
  const { data, error } = await (supabase as any)
    .from("inventory_movements")
    .select("product_id, created_at")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const r of (data ?? []) as LastMovementRow[]) {
    if (!map[r.product_id]) map[r.product_id] = r.created_at;
  }
  return map;
}

function LocationStockPage() {
  const { t, i18n } = useTranslation();
  const products = useQuery({ queryKey: ["products"], queryFn: listProducts });
  const locations = useQuery({
    queryKey: ["locations"],
    queryFn: () => listLocations({ includeInactive: true }),
  });
  const lastMoves = useQuery({
    queryKey: ["last_movements"],
    queryFn: fetchLastMovements,
  });

  const grouped = useMemo(() => {
    const groups = new Map<string, typeof products.data>();
    for (const p of products.data ?? []) {
      const key = (p.location ?? "").trim() || t("loc.unassigned", "Unassigned");
      if (!groups.has(key)) groups.set(key, [] as any);
      (groups.get(key) as any).push(p);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [products.data, t]);

  const fmtDate = (d: string | undefined) =>
    d ? new Date(d).toLocaleString(i18n.language) : "—";

  const exportCsv = () => {
    try {
      const rows: string[][] = [
        [
          t("loc.name", "Location"),
          t("po.product", "Product"),
          "SKU",
          t("p.barcode", "Barcode"),
          t("loc.available", "Available"),
          t("loc.last_movement", "Last movement"),
        ],
      ];
      for (const [loc, items] of grouped) {
        for (const p of items ?? []) {
          rows.push([
            loc,
            p.name,
            p.sku ?? "",
            p.barcode ?? "",
            String(p.stock ?? 0),
            fmtDate(lastMoves.data?.[p.id]),
          ]);
        }
      }
      const csv = rows
        .map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(","))
        .join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `location-stock-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e.message ?? String(e));
    }
  };

  const locTypeByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of locations.data ?? []) m.set(l.name, l.type);
    return m;
  }, [locations.data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-primary mb-1.5">
            {t("tr.section", "Logistics")}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {t("locstock.title", "Stock by Location")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t(
              "locstock.subtitle",
              "Available stock grouped by product location.",
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/transfer-orders">
              <ArrowLeft className="h-4 w-4" />{" "}
              {t("locstock.back", "Back to Transfers")}
            </Link>
          </Button>
          <Button variant="outline" onClick={exportCsv}>
            <FileDown className="h-4 w-4" /> {t("common.exportCsv", "Export CSV")}
          </Button>
        </div>
      </div>

      {products.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : grouped.length === 0 ? (
        <Card className="border-border shadow-soft">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {t("locstock.empty", "No products yet.")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(([loc, items]) => {
            const type = locTypeByName.get(loc);
            const totalUnits = (items ?? []).reduce(
              (s, p) => s + (p.stock ?? 0),
              0,
            );
            return (
              <Card key={loc} className="border-border shadow-soft">
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      {loc}
                      {type && (
                        <Badge variant="outline" className="text-xs ml-1">
                          {t(`loc.types.${type}`, type)}
                        </Badge>
                      )}
                    </span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {(items ?? []).length}{" "}
                      {t("locstock.products", "products")} ·{" "}
                      {totalUnits} {t("locstock.units", "units")}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("po.product", "Product")}</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>{t("p.barcode", "Barcode")}</TableHead>
                          <TableHead className="text-right">
                            {t("loc.available", "Available")}
                          </TableHead>
                          <TableHead>
                            {t("loc.last_movement", "Last movement")}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(items ?? []).map((p) => (
                          <TableRow key={p.id}>
                            <TableCell>{p.name}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {p.sku ?? "—"}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {p.barcode ?? "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              {p.stock ?? 0}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {fmtDate(lastMoves.data?.[p.id])}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
