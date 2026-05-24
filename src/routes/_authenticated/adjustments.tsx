import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImportDialog } from "@/components/ImportDialog";
import { importAdjustments } from "@/lib/adjustments.functions";
import type { ImportSchema } from "@/lib/import-utils";

export const Route = createFileRoute("/_authenticated/adjustments")({
  component: AdjustmentsPage,
});

const SCHEMA: ImportSchema = {
  entity: "adjustments",
  sheetName: "Adjustments",
  fields: [
    { key: "sku", example: "SKU-001" },
    { key: "barcode", example: "1234567890" },
    { key: "adjustment_type", required: true, aliases: ["type"], example: "add" },
    { key: "quantity", required: true, aliases: ["qty"], example: "10" },
    { key: "reason", example: "Restock" },
    { key: "location", example: "Main Warehouse" },
    { key: "notes", example: "" },
  ],
};

function AdjustmentsPage() {
  const { t } = useTranslation();
  const runImport = useServerFn(importAdjustments);
  const [open, setOpen] = useState(false);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5" />
            {t("adjustments.title", "Inventory Adjustments")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("adjustments.subtitle", "Bulk import stock adjustments. Each row creates a movement and updates stock.")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            {t("importer.button", "Import")}
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-border p-4 text-sm text-muted-foreground space-y-2">
        <p>
          <strong>{t("adjustments.howTitle", "How it works")}:</strong>{" "}
          {t("adjustments.howBody", "Provide sku or barcode to identify each product. adjustment_type accepts: add, remove, adjustment (set absolute).")}
        </p>
        <ul className="list-disc pl-5 text-xs space-y-1">
          <li>{t("adjustments.help1", "add — increases stock by quantity")}</li>
          <li>{t("adjustments.help2", "remove — decreases stock by quantity")}</li>
          <li>{t("adjustments.help3", "adjustment — sets absolute stock to quantity")}</li>
        </ul>
      </div>

      <ImportDialog
        open={open}
        onOpenChange={setOpen}
        schema={SCHEMA}
        title={t("adjustments.importTitle", "Import inventory adjustments")}
        onImport={async (rows) => runImport({ data: { rows } })}
      />
    </div>
  );
}
