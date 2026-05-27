import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { upsertProduct, createMovement, type Product } from "@/lib/inventory";
import {
  listActiveCategoryNames,
  createProductCategory,
} from "@/lib/categories";
import { toast } from "sonner";
import { AlertCircle, Check, Plus, MapPin } from "lucide-react";
import { ScanFieldButton } from "@/components/ScanFieldButton";
import { useUpgradeModal } from "@/components/UpgradeDialog";
import { HierarchicalLocationPicker } from "./HierarchicalLocationPicker";
import type { LocationNode } from "@/lib/location-tree";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const NEW_CATEGORY_VALUE = "__new__";
const sb = supabase as any;

type Step = 1 | 2 | 3;

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
  const { t } = useTranslation();
  const qc = useQueryClient();
  const upgrade = useUpgradeModal();
  const isEdit = !!product;

  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [showNewCategory, setShowNewCategory] = useState(false);

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
    description: "",
    unit: "unit",
  });
  const [binId, setBinId] = useState<string | null>(product?.bin_id ?? null);
  const [binPath, setBinPath] = useState<LocationNode[]>([]);
  const [unassigned, setUnassigned] = useState<boolean>(
    isEdit && !product?.bin_id,
  );

  const { data: categories = [] } = useQuery({
    queryKey: ["product-categories"],
    queryFn: listActiveCategoryNames,
  });

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const handleCategoryChange = (v: string) => {
    if (v === NEW_CATEGORY_VALUE) {
      setShowNewCategory(true);
      return;
    }
    setShowNewCategory(false);
    set("category", v);
  };

  const submitNewCategory = async () => {
    const name = newCategory.trim();
    if (!name) return toast.error(t("categories.nameRequired"));
    setCreatingCategory(true);
    try {
      const created = await createProductCategory(name);
      await qc.invalidateQueries({ queryKey: ["product-categories"] });
      set("category", created.name);
      setNewCategory("");
      setShowNewCategory(false);
      toast.success(t("categories.created"));
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setCreatingCategory(false);
    }
  };

  const canNextFromStep1 = form.name.trim() && form.sku.trim();
  const canNextFromStep2 =
    Number.isFinite(Number(form.stock)) && Number(form.stock) >= 0;

  const next = () => {
    setErrorMsg(null);
    if (step === 1 && !canNextFromStep1) {
      return toast.error(t("pf.need_name_sku", "Name and SKU are required"));
    }
    if (step === 2 && !canNextFromStep2) {
      return toast.error(t("pf.invalid_stock", "Enter a valid quantity"));
    }
    setStep((s) => (s < 3 ? ((s + 1) as Step) : s));
  };

  const back = () => {
    setErrorMsg(null);
    setStep((s) => (s > 1 ? ((s - 1) as Step) : s));
  };

  const locationLabel = useMemo(() => {
    if (binPath.length) return binPath.map((n) => n.code || n.name).join(" / ");
    return form.location || "";
  }, [binPath, form.location]);

  const submit = async () => {
    setErrorMsg(null);
    if (!form.name.trim() || !form.sku.trim()) {
      return toast.error(t("pf.need_name_sku", "Name and SKU are required"));
    }
    if (!isEdit && !binId && !unassigned) {
      return toast.error(
        t(
          "pf.need_storage",
          "Assign storage or choose Unassigned inventory",
        ),
      );
    }
    setSaving(true);
    try {
      const startingQty = Number(form.stock) || 0;
      // For NEW products we insert with stock=0 and let an initial movement
      // build the count so the audit trail captures it. For edits keep the
      // direct upsert behaviour.
      const baseStockOnInsert = isEdit ? startingQty : 0;

      // Derive a friendly location label so existing filters keep working.
      const topLocationName = binPath[0]?.name ?? form.location ?? null;

      const saved = await upsertProduct({
        id: product?.id,
        name: form.name,
        sku: form.sku,
        barcode: form.barcode || null,
        category: form.category || null,
        cost: Number(form.cost),
        price: Number(form.price),
        stock: baseStockOnInsert,
        min_stock: Number(form.min_stock),
        location: unassigned ? null : topLocationName,
        supplier: form.supplier || null,
        bin_id: unassigned ? null : binId,
      } as any);

      const newId = product?.id ?? (saved as any)?.[0]?.id;

      // On create + starting qty > 0, log an initial movement.
      if (!isEdit && newId && startingQty > 0) {
        try {
          await createMovement({
            product_id: newId,
            type: "add",
            quantity: startingQty,
            note: binId
              ? `[initial] Stocked at ${locationLabel || "selected bin"}`
              : "[initial] Initial stock",
          });
        } catch (mErr) {
          console.error("[product-create] initial movement failed", mErr);
        }
      }

      // Audit log entry (best-effort).
      try {
        const { data: u } = await supabase.auth.getUser();
        await sb.from("admin_audit_log").insert({
          action_type: isEdit ? "product_updated" : "product_created",
          target_type: "product",
          target_id: newId ?? product?.id ?? "00000000-0000-0000-0000-000000000000",
          target_label: form.name,
          performed_by: u.user?.id ?? null,
          performed_by_email: u.user?.email ?? null,
          metadata: {
            sku: form.sku,
            bin_id: unassigned ? null : binId,
            location_path: binPath.map((n) => n.name),
            starting_qty: startingQty,
          },
        });
      } catch {
        /* audit best-effort */
      }

      toast.success(
        isEdit
          ? t("pf.updated", "Product updated")
          : t("pf.created", "Product added"),
      );
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      const planKind = (await import("@/lib/plan-limits")).parsePlanLimitError(e);
      if (planKind) {
        onOpenChange(false);
        upgrade.open({ reason: planKind });
      } else {
        const msg =
          [e?.message, e?.details, e?.hint, e?.code ? `(code: ${e.code})` : null]
            .filter(Boolean)
            .join(" — ") || "Failed to save";
        setErrorMsg(msg);
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-surface p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-5 border-b border-border">
          <DialogTitle className="text-lg">
            {isEdit
              ? t("pf.edit_title", "Edit product")
              : t("pf.add_title", "Add product")}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? t("pf.edit_desc", "Update the product details below.")
              : t(
                  "pf.add_desc",
                  "Set up the product, its inventory, and warehouse placement.",
                )}
          </DialogDescription>
          <Stepper step={step} />
        </DialogHeader>

        <div className="px-6 py-5 space-y-6 max-h-[60vh] overflow-y-auto">
          {step === 1 && (
            <Section title={t("pf.s1", "Product information")}>
              <Field label={t("pf.f.name", "Product name")} full>
                <Input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="e.g. USB-C Cable 1m"
                  autoFocus
                />
              </Field>
              <Field label={t("pf.f.sku", "SKU")}>
                <Input
                  value={form.sku}
                  onChange={(e) => set("sku", e.target.value)}
                  placeholder="SKU-001"
                />
              </Field>
              <Field label={t("pf.f.barcode", "Barcode")}>
                <div className="flex gap-2">
                  <Input
                    value={form.barcode ?? ""}
                    onChange={(e) => set("barcode", e.target.value)}
                    placeholder="0000000000"
                  />
                  <ScanFieldButton onScan={(code) => set("barcode", code)} />
                </div>
              </Field>
              <Field label={t("products.category", "Category")}>
                <Select
                  value={form.category || ""}
                  onValueChange={handleCategoryChange}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t("categories.selectPlaceholder")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c: string) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                    <SelectItem value={NEW_CATEGORY_VALUE}>
                      + {t("categories.createNew")}
                    </SelectItem>
                  </SelectContent>
                </Select>
                {showNewCategory && (
                  <div className="flex gap-2 mt-2">
                    <Input
                      autoFocus
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      placeholder={t("categories.newPlaceholder")}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          submitNewCategory();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={submitNewCategory}
                      disabled={creatingCategory}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      {creatingCategory ? t("common.loading") : t("common.add")}
                    </Button>
                  </div>
                )}
              </Field>
              <Field label={t("pf.f.unit", "Unit")}>
                <Select value={form.unit} onValueChange={(v) => set("unit", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unit">
                      {t("pf.units.unit", "Unit")}
                    </SelectItem>
                    <SelectItem value="box">
                      {t("pf.units.box", "Box")}
                    </SelectItem>
                    <SelectItem value="case">
                      {t("pf.units.case", "Case")}
                    </SelectItem>
                    <SelectItem value="kg">
                      {t("pf.units.kg", "Kilogram")}
                    </SelectItem>
                    <SelectItem value="l">
                      {t("pf.units.l", "Liter")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("pf.f.supplier", "Supplier (optional)")}>
                <Input
                  value={form.supplier ?? ""}
                  onChange={(e) => set("supplier", e.target.value)}
                  placeholder="Supplier name"
                />
              </Field>
              <Field label={t("pf.f.description", "Description")} full>
                <Textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder={t(
                    "pf.f.description_ph",
                    "Short notes about the product",
                  )}
                />
              </Field>
            </Section>
          )}

          {step === 2 && (
            <Section title={t("pf.s2", "Inventory setup")}>
              <Field label={t("pf.f.starting_qty", "Starting quantity")}>
                <Input
                  type="number"
                  min={0}
                  value={form.stock}
                  onChange={(e) => set("stock", e.target.value)}
                />
              </Field>
              <Field label={t("pf.f.min_stock", "Minimum stock")}>
                <Input
                  type="number"
                  min={0}
                  value={form.min_stock}
                  onChange={(e) => set("min_stock", e.target.value)}
                />
              </Field>
              <Field label={t("pf.f.cost", "Cost (optional)")}>
                <PrefixedInput
                  prefix="$"
                  type="number"
                  value={form.cost}
                  onChange={(v) => set("cost", v)}
                />
              </Field>
              <Field label={t("pf.f.price", "Sale price (optional)")}>
                <PrefixedInput
                  prefix="$"
                  type="number"
                  value={form.price}
                  onChange={(v) => set("price", v)}
                />
              </Field>
            </Section>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("pf.s3", "Storage assignment")}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t(
                    "pf.s3_desc",
                    "Pick where this product lives in your warehouse hierarchy.",
                  )}
                </p>
              </div>

              <div
                className={cn(
                  "rounded-lg border p-4 transition-opacity",
                  unassigned && "opacity-50 pointer-events-none",
                )}
              >
                <HierarchicalLocationPicker
                  value={binId}
                  onChange={(id, info) => {
                    setBinId(id);
                    setBinPath(info.path);
                  }}
                />
                {locationLabel && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    <span className="font-medium text-foreground">
                      {locationLabel}
                    </span>
                  </div>
                )}
              </div>

              <label className="flex items-start gap-3 rounded-lg border border-dashed border-border p-3 cursor-pointer hover:bg-surface-muted/40">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={unassigned}
                  onChange={(e) => {
                    setUnassigned(e.target.checked);
                    if (e.target.checked) {
                      setBinId(null);
                      setBinPath([]);
                    }
                  }}
                />
                <div className="text-sm">
                  <p className="font-medium">
                    {t("pf.unassigned", "Unassigned inventory")}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {t(
                      "pf.unassigned_desc",
                      "Save without a storage location. You can assign it later from the product page.",
                    )}
                  </p>
                </div>
              </label>
            </div>
          )}

          {errorMsg && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span className="whitespace-pre-wrap break-words">{errorMsg}</span>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border bg-surface-muted/50 flex sm:justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t("common.cancel", "Cancel")}
          </Button>
          <div className="flex gap-2">
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={back}
                disabled={saving}
              >
                {t("common.back", "Back")}
              </Button>
            )}
            {step < 3 ? (
              <Button type="button" onClick={next} className="shadow-soft">
                {t("common.next", "Next")}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={submit}
                disabled={saving}
                className="shadow-soft"
              >
                {saving
                  ? t("common.saving", "Saving…")
                  : isEdit
                    ? t("common.save", "Save changes")
                    : t("pf.create_cta", "Create product")}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stepper({ step }: { step: Step }) {
  const { t } = useTranslation();
  const items: { n: Step; label: string }[] = [
    { n: 1, label: t("pf.step.1", "Product") },
    { n: 2, label: t("pf.step.2", "Inventory") },
    { n: 3, label: t("pf.step.3", "Storage") },
  ];
  return (
    <div className="flex items-center gap-2 pt-3">
      {items.map((it, i) => {
        const done = step > it.n;
        const active = step === it.n;
        return (
          <div key={it.n} className="flex items-center gap-2 flex-1">
            <div
              className={cn(
                "h-6 w-6 rounded-full text-xs font-semibold flex items-center justify-center border transition-colors",
                done && "bg-primary text-primary-foreground border-primary",
                active &&
                  "border-primary text-primary bg-primary/10",
                !done && !active && "border-border text-muted-foreground",
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : it.n}
            </div>
            <span
              className={cn(
                "text-xs font-medium",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {it.label}
            </span>
            {i < items.length - 1 && (
              <div
                className={cn(
                  "h-px flex-1",
                  step > it.n ? "bg-primary" : "bg-border",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
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
