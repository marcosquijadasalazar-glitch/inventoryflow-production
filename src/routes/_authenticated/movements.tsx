import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

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
import { Skeleton } from "@/components/ui/skeleton";
import { listProducts, listMovements, createMovement } from "@/lib/inventory";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Plus,
  Minus,
  Sliders,
  ArrowLeftRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/movements")({
  component: MovementsPage,
});

type MovementType = "add" | "remove" | "adjustment";

const typeOptions: { value: MovementType; label: string; icon: any; desc: string }[] = [
  { value: "add", label: "Add stock", icon: Plus, desc: "Restock or receive" },
  { value: "remove", label: "Remove stock", icon: Minus, desc: "Sale or shrinkage" },
  { value: "adjustment", label: "Adjustment", icon: Sliders, desc: "Set exact stock" },
];

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
        <p className="text-xs font-medium uppercase tracking-wider text-primary mb-1.5">
          Operations
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Inventory Movements</h1>
        <p className="text-muted-foreground mt-1">
          Record stock additions, removals and adjustments.
        </p>
      </div>

      <Card className="border-border shadow-soft overflow-hidden">
        <CardHeader className="border-b border-border bg-surface-muted/50">
          <CardTitle className="text-base">New movement</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={submit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {typeOptions.map((opt) => {
                const Icon = opt.icon;
                const active = type === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setType(opt.value)}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all",
                      active
                        ? "border-primary bg-primary/5 shadow-soft ring-1 ring-primary/20"
                        : "border-border bg-surface hover:border-primary/30 hover:bg-surface-muted/40",
                    )}
                  >
                    <div
                      className={cn(
                        "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label>Product</Label>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger className="bg-surface">
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
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min={0}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="bg-surface"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Reason or reference number"
                className="bg-surface resize-none"
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={saving} className="shadow-soft">
                {saving ? (
                  <>
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <ArrowLeftRight className="h-4 w-4" />
                    Record movement
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">History</CardTitle>
        </CardHeader>
        <CardContent>
          {movements.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-4 py-2">
                  <div className="flex items-center gap-3 flex-1">
                    <Skeleton className="h-9 w-9 rounded-lg" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-1/2" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-14 rounded-full" />
                </div>
              ))}
            </div>
          ) : movements.data && movements.data.length > 0 ? (
            <ul className="divide-y divide-border">
              {movements.data.map((m) => {
                const isAdd = m.type === "add";
                const isRemove = m.type === "remove";
                return (
                  <li
                    key={m.id}
                    className="py-3.5 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={
                          isAdd
                            ? "h-9 w-9 rounded-lg bg-success/10 text-success flex items-center justify-center shrink-0"
                            : isRemove
                              ? "h-9 w-9 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center shrink-0"
                              : "h-9 w-9 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0"
                        }
                      >
                        {isAdd ? (
                          <ArrowUpRight className="h-4 w-4" />
                        ) : isRemove ? (
                          <ArrowDownRight className="h-4 w-4" />
                        ) : (
                          <TrendingUp className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {m.products?.name ?? "Unknown"}
                          <span className="text-muted-foreground font-normal ml-1.5 font-mono text-xs">
                            {m.products?.sku ?? "—"}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(m.created_at), {
                            addSuffix: true,
                          })}
                          {m.note ? ` · ${m.note}` : ""}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        isAdd
                          ? "border-success/25 bg-success/10 text-[oklch(0.4_0.12_155)] font-mono"
                          : isRemove
                            ? "border-destructive/25 bg-destructive/10 text-destructive font-mono"
                            : "border-border bg-muted text-muted-foreground font-mono"
                      }
                    >
                      {isAdd ? "+" : isRemove ? "−" : "="}
                      {m.quantity}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center text-center py-12">
              <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <ArrowLeftRight className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-medium">No movements yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Record your first movement using the form above.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
