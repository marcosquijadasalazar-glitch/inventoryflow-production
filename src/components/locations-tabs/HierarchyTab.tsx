import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ImportDialog } from "@/components/ImportDialog";
import { listLocationsAll, importLocations } from "@/lib/locations.functions";
import type { ImportSchema } from "@/lib/import-utils";



const SCHEMA: ImportSchema = {
  entity: "locations",
  sheetName: "Locations",
  fields: [
    { key: "location_name", required: true, aliases: ["name"], example: "Main Warehouse" },
    { key: "address", example: "123 Main St" },
    { key: "city", example: "New York" },
    { key: "country", example: "USA" },
    { key: "manager", example: "John Smith" },
    { key: "status", example: "active" },
    { key: "type", example: "warehouse" },
  ],
};

export function HierarchyTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const fetchList = useServerFn(listLocationsAll);
  const runImport = useServerFn(importLocations);
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ["locations-all"], queryFn: () => fetchList({}) });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end flex-wrap gap-2">
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
              <TableHead>{t("locationsPage.name", "Name")}</TableHead>
              <TableHead>{t("locationsPage.type", "Type")}</TableHead>
              <TableHead>{t("locationsPage.address", "Address")}</TableHead>
              <TableHead>{t("locationsPage.status", "Status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading && Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-5 w-full" /></TableCell></TableRow>
            ))}
            {!q.isLoading && (q.data?.locations ?? []).length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                {t("locationsPage.empty", "No locations yet. Import a CSV/Excel file to get started.")}
              </TableCell></TableRow>
            )}
            {(q.data?.locations ?? []).map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-xs capitalize">{c.type}</TableCell>
                <TableCell className="text-xs">{c.address ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={c.is_active ? "secondary" : "outline"}>
                    {c.is_active ? t("locationsPage.active", "Active") : t("locationsPage.inactive", "Inactive")}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ImportDialog
        open={open}
        onOpenChange={setOpen}
        schema={SCHEMA}
        title={t("locationsPage.importTitle", "Import locations")}
        onImport={async (rows) => runImport({ data: { rows } })}
        onDone={() => qc.invalidateQueries({ queryKey: ["locations-all"] })}
      />
    </div>
  );
}
