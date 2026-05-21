import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { upsertProduct, type Product } from "@/lib/inventory";
import { PRODUCT_CATEGORIES } from "@/lib/categories";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { ScanFieldButton } from "@/components/ScanFieldButton";

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
      await upsertProduct({
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
      toast.success(product ? "Product updated" : "Product added");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
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
            <Section title="Basic info">
              <Field label="Product name" full>
                <Input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="e.g. USB-C Cable 1m"
                />
              </Field>
              <Field label="SKU">
                <Input
                  value={form.sku}
                  onChange={(e) => set("sku", e.target.value)}
                  placeholder="SKU-001"
                />
              </Field>
              <Field label="Barcode">
                <div className="flex gap-2">
                  <Input
                    value={form.barcode ?? ""}
                    onChange={(e) => set("barcode", e.target.value)}
                    placeholder="0000000000"
                  />
                  <ScanFieldButton onScan={(code) => set("barcode", code)} />
                </div>
              </Field>
              <Field label="Category" full>
                <Select
                  value={form.category || ""}
                  onValueChange={(v) => set("category", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </Section>

            <Section title="Pricing">
              <Field label="Cost">
                <PrefixedInput
                  prefix="$"
                  type="number"
                  value={form.cost}
                  onChange={(v) => set("cost", v)}
                />
              </Field>
              <Field label="Price">
                <PrefixedInput
                  prefix="$"
                  type="number"
                  value={form.price}
                  onChange={(v) => set("price", v)}
                />
              </Field>
            </Section>

            <Section title="Stock & logistics">
              <Field label="Current stock">
                <Input
                  type="number"
                  value={form.stock}
                  onChange={(e) => set("stock", e.target.value)}
                />
              </Field>
              <Field label="Min stock">
                <Input
                  type="number"
                  value={form.min_stock}
                  onChange={(e) => set("min_stock", e.target.value)}
                />
              </Field>
              <Field label="Location">
                <Input
                  value={form.location ?? ""}
                  onChange={(e) => set("location", e.target.value)}
                  placeholder="Aisle A · Bin 12"
                />
              </Field>
              <Field label="Supplier">
                <Input
                  value={form.supplier ?? ""}
                  onChange={(e) => set("supplier", e.target.value)}
                  placeholder="Supplier name"
                />
              </Field>
            </Section>

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
              {saving ? "Saving…" : product ? "Save changes" : "Add product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2 space-y-1.5" : "space-y-1.5"}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function PrefixedInput({
  prefix,
  value,
  onChange,
  type,
}: {
  prefix: string;
  value: any;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        {prefix}
      </span>
      <Input
        type={type ?? "text"}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="pl-7"
      />
    </div>
  );
}
