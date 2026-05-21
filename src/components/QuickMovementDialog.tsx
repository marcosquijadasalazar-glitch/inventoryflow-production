import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createMovement, type Product } from "@/lib/inventory";
import { toast } from "sonner";
import { Plus, Minus } from "lucide-react";

export function QuickMovementDialog({
  product,
  type,
  onClose,
}: {
  product: Product | null;
  type: "add" | "remove";
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  if (!product) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = parseInt(qty, 10);
    if (isNaN(q) || q <= 0) return toast.error("Enter a valid quantity");
    setSaving(true);
    try {
      await createMovement({
        product_id: product.id,
        type,
        quantity: q,
        note: note || null,
      });
      toast.success(type === "add" ? "Stock added" : "Stock removed");
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const Icon = type === "add" ? Plus : Minus;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-surface max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            {type === "add" ? "Add stock" : "Remove stock"}
          </DialogTitle>
          <DialogDescription>
            {product.name}{" "}
            <span className="font-mono text-xs">({product.sku})</span> · current
            stock: {product.stock}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Quantity</Label>
            <Input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Reason or reference"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : type === "add" ? "Add stock" : "Remove stock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
