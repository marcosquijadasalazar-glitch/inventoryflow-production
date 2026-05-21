import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Search, Package } from "lucide-react";
import { deleteProduct, listProducts, type Product } from "@/lib/inventory";
import { ProductForm } from "@/components/ProductForm";
import { StockBadge, StockHealthBar } from "@/components/StockBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
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

export const Route = createFileRoute("/_authenticated/products")({
  component: ProductsPage,
});

function ProductsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["products"], queryFn: listProducts });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["products"] });

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.category ?? "").toLowerCase().includes(q) ||
        (p.supplier ?? "").toLowerCase().includes(q),
    );
  }, [data, query]);

  const onDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteProduct(deleteId);
      toast.success("Product deleted");
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-primary mb-1.5">
            Catalog
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Products</h1>
          <p className="text-muted-foreground mt-1">
            Manage SKUs, stock levels and supplier details.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className="shadow-soft"
        >
          <Plus className="h-4 w-4" /> Add Product
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products, SKUs, suppliers…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 bg-surface"
          />
        </div>
        {data && (
          <span className="text-xs text-muted-foreground">
            {filtered.length} of {data.length}
          </span>
        )}
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-surface shadow-soft">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-muted hover:bg-surface-muted border-border">
                <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground h-11">
                  Product
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                  Category
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                  Stock
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                  Status
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                  Location
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                  Supplier
                </TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-border">
                    {Array.from({ length: 7 }).map((_, j) => (
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
                    className="border-border hover:bg-surface-muted/50 transition-colors group"
                  >
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
                    <TableCell className="text-sm text-muted-foreground">
                      {p.category ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1.5 min-w-[100px]">
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-semibold text-sm tabular-nums">
                            {p.stock}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            / {p.min_stock} min
                          </span>
                        </div>
                        <StockHealthBar stock={p.stock} min={p.min_stock} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <StockBadge product={p} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.location ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.supplier ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditing(p);
                            setOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setDeleteId(p.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="py-16">
                    <div className="flex flex-col items-center text-center">
                      <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                        <Package className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="font-medium">
                        {query ? "No matching products" : "No products yet"}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                        {query
                          ? "Try a different search term or clear the filter."
                          : "Add your first product to start tracking inventory."}
                      </p>
                      {!query && (
                        <Button
                          className="mt-4"
                          onClick={() => {
                            setEditing(null);
                            setOpen(true);
                          }}
                        >
                          <Plus className="h-4 w-4" /> Add Product
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

      {open && (
        <ProductForm
          open={open}
          onOpenChange={setOpen}
          product={editing}
          onSaved={refresh}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="bg-surface">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this product?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All inventory movements for this product will
              also be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
