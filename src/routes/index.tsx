import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { listProducts, listMovements } from "@/lib/inventory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, AlertTriangle, DollarSign, ArrowLeftRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/")({
  component: () => (
    <AppLayout>
      <Dashboard />
    </AppLayout>
  ),
});

function Dashboard() {
  const products = useQuery({ queryKey: ["products"], queryFn: listProducts });
  const movements = useQuery({ queryKey: ["movements"], queryFn: listMovements });

  const total = products.data?.length ?? 0;
  const lowStock = products.data?.filter((p) => p.stock <= p.min_stock) ?? [];
  const inventoryValue =
    products.data?.reduce((sum, p) => sum + Number(p.cost) * p.stock, 0) ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-neutral-500 mt-1">Overview of your inventory</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Stat icon={Package} label="Total Products" value={total.toString()} />
        <Stat
          icon={AlertTriangle}
          label="Low Stock Alerts"
          value={lowStock.length.toString()}
          accent={lowStock.length > 0}
        />
        <Stat
          icon={DollarSign}
          label="Inventory Value"
          value={`$${inventoryValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
        />
      </div>

      <Card className="border-neutral-200 shadow-none">
        <CardHeader className="flex flex-row items-center gap-2">
          <ArrowLeftRight className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Recent Inventory Movements</CardTitle>
        </CardHeader>
        <CardContent>
          {movements.isLoading ? (
            <p className="text-sm text-neutral-500">Loading...</p>
          ) : movements.data && movements.data.length > 0 ? (
            <ul className="divide-y divide-neutral-100">
              {movements.data.slice(0, 8).map((m) => (
                <li key={m.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {m.products?.name ?? "Unknown product"}{" "}
                      <span className="text-neutral-400 font-normal">
                        ({m.products?.sku ?? "—"})
                      </span>
                    </p>
                    <p className="text-xs text-neutral-500">
                      {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                      {m.note ? ` · ${m.note}` : ""}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      m.type === "add"
                        ? "border-primary/30 text-primary bg-primary/5"
                        : m.type === "remove"
                        ? "border-red-200 text-red-600 bg-red-50"
                        : "border-neutral-200 text-neutral-700 bg-neutral-50"
                    }
                  >
                    {m.type === "add" ? "+" : m.type === "remove" ? "-" : "="}
                    {m.quantity}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-500">No movements yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: any;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <Card className="border-neutral-200 shadow-none">
      <CardContent className="p-6">
        <div className="flex items-center gap-3">
          <div
            className={
              accent
                ? "h-10 w-10 rounded-md bg-red-50 flex items-center justify-center"
                : "h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center"
            }
          >
            <Icon className={accent ? "h-5 w-5 text-red-600" : "h-5 w-5 text-primary"} />
          </div>
          <div>
            <p className="text-sm text-neutral-500">{label}</p>
            <p className="text-2xl font-semibold tracking-tight">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
