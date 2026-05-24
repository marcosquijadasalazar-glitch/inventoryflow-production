import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ImportDialog } from "@/components/ImportDialog";
import { listSuppliers, importSuppliers } from "@/lib/suppliers.functions";
import type { ImportSchema } from "@/lib/import-utils";

export const Route = createFileRoute("/_authenticated/suppliers")({
  component: SuppliersPage,
});

const SCHEMA: ImportSchema = {
  entity: "suppliers",
  sheetName: "Suppliers",
  fields: [
    { key: "supplier_name", required: true, aliases: ["name"], example: "ACME Distributors" },
    { key: "contact_name", aliases: ["contact"], example: "Jane Doe" },
    { key: "email", example: "ap@acme.com" },
    { key: "phone", example: "+1 555 0100" },
    { key: "payment_terms", aliases: ["terms"], example: "Net 30" },
    { key: "notes", example: "Preferred supplier" },
    { key: "status", example: "active" },
  ],
};

function SuppliersPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const fetchList = useServerFn(listSuppliers);
  const runImport = useServerFn(importSuppliers);
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ["suppliers"], queryFn: () => fetchList({}) });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Truck className="h-5 w-5" />
            {t("suppliers.title", "Suppliers")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("suppliers.subtitle", "Manage your supplier directory")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            {t("importer.button", "Import")}
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("suppliers.name", "Name")}</TableHead>
              <TableHead>{t("suppliers.email", "Email")}</TableHead>
              <TableHead>{t("suppliers.phone", "Phone")}</TableHead>
              <TableHead>{t("suppliers.notes", "Notes")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading && Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-5 w-full" /></TableCell></TableRow>
            ))}
            {!q.isLoading && (q.data?.suppliers ?? []).length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                {t("suppliers.empty", "No suppliers yet. Import a CSV/Excel file to get started.")}
              </TableCell></TableRow>
            )}
            {(q.data?.suppliers ?? []).map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.email ?? "—"}</TableCell>
                <TableCell>{c.phone ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{c.notes ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ImportDialog
        open={open}
        onOpenChange={setOpen}
        schema={SCHEMA}
        title={t("suppliers.importTitle", "Import suppliers")}
        onImport={async (rows) => runImport({ data: { rows } })}
        onDone={() => qc.invalidateQueries({ queryKey: ["suppliers"] })}
      />
    </div>
  );
}
