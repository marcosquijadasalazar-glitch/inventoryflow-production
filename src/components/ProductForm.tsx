import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { upsertProduct, type Product } from "@/lib/inventory";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";

type FieldDef = {
  key: string;
  label: string;
  type?: string;
  full?: boolean;
  placeholder?: string;
  prefix?: string;
};

const sections: { title: string; fields: FieldDef[] }[] = [
  {
    title: "Basic info",
    fields: [
      { key: "name", label: "Product name", full: true, placeholder: "e.g. USB-C Cable 1m" },
      { key: "sku", label: "SKU", placeholder: "SKU-001" },
      { key: "barcode", label: "Barcode", placeholder: "0000000000" },
      { key: "category", label: "Category", placeholder: "Electronics" },
    ],
  },
  {
    title: "Pricing",
    fields: [
      { key: "cost", label: "Cost", type: "number", prefix: "$" },
      { key: "price", label: "Price", type: "number", prefix: "$" },
    ],
  },
  {
    title: "Stock & logistics",
    fields: [
      { key: "stock", label: "Current stock", type: "number" },
      { key: "min_stock", label: "Min stock", type: "number" },
      { key: "location", label: "Location", placeholder: "Aisle A · Bin 12" },
      { key: "supplier", label: "Supplier", placeholder: "Supplier name" },
    ],
  },
];

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-surface p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-5 border-b border-border">
          <DialogTitle className="text-lg">
            {product ? "Edit product" : "Add product"}
          </DialogTitle>
          <DialogDescription>
            {product
              ? "Update the product details below."
              : "Add a new product to your inventory catalog."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col">
          <div className="px-6 py-5 space-y-6 max-h-[60vh] overflow-y-auto">
            {sections.map((section) => (
              <div key={section.title} className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.title}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {section.fields.map((f) => (
                    <div
                      key={f.key}
                      className={f.full ? "sm:col-span-2 space-y-1.5" : "space-y-1.5"}
                    >
                      <Label htmlFor={f.key}>{f.label}</Label>
                      <div className="relative">
                        {f.prefix && (
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            {f.prefix}
                          </span>
                        )}
                        <Input
                          id={f.key}
                          type={f.type ?? "text"}
                          placeholder={f.placeholder}
                          value={(form as any)[f.key] ?? ""}
                          onChange={(e) => set(f.key, e.target.value)}
                          className={f.prefix ? "pl-7" : undefined}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {errorMsg && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span className="whitespace-pre-wrap break-words">{errorMsg}</span>
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border bg-surface-muted/50">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="shadow-soft">
              {saving ? (
                <>
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin" />
                  Saving…
                </>
              ) : product ? (
                "Save changes"
              ) : (
                "Add product"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
