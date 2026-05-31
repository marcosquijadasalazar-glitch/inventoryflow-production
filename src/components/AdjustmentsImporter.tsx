import { useCallback, useMemo, useRef, useState } from "react";
import { invalidateDerived } from "@/lib/invalidate-after-write";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Upload,
  FileDown,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Sparkles,
  Loader2,
  History,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { parseImportFile, type ImportSchema, type ParsedRow } from "@/lib/import-utils";
import {
  previewAdjustments,
  importAdjustments,
  recentAdjustmentImports,
} from "@/lib/adjustments.functions";
import { useApprovalGate } from "@/components/approvals/useApprovalGate";

const SCHEMA: ImportSchema = {
  entity: "adjustments",
  sheetName: "Adjustments",
  fields: [
    { key: "sku", example: "SKU-001" },
    { key: "barcode", example: "1234567890123" },
    { key: "adjustment_type", required: true, aliases: ["type"], example: "set" },
    { key: "quantity", required: true, aliases: ["qty"], example: "12" },
    { key: "reason", example: "Cycle count" },
    { key: "location", example: "Main Warehouse" },
    { key: "notes", example: "" },
  ],
};

const TEMPLATE_CSV = [
  "sku,barcode,adjustment_type,quantity,reason,location,notes",
  "SKU-001,,set,12,Cycle count,Main Warehouse,",
  "SKU-002,,add,5,Restock,Main Warehouse,",
  ",1234567890123,remove,2,Damaged,Main Warehouse,",
].join("\n");

function downloadCsvTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "adjustments-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

type Step = "upload" | "preview" | "result";

export function AdjustmentsImporter({ onImported }: { onImported?: () => void }) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const runPreview = useServerFn(previewAdjustments);
  const runImport = useServerFn(importAdjustments);
  const { guard, modal } = useApprovalGate();
  const qc = useQueryClient();


  const [step, setStep] = useState<Step>("upload");
  const [dragOver, setDragOver] = useState(false);
  const [filename, setFilename] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewAdjustments>> | null>(null);
  const [batchReason, setBatchReason] = useState("");
  const [confirmLarge, setConfirmLarge] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof importAdjustments>> | null>(null);

  const reset = () => {
    setStep("upload");
    setFilename("");
    setParsedRows([]);
    setPreview(null);
    setBatchReason("");
    setConfirmLarge(false);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = useCallback(async (f: File) => {
    setParsing(true);
    try {
      const { rows } = await parseImportFile(f, SCHEMA);
      if (rows.length === 0) {
        toast.error(t("adjustments.empty", "We couldn't find any rows in this file."));
        return;
      }
      setFilename(f.name);
      setParsedRows(rows);
      setPreviewing(true);
      const res = await runPreview({ data: { rows: rows.map((r) => r.data) } });
      setPreview(res);
      setStep("preview");
    } catch (e: any) {
      toast.error(e?.message ?? t("adjustments.parseFail", "Couldn't read this file."));
    } finally {
      setParsing(false);
      setPreviewing(false);
    }
  }, [runPreview, t]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const startImport = async () => {
    if (!preview) return;
    const performImport = async () => {
      setImporting(true);
      try {
        const res = await runImport({
          data: {
            rows: parsedRows.map((r) => r.data),
            batch_reason: batchReason.trim(),
            confirm_large: confirmLarge,
          },
        });
        setResult(res);
        setStep("result");
        if (res.failed === 0) {
          toast.success(t("adjustments.successToast", "{{n}} stock adjustments imported successfully.", { n: res.inserted }));
        } else {
          toast.warning(t("adjustments.partialToast", "{{ok}} imported, {{fail}} need a second look.", { ok: res.inserted, fail: res.failed }));
        }
        qc.invalidateQueries({ queryKey: ["products"] });
        qc.invalidateQueries({ queryKey: ["movements"] });
        invalidateDerived(qc);
        onImported?.();
      } catch (e: any) {
        toast.error(e?.message ?? t("adjustments.importFail", "Import failed."));
      } finally {
        setImporting(false);
      }
    };
    const totalQty = parsedRows.reduce((s, r) => s + (Number((r.data as any).quantity) || 0), 0);
    guard({
      action: "large_import",
      measurements: { quantity: parsedRows.length, value: totalQty },
      entityLabel: filename || `${parsedRows.length} rows`,
      onApproved: performImport,
    });
  };

  const previewRows = preview?.rows ?? [];
  const summary = preview?.summary;
  const hasWarnings = (summary?.warnings ?? 0) > 0;
  const hasLarge = (summary?.large ?? 0) > 0;
  const canImport = !!summary && summary.valid > 0 && (!hasLarge || confirmLarge);

  return (
    <>
    <Card>
      <CardContent className="p-5 space-y-4">
        {step === "upload" && (
          <>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              role="button"
              tabIndex={0}
              className={`group cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
              }`}
            >
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                {parsing || previewing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
              </div>
              <p className="text-sm font-medium">
                {parsing
                  ? t("adjustments.parsing", "Reading your file…")
                  : previewing
                  ? t("adjustments.checking", "Checking stock impact…")
                  : t("adjustments.dropTitle", "Drop your CSV here or click to upload")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("adjustments.dropHint", "We'll preview every change before anything is saved.")}
              </p>
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
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); downloadCsvTemplate(); }}
                className="inline-flex items-center gap-1.5 text-primary hover:underline"
              >
                <FileDown className="h-3.5 w-3.5" />
                {t("adjustments.downloadCsv", "Download CSV template")}
              </button>
              <span>{t("adjustments.supportedFormats", "Supports .csv, .xlsx")}</span>
            </div>
          </>
        )}

        {step === "preview" && summary && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm">
                <p className="font-medium">{filename}</p>
                <p className="text-xs text-muted-foreground">
                  {t("adjustments.previewIntro", "Review the stock impact below. Nothing is saved until you confirm.")}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={reset}>
                {t("adjustments.replaceFile", "Replace file")}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatCard label={t("adjustments.statTotal", "Rows")} value={summary.total} />
              <StatCard label={t("adjustments.statValid", "Ready")} value={summary.valid} tone="success" />
              <StatCard label={t("adjustments.statErrors", "Need fixes")} value={summary.errors} tone={summary.errors ? "destructive" : "muted"} />
              <StatCard label={t("adjustments.statNetDelta", "Net change")} value={(summary.net_delta > 0 ? "+" : "") + summary.net_delta} tone="muted" />
            </div>

            {(hasLarge || summary.negatives > 0) && (
              <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-sm">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <div className="space-y-1.5">
                    {hasLarge && (
                      <p>
                        {t("adjustments.warnLarge", "We noticed unusual inventory differences for {{n}} products.", { n: summary.large })}
                      </p>
                    )}
                    {summary.negatives > 0 && (
                      <p>
                        {t("adjustments.warnNegative", "{{n}} rows would push stock below zero.", { n: summary.negatives })}
                      </p>
                    )}
                    {hasLarge && (
                      <label className="mt-1 flex items-center gap-2 text-xs">
                        <Checkbox checked={confirmLarge} onCheckedChange={(v) => setConfirmLarge(!!v)} />
                        {t("adjustments.confirmLarge", "I've reviewed these and want to apply the large changes.")}
                      </label>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("adjustments.batchReason", "Reason for this batch (optional)")}
              </label>
              <Textarea
                value={batchReason}
                onChange={(e) => setBatchReason(e.target.value)}
                placeholder={t("adjustments.batchReasonHint", "E.g. Monthly cycle count for Main Warehouse")}
                className="text-sm"
                rows={2}
              />
            </div>

            <div className="max-h-[45vh] overflow-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>{t("adjustments.colProduct", "Product")}</TableHead>
                    <TableHead>{t("adjustments.colType", "Action")}</TableHead>
                    <TableHead className="text-right">{t("adjustments.colImpact", "Stock impact")}</TableHead>
                    <TableHead>{t("adjustments.colStatus", "Status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.slice(0, 200).map((r) => (
                    <TableRow key={r.row} className={r.error ? "bg-destructive/5" : r.warnings.length ? "bg-warning/5" : ""}>
                      <TableCell className="text-xs text-muted-foreground">{r.row}</TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium">{r.product_name ?? r.sku ?? r.barcode ?? "—"}</div>
                        <div className="text-muted-foreground">{r.sku ?? r.barcode ?? ""}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.type ? <Badge variant="outline" className="font-normal">{r.type === "adjustment" ? "set" : r.type}</Badge> : "—"}
                        {r.quantity != null && <span className="ml-2 text-muted-foreground">×{r.quantity}</span>}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {r.current_stock != null && r.new_stock != null ? (
                          <span className="inline-flex items-center gap-1">
                            <span className="text-muted-foreground">{r.current_stock}</span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <span className={r.new_stock < 0 ? "text-destructive font-medium" : "font-medium"}>{r.new_stock}</span>
                            {r.delta != null && r.delta !== 0 && (
                              <span className={`ml-1 ${r.delta > 0 ? "text-success" : "text-destructive"}`}>
                                ({r.delta > 0 ? "+" : ""}{r.delta})
                              </span>
                            )}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.error ? (
                          <span className="text-destructive inline-flex items-center gap-1">
                            <XCircle className="h-3 w-3" /> {r.error}
                          </span>
                        ) : r.warnings.length ? (
                          <span className="text-warning inline-flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> {r.warnings.join(", ")}
                          </span>
                        ) : (
                          <span className="text-success inline-flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> {t("adjustments.ready", "Ready")}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {previewRows.length > 200 && (
              <p className="text-xs text-muted-foreground">
                {t("adjustments.previewLimit", "Showing first 200 rows. All valid rows will be imported.")}
              </p>
            )}

            {importing && <Progress value={undefined} className="h-1" />}

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={reset} disabled={importing}>
                {t("common.cancel", "Cancel")}
              </Button>
              <Button onClick={startImport} disabled={!canImport || importing}>
                {importing ? (
                  <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> {t("adjustments.applying", "Applying…")}</>
                ) : (
                  t("adjustments.applyN", "Apply {{n}} adjustments", { n: summary.valid })
                )}
              </Button>
            </div>
          </>
        )}

        {step === "result" && result && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${result.failed === 0 ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                {result.failed === 0 ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
              </div>
              <div>
                <p className="font-medium">
                  {result.failed === 0
                    ? t("adjustments.allDone", "{{n}} stock adjustments imported successfully.", { n: result.inserted })
                    : t("adjustments.partialDone", "{{ok}} imported. {{fail}} need a second look.", { ok: result.inserted, fail: result.failed })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("adjustments.touched", "{{n}} products updated.", { n: result.summary.products_touched })}
                </p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="max-h-40 space-y-1 overflow-auto rounded-md border border-border p-2 text-xs">
                {result.errors.map((e, i) => (
                  <div key={i} className="text-destructive">Row {e.row}: {e.message}</div>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset}>{t("adjustments.importAnother", "Import another file")}</Button>
              <Link to="/history"><Button variant="ghost">{t("adjustments.viewHistory", "View history")}</Button></Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
    {modal}
    </>
  );
}

function StatCard({ label, value, tone = "default" }: { label: string; value: number | string; tone?: "default" | "success" | "destructive" | "muted" }) {
  const toneCls =
    tone === "success" ? "text-success"
    : tone === "destructive" ? "text-destructive"
    : tone === "muted" ? "text-muted-foreground"
    : "text-foreground";
  return (
    <div className="rounded-md border border-border p-2.5">
      <div className={`text-lg font-semibold tabular-nums ${toneCls}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

export function RecentImportsCard({ refreshKey }: { refreshKey: number }) {
  const { t } = useTranslation();
  const fetchRecent = useServerFn(recentAdjustmentImports);
  const { data, isLoading } = useQuery({
    queryKey: ["adjustments", "recent", refreshKey],
    queryFn: () => fetchRecent({}),
  });
  const items = data?.items ?? [];
  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">{t("adjustments.recentTitle", "Recent imports")}</h3>
        </div>
        {isLoading ? (
          <p className="text-xs text-muted-foreground">{t("common.loading", "Loading…")}</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {t("adjustments.recentEmpty", "Your imports will appear here.")}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((it: any) => {
              const m = it.metadata ?? {};
              return (
                <li key={it.id} className="flex items-start justify-between gap-3 py-2 text-xs">
                  <div>
                    <p className="font-medium text-foreground">{it.summary ?? t("adjustments.batch", "Bulk adjustment")}</p>
                    <p className="text-muted-foreground">
                      {new Date(it.created_at).toLocaleString()} · {it.actor_email ?? "—"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1">
                    <Badge variant="secondary" className="text-[10px]">
                      {t("adjustments.products", "{{n}} products", { n: m.products_touched ?? 0 })}
                    </Badge>
                    {(m.large_changes ?? 0) > 0 && (
                      <Badge variant="outline" className="border-warning/40 text-warning text-[10px]">
                        {t("adjustments.largeCount", "{{n}} large", { n: m.large_changes })}
                      </Badge>
                    )}
                    {(m.failed ?? 0) > 0 && (
                      <Badge variant="outline" className="border-destructive/40 text-destructive text-[10px]">
                        {t("adjustments.failedCount", "{{n}} skipped", { n: m.failed })}
                      </Badge>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function GuidanceCard() {
  const { t } = useTranslation();
  const items = useMemo(() => ([
    { icon: Sparkles, title: t("adjustments.tipSetTitle", "Use set for cycle counts"), body: t("adjustments.tipSetBody", "Use 'set' when you want inventory to match the real physical count.") },
    { icon: ArrowRight, title: t("adjustments.tipAddTitle", "Use add for restocks"), body: t("adjustments.tipAddBody", "Use 'add' to increase stock after receiving items.") },
    { icon: ShieldCheck, title: t("adjustments.tipPreviewTitle", "Always preview first"), body: t("adjustments.tipPreviewBody", "We'll show every stock change before anything is saved.") },
    { icon: ScanLine, title: t("adjustments.tipScannerTitle", "Or use the Scanner"), body: t("adjustments.tipScannerBody", "Counts and quick fixes are faster on a phone in Scanner mode.") },
  ]), [t]);
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <h3 className="text-sm font-medium">{t("adjustments.guidanceTitle", "How adjustments work")}</h3>
        <ul className="space-y-2.5">
          {items.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex items-start gap-2.5 text-sm">
              <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div>
                <p className="font-medium leading-tight">{title}</p>
                <p className="text-xs text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
