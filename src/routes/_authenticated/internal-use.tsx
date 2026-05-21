import { createFileRoute } from "@tanstack/react-router";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Wrench, AlertTriangle } from "lucide-react";
import { ProductPicker, type ProductLite } from "@/components/ProductPickerInput";
import { useProfile, canManageOrg } from "@/lib/profile";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/internal-use")({
  component: InternalUsePage,
});

function InternalUsePage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const profile = useProfile();
  const history = useQuery({ queryKey: ["internal_use"], queryFn: listInternalUse });

  const [product, setProduct] = useState<ProductLite | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [department, setDepartment] = useState("Warehouse");
  const [customDept, setCustomDept] = useState("");
  const [reason, setReason] = useState("Internal Use");
  const [customReason, setCustomReason] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const canOverride = canManageOrg(profile.data?.role);
  const q = parseInt(quantity) || 0;
  const over = product != null && q > product.stock;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return toast.error(t("iu.need_product", "Select a product"));
    if (q <= 0) return toast.error(t("iu.invalid_qty", "Enter a valid quantity"));
    if (over && !canOverride)
      return toast.error(t("iu.overstock", "Quantity exceeds available stock"));
    setSaving(true);
    try {
      await createInternalUse({
        product_id: product.id,
        quantity: q,
        department: department === "Other" ? customDept || "Other" : department,
        reason: reason === "Other" ? customReason || "Other" : reason,
        notes: notes || null,
      });
      toast.success(t("iu.saved", "Internal use recorded"));
      setProduct(null);
      setQuantity("1");
      setNotes("");
      qc.invalidateQueries({ queryKey: ["internal_use"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["history"] });
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
          <p className="text-xs font-medium uppercase tracking-wider text-primary mb-1.5">
            {t("iu.section", "Operations")}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {t("iu.title", "Internal Use")}
          </h1>
          <p className="text-muted-foreground mt-1">
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
                <ProductPicker value={product} onSelect={setProduct} />
                {product && (
                  <p className="text-xs text-muted-foreground">
                    {t("iu.current_stock", "Current stock")}: {product.stock} ·{" "}
                    {product.location ?? "—"}
                  </p>
                )}
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

            {over && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/5 border border-destructive/20 p-3 text-sm">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p>
                  {t("iu.overstock", "Quantity exceeds available stock")}
                  {canOverride && ` — ${t("iu.override", "manager override available")}`}
                </p>
              </div>
            )}

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
              <Button type="submit" disabled={saving} className="shadow-soft">
                {saving ? t("common.loading") : t("common.submit")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">{t("iu.history", "Internal use history")}</CardTitle>
        </CardHeader>
        <CardContent>
          {history.isLoading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : !history.data?.length ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {t("iu.empty", "No internal use records yet.")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.date")}</TableHead>
                    <TableHead>{t("po.product", "Product")}</TableHead>
                    <TableHead className="text-right">{t("common.quantity")}</TableHead>
                    <TableHead>{t("common.reason")}</TableHead>
                    <TableHead>{t("history.user")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.data.map((h: any) => (
                    <TableRow key={h.id}>
                      <TableCell className="text-xs">
                        {format(new Date(h.created_at), "yyyy-MM-dd HH:mm")}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{h.product_name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{h.sku}</p>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {h.quantity_change}
                      </TableCell>
                      <TableCell className="text-xs">{h.reason ?? "—"}</TableCell>
                      <TableCell className="text-xs">{h.user_email ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
