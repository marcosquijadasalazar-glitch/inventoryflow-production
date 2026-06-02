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
import { LocationSelect } from "@/components/LocationSelect";
import {
  useProductLocationStock,
  validateLocationQuantity,
} from "@/lib/product-location-stock";
import {
  LocationAvailabilityHint,
  LocationStockValidationAlert,
} from "@/components/LocationAvailabilityHint";
import { invalidateInventoryCaches } from "@/lib/invalidate-after-write";

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
  const stockQ = useProductLocationStock();
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const [locationId, setLocationId] = useState<string | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  if (!product) return null;

  const qNum = parseInt(qty, 10) || 0;
  const stockValidation = validateLocationQuantity({
    movementType: type,
    quantity: qNum,
    productId: product.id,
    locationId,
    locationName,
    stockData: stockQ.data,
    requireLocation: type === "remove",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = parseInt(qty, 10);
    if (isNaN(q) || q <= 0) return toast.error("Please enter a valid quantity.");
    if (stockValidation.blocked) {
      return toast.error(stockValidation.message?.split("\n")[0] ?? "Invalid quantity");
    }
    setSaving(true);
    try {
      await createMovement({
        product_id: product.id,
        type,
        quantity: q,
        note: note || null,
        ...(locationId ? { location_id: locationId } : {}),
      });
      toast.success(
        type === "add"
          ? `Added ${q} ${q === 1 ? "unit" : "units"} to ${product.name}.`
          : `Removed ${q} ${q === 1 ? "unit" : "units"} from ${product.name}.`,
      );
      invalidateInventoryCaches(qc);
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
            <span className="font-mono text-xs">({product.sku})</span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Location</Label>
            <LocationSelect
              value={locationId}
              onChange={(id, loc) => {
                setLocationId(id);
                setLocationName(loc?.name ?? null);
              }}
              productId={product.id}
              stockData={stockQ.data}
              requireDirectStock={type === "remove"}
            />
            <LocationAvailabilityHint
              productId={product.id}
              locationId={locationId}
              stockData={stockQ.data}
            />
          </div>
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
          <LocationStockValidationAlert message={stockValidation.message} />
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
            <Button type="submit" disabled={saving || stockValidation.blocked}>
              {saving ? "Saving…" : type === "add" ? "Add stock" : "Remove stock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
