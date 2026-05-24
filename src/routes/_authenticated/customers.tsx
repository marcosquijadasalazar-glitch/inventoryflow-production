import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ImportDialog } from "@/components/ImportDialog";
import { listCustomers, importCustomers } from "@/lib/customers.functions";
import type { ImportSchema } from "@/lib/import-utils";

export const Route = createFileRoute("/_authenticated/customers")({
  component: CustomersPage,
});

const CUSTOMERS_SCHEMA: ImportSchema = {
  entity: "customers",
  sheetName: "Customers",
  fields: [
    { key: "name", required: true, aliases: ["full_name", "customer_name"], example: "Acme Corp" },
    { key: "email", aliases: ["e-mail"], example: "billing@acme.com" },
    { key: "phone", example: "+1 555 1234" },
    { key: "address", example: "123 Main St" },
    { key: "notes", example: "VIP" },
    { key: "status", example: "active" },
  ],
};

function CustomersPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const fetchList = useServerFn(listCustomers);
  const runImport = useServerFn(importCustomers);
  const [open, setOpen] = useState(false);

  const q = useQuery({
    queryKey: ["customers"],
    queryFn: () => fetchList({}),
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t("customers.title", "Customers")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("customers.subtitle", "Manage your customer directory")}
          </p>
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
              <TableHead>{t("customers.name", "Name")}</TableHead>
              <TableHead>{t("customers.email", "Email")}</TableHead>
              <TableHead>{t("customers.phone", "Phone")}</TableHead>
              <TableHead>{t("customers.address", "Address")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading && (
              <>
                {Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={4}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              </>
            )}
            {!q.isLoading && (q.data?.customers ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                  {t("customers.empty", "No customers yet. Import a CSV/Excel file to get started.")}
                </TableCell>
              </TableRow>
            )}
            {(q.data?.customers ?? []).map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.email ?? "—"}</TableCell>
                <TableCell>{c.phone ?? "—"}</TableCell>
                <TableCell>{c.address ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ImportDialog
        open={open}
        onOpenChange={setOpen}
        schema={CUSTOMERS_SCHEMA}
        title={t("customers.importTitle", "Import customers")}
        onImport={async (rows) => runImport({ data: { rows } })}
        onDone={() => qc.invalidateQueries({ queryKey: ["customers"] })}
      />
    </div>
  );
}
