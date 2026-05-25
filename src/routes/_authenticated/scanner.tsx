import { createFileRoute } from "@tanstack/react-router";
import { FirstTimeTooltip } from "@/components/onboarding/FirstTimeTooltip";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { createMovement, type Product } from "@/lib/inventory";
import { BarcodeScanInput } from "@/components/BarcodeScanInput";
import { ProductForm } from "@/components/ProductForm";
import { ScanLine, PackageCheck, PackageX, Plus, Minus, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { StockBadge } from "@/components/StockBadge";

export const Route = createFileRoute("/_authenticated/scanner")({
  component: ScannerPage,
});

type Action = "add" | "remove" | "adjustment";

function ScannerPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [scanned, setScanned] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [action, setAction] = useState<Action>("add");
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const handleScan = async (code: string) => {
    setScanned(code);
    setNotFound(false);
    setProduct(null);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("barcode", code)
      .maybeSingle();
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data) {
      setNotFound(true);
      return;
    }
    setProduct(data as Product);
    setQty("1");
    setReason("");
    setAction("add");
  };

  const submit = async () => {
    if (!product) return;
    const q = parseInt(qty, 10);
    if (isNaN(q) || q <= 0) return toast.error("Invalid quantity");
    setSaving(true);
    try {
      await createMovement({
        product_id: product.id,
        type: action,
        quantity: q,
        note: `[scan] ${reason || ""}`.trim(),
      });
      toast.success(t("scanner.saveMovement"));
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["history"] });
      setProduct(null);
      setScanned(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <FirstTimeTooltip storageKey="scanner" i18nKey="onboarding.tips.scanner" />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <ScanLine className="h-6 w-6 text-primary" />
          {t("scanner.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("scanner.subtitle")}
        </p>
      </header>

      <Card>
        <CardContent className="pt-6">
          <BarcodeScanInput onScan={handleScan} />
        </CardContent>
      </Card>

      {scanned && notFound && (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PackageX className="h-5 w-5 text-warning" />
              {t("scanner.productNotFound")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <code className="px-2 py-1 bg-muted rounded font-mono text-sm">
              {scanned}
            </code>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              {t("scanner.createNewProduct")}
            </Button>
            <Button variant="ghost" onClick={() => setScanned(null)}>
              {t("scanner.scanAgain")}
            </Button>
          </CardContent>
        </Card>
      )}

      {product && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-success" />
              {t("scanner.productFound")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-border bg-surface-muted/40 p-4">
              <div>
                <div className="font-semibold text-lg">{product.name}</div>
                <div className="text-xs text-muted-foreground font-mono mt-0.5">
                  SKU {product.sku} · {product.barcode}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    {t("scanner.currentStock")}
                  </div>
                  <div className="text-2xl font-bold">{product.stock}</div>
                </div>
                <StockBadge product={product} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { key: "add", label: t("scanner.addStock"), icon: Plus },
                  { key: "remove", label: t("scanner.removeStock"), icon: Minus },
                  {
                    key: "adjustment",
                    label: t("scanner.adjustStock"),
                    icon: Settings2,
                  },
                ] as { key: Action; label: string; icon: any }[]
              ).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setAction(key)}
                  className={
                    "rounded-lg border px-3 py-3 text-sm font-medium flex flex-col items-center gap-1.5 transition-colors " +
                    (action === key
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:bg-muted/50")
                  }
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("common.quantity")}</Label>
                <Input
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  {t("common.reason")}{" "}
                  <span className="text-muted-foreground">({t("common.optional")})</span>
                </Label>
                <Textarea
                  rows={1}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setProduct(null);
                  setScanned(null);
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button onClick={submit} disabled={saving}>
                {saving ? t("common.loading") : t("scanner.saveMovement")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <ProductForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        product={
          scanned ? ({ barcode: scanned } as unknown as Product) : null
        }
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["products"] });
          qc.invalidateQueries({ queryKey: ["history"] });
          if (scanned) handleScan(scanned);
        }}
      />
    </div>
  );
}
