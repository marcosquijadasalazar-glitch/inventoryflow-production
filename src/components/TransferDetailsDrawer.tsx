import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getTransferOrder, type TransferOrder, type TransferStatus } from "@/lib/orders";
import { getCompanySettings } from "@/lib/settings";
import { exportTransferOrderPdf } from "@/lib/pdf";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowRight, FileDown, Printer } from "lucide-react";

const sb = supabase as any;

const STATUS_COLORS: Record<TransferStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  in_transit: "bg-warning/15 text-[oklch(0.5_0.14_70)]",
  completed: "bg-success/10 text-[oklch(0.4_0.12_155)]",
  cancelled: "bg-destructive/10 text-destructive",
};

export function TransferDetailsDrawer({
  transferId,
  onClose,
}: {
  transferId: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const open = !!transferId;

  const details = useQuery({
    queryKey: ["transfer_order_details", transferId],
    queryFn: () => getTransferOrder(transferId!),
    enabled: open,
  });

  const movements = useQuery({
    queryKey: ["transfer_movements", details.data?.transfer_number],
    queryFn: async () => {
      const num = details.data?.transfer_number;
      if (!num) return [];
      const { data, error } = await sb
        .from("inventory_movements")
        .select("id, type, quantity, note, created_at, product_id")
        .ilike("note", `%${num}%`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!details.data?.transfer_number,
  });

  const downloadPdf = async (full: TransferOrder) => {
    try {
      const settings = await getCompanySettings().catch(() => null);
      await exportTransferOrderPdf({
        transferNumber: full.transfer_number,
        fromLocation: full.from_location ?? "",
        toLocation: full.to_location ?? "",
        transferDate: full.transfer_date,
        status: full.status,
        items: (full.items ?? []).map((i: any) => ({
          product_name: i.product_name,
          sku: i.sku,
          quantity: i.quantity,
        })),
        notes: full.notes,
        settings,
      });
    } catch (e: any) {
      toast.error(e.message ?? String(e));
    }
  };

  const tr = details.data;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className="font-mono text-sm">{tr?.transfer_number ?? "—"}</span>
            {tr && (
              <Badge variant="outline" className={STATUS_COLORS[tr.status]}>
                {t(`tr.statuses.${tr.status}`, tr.status)}
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        {details.isLoading || !tr ? (
          <p className="mt-6 text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : (
          <div className="mt-4 space-y-5 text-sm">
            <div className="rounded-lg border p-3 bg-surface/40">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span>{tr.from_location ?? "—"}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span>{tr.to_location ?? "—"}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <Field label={t("po.order_date", "Date")} value={tr.transfer_date ?? "—"} />
              <Field
                label={t("tr.completed_date", "Completed")}
                value={tr.completed_date ?? "—"}
              />
              <Field
                label={t("tr.created", "Created")}
                value={new Date(tr.created_at).toLocaleString()}
              />
              <Field
                label={t("common.notes")}
                value={tr.notes || "—"}
              />
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                {t("po.items", "Items")}
              </p>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("po.product", "Product")}</TableHead>
                      <TableHead>{t("products.sku", "SKU")}</TableHead>
                      <TableHead className="text-right">
                        {t("common.quantity")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(tr.items ?? []).map((i: any) => (
                      <TableRow key={i.id}>
                        <TableCell>
                          <p>{i.product_name}</p>
                          {i.barcode && (
                            <p className="font-mono text-[10px] text-muted-foreground">
                              {i.barcode}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{i.sku ?? "—"}</TableCell>
                        <TableCell className="text-right">{i.quantity}</TableCell>
                      </TableRow>
                    ))}
                    {(tr.items ?? []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                          {t("common.noResults")}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                {t("tr.related_movements", "Related inventory movements")}
              </p>
              {movements.isLoading ? (
                <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
              ) : (movements.data ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t("tr.no_movements", "No linked movements yet.")}
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {movements.data!.map((m: any) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between rounded border px-2.5 py-1.5 text-xs"
                    >
                      <span className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            m.type === "add"
                              ? "bg-success/10 text-[oklch(0.4_0.12_155)]"
                              : "bg-destructive/10 text-destructive"
                          }
                        >
                          {m.type === "add" ? "+" : "−"} {m.quantity}
                        </Badge>
                        <span className="text-muted-foreground">{m.note}</span>
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(m.created_at).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => downloadPdf(tr)}>
                <FileDown className="h-4 w-4" /> {t("common.exportPdf")}
              </Button>
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> {t("common.print")}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm mt-0.5">{value}</p>
    </div>
  );
}
