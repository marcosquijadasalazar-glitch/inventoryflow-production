import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FileDown } from "lucide-react";
import {
  downloadTemplate,
  parseImportFile,
  type ImportSchema,
} from "@/lib/import-utils";
import {
  importHierarchy,
  type HierarchyImportResult,
} from "@/lib/location-tree";

const SCHEMA: ImportSchema = {
  entity: "locations",
  sheetName: "Locations",
  fields: [
    {
      key: "location_name",
      required: true,
      aliases: ["location", "warehouse"],
      example: "Main Warehouse",
    },
    {
      key: "sub_location_name",
      aliases: ["sublocation", "sub_location", "zone"],
      example: "Cold Storage",
    },
    { key: "aisle_name", aliases: ["aisle"], example: "Aisle A" },
    { key: "bin_name", aliases: ["bin", "shelf"], example: "A-01" },
    { key: "code", example: "A-01" },
    { key: "notes", example: "Top shelf" },
  ],
};

export function ImportLocationsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<HierarchyImportResult | null>(null);

  if (!open) return null;

  const reset = () => {
    setFile(null);
    setResult(null);
  };

  const submit = async () => {
    if (!file) return;
    setImporting(true);
    setResult(null);
    try {
      const parsed = await parseImportFile(file, SCHEMA);
      const valid = parsed.rows.filter((r) => r.errors.length === 0);
      const res = await importHierarchy(valid.map((r) => r.data as any));
      // Add parse-level errors to result
      for (const r of parsed.rows.filter((r) => r.errors.length > 0)) {
        res.failed++;
        res.errors.push({ row: r.rowNumber + 1, message: r.errors.join("; ") });
      }
      setResult(res);
      qc.invalidateQueries({ queryKey: ["location-nodes-all"] });
      qc.invalidateQueries({ queryKey: ["locations"] });
      const createdTotal = Object.values(res.created).reduce((a, b) => a + b, 0);
      if (createdTotal > 0)
        toast.success(t("ln.import_done", "Import complete"));
      else if (res.failed === 0)
        toast.message(t("ln.import_no_changes", "No new nodes created"));
      else toast.error(t("ln.import_errors", "Some rows failed"));
    } catch (e: any) {
      toast.error(e?.message ?? String(e));
    } finally {
      setImporting(false);
    }
  };

  const close = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent className="bg-surface max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("ln.import_title", "Import Locations")}</DialogTitle>
          <DialogDescription>
            {t(
              "ln.import_desc",
              "Upload a CSV or XLSX with location, sub-location, aisle, and bin columns. Existing nodes are reused.",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {t(
                "ln.import_cols",
                "Columns: location_name, sub_location_name, aisle_name, bin_name, code, notes",
              )}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadTemplate(SCHEMA, "locations-template.xlsx")}
            >
              <FileDown className="h-4 w-4" />
              {t("ln.template", "Template")}
            </Button>
          </div>

          <Input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setResult(null);
            }}
          />

          {result && (
            <div className="rounded-md border border-border bg-card p-3 text-xs space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {(["location", "sublocation", "aisle", "bin"] as const).map((k) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-muted-foreground capitalize">{k}s</span>
                    <span className="tabular-nums">
                      +{result.created[k]} / ~{result.reused[k]}
                    </span>
                  </div>
                ))}
              </div>
              {result.failed > 0 && (
                <>
                  <p className="text-destructive font-medium">
                    {t("ln.failed", "Failed")}: {result.failed}
                  </p>
                  <ul className="max-h-24 overflow-auto text-destructive/90 space-y-0.5">
                    {result.errors.slice(0, 8).map((e, i) => (
                      <li key={i}>
                        Row {e.row}: {e.message}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={importing}>
            {t("common.close", "Close")}
          </Button>
          <Button onClick={submit} disabled={!file || importing}>
            <Upload className="h-4 w-4" />
            {importing ? t("common.saving", "Importing…") : t("ln.import", "Import")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
