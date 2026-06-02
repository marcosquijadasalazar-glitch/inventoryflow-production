import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  createInternalUse,
  listInternalUse,
  INTERNAL_DEPARTMENTS,
  INTERNAL_REASONS,
} from "@/lib/orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Wrench } from "lucide-react";
import { ProductPicker, type ProductLite } from "@/components/ProductPickerInput";
import { LocationSelect } from "@/components/LocationSelect";
import { useProfile, canManageOrg } from "@/lib/profile";
import { MovementsHistoryStandard } from "@/components/movements-tabs/MovementsHistoryStandard";
import {
  useProductLocationStock,
  validateLocationQuantity,
} from "@/lib/product-location-stock";
import {
  LocationAvailabilityHint,
  LocationStockValidationAlert,
} from "@/components/LocationAvailabilityHint";
import { invalidateInventoryCaches } from "@/lib/invalidate-after-write";

export function InternalUseTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const profile = useProfile();
  const history = useQuery({ queryKey: ["internal_use"], queryFn: listInternalUse });
  const stockQ = useProductLocationStock();

  const [product, setProduct] = useState<ProductLite | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [department, setDepartment] = useState("Warehouse");
  const [customDept, setCustomDept] = useState("");
  const [reason, setReason] = useState("Internal Use");
  const [customReason, setCustomReason] = useState("");
  const [notes, setNotes] = useState("");
  const [locationId, setLocationId] = useState<string | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canOverride = canManageOrg(profile.data?.role);
  const q = parseInt(quantity) || 0;
  const stockValidation = validateLocationQuantity({
    movementType: "remove",
    quantity: q,
    productId: product?.id ?? null,
    locationId,
    locationName,
    stockData: stockQ.data,
    requireLocation: true,
  });
  const over = stockValidation.blocked && !canOverride;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return toast.error(t("iu.need_product", "Select a product"));
    if (q <= 0) return toast.error(t("iu.invalid_qty", "Enter a valid quantity"));
    if (!locationId) return toast.error(t("iu.need_location", "Select a source location"));
    if (over)
      return toast.error(stockValidation.message?.split("\n")[0] ?? t("iu.overstock", "Quantity exceeds available stock"));
    setSaving(true);
    try {
      await createInternalUse({
        product_id: product.id,
        quantity: q,
        department: department === "Other" ? customDept || "Other" : department,
        reason: reason === "Other" ? customReason || "Other" : reason,
        notes: notes || null,
        location_id: locationId,
      });
      toast.success(t("iu.saved", "Internal use recorded"));
      setProduct(null);
      setQuantity("1");
      setNotes("");
      setLocationId(null);
      setLocationName(null);
      qc.invalidateQueries({ queryKey: ["internal_use"] });
      invalidateInventoryCaches(qc);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const monthCount = useMemo(() => {
    const now = new Date();
    return (
      history.data?.filter((h: any) => {
        const d = new Date(h.created_at);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length ?? 0
    );
  }, [history.data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            {t("iu.title", "Internal Use")}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("iu.subtitle", "Track products consumed inside your company.")}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {t("iu.this_month", "This month")}
          </p>
          <p className="text-2xl font-semibold">{monthCount}</p>
        </div>
      </div>

      <Card className="border-border shadow-soft">
        <CardHeader className="border-b bg-surface-muted/50">
          <CardTitle className="text-base flex items-center gap-2">
            <Wrench className="h-4 w-4 text-primary" />
            {t("iu.record", "Record internal use")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={submit} className="space-y-4">
            <div className="grid md:grid-cols-3 gap-3">
              <div className="md:col-span-2 space-y-1.5">
                <Label>{t("iu.product", "Product (or scan)")}</Label>
                <ProductPicker
                  value={product}
                  onSelect={setProduct}
                  showGlobalStock={false}
                  locationStock={stockQ.data}
                  filterLocationId={locationId}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("iu.qty_used", "Quantity used")}</Label>
                <Input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t("iu.location", "Source location")}</Label>
              <LocationSelect
                value={locationId}
                onChange={(id, loc) => {
                  setLocationId(id);
                  setLocationName(loc?.name ?? null);
                }}
                productId={product?.id ?? null}
                stockData={stockQ.data}
                requireDirectStock={!!product}
              />
              <LocationAvailabilityHint
                productId={product?.id ?? null}
                locationId={locationId}
                stockData={stockQ.data}
              />
            </div>

            <LocationStockValidationAlert
              message={stockValidation.blocked ? stockValidation.message : undefined}
            />

            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("iu.department", "Department")}</Label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERNAL_DEPARTMENTS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {department === "Other" && (
                  <Input
                    placeholder={t("iu.custom_dept", "Custom department")}
                    value={customDept}
                    onChange={(e) => setCustomDept(e.target.value)}
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <Label>{t("common.reason")}</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERNAL_REASONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {reason === "Other" && (
                  <Input
                    placeholder={t("iu.custom_reason", "Custom reason")}
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                  />
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t("common.notes")}</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={saving || over} className="shadow-soft">
                {saving ? t("common.loading") : t("common.submit")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <MovementsHistoryStandard module="internal-use" />
    </div>
  );
}
