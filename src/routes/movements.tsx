import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
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
import { listProducts, listMovements, createMovement } from "@/lib/inventory";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/movements")({
  component: () => (
    <AppLayout>
      <MovementsPage />
    </AppLayout>
  ),
});

type MovementType = "add" | "remove" | "adjustment";

function MovementsPage() {
  const qc = useQueryClient();
  const products = useQuery({ queryKey: ["products"], queryFn: listProducts });
  const movements = useQuery({ queryKey: ["movements"], queryFn: listMovements });

  const [productId, setProductId] = useState<string>("");
  const [type, setType] = useState<MovementType>("add");
  const [quantity, setQuantity] = useState<string>("1");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId) return toast.error("Select a product");
    const q = parseInt(quantity, 10);
    if (isNaN(q) || q < 0) return toast.error("Enter a valid quantity");
    setSaving(true);
    try {
      await createMovement({
        product_id: productId,
        type,
        quantity: q,
        note: note || null,
      });
      toast.success("Movement recorded");
      setQuantity("1");
      setNote("");
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Inventory Movements</h1>
        <p className="text-neutral-500 mt-1">Add, remove, or adjust stock</p>
      </div>

      <Card className="border-neutral-200 shadow-none">
        <CardHeader>
          <CardTitle className="text-base">New movement</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Product</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.data?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.sku}) · {p.stock} in stock
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as MovementType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Add Stock</SelectItem>
                  <SelectItem value="remove">Remove Stock</SelectItem>
                  <SelectItem value="adjustment">Adjustment (set to)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Quantity</Label>
              <Input
                type="number"
                min={0}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 md:col-span-3">
              <Label>Note (optional)</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Reason or reference"
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Record movement"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-neutral-200 shadow-none">
        <CardHeader>
          <CardTitle className="text-base">History</CardTitle>
        </CardHeader>
        <CardContent>
          {movements.isLoading ? (
            <p className="text-sm text-neutral-500">Loading...</p>
          ) : movements.data && movements.data.length > 0 ? (
            <ul className="divide-y divide-neutral-100">
              {movements.data.map((m) => (
                <li key={m.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {m.products?.name ?? "Unknown"}{" "}
                      <span className="text-neutral-400 font-normal">({m.products?.sku})</span>
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
