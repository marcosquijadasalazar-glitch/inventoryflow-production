import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Warehouse, MapPin, Boxes, AlertTriangle, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listLocationsAll } from "@/lib/locations.functions";
import { listProducts } from "@/lib/inventory";

function Kpi({ label, value, icon: Icon, loading }: { label: string; value: string | number; icon: any; loading?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          {loading ? <Skeleton className="h-6 w-16 mt-1" /> : <div className="text-xl font-semibold">{value}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

export function OverviewTab({ onGoTo }: { onGoTo: (tab: string) => void }) {
  const navigate = useNavigate();
  const fetchLocations = useServerFn(listLocationsAll);
  const locQ = useQuery({ queryKey: ["locations-all"], queryFn: () => fetchLocations({}) });
  const prodQ = useQuery({ queryKey: ["products-for-locations-overview"], queryFn: () => listProducts() });

  const locations: any[] = locQ.data?.locations ?? [];
  const warehouses = locations.filter((l) => (l.type ?? "").toLowerCase() === "warehouse").length;
  const totalLocations = locations.length;
  const products: any[] = (prodQ.data as any) ?? [];
  const totalUnits = products.reduce((s, p) => s + (Number(p.stock) || 0), 0);

  // Low stock locations: count locations whose products include any low/out
  const locProducts = new Map<string, any[]>();
  for (const p of products) {
    const key = p.location_id ?? p.location ?? "_";
    if (!locProducts.has(key)) locProducts.set(key, []);
    locProducts.get(key)!.push(p);
  }
  let lowStockLocations = 0;
  for (const [, items] of locProducts) {
    if (items.some((p) => Number(p.stock) <= Number(p.min_stock ?? 0))) lowStockLocations++;
  }

  const loading = locQ.isLoading || prodQ.isLoading;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Total Warehouses" value={warehouses} icon={Warehouse} loading={loading} />
        <Kpi label="Total Locations" value={totalLocations} icon={MapPin} loading={loading} />
        <Kpi label="Total Inventory Units" value={totalUnits.toLocaleString()} icon={Boxes} loading={loading} />
        <Kpi label="Low Stock Locations" value={lowStockLocations} icon={AlertTriangle} loading={loading} />
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Quick actions</div>
            <div className="text-xs text-muted-foreground">Create warehouses or storage locations.</div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => onGoTo("hierarchy")}>
              <Plus className="h-4 w-4 mr-1" /> New Warehouse
            </Button>
            <Button size="sm" onClick={() => onGoTo("hierarchy")}>
              <Plus className="h-4 w-4 mr-1" /> New Location
            </Button>
            <Button size="sm" variant="ghost" onClick={() => navigate({ to: "/locations", search: (p: any) => ({ ...p, tab: "stock" }) })}>
              View Stock by Location
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
