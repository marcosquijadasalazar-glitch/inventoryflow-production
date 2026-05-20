import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listProducts } from "@/lib/inventory";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/alerts")({
  component: () => (
    <AppLayout>
      <AlertsPage />
    </AppLayout>
  ),
});

function AlertsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["products"], queryFn: listProducts });
  const low = data?.filter((p) => p.stock <= p.min_stock) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Low Stock Alerts</h1>
        <p className="text-neutral-500 mt-1">
          Products at or below their minimum stock level
        </p>
      </div>

      <div className="border border-neutral-200 rounded-lg overflow-x-auto bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Min Stock</TableHead>
              <TableHead>Supplier</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-neutral-500 py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : low.length > 0 ? (
              low.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    {p.name}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-neutral-600">{p.sku}</TableCell>
                  <TableCell>{p.category ?? "—"}</TableCell>
                  <TableCell className="text-right text-red-600 font-medium">{p.stock}</TableCell>
                  <TableCell className="text-right">{p.min_stock}</TableCell>
                  <TableCell>{p.supplier ?? "—"}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-neutral-500 py-8">
                  All products are above their minimum stock levels.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
