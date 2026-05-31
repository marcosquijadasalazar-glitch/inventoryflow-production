import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  Upload,
  FileDown,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Truck,
  Sparkles,
  ArrowRight,
  PackagePlus,
  AlertTriangle,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  downloadTemplate,
  parseImportFile,
  type ImportSchema,
  type ParsedRow,
  type ImportResult,
} from "@/lib/import-utils";
import { previewProductsImport } from "@/lib/products-import.functions";

const CREATE_NEW = "__create_new__";

type ResolutionAction = "skip" | "update" | "replace_stock" | "new_sku";
type Resolution = { action: ResolutionAction; new_sku?: string };

type ImportResultExt = ImportResult & { updated?: number; skipped?: number };

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  schema: ImportSchema;
  orgLocations: { id: string; name: string }[];
  defaultLocation?: string;
  onImport: (args: {
    rows: Record<string, string>[];
    location_mappings: Record<string, string>;
    auto_create_locations: boolean;
    auto_create_suppliers: boolean;
    sku_resolutions: Record<string, Resolution>;
  }) => Promise<ImportResultExt>;
  onDone?: () => void;
};

export function ProductsImportDialog({
  open,
  onOpenChange,
  schema,
  orgLocations,
  defaultLocation,
  onImport,
  onDone,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [filename, setFilename] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResultExt | null>(null);
  const [autoCreateSuppliers, setAutoCreateSuppliers] = useState(true);
  const [locMap, setLocMap] = useState<Record<string, string>>({});
  const [newLocNames, setNewLocNames] = useState<Record<string, string>>({});
  const [skuResolutions, setSkuResolutions] = useState<Record<string, Resolution>>({});
  const [barcodeSkipped, setBarcodeSkipped] = useState<Record<string, boolean>>({});
  const [skuConflicts, setSkuConflicts] = useState<
    { sku: string; existing: { id: string; name: string; location: string | null; stock: number; barcode?: string | null } }[]
  >([]);
  const [barcodeConflicts, setBarcodeConflicts] = useState<
    { barcode: string; existing: { id: string; name: string; location: string | null; stock: number; sku?: string | null } }[]
  >([]);
  const [previewing, setPreviewing] = useState(false);
  const runPreview = useServerFn(previewProductsImport);

  function reset() {
    setRows([]);
    setFilename("");
    setResult(null);
    setLocMap({});
    setNewLocNames({});
    setSkuResolutions({});
    setBarcodeSkipped({});
    setSkuConflicts([]);
    setBarcodeConflicts([]);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleFile(f: File) {
    try {
      const { rows: parsed } = await parseImportFile(f, schema);
      setRows(parsed);
      setFilename(f.name);
      setResult(null);
      setLocMap({});
      setNewLocNames({});
      setSkuResolutions({});
      setBarcodeSkipped({});
      setSkuConflicts([]);
      setBarcodeConflicts([]);
      if (parsed.length === 0) {
        toast.error("This file doesn't have any rows.");
        return;
      }
      // Ask the server which SKUs/barcodes already exist
      setPreviewing(true);
      try {
        const preview: any = await runPreview({
          data: { rows: parsed.map((r) => r.data) },
        });
        // Defensive: accept either the raw handler shape or any wrapped envelope.
        const sku = preview?.sku_conflicts ?? preview?.result?.sku_conflicts ?? [];
        const bar = preview?.barcode_conflicts ?? preview?.result?.barcode_conflicts ?? [];
        setSkuConflicts(sku);
        setBarcodeConflicts(bar);
        if (sku.length > 0 || bar.length > 0) {
          toast.message(
            `Found ${sku.length} SKU and ${bar.length} barcode match${sku.length + bar.length === 1 ? "" : "es"} in your catalog — choose how to handle each below.`,
          );
        }
      } catch (e: any) {
        console.error("[ProductsImportDialog] preview failed:", e);
        toast.error(
          `We couldn't check your catalog for duplicates: ${e?.message ?? "unknown error"}. You can still import, but existing-SKU conflicts won't be shown until the server rejects them.`,
        );
      } finally {
        setPreviewing(false);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "We couldn't read that file.");
    }
  }

  const orgLocLower = useMemo(
    () => new Set(orgLocations.map((l) => l.name.toLowerCase())),
    [orgLocations],
  );

  const unknownLocations = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) {
      const raw = (r.data.location ?? "").trim();
      if (!raw) continue;
      const lower = raw.toLowerCase();
      if (orgLocLower.has(lower)) continue;
      if (!seen.has(lower)) seen.set(lower, raw);
    }
    return Array.from(seen.entries()).map(([lower, display]) => ({ lower, display }));
  }, [rows, orgLocLower]);

  const unknownSuppliers = useMemo(() => {
    const seen = new Set<string>();
    for (const r of rows) {
      const raw = (r.data.supplier ?? "").trim();
      if (raw) seen.add(raw);
    }
    return Array.from(seen);
  }, [rows]);

  // In-file duplicates
  const duplicateSkus = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const sku = (r.data.sku ?? "").trim().toLowerCase();
      if (!sku) continue;
      counts.set(sku, (counts.get(sku) ?? 0) + 1);
    }
    return new Set(
      Array.from(counts.entries()).filter(([, n]) => n > 1).map(([sku]) => sku),
    );
  }, [rows]);

  // Near-duplicate product names within the file (case/whitespace-insensitive)
  const nearDuplicateNames = useMemo(() => {
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
    const counts = new Map<string, number>();
    for (const r of rows) {
      const n = norm(r.data.product_name ?? r.data.name ?? "");
      if (!n) continue;
      counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    return Array.from(counts.entries()).filter(([, n]) => n > 1).length;
  }, [rows]);

  const conflictSkuSet = useMemo(
    () => new Set(skuConflicts.map((c) => c.sku.toLowerCase())),
    [skuConflicts],
  );
  const unresolvedConflicts = useMemo(
    () => skuConflicts.filter((c) => !skuResolutions[c.sku.toLowerCase()]),
    [skuConflicts, skuResolutions],
  );
  const unresolvedBarcodes = useMemo(
    () => barcodeConflicts.filter((c) => barcodeSkipped[c.barcode.toLowerCase()] === undefined),
    [barcodeConflicts, barcodeSkipped],
  );

  // Lookup incoming row data by SKU / barcode for side-by-side compare
  const incomingBySku = useMemo(() => {
    const m = new Map<string, Record<string, string>>();
    for (const r of rows) {
      const k = (r.data.sku ?? "").trim().toLowerCase();
      if (k && !m.has(k)) m.set(k, r.data);
    }
    return m;
  }, [rows]);
  const incomingByBarcode = useMemo(() => {
    const m = new Map<string, Record<string, string>>();
    for (const r of rows) {
      const k = (r.data.barcode ?? "").trim().toLowerCase();
      if (k && !m.has(k)) m.set(k, r.data);
    }
    return m;
  }, [rows]);


  function rowIssue(r: ParsedRow): { kind: "ok" | "warn" | "error"; label: string } {
    const sku = (r.data.sku ?? "").trim();
    const name = (r.data.product_name ?? r.data.name ?? "").trim();
    if (!sku || !name) return { kind: "error", label: "missing fields" };
    if (r.errors.length > 0) return { kind: "error", label: "needs fix" };
    const skuLower = sku.toLowerCase();
    if (duplicateSkus.has(skuLower)) return { kind: "warn", label: "duplicate in file" };
    if (conflictSkuSet.has(skuLower)) {
      const res = skuResolutions[skuLower];
      if (!res) return { kind: "warn", label: "needs your choice" };
      return { kind: "ok", label: res.action === "skip" ? "will skip" : res.action === "new_sku" ? "new SKU" : "will update" };
    }
    return { kind: "ok", label: "ready" };
  }

  const rowsNeedingAttention = useMemo(
    () => rows.filter((r) => rowIssue(r).kind !== "ok").length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, duplicateSkus, conflictSkuSet, skuResolutions],
  );

  const locationsToCreate = useMemo(() => {
    const set = new Map<string, string>();
    for (const { lower, display } of unknownLocations) {
      const choice = locMap[lower];
      if (choice === CREATE_NEW) {
        const name = (newLocNames[lower] ?? display).trim();
        if (name) set.set(name.toLowerCase(), name);
      } else if (!choice && defaultLocation) {
        // falls back
      } else if (!choice) {
        set.set(lower, display);
      }
    }
    return Array.from(set.values());
  }, [unknownLocations, locMap, newLocNames, defaultLocation]);

  const totalStockImpact = useMemo(() => {
    let n = 0;
    for (const r of rows) {
      const v = Number((r.data.stock_quantity ?? "").replace(/[, ]/g, ""));
      if (Number.isFinite(v) && v > 0) n += v;
    }
    return n;
  }, [rows]);

  const readyCount = Math.max(0, rows.length - rowsNeedingAttention);
  const canImport =
    readyCount > 0 && unresolvedConflicts.length === 0 && unresolvedBarcodes.length === 0;

  // Quick-actions for conflicts
  function setAllConflicts(action: ResolutionAction) {
    setSkuResolutions((prev) => {
      const next = { ...prev };
      skuConflicts.forEach((c) => {
        const k = c.sku.toLowerCase();
        if (action === "new_sku") {
          next[k] = { action, new_sku: suggestNewSku(c.sku) };
        } else {
          next[k] = { action };
        }
      });
      return next;
    });
  }

  function suggestNewSku(sku: string): string {
    return `${sku}-NEW`;
  }

  async function doImport() {
    const mappingForApi: Record<string, string> = {};
    for (const { lower, display } of unknownLocations) {
      const choice = locMap[lower];
      if (choice && choice !== CREATE_NEW) {
        mappingForApi[lower] = choice;
      } else if (choice === CREATE_NEW) {
        mappingForApi[lower] = (newLocNames[lower] ?? display).trim() || display;
      } else if (defaultLocation) {
        mappingForApi[lower] = defaultLocation;
      }
    }

    setImporting(true);
    try {
      const res = await onImport({
        rows: rows
          .map((r) => r.data)
          .filter((d) => {
            const bc = (d.barcode ?? "").trim().toLowerCase();
            return !(bc && barcodeSkipped[bc]);
          }),
        location_mappings: mappingForApi,
        auto_create_locations: true,
        auto_create_suppliers: autoCreateSuppliers,
        sku_resolutions: skuResolutions,
      });
      setResult(res);
      const parts: string[] = [];
      if (res.inserted) parts.push(`${res.inserted} added`);
      if (res.updated) parts.push(`${res.updated} updated`);
      if (res.skipped) parts.push(`${res.skipped} skipped`);
      const summary = parts.join(" · ") || "Nothing changed yet";
      if (res.failed === 0) {
        toast.success(`Import finished — ${summary}.`);
      } else {
        toast.warning(`${summary} · ${res.failed} need attention.`);
      }
      onDone?.();
    } catch (e: any) {
      toast.error(e?.message ?? "We couldn't complete the import.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-4 w-4 text-primary" />
            Import products
          </DialogTitle>
          <DialogDescription>
            Upload your file and we'll guide you through anything that needs a quick fix.
          </DialogDescription>
        </DialogHeader>

        {/* Upload */}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadTemplate(schema)}>
            <FileDown className="h-3.5 w-3.5 mr-1.5" />
            Download template
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            {filename ? "Choose another file" : "Choose a file"}
          </Button>
          {filename && <span className="text-xs text-muted-foreground">{filename}</span>}
          {previewing && (
            <span className="text-xs text-muted-foreground">Checking your catalog…</span>
          )}
        </div>

        {/* Empty state */}
        {rows.length === 0 && !result && (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <Sparkles className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-medium">Ready when you are.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Drop in a CSV or Excel file — we'll preview every row before anything is saved.
            </p>
          </div>
        )}

        {/* Summary cards */}
        {rows.length > 0 && !result && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <SummaryCard tone="success" label="Ready to import" value={readyCount} hint="products" />
            <SummaryCard
              tone={rowsNeedingAttention > 0 ? "warning" : "muted"}
              label="Need attention"
              value={rowsNeedingAttention}
              hint="rows"
            />
            <SummaryCard
              tone={locationsToCreate.length > 0 ? "info" : "muted"}
              label="New locations"
              value={locationsToCreate.length}
              hint="will be created"
            />
            <SummaryCard
              tone={totalStockImpact > 0 ? "info" : "muted"}
              label="Stock impact"
              value={totalStockImpact}
              hint="units added"
            />
          </div>
        )}

        {/* Hero message — calm operational tone */}
        {rows.length > 0 && !result && (
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
            <p className="text-sm font-medium">
              {readyCount === rows.length
                ? "Your file is ready to import."
                : readyCount === 0
                  ? "Almost there — a few rows need your input."
                  : `${readyCount} of ${rows.length} rows look good. ${rowsNeedingAttention} need a quick decision.`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Nothing is saved until you confirm. Review the suggestions below and import when you're happy.
            </p>
          </div>
        )}

        {/* Existing SKU conflict resolution */}
        {rows.length > 0 && !result && skuConflicts.length > 0 && (
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {skuConflicts.length === 1
                    ? "We found 1 product with the same SKU already in your inventory."
                    : `We found ${skuConflicts.length} products with SKUs that already exist.`}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Choose what to do for each one — we'll never overwrite anything without your go-ahead.
                </p>
              </div>
            </div>

            {/* Bulk actions */}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setAllConflicts("skip")}>
                Skip all
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAllConflicts("update")}>
                Update all
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAllConflicts("replace_stock")}>
                Replace stock for all
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAllConflicts("new_sku")}>
                Give all a new SKU
              </Button>
            </div>

            <div className="space-y-2">
              {skuConflicts.map((c) => {
                const k = c.sku.toLowerCase();
                const res = skuResolutions[k];
                return (
                  <div key={k} className="rounded-md border border-border bg-background p-2.5">
                    <ConflictCompare
                      existing={{
                        name: c.existing.name,
                        sku: c.sku,
                        barcode: c.existing.barcode ?? null,
                        stock: c.existing.stock,
                        location: c.existing.location,
                      }}
                      incoming={(() => {
                        const d = incomingBySku.get(k);
                        return {
                          name: d?.product_name || d?.name || "—",
                          sku: d?.sku ?? c.sku,
                          barcode: d?.barcode ?? null,
                        };
                      })()}
                      needsAction={!res}
                    />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 mt-2">
                      <ResolutionPill
                        active={res?.action === "update"}
                        label="Update existing"
                        hint="Refresh name, price, etc."
                        onClick={() =>
                          setSkuResolutions((p) => ({ ...p, [k]: { action: "update" } }))
                        }
                      />
                      <ResolutionPill
                        active={res?.action === "skip"}
                        label="Skip row"
                        hint="Keep existing as-is"
                        onClick={() =>
                          setSkuResolutions((p) => ({ ...p, [k]: { action: "skip" } }))
                        }
                      />
                      <ResolutionPill
                        active={res?.action === "replace_stock"}
                        label="Replace stock"
                        hint="Set stock to file value"
                        onClick={() =>
                          setSkuResolutions((p) => ({
                            ...p,
                            [k]: { action: "replace_stock" },
                          }))
                        }
                      />
                      <ResolutionPill
                        active={res?.action === "new_sku"}
                        label="Use a new SKU"
                        hint="Create as separate product"
                        onClick={() =>
                          setSkuResolutions((p) => ({
                            ...p,
                            [k]: { action: "new_sku", new_sku: suggestNewSku(c.sku) },
                          }))
                        }
                      />
                    </div>
                    {res?.action === "new_sku" && (
                      <div className="mt-2 flex items-center gap-2">
                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          className="h-8 text-xs"
                          value={res.new_sku ?? ""}
                          onChange={(e) =>
                            setSkuResolutions((p) => ({
                              ...p,
                              [k]: { action: "new_sku", new_sku: e.target.value },
                            }))
                          }
                          placeholder="New SKU"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Existing Barcode conflict resolution */}
        {rows.length > 0 && !result && barcodeConflicts.length > 0 && (
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {barcodeConflicts.length === 1
                    ? "We found 1 barcode that already belongs to another product."
                    : `We found ${barcodeConflicts.length} barcodes that already belong to other products.`}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Compare each one and choose to skip the row or cancel the whole import.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const next: Record<string, boolean> = {};
                  barcodeConflicts.forEach((c) => (next[c.barcode.toLowerCase()] = true));
                  setBarcodeSkipped(next);
                }}
              >
                Skip all
              </Button>
            </div>
            <div className="space-y-2">
              {barcodeConflicts.map((c) => {
                const k = c.barcode.toLowerCase();
                const skipped = barcodeSkipped[k];
                const d = incomingByBarcode.get(k);
                return (
                  <div key={k} className="rounded-md border border-border bg-background p-2.5">
                    <ConflictCompare
                      existing={{
                        name: c.existing.name,
                        sku: c.existing.sku ?? null,
                        barcode: c.barcode,
                        stock: c.existing.stock,
                        location: c.existing.location,
                      }}
                      incoming={{
                        name: d?.product_name || d?.name || "—",
                        sku: d?.sku ?? null,
                        barcode: d?.barcode ?? c.barcode,
                      }}
                      needsAction={skipped === undefined}
                    />
                    <div className="grid grid-cols-2 gap-1.5 mt-2">
                      <ResolutionPill
                        active={skipped === true}
                        label="Skip row"
                        hint="Leave existing product as-is"
                        onClick={() => setBarcodeSkipped((p) => ({ ...p, [k]: true }))}
                      />
                      <ResolutionPill
                        active={skipped === false}
                        label="Keep row (let server handle)"
                        hint="Row will fail if conflict remains"
                        onClick={() => setBarcodeSkipped((p) => ({ ...p, [k]: false }))}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}


        {/* Friendly notes */}
        {rows.length > 0 && !result && (
          <div className="space-y-2">
            {duplicateSkus.size > 0 && (
              <NoteRow tone="warning">
                {duplicateSkus.size === 1
                  ? "1 SKU appears more than once in this file — only the first occurrence will be kept."
                  : `${duplicateSkus.size} SKUs appear more than once in this file — only the first of each will be kept.`}
              </NoteRow>
            )}
            {nearDuplicateNames > 0 && (
              <NoteRow tone="info">
                Heads up — {nearDuplicateNames} product name
                {nearDuplicateNames === 1 ? "" : "s"} look very similar to{" "}
                {nearDuplicateNames === 1 ? "another row" : "other rows"}. Make sure they're not
                accidental copies.
              </NoteRow>
            )}
            {unknownSuppliers.length > 0 && (
              <NoteRow tone="info">
                {unknownSuppliers.length} supplier
                {unknownSuppliers.length === 1 ? "" : "s"} aren't in your list yet — we'll add{" "}
                {unknownSuppliers.length === 1 ? "it" : "them"} automatically.
              </NoteRow>
            )}
          </div>
        )}

        {/* Location mapping */}
        {rows.length > 0 && !result && unknownLocations.length > 0 && (
          <div className="rounded-lg border border-border p-3 space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">Map locations from your file</p>
            </div>
            <p className="text-xs text-muted-foreground">
              These locations don't exist yet. Pick an existing one, or create a new one — we'll
              handle the rest.
            </p>
            <div className="space-y-2">
              {unknownLocations.map(({ lower, display }) => {
                const choice = locMap[lower] ?? "";
                return (
                  <div
                    key={lower}
                    className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-2"
                  >
                    <div className="text-sm font-medium truncate">{display}</div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground hidden md:block" />
                    <div className="flex gap-2">
                      <Select
                        value={choice}
                        onValueChange={(v) =>
                          setLocMap((prev) => ({ ...prev, [lower]: v }))
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Choose or create…" />
                        </SelectTrigger>
                        <SelectContent>
                          {orgLocations.map((l) => (
                            <SelectItem key={l.id} value={l.name}>
                              {l.name}
                            </SelectItem>
                          ))}
                          <SelectItem value={CREATE_NEW}>+ Create new location</SelectItem>
                        </SelectContent>
                      </Select>
                      {choice === CREATE_NEW && (
                        <Input
                          className="h-8 text-xs"
                          placeholder={display}
                          value={newLocNames[lower] ?? display}
                          onChange={(e) =>
                            setNewLocNames((prev) => ({ ...prev, [lower]: e.target.value }))
                          }
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Supplier preference */}
        {rows.length > 0 && !result && unknownSuppliers.length > 0 && (
          <div className="flex items-center gap-2 rounded-md border border-border p-3">
            <Truck className="h-4 w-4 text-muted-foreground" />
            <Label className="flex-1 text-sm">
              Add new suppliers found in this file automatically
            </Label>
            <Checkbox
              checked={autoCreateSuppliers}
              onCheckedChange={(v) => setAutoCreateSuppliers(v === true)}
            />
          </div>
        )}

        {/* Preview table with row highlighting */}
        {rows.length > 0 && !result && (
          <div className="max-h-[35vh] overflow-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 50).map((r) => {
                  const loc = (r.data.location ?? "").trim();
                  const locLower = loc.toLowerCase();
                  const isUnknown = loc && !orgLocLower.has(locLower);
                  const mapped = isUnknown ? locMap[locLower] : null;
                  const issue = rowIssue(r);
                  const rowCls =
                    issue.kind === "error"
                      ? "bg-destructive/5"
                      : issue.kind === "warn"
                        ? "bg-warning/5"
                        : "";
                  return (
                    <TableRow key={r.rowNumber} className={rowCls}>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.rowNumber + 1}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.data.product_name || r.data.name || (
                          <span className="text-muted-foreground italic">missing</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-mono">{r.data.sku || "—"}</TableCell>
                      <TableCell className="text-xs">
                        {r.data.stock_quantity || "0"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {!loc ? (
                          <span className="text-muted-foreground">
                            {defaultLocation ?? "—"}
                          </span>
                        ) : !isUnknown ? (
                          loc
                        ) : mapped === CREATE_NEW ? (
                          <Badge variant="outline" className="text-xs">
                            new: {newLocNames[locLower] ?? loc}
                          </Badge>
                        ) : mapped ? (
                          <span>
                            {loc} <ArrowRight className="inline h-3 w-3" /> {mapped}
                          </span>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            needs mapping
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {issue.kind === "ok" ? (
                          <span className="text-success inline-flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> {issue.label}
                          </span>
                        ) : issue.kind === "warn" ? (
                          <Badge variant="outline" className="text-warning border-warning/40">
                            {issue.label}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-destructive border-destructive/40">
                            {issue.label}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {rows.length > 50 && (
              <p className="text-xs text-muted-foreground p-2">
                Showing first 50 rows. All {rows.length} will be processed.
              </p>
            )}
          </div>
        )}

        {/* Result — calm operational tone */}
        {result && (
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              {result.failed === 0 ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-warning" />
              )}
              <p className="text-sm font-medium">
                {result.inserted === 0 && (result.updated ?? 0) === 0 && (result.skipped ?? 0) === 0
                  ? "Nothing was imported yet — review the notes below and try again."
                  : "Import finished."}
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <ResultStat label="Added" value={result.inserted} tone="success" />
              <ResultStat label="Updated" value={result.updated ?? 0} tone="info" />
              <ResultStat label="Skipped" value={result.skipped ?? 0} tone="muted" />
              <ResultStat label="Need attention" value={result.failed} tone={result.failed > 0 ? "warning" : "muted"} />
            </div>
            {result.errors.length > 0 && (
              <div className="max-h-40 overflow-auto text-xs border-t border-border pt-2 space-y-1">
                <p className="font-medium mb-1">A few rows need your attention:</p>
                {result.errors.slice(0, 50).map((e, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-muted-foreground shrink-0">
                      {e.row > 0 ? `Row ${e.row}:` : "Note:"}
                    </span>
                    <span>{e.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {rows.length > 0 && !result && (
            <Button
              variant="ghost"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
              disabled={importing}
            >
              Cancel import
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            {result ? "Done" : "Close"}
          </Button>
          {rows.length > 0 && !result && (
            <Button onClick={doImport} disabled={importing || !canImport}>
              {importing
                ? "Importing…"
                : unresolvedConflicts.length > 0
                  ? `Resolve ${unresolvedConflicts.length} SKU conflict${unresolvedConflicts.length === 1 ? "" : "s"} to continue`
                  : unresolvedBarcodes.length > 0
                    ? `Resolve ${unresolvedBarcodes.length} barcode conflict${unresolvedBarcodes.length === 1 ? "" : "s"} to continue`
                    : `Import ${readyCount} product${readyCount === 1 ? "" : "s"}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConflictCompare({
  existing,
  incoming,
  needsAction,
}: {
  existing: { name: string; sku: string | null; barcode: string | null; stock: number; location: string | null };
  incoming: { name: string; sku: string | null; barcode: string | null };
  needsAction: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Existing vs incoming
        </p>
        {needsAction && (
          <Badge variant="outline" className="text-warning border-warning/40 text-[10px]">
            choose action
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div className="rounded-md border border-border bg-muted/30 p-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
            Existing product
          </p>
          <p className="text-sm font-medium truncate">{existing.name}</p>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs">
            <dt className="text-muted-foreground">SKU</dt>
            <dd className="font-mono truncate">{existing.sku ?? "—"}</dd>
            <dt className="text-muted-foreground">Barcode</dt>
            <dd className="font-mono truncate">{existing.barcode ?? "—"}</dd>
            <dt className="text-muted-foreground">Stock</dt>
            <dd>{existing.stock}</dd>
            <dt className="text-muted-foreground">Location</dt>
            <dd className="truncate">{existing.location ?? "—"}</dd>
          </dl>
        </div>
        <div className="rounded-md border border-primary/20 bg-primary/5 p-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
            Incoming row
          </p>
          <p className="text-sm font-medium truncate">{incoming.name}</p>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs">
            <dt className="text-muted-foreground">SKU</dt>
            <dd className="font-mono truncate">{incoming.sku ?? "—"}</dd>
            <dt className="text-muted-foreground">Barcode</dt>
            <dd className="font-mono truncate">{incoming.barcode ?? "—"}</dd>
          </dl>
        </div>
      </div>
    </div>
  );
}


function ResolutionPill({
  active,
  label,
  hint,
  onClick,
}: {
  active: boolean;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-md border px-2.5 py-1.5 transition-colors ${
        active
          ? "border-primary bg-primary/10"
          : "border-border bg-background hover:bg-muted/50"
      }`}
    >
      <p className="text-xs font-medium leading-tight">{label}</p>
      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{hint}</p>
    </button>
  );
}

function ResultStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "info" | "warning" | "muted";
}) {
  const cls =
    tone === "success"
      ? "border-success/30 bg-success/5"
      : tone === "warning"
        ? "border-warning/30 bg-warning/5"
        : tone === "info"
          ? "border-primary/20 bg-primary/5"
          : "border-border bg-muted/30";
  return (
    <div className={`rounded-md border ${cls} p-2`}>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-base font-semibold">{value}</p>
    </div>
  );
}

function SummaryCard({
  tone,
  label,
  value,
  hint,
}: {
  tone: "success" | "warning" | "info" | "muted";
  label: string;
  value: number;
  hint: string;
}) {
  const toneCls =
    tone === "success"
      ? "border-success/30 bg-success/5"
      : tone === "warning"
        ? "border-warning/30 bg-warning/5"
        : tone === "info"
          ? "border-primary/30 bg-primary/5"
          : "border-border bg-muted/30";
  return (
    <div className={`rounded-lg border ${toneCls} p-3`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold mt-0.5">{value}</p>
      <p className="text-[10px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function NoteRow({
  tone,
  children,
}: {
  tone: "warning" | "info";
  children: React.ReactNode;
}) {
  const toneCls =
    tone === "warning"
      ? "border-warning/30 bg-warning/5 text-foreground"
      : "border-primary/20 bg-primary/5 text-foreground";
  return (
    <div className={`flex items-start gap-2 rounded-md border ${toneCls} px-3 py-2 text-xs`}>
      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
