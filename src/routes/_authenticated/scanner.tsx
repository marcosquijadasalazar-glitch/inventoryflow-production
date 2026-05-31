import { createFileRoute } from "@tanstack/react-router";
import { FirstTimeTooltip } from "@/components/onboarding/FirstTimeTooltip";
import { LocationPath } from "@/components/LocationPath";
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
import { Tag, SlidersHorizontal } from "lucide-react";
import { ScannerFeedbackFlash, type FlashState } from "@/components/ScannerFeedbackFlash";
import {
  BarcodeIntelCard,
  type BarcodeIntelDecision,
} from "@/components/BarcodeIntelCard";

export const Route = createFileRoute("/_authenticated/scanner")({
  component: ScannerPage,
});

type Action = "add" | "remove" | "adjustment";
type ScanMode = "lookup" | "count" | "receive" | "transfer" | "adjust";

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

type FeedbackKind = "success" | "duplicate" | "error";

function playBeep(kind: FeedbackKind = "success") {
  try {
    const Ctx =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    const freq = kind === "success" ? 880 : kind === "duplicate" ? 520 : 220;
    const duration = kind === "error" ? 0.32 : 0.18;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
    setTimeout(() => ctx.close().catch(() => {}), Math.round((duration + 0.1) * 1000));
  } catch {
    /* ignore */
  }
}

function vibrate(kind: FeedbackKind = "success") {
  try {
    const pattern =
      kind === "success" ? 40 : kind === "duplicate" ? [20, 40, 20] : [80, 40, 80];
    navigator.vibrate?.(pattern);
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
  const canAdjust = can("adjust_stock");

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

      <p className="-mt-3 text-xs text-muted-foreground px-1">
        {t(`scanner.modeHints.${mode}`)}
      </p>

      {mode === "lookup" && <LookupMode />}
      {mode === "count" && (
        <BatchMode mode="count" locations={locations} canSave={canCount} />
      )}
      {mode === "receive" && (
        <BatchMode mode="receive" locations={locations} canSave={canReceive} />
      )}
      {mode === "adjust" && (
        <BatchMode mode="adjust" locations={locations} canSave={canAdjust} />
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
    { id: "adjust", label: t("scanner.modes.adjust"), icon: SlidersHorizontal },
  ];
  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 rounded-lg bg-muted/40 p-1">
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
              "rounded-md px-3 py-2 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors min-h-[44px]",
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
  const [intelPrefill, setIntelPrefill] = useState<BarcodeIntelDecision | null>(
    null,
  );
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
      const qr = parseQrPayload(code);
      let data: Product | null = null;
      if (qr?.kind === "unsupported") {
        toast.warning(t("scanner.qrUnsupported"));
        setNotFound(true);
        return;
      }
      if (qr?.kind === "product") {
        data = await lookupById(qr.id);
        if (data) toast.success(t("scanner.qrOpenedProduct"));
      } else {
        data = await lookupByBarcode(code);
      }
      if (!data) {
        setNotFound(true);
        playBeep("error");
        vibrate("error");
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
    setIntelPrefill(null);
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

  const canPrintLabels = can("print_labels");

  return (
    <>
      <FrequentTodayStrip onPick={handleScan} />
      <Card>
        <CardContent className="pt-6">
          <BarcodeScanInput onScan={handleScan} />
        </CardContent>
      </Card>

      <div ref={scanRegionRef}>
        {scanned && notFound && (
          <BarcodeIntelCard
            barcode={scanned}
            onConfirm={(decision) => {
              setIntelPrefill(decision);
              setCreateOpen(true);
            }}
            onManual={() => {
              setIntelPrefill(null);
              setCreateOpen(true);
            }}
            onDismiss={resetScan}
          />
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
                    <LocationPath
                      nodeId={(product as any).bin_id}
                      fallback={product.location}
                      hideEmpty
                    />
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

              <div className="flex items-center justify-between gap-2">
                {canPrintLabels ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLabelOpen(true)}
                    disabled={!product.barcode && !product.sku}
                  >
                    <Tag className="h-4 w-4 mr-1.5" />
                    {t("scanner.printLabel")}
                  </Button>
                ) : (
                  <span />
                )}
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
        key={`create-${scanned ?? "none"}-${intelPrefill ? "intel" : "blank"}`}
        open={createOpen}
        onOpenChange={(v) => {
          setCreateOpen(v);
          if (!v) setIntelPrefill(null);
        }}
        product={
          scanned
            ? ({
                barcode: scanned,
                name: intelPrefill?.name ?? "",
                category: intelPrefill?.category ?? "",
                supplier: intelPrefill?.brand ?? "",
              } as unknown as Product)
            : null
        }
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["products"] });
          qc.invalidateQueries({ queryKey: ["history"] });
          setIntelPrefill(null);
          if (scanned) handleScan(scanned);
        }}
      />


      <ProductDetailsDialog
        product={detailsOpen ? product : null}
        onClose={() => setDetailsOpen(false)}
      />

      <LabelPrintDialog
        product={labelOpen ? product : null}
        onClose={() => setLabelOpen(false)}
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
  mode: "count" | "receive" | "transfer" | "adjust";
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
  const [flash, setFlash] = useState<FlashState>(null);
  // Adjust mode extras
  const [adjustDirection, setAdjustDirection] = useState<"add" | "remove">("add");
  const [adjustReason, setAdjustReason] = useState<string>("");
  const dedupeRef = useRef<Map<string, number>>(new Map());
  const flashNonce = useRef(0);
  const pushFlash = (s: Omit<NonNullable<FlashState>, "nonce">) => {
    flashNonce.current += 1;
    setFlash({ ...s, nonce: flashNonce.current });
  };

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
    adjust: {
      title: t("scanner.modes.adjust"),
      saveNote: "Stock adjustment via barcode scanner",
      saveLabel: t("scanner.saveAdjust"),
      empty: t("scanner.emptyAdjust"),
      locationLabel: t("scanner.locationOptional"),
      needsLocation: false,
      needsTwoLocations: false,
    },
  }[mode];

  const handleScan = async (code: string) => {
    // Per-code dedupe window (2.5s) — robust against burst reads
    const now = Date.now();
    const prevTs = dedupeRef.current.get(code);
    if (prevTs && now - prevTs < 2500) {
      playBeep("duplicate");
      vibrate("duplicate");
      pushFlash({
        kind: "duplicate",
        title: t("scanner.scanFlash.duplicate"),
        detail: code,
      });
      return;
    }
    dedupeRef.current.set(code, now);
    // Trim old entries to keep map small
    if (dedupeRef.current.size > 200) {
      for (const [k, ts] of dedupeRef.current) {
        if (now - ts > 60_000) dedupeRef.current.delete(k);
      }
    }

    try {
      const qr = parseQrPayload(code);
      let product: Product | null = null;
      if (qr?.kind === "unsupported") {
        toast.warning(t("scanner.qrUnsupported"));
        return;
      }
      if (qr?.kind === "product") {
        product = await lookupById(qr.id);
      } else {
        product = await lookupByBarcode(code);
      }
      if (!product) {
        setPendingBarcode(code);
        playBeep("error");
        vibrate("error");
        pushFlash({
          kind: "error",
          title: t("scanner.scanFlash.notFound"),
          detail: code,
        });
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
        const idx = prev.findIndex((i) => i.product.id === product!.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
          return next;
        }
        return [...prev, { product: product!, quantity: 1 }];
      });
      playBeep();
      vibrate();
      pushFlash({
        kind: "success",
        title: product.name,
        detail: t("scanner.scanFlash.added"),
      });
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
    if (mode === "adjust" && !adjustReason) {
      toast.error(t("scanner.adjustReasonRequired"));
      return;
    }

    setSaving(true);
    try {
      const fromName = locations.find((l) => l.id === fromLocation)?.name;
      const toName = locations.find((l) => l.id === toLocation)?.name;
      let queuedAny = false;
      let varianceCount = 0;
      const submit = async (payload: Parameters<typeof submitMovement>[0]) => {
        const r = await submitMovement(payload);
        if (r.queued) queuedAny = true;
      };

      for (const item of items) {
        if (mode === "count") {
          if (item.quantity !== item.product.stock) varianceCount += 1;
          const note = `[scan] ${labels.saveNote}${
            fromName ? ` @${fromName}` : ""
          }`;
          await submit({
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
          await submit({
            product_id: item.product.id,
            type: "add",
            quantity: item.quantity,
            note,
          });
        } else if (mode === "transfer") {
          const note = `[scan] ${labels.saveNote} ${fromName} → ${toName}`;
          await submit({
            product_id: item.product.id,
            type: "remove",
            quantity: item.quantity,
            note,
          });
          await submit({
            product_id: item.product.id,
            type: "add",
            quantity: item.quantity,
            note,
          });
        } else if (mode === "adjust") {
          const note = `[scan] [${adjustReason}] ${labels.saveNote}${
            fromName ? ` @${fromName}` : ""
          }`;
          await submit({
            product_id: item.product.id,
            type: adjustDirection,
            quantity: item.quantity,
            note,
          });
        }
      }

      const totalCount = items.reduce((s, i) => s + i.quantity, 0);
      if (queuedAny) {
        toast.success(t("scanner.queuedSession", { count: items.length }));
      } else if (mode === "receive") {
        toast.success(
          t("scanner.receivedSuccess", {
            count: totalCount,
            at: fromName ? ` at ${fromName}` : "",
          }),
        );
      } else if (mode === "transfer") {
        toast.success(
          t("scanner.transferSuccess", {
            count: totalCount,
            to: toName ?? "",
          }),
        );
      } else if (mode === "count") {
        toast.success(
          varianceCount > 0
            ? t("scanner.countSavedVariance", { count: varianceCount })
            : t("scanner.countSavedClean"),
        );
      } else if (mode === "adjust") {
        toast.success(
          adjustDirection === "add"
            ? t("scanner.adjustSavedAdd", { count: totalCount })
            : t("scanner.adjustSavedRemove", { count: totalCount }),
        );
      } else {
        toast.success(t("scanner.sessionSaved", { count: items.length }));
      }
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
            {mode === "adjust" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t("scanner.adjustDirection")}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={adjustDirection === "add" ? "default" : "outline"}
                      className="h-11"
                      onClick={() => setAdjustDirection("add")}
                    >
                      <Plus className="h-4 w-4 mr-1.5" />
                      {t("scanner.adjustAdd")}
                    </Button>
                    <Button
                      type="button"
                      variant={adjustDirection === "remove" ? "default" : "outline"}
                      className="h-11"
                      onClick={() => setAdjustDirection("remove")}
                    >
                      <Minus className="h-4 w-4 mr-1.5" />
                      {t("scanner.adjustRemove")}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("scanner.adjustReason")}</Label>
                  <Select value={adjustReason} onValueChange={setAdjustReason}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="physical_count">{t("sa.adj_reasons.physical_count", "Physical count")}</SelectItem>
                      <SelectItem value="correction">{t("sa.adj_reasons.correction", "Inventory correction")}</SelectItem>
                      <SelectItem value="damaged">{t("sa.adj_reasons.damaged", "Damaged items")}</SelectItem>
                      <SelectItem value="expired">{t("sa.adj_reasons.expired", "Expired inventory")}</SelectItem>
                      <SelectItem value="shrinkage">{t("sa.adj_reasons.shrinkage", "Shrinkage")}</SelectItem>
                      <SelectItem value="other">{t("sa.adj_reasons.other", "Other")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <ScannerFeedbackFlash state={flash} />

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
                    {mode === "count" && (
                      <div className="text-xs mt-0.5">
                        <span className="text-muted-foreground">
                          {t("scanner.currentStock")}: {item.product.stock} ·{" "}
                        </span>
                        {item.quantity === item.product.stock ? (
                          <span className="text-success font-medium">{t("scanner.countMatch")}</span>
                        ) : (
                          <span className={cn("font-medium", item.quantity > item.product.stock ? "text-success" : "text-destructive")}>
                            {t("scanner.countVariance")}: {item.quantity > item.product.stock ? "+" : ""}
                            {item.quantity - item.product.stock}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 shrink-0"
                      onClick={() => updateQty(item.product.id, item.quantity - 1)}
                      aria-label="Decrease"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={mode === "count" ? 0 : 1}
                      value={item.quantity}
                      onChange={(e) =>
                        updateQty(item.product.id, parseInt(e.target.value, 10) || 0)
                      }
                      className="w-14 h-10 text-center font-semibold"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 shrink-0"
                      onClick={() => updateQty(item.product.id, item.quantity + 1)}
                      aria-label="Increase"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
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

  const modeLabel = useMemo<Record<ScanMode, string>>(
    () => ({
      lookup: t("scanner.modes.lookup"),
      count: t("scanner.modes.count"),
      receive: t("scanner.modes.receive"),
      transfer: t("scanner.modes.transfer"),
      adjust: t("scanner.modes.adjust"),
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
  const [adjustReason, setAdjustReason] = useState("physical_count");
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
      setAdjustReason("physical_count");
      setLocationId("");
    }
  }, [action, product]);

  const currentStock = product?.stock ?? 0;
  const parsedQty = parseInt(qty, 10);
  const adjustDiff =
    action === "adjustment" && !isNaN(parsedQty) ? parsedQty - currentStock : 0;

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
    if (action === "adjustment" && q === product.stock) {
      toast.info(t("scanner.noChange", "New quantity matches current stock"));
      return;
    }
    setSaving(true);
    try {
      const locName =
        locationId && locations.find((l) => l.id === locationId)?.name;
      const tag = action === "adjustment" ? `[${adjustReason}]` : "";
      const noteParts = ["[scan]", tag, locName ? `@${locName}` : "", reason]
        .filter(Boolean)
        .join(" ");
      await createMovement({
        product_id: product.id,
        type: action,
        quantity: q,
        note: noteParts,
      });
      toast.success(
        action === "adjustment"
          ? t("scanner.adjustedTo", "Stock set to {{qty}}", { qty: q })
          : t("scanner.saveMovement"),
      );
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
            {action === "adjustment" && product && !isNaN(parsedQty) && (
              <p className="text-xs text-muted-foreground">
                {t("sa.diff", "Difference")}:{" "}
                <span
                  className={
                    adjustDiff > 0
                      ? "font-semibold text-success"
                      : adjustDiff < 0
                        ? "font-semibold text-destructive"
                        : "font-medium"
                  }
                >
                  {adjustDiff > 0 ? "+" : ""}
                  {adjustDiff}
                </span>
              </p>
            )}
          </div>

          {action === "adjustment" && (
            <div className="space-y-1.5">
              <Label>{t("sa.adjust_reason", "Reason for adjustment")}</Label>
              <Select value={adjustReason} onValueChange={setAdjustReason}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="physical_count">
                    {t("sa.adj_reasons.physical_count", "Physical count")}
                  </SelectItem>
                  <SelectItem value="correction">
                    {t("sa.adj_reasons.correction", "Inventory correction")}
                  </SelectItem>
                  <SelectItem value="damaged">
                    {t("sa.adj_reasons.damaged", "Damaged items")}
                  </SelectItem>
                  <SelectItem value="expired">
                    {t("sa.adj_reasons.expired", "Expired inventory")}
                  </SelectItem>
                  <SelectItem value="shrinkage">
                    {t("sa.adj_reasons.shrinkage", "Shrinkage")}
                  </SelectItem>
                  <SelectItem value="reconciliation">
                    {t("sa.adj_reasons.reconciliation", "Manual reconciliation")}
                  </SelectItem>
                  <SelectItem value="other">
                    {t("sa.adj_reasons.other", "Other")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

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
