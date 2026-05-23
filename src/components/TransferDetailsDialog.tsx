import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getTransferOrder,
  listTransferMovements,
  getProfileEmail,
  type TransferStatus,
} from "@/lib/orders";

const STATUS_COLORS: Record<TransferStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  in_transit: "bg-warning/15 text-[oklch(0.5_0.14_70)]",
  completed: "bg-success/10 text-[oklch(0.4_0.12_155)]",
  cancelled: "bg-destructive/10 text-destructive",
};

export function TransferDetailsDialog({
  transferId,
  open,
  onClose,
}: {
  transferId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleString(i18n.language) : "—";

  const transfer = useQuery({
    queryKey: ["transfer_order", transferId],
    queryFn: () => getTransferOrder(transferId!),
    enabled: !!transferId && open,
  });

  const tr = transfer.data;

  const movements = useQuery({
    queryKey: ["transfer_movements", tr?.transfer_number],
    queryFn: () => listTransferMovements(tr!.transfer_number),
    enabled: !!tr?.transfer_number && open,
  });

  const creator = useQuery({
    queryKey: ["profile_email", tr?.created_by],
    queryFn: () => getProfileEmail(tr!.created_by!),
    enabled: !!tr?.created_by && open,
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl bg-surface max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono text-base">
            {tr?.transfer_number ?? t("common.loading")}
            {tr && (
              <Badge variant="outline" className={STATUS_COLORS[tr.status]}>
                {t(`tr.statuses.${tr.status}`, tr.status)}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {!tr ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : (
          <div className="space-y-5 text-sm">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label={t("tr.from", "From")} value={tr.from_location ?? "—"} />
              <Field label={t("tr.to", "To")} value={tr.to_location ?? "—"} />
              <Field
                label={t("tr.date", "Transfer date")}
                value={tr.transfer_date ?? "—"}
              />
              <Field
                label={t("tr.completed_date", "Completed date")}
                value={tr.completed_date ?? "—"}
              />
              <Field
                label={t("tr.created_at", "Created")}
                value={fmt(tr.created_at)}
              />
              <Field
                label={t("tr.created_by", "Created by")}
                value={creator.data ?? (tr.created_by ? "…" : "—")}
              />
            </div>

            {tr.notes && (
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  {t("common.notes")}
                </p>
                <p className="whitespace-pre-wrap">{tr.notes}</p>
              </div>
            )}

            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                {t("po.items", "Items")}
              </p>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("po.product", "Product")}</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">
                        {t("common.quantity")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(tr.items ?? []).map((it) => (
                      <TableRow key={it.id}>
                        <TableCell>{it.product_name}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {it.sku ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">{it.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                {t("tr.related_movements", "Related inventory movements")}
              </p>
              {movements.isLoading ? (
                <p className="text-xs text-muted-foreground">
                  {t("common.loading")}
                </p>
              ) : !movements.data?.length ? (
                <p className="text-xs text-muted-foreground">
                  {t("tr.no_movements", "No related movements yet.")}
                </p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("mv.date", "Date")}</TableHead>
                        <TableHead>{t("mv.type", "Type")}</TableHead>
                        <TableHead className="text-right">
                          {t("common.quantity")}
                        </TableHead>
                        <TableHead>{t("common.notes")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movements.data.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="text-xs">
                            {fmt(m.created_at)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {m.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{m.quantity}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {m.note}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
