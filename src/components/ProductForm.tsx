import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { upsertProduct, type Product } from "@/lib/inventory";
import { toast } from "sonner";

export function ProductForm({
  open,
  onOpenChange,
  product,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product?: Product | null;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: product?.name ?? "",
    sku: product?.sku ?? "",
    barcode: product?.barcode ?? "",
    category: product?.category ?? "",
    cost: product?.cost ?? 0,
    price: product?.price ?? 0,
    stock: product?.stock ?? 0,
    min_stock: product?.min_stock ?? 0,
    location: product?.location ?? "",
    supplier: product?.supplier ?? "",
  });

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!form.name.trim() || !form.sku.trim()) {
      toast.error("Name and SKU are required");
      return;
    }
    setSaving(true);
    try {
      const result = await upsertProduct({
        id: product?.id,
        ...form,
        cost: Number(form.cost),
        price: Number(form.price),
        stock: Number(form.stock),
        min_stock: Number(form.min_stock),
        barcode: form.barcode || null,
        category: form.category || null,
        location: form.location || null,
        supplier: form.supplier || null,
      });
      console.log("[ProductForm] saved product:", result);
      toast.success(product ? "Product updated" : "Product added");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      console.error("[ProductForm] save failed:", e);
      const msg =
        [e?.message, e?.details, e?.hint, e?.code ? `(code: ${e.code})` : null]
          .filter(Boolean)
          .join(" — ") || "Failed to save";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const fields: [string, string, string?][] = [
    ["name", "Name"],
    ["sku", "SKU"],
    ["barcode", "Barcode"],
    ["category", "Category"],
    ["cost", "Cost", "number"],
    ["price", "Price", "number"],
    ["stock", "Stock", "number"],
    ["min_stock", "Min Stock", "number"],
    ["location", "Location"],
    ["supplier", "Supplier"],
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white">
        <DialogHeader>
          <DialogTitle>{product ? "Edit product" : "Add product"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map(([key, label, type]) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={key}>{label}</Label>
              <Input
                id={key}
                type={type ?? "text"}
                value={(form as any)[key] ?? ""}
                onChange={(e) =>
                  set(key, type === "number" ? e.target.value : e.target.value)
                }
              />
            </div>
          ))}
          {errorMsg && (
            <div className="sm:col-span-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 whitespace-pre-wrap break-words">
              {errorMsg}
            </div>
          )}
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
