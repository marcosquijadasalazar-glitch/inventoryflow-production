import { createFileRoute } from "@tanstack/react-router";
import { FirstTimeTooltip } from "@/components/onboarding/FirstTimeTooltip";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { createMovement, type Product } from "@/lib/inventory";
import { listLocations, type Location } from "@/lib/locations";
import { usePermissions } from "@/lib/use-permissions";
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
  Search,
  ClipboardList,
  PackagePlus,
  ArrowLeftRight,
  Trash2,
  Save,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { StockBadge } from "@/components/StockBadge";
import { cn } from "@/lib/utils";
import { InsightsPanel } from "@/components/InsightsPanel";
import { ScannerStatusPill } from "@/components/ScannerStatusPill";
import { ScannerAnalyticsPanel } from "@/components/ScannerAnalyticsPanel";
import { FrequentTodayStrip } from "@/components/FrequentTodayStrip";
import { LabelPrintDialog } from "@/components/LabelPrintDialog";
import { installAutoSync, submitMovement } from "@/lib/scan-queue";
import { Tag } from "lucide-react";

export const Route = createFileRoute("/_authenticated/scanner")({
  component: ScannerPage,
});

type Action = "add" | "remove" | "adjustment";
type ScanMode = "lookup" | "count" | "receive" | "transfer";

type SessionItem = {
  product: Product;
  quantity: number;
};

type HistoryEntry = {
  productName: string;
  barcode: string;
  mode: ScanMode;
  ts: number;
};

const HISTORY_KEY = "scanner-history-v1";
const HISTORY_MAX = 10;

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

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

function pushHistory(entry: HistoryEntry) {
  try {
    const list = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event("scanner-history-changed"));
  } catch {
    /* ignore */
  }
}

async function lookupByBarcode(code: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("barcode", code)
    .maybeSingle();
  if (error) throw error;
  return (data as Product) ?? null;
}

async function lookupById(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as Product) ?? null;
}

/** Parse special QR payloads. Returns null for plain barcodes. */
function parseQrPayload(code: string): { kind: "product"; id: string } | { kind: "unsupported" } | null {
  const trimmed = code.trim();
  const m = trimmed.match(/^inventoryflow:\/\/product\/([a-zA-Z0-9-]+)$/);
  if (m) return { kind: "product", id: m[1] };
  if (/^[a-z]+:\/\//i.test(trimmed) || trimmed.startsWith("http")) {
    return { kind: "unsupported" };
  }
  return null;
}

function ScannerPage() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<ScanMode>("lookup");
  useEffect(() => { installAutoSync(); }, []);
  const { data: locations = [] } = useQuery({
    queryKey: ["locations-active"],
    queryFn: () => listLocations(),
  });
  const { can } = usePermissions();
  const canCount = can("adjust_stock");
  const canReceive = can("create_movements") || can("adjust_stock");
  const canTransfer = can("manage_transfer_orders") || can("create_movements");

  const transferDisabled = locations.length < 2;

  return (
    <div className="space-y-6">
      <FirstTimeTooltip storageKey="scanner" i18nKey="onboarding.tips.scanner" />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <ScanLine className="h-6 w-6 text-primary" />
            {t("scanner.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("scanner.subtitle")}
          </p>
        </div>
        <ScannerStatusPill />
      </header>

      <ModeTabs
        mode={mode}
        onChange={setMode}
        transferDisabled={transferDisabled}
      />

      {mode === "lookup" && <LookupMode />}
      {mode === "count" && (
        <BatchMode mode="count" locations={locations} canSave={canCount} />
      )}
      {mode === "receive" && (
        <BatchMode mode="receive" locations={locations} canSave={canReceive} />
      )}
      {mode === "transfer" &&
        (transferDisabled ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              {t("scanner.transferNeedsLocations")}
            </CardContent>
          </Card>
        ) : (
          <BatchMode mode="transfer" locations={locations} canSave={canTransfer} />
        ))}

      <ScanHistoryPanel />
      <ScannerAnalyticsPanel />
      <InsightsPanel />
    </div>
  );
}

function ModeTabs({
  mode,
  onChange,
  transferDisabled,
}: {
  mode: ScanMode;
  onChange: (m: ScanMode) => void;
  transferDisabled: boolean;
}) {
  const { t } = useTranslation();
  const tabs: { id: ScanMode; label: string; icon: any; disabled?: boolean }[] = [
    { id: "lookup", label: t("scanner.modes.lookup"), icon: Search },
    { id: "count", label: t("scanner.modes.count"), icon: ClipboardList },
    { id: "receive", label: t("scanner.modes.receive"), icon: PackagePlus },
    {
      id: "transfer",
      label: t("scanner.modes.transfer"),
      icon: ArrowLeftRight,
      disabled: transferDisabled,
    },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-lg bg-muted/40 p-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = mode === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
              tab.disabled && "opacity-50 cursor-not-allowed",
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="truncate">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* =========================================================================
 * LOOKUP MODE (Phase 1 behavior — unchanged)
 * ========================================================================= */
function LookupMode() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { can } = usePermissions();
  const [scanned, setScanned] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [actionOpen, setActionOpen] = useState<Action | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);
  const scanRegionRef = useRef<HTMLDivElement>(null);

  const handleScan = async (code: string) => {
    setScanned(code);
    setNotFound(false);
    setProduct(null);
    try {
      const data = await lookupByBarcode(code);
      if (!data) {
        setNotFound(true);
        toast.warning(t("scanner.productNotFound"));
        pushHistory({
          productName: t("scanner.productNotFound"),
          barcode: code,
          mode: "lookup",
          ts: Date.now(),
        });
        return;
      }
      setProduct(data);
      playBeep();
      vibrate();
      toast.success(t("scanner.productFound"));
      pushHistory({
        productName: data.name,
        barcode: code,
        mode: "lookup",
        ts: Date.now(),
      });
      setTimeout(() => {
        scanRegionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 50);
    } catch (e: any) {
      toast.error(e.message);
    }
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
    <>
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
    </>
  );
}

/* =========================================================================
 * BATCH MODE — shared for count / receive / transfer
 * ========================================================================= */
function BatchMode({
  mode,
  locations,
  canSave,
}: {
  mode: "count" | "receive" | "transfer";
  locations: Location[];
  canSave: boolean;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [items, setItems] = useState<SessionItem[]>([]);
  const [fromLocation, setFromLocation] = useState<string>("");
  const [toLocation, setToLocation] = useState<string>("");
  const [reference, setReference] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const lastScanRef = useRef<{ code: string; ts: number } | null>(null);

  // Auto-select first location when relevant
  useEffect(() => {
    if (locations.length > 0 && !fromLocation) {
      setFromLocation(locations[0].id);
    }
  }, [locations, fromLocation]);

  const totalUnits = items.reduce((sum, i) => sum + i.quantity, 0);

  const labels = {
    count: {
      title: t("scanner.modes.count"),
      saveNote: "Inventory count via barcode scanner",
      saveLabel: t("scanner.saveCount"),
      empty: t("scanner.emptyCount"),
      locationLabel: t("scanner.location"),
      needsLocation: true,
      needsTwoLocations: false,
    },
    receive: {
      title: t("scanner.modes.receive"),
      saveNote: "Receiving via barcode scanner",
      saveLabel: t("scanner.saveReceiving"),
      empty: t("scanner.emptyReceiving"),
      locationLabel: t("scanner.location"),
      needsLocation: true,
      needsTwoLocations: false,
    },
    transfer: {
      title: t("scanner.modes.transfer"),
      saveNote: "Transfer via barcode scanner",
      saveLabel: t("scanner.saveTransfer"),
      empty: t("scanner.emptyTransfer"),
      locationLabel: t("scanner.fromLocation"),
      needsLocation: true,
      needsTwoLocations: true,
    },
  }[mode];

  const handleScan = async (code: string) => {
    // Duplicate-scan throttle (1s)
    const now = Date.now();
    if (
      lastScanRef.current &&
      lastScanRef.current.code === code &&
      now - lastScanRef.current.ts < 1000
    ) {
      return;
    }
    lastScanRef.current = { code, ts: now };

    try {
      const product = await lookupByBarcode(code);
      if (!product) {
        setPendingBarcode(code);
        toast.warning(t("scanner.productNotFound"));
        setCreateOpen(true);
        pushHistory({
          productName: t("scanner.productNotFound"),
          barcode: code,
          mode,
          ts: now,
        });
        return;
      }
      setItems((prev) => {
        const idx = prev.findIndex((i) => i.product.id === product.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
          return next;
        }
        return [...prev, { product, quantity: 1 }];
      });
      playBeep();
      vibrate();
      pushHistory({
        productName: product.name,
        barcode: code,
        mode,
        ts: now,
      });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const updateQty = (id: string, qty: number) => {
    setItems((prev) =>
      prev.map((i) =>
        i.product.id === id
          ? { ...i, quantity: Math.max(mode === "count" ? 0 : 1, qty) }
          : i,
      ),
    );
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.product.id !== id));
  };

  const clearAll = () => {
    setItems([]);
    setReference("");
    setClearOpen(false);
  };

  const askClear = () => {
    if (items.length === 0) return;
    setClearOpen(true);
  };

  const save = async () => {
    if (!canSave) {
      toast.error(t("scanner.noPermission"));
      return;
    }
    if (items.length === 0) {
      toast.error(labels.empty);
      return;
    }
    if (mode === "transfer") {
      if (!fromLocation || !toLocation) {
        toast.error(t("scanner.selectBothLocations"));
        return;
      }
      if (fromLocation === toLocation) {
        toast.error(t("scanner.sameLocationError"));
        return;
      }
    }

    setSaving(true);
    try {
      const fromName = locations.find((l) => l.id === fromLocation)?.name;
      const toName = locations.find((l) => l.id === toLocation)?.name;

      for (const item of items) {
        if (mode === "count") {
          const note = `[scan] ${labels.saveNote}${
            fromName ? ` @${fromName}` : ""
          }`;
          await createMovement({
            product_id: item.product.id,
            type: "adjustment",
            quantity: item.quantity,
            note,
          });
        } else if (mode === "receive") {
          const refPart = reference ? ` | ref:${reference}` : "";
          const note = `[scan] ${labels.saveNote}${
            fromName ? ` @${fromName}` : ""
          }${refPart}`;
          await createMovement({
            product_id: item.product.id,
            type: "add",
            quantity: item.quantity,
            note,
          });
        } else if (mode === "transfer") {
          const note = `[scan] ${labels.saveNote} ${fromName} → ${toName}`;
          await createMovement({
            product_id: item.product.id,
            type: "remove",
            quantity: item.quantity,
            note,
          });
          await createMovement({
            product_id: item.product.id,
            type: "add",
            quantity: item.quantity,
            note,
          });
        }
      }

      toast.success(t("scanner.sessionSaved", { count: items.length }));
      setItems([]);
      setReference("");
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["history"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Location selector */}
      {locations.length > 0 && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className={cn("grid gap-3", mode === "transfer" && "sm:grid-cols-2")}>
              <div className="space-y-1.5">
                <Label>{labels.locationLabel}</Label>
                <Select value={fromLocation} onValueChange={setFromLocation}>
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
              {mode === "transfer" && (
                <div className="space-y-1.5">
                  <Label>{t("scanner.toLocation")}</Label>
                  <Select value={toLocation} onValueChange={setToLocation}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder={t("scanner.selectLocation")} />
                    </SelectTrigger>
                    <SelectContent>
                      {locations
                        .filter((l) => l.id !== fromLocation)
                        .map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {mode === "receive" && (
              <div className="space-y-1.5">
                <Label>
                  {t("scanner.supplierReference")} ({t("common.optional")})
                </Label>
                <Input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder=""
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <BarcodeScanInput onScan={handleScan} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            {t("scanner.sessionItems")}{" "}
            <span className="text-muted-foreground font-normal">
              ({items.length} · {totalUnits} {t("scanner.units")})
            </span>
          </CardTitle>
          {items.length > 0 && (
            <Button variant="ghost" size="sm" onClick={askClear}>
              <Trash2 className="h-4 w-4 mr-1.5" />
              {t("scanner.clearSession")}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {labels.empty}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li
                  key={item.product.id}
                  className="py-3 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {item.product.name}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono truncate">
                      {item.product.sku}
                      {item.product.barcode ? ` · ${item.product.barcode}` : ""}
                    </div>
                    {mode !== "count" && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {t("scanner.currentStock")}: {item.product.stock}
                      </div>
                    )}
                  </div>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={mode === "count" ? 0 : 1}
                    value={item.quantity}
                    onChange={(e) =>
                      updateQty(item.product.id, parseInt(e.target.value, 10) || 0)
                    }
                    className="w-20 h-10 text-center"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(item.product.id)}
                    aria-label={t("common.remove")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="sticky bottom-2 z-10">
        <Button
          onClick={save}
          disabled={saving || items.length === 0 || !canSave}
          className="w-full h-12 text-base shadow-lg"
        >
          <Save className="h-5 w-5 mr-2" />
          {saving ? t("common.loading") : labels.saveLabel}
        </Button>
        {!canSave && (
          <p className="text-xs text-center text-muted-foreground mt-2">
            {t("scanner.noPermission")}
          </p>
        )}
      </div>

      <ProductForm
        open={createOpen}
        onOpenChange={(v) => {
          setCreateOpen(v);
          if (!v) setPendingBarcode(null);
        }}
        product={
          pendingBarcode
            ? ({ barcode: pendingBarcode } as unknown as Product)
            : null
        }
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["products"] });
          if (pendingBarcode) {
            const code = pendingBarcode;
            setPendingBarcode(null);
            // Re-scan to add the new product into the session
            setTimeout(() => handleScan(code), 200);
          }
        }}
      />

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("scanner.clearSession")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("scanner.clearConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={clearAll}>
              {t("scanner.clearSession")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* =========================================================================
 * SCAN HISTORY
 * ========================================================================= */
function ScanHistoryPanel() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    const refresh = () => setEntries(loadHistory());
    refresh();
    window.addEventListener("scanner-history-changed", refresh);
    return () => window.removeEventListener("scanner-history-changed", refresh);
  }, []);

  const modeLabel = useMemo(
    () => ({
      lookup: t("scanner.modes.lookup"),
      count: t("scanner.modes.count"),
      receive: t("scanner.modes.receive"),
      transfer: t("scanner.modes.transfer"),
    }),
    [t],
  );

  if (entries.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          {t("scanner.recentScans")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border text-sm">
          {entries.map((e, i) => (
            <li
              key={`${e.ts}-${i}`}
              className="py-2 flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{e.productName}</div>
                <div className="text-xs text-muted-foreground font-mono truncate">
                  {e.barcode}
                </div>
              </div>
              <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                {modeLabel[e.mode]}
              </span>
              <span className="text-xs text-muted-foreground shrink-0">
                {formatRelative(new Date(e.ts).toISOString())}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/* =========================================================================
 * Shared sub-components (Lookup quick actions)
 * ========================================================================= */
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
      const noteParts = ["[scan]", locName ? `@${locName}` : "", reason]
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
