import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Upload, FileDown, AlertCircle, CheckCircle2 } from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  downloadTemplate,
  parseImportFile,
  type ImportSchema,
  type ParsedRow,
  type ImportResult,
} from "@/lib/import-utils";

export type ImportDialogProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  schema: ImportSchema;
  title: string;
  onImport: (rows: Record<string, string>[]) => Promise<ImportResult>;
  onDone?: () => void;
};

export function ImportDialog({ open, onOpenChange, schema, title, onImport, onDone }: ImportDialogProps) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [unknown, setUnknown] = useState<string[]>([]);
  const [filename, setFilename] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  function reset() {
    setRows([]);
    setUnknown([]);
    setFilename("");
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleFile(f: File) {
    try {
      const { rows: parsed, unknownHeaders } = await parseImportFile(f, schema);
      setRows(parsed);
      setUnknown(unknownHeaders);
      setFilename(f.name);
      setResult(null);
      if (parsed.length === 0) toast.error(t("importer.empty", "No rows found in file"));
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to read file");
    }
  }

  async function doImport() {
    const validRows = rows.filter((r) => r.errors.length === 0).map((r) => r.data);
    if (validRows.length === 0) {
      toast.error(t("importer.noValidRows", "No valid rows to import"));
      return;
    }
    setImporting(true);
    try {
      const res = await onImport(validRows);
      setResult(res);
      if (res.failed === 0) {
        toast.success(t("importer.success", "Imported {{n}} records", { n: res.inserted }));
      } else {
        toast.warning(t("importer.partial", "Imported {{ok}}, {{fail}} failed", { ok: res.inserted, fail: res.failed }));
      }
      onDone?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Import failed");
    } finally {
      setImporting(false);
    }
  }

  const errorCount = rows.filter((r) => r.errors.length > 0).length;
  const okCount = rows.length - errorCount;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {t("importer.description", "Upload a CSV or Excel file. Download the template to ensure correct column names.")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadTemplate(schema)}>
            <FileDown className="h-3.5 w-3.5 mr-1.5" />
            {t("importer.downloadTemplate", "Download template")}
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
            {t("importer.chooseFile", "Choose file")}
          </Button>
          {filename && <span className="text-xs text-muted-foreground self-center">{filename}</span>}
        </div>

        {unknown.length > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-warning/20 bg-warning/5 px-3 py-2 text-xs">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              {t("importer.unknownHeaders", "Ignored columns")}: {unknown.join(", ")}
            </span>
          </div>
        )}

        {rows.length > 0 && !result && (
          <>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className="text-foreground">{t("importer.total", "Total: {{n}}", { n: rows.length })}</span>
              <span className="text-success">{t("importer.valid", "Valid: {{n}}", { n: okCount })}</span>
              {errorCount > 0 && (
                <span className="text-destructive">
                  {t("importer.errors", "Errors: {{n}}", { n: errorCount })}
                </span>
              )}
            </div>
            <div className="max-h-[40vh] overflow-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    {schema.fields.map((f) => (
                      <TableHead key={f.key}>{f.key}</TableHead>
                    ))}
                    <TableHead>{t("importer.status", "Status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 100).map((r) => (
                    <TableRow key={r.rowNumber} className={r.errors.length ? "bg-destructive/5" : ""}>
                      <TableCell className="text-xs text-muted-foreground">{r.rowNumber + 1}</TableCell>
                      {schema.fields.map((f) => (
                        <TableCell key={f.key} className="text-xs">
                          {r.data[f.key] ?? ""}
                        </TableCell>
                      ))}
                      <TableCell className="text-xs">
                        {r.errors.length ? (
                          <span className="text-destructive">{r.errors.join("; ")}</span>
                        ) : (
                          <span className="text-success inline-flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> OK
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {rows.length > 100 && (
              <p className="text-xs text-muted-foreground">
                {t("importer.previewLimit", "Showing first 100 rows. All valid rows will be imported.")}
              </p>
            )}
          </>
        )}

        {result && (
          <div className="rounded-md border border-border p-4 space-y-2">
            <p className="text-sm font-medium">{t("importer.summary", "Import summary")}</p>
            <ul className="text-sm space-y-1">
              <li className="text-success">✓ {t("importer.inserted", "Inserted: {{n}}", { n: result.inserted })}</li>
              {result.failed > 0 && (
                <li className="text-destructive">✗ {t("importer.failed", "Failed: {{n}}", { n: result.failed })}</li>
              )}
            </ul>
            {result.errors.length > 0 && (
              <div className="max-h-40 overflow-auto text-xs border-t border-border pt-2 space-y-1">
                {result.errors.map((e, i) => (
                  <div key={i} className="text-destructive">
                    Row {e.row}: {e.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            {t("common.close", "Close")}
          </Button>
          {rows.length > 0 && !result && (
            <Button onClick={doImport} disabled={importing || okCount === 0}>
              {importing
                ? t("common.loading", "Loading…")
                : t("importer.importN", "Import {{n}}", { n: okCount })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
