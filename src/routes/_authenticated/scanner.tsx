import { createFileRoute } from "@tanstack/react-router";
import { FirstTimeTooltip } from "@/components/onboarding/FirstTimeTooltip";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { createMovement, type Product } from "@/lib/inventory";
import { listLocations } from "@/lib/locations";
import { BarcodeScanInput } from "@/components/BarcodeScanInput";
import { ProductForm } from "@/components/ProductForm";
import { ProductDetailsDialog } from "@/components/ProductDetailsDialog";
import {
  ScanLine,
  PackageCheck,
  PackageX,
  Plus,
  Minus,
  Settings2,
  Eye,
  MapPin,
  Clock,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { StockBadge } from "@/components/StockBadge";

export const Route = createFileRoute("/_authenticated/scanner")({
  component: ScannerPage,
});

type Action = "add" | "remove" | "adjustment";

// Subtle success beep using WebAudio (no asset required)
function playBeep() {
  try {
    const Ctx =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
    setTimeout(() => ctx.close().catch(() => {}), 300);
  } catch {
    /* ignore */
  }
}

function vibrate() {
  try {
    navigator.vibrate?.(40);
  } catch {
    /* ignore */
  }
}

function formatRelative(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

function ScannerPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [scanned, setScanned] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [actionOpen, setActionOpen] = useState<Action | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const scanRegionRef = useRef<HTMLDivElement>(null);

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
      toast.warning(t("scanner.productNotFound"));
      return;
    }
    setProduct(data as Product);
    playBeep();
    vibrate();
    toast.success(t("scanner.productFound"));
    // Scroll into view on mobile
    setTimeout(() => {
      scanRegionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  };

  const refreshProduct = async () => {
    if (!product) return;
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("id", product.id)
      .maybeSingle();
    if (data) setProduct(data as Product);
  };

  const resetScan = () => {
    setProduct(null);
    setScanned(null);
    setNotFound(false);
  };

  // Last activity for found product
  const { data: lastActivity } = useQuery({
    queryKey: ["scanner-last-activity", product?.id],
    enabled: !!product?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("inventory_movements")
        .select("created_at, type, quantity")
        .eq("product_id", product!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as { created_at: string; type: string; quantity: number } | null;
    },
  });

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

      <div ref={scanRegionRef}>
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
              <Button variant="ghost" onClick={resetScan}>
                {t("scanner.scanAgain")}
              </Button>
            </CardContent>
          </Card>
        )}

        {product && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <PackageCheck className="h-5 w-5 text-success" />
                {t("scanner.productFound")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Compact product summary */}
              <div className="flex gap-3 rounded-lg border border-border bg-surface-muted/40 p-3 sm:p-4">
                <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-md bg-muted flex items-center justify-center shrink-0">
                  <Package className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-base sm:text-lg truncate">
                    {product.name}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                    SKU {product.sku}
                    {product.barcode ? ` · ${product.barcode}` : ""}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                    {product.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {product.location}
                      </span>
                    )}
                    {lastActivity && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatRelative(lastActivity.created_at)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {t("scanner.currentStock")}
                  </div>
                  <div className="text-2xl font-bold leading-tight">
                    {product.stock}
                  </div>
                  <div className="mt-1">
                    <StockBadge product={product} />
                  </div>
                </div>
              </div>

              {/* Quick action grid — mobile-first, 2 cols on phone, 4 on sm+ */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <QuickActionButton
                  icon={Plus}
                  label={t("scanner.addStock")}
                  onClick={() => setActionOpen("add")}
                />
                <QuickActionButton
                  icon={Minus}
                  label={t("scanner.removeStock")}
                  onClick={() => setActionOpen("remove")}
                />
                <QuickActionButton
                  icon={Settings2}
                  label={t("scanner.adjustStock")}
                  onClick={() => setActionOpen("adjustment")}
                />
                <QuickActionButton
                  icon={Eye}
                  label={t("scanner.viewProduct")}
                  onClick={() => setDetailsOpen(true)}
                />
              </div>

              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={resetScan}>
                  {t("scanner.scanAgain")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick action sheet */}
      <QuickActionSheet
        action={actionOpen}
        product={product}
        onClose={() => setActionOpen(null)}
        onSaved={async () => {
          await refreshProduct();
          qc.invalidateQueries({ queryKey: ["products"] });
          qc.invalidateQueries({ queryKey: ["movements"] });
          qc.invalidateQueries({ queryKey: ["history"] });
          qc.invalidateQueries({
            queryKey: ["scanner-last-activity", product?.id],
          });
        }}
      />

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

      <ProductDetailsDialog
        product={detailsOpen ? product : null}
        onClose={() => setDetailsOpen(false)}
      />
    </div>
  );
}

function QuickActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: any;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-border bg-background hover:bg-muted/50 active:bg-muted px-3 py-4 text-sm font-medium flex flex-col items-center justify-center gap-1.5 transition-colors min-h-[72px]"
    >
      <Icon className="h-5 w-5 text-primary" />
      <span className="text-center leading-tight">{label}</span>
    </button>
  );
}

function QuickActionSheet({
  action,
  product,
  onClose,
  onSaved,
}: {
  action: Action | null;
  product: Product | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const { t } = useTranslation();
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState("");
  const [locationId, setLocationId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const { data: locations = [] } = useQuery({
    queryKey: ["locations-active"],
    queryFn: () => listLocations(),
  });

  // Reset when opening
  useEffect(() => {
    if (action && product) {
      setQty(action === "adjustment" ? String(product.stock) : "1");
      setReason("");
      setLocationId("");
    }
  }, [action, product]);

  const open = !!action && !!product;
  const title =
    action === "add"
      ? t("scanner.addStock")
      : action === "remove"
        ? t("scanner.removeStock")
        : action === "adjustment"
          ? t("scanner.adjustStock")
          : "";

  const submit = async () => {
    if (!product || !action) return;
    const q = parseInt(qty, 10);
    if (isNaN(q) || q < 0) return toast.error("Invalid quantity");
    if (action !== "adjustment" && q <= 0)
      return toast.error("Invalid quantity");
    setSaving(true);
    try {
      const locName =
        locationId && locations.find((l) => l.id === locationId)?.name;
      const noteParts = [
        "[scan]",
        locName ? `@${locName}` : "",
        reason,
      ]
        .filter(Boolean)
        .join(" ");
      await createMovement({
        product_id: product.id,
        type: action,
        quantity: q,
        note: noteParts,
      });
      toast.success(t("scanner.saveMovement"));
      await onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle>{title}</SheetTitle>
          {product && (
            <SheetDescription className="truncate">
              {product.name} · {t("scanner.currentStock")}: {product.stock}
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label>
              {action === "adjustment"
                ? t("scanner.newQuantity")
                : t("common.quantity")}
            </Label>
            <Input
              type="number"
              min={0}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              autoFocus
              inputMode="numeric"
              className="text-lg h-12"
            />
          </div>

          {locations.length > 1 && (
            <div className="space-y-1.5">
              <Label>{t("scanner.locationOptional")}</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder={t("scanner.selectLocation")} />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>
              {action === "remove"
                ? t("common.reason")
                : `${t("common.notes")} (${t("common.optional")})`}
            </Label>
            <Textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder=""
            />
          </div>
        </div>

        <SheetFooter className="flex-row gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
            disabled={saving}
          >
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} disabled={saving} className="flex-1">
            {saving ? t("common.loading") : t("scanner.saveMovement")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
