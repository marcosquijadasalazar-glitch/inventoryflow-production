import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  listTransferOrders,
  createTransferOrder,
  completeTransferOrder,
  updateTransferStatus,
  type TransferItem,
  type TransferStatus,
  type TransferOrder,
} from "@/lib/orders";
import { type Location } from "@/lib/locations";
import { listProducts } from "@/lib/inventory";
import { getCompanySettings } from "@/lib/settings";
import { exportTransferOrderPdf } from "@/lib/pdf";
import { LocationPath } from "@/components/LocationPath";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Trash2,
  MoreHorizontal,
  ArrowRightLeft,
  CheckCircle2,
  MapPin,
  FileDown,
  Eye,
  Warehouse,
} from "lucide-react";
import { ProductPicker, type ProductLite } from "@/components/ProductPickerInput";
import { LocationSelect } from "@/components/LocationSelect";
import { LocationFormDialog } from "@/components/LocationFormDialog";
import { TransferDetailsDrawer } from "@/components/TransferDetailsDrawer";
import { ExportMenu } from "@/components/ExportMenu";
import type { ExportColumn } from "@/lib/exporters";

const TRANSFER_EXPORT_COLUMNS: ExportColumn<TransferOrder>[] = [
  { key: "transfer_number", header: "Transfer #" },
  { key: "from_location", header: "From", get: (t) => t.from_location ?? "" },
  { key: "to_location", header: "To", get: (t) => t.to_location ?? "" },
  { key: "status", header: "Status" },
  { key: "transfer_date", header: "Date", get: (t) => t.transfer_date ?? "" },
  { key: "completed_date", header: "Completed", get: (t) => t.completed_date ?? "" },
  { key: "notes", header: "Notes", get: (t) => t.notes ?? "" },
];

export const Route = createFileRoute("/_authenticated/transfer-orders")({
  component: TransferOrdersPage,
});

const STATUS_COLORS: Record<TransferStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  in_transit: "bg-warning/15 text-[oklch(0.5_0.14_70)]",
  completed: "bg-success/10 text-[oklch(0.4_0.12_155)]",
  cancelled: "bg-destructive/10 text-destructive",
};

function TransferOrdersPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const transfers = useQuery({
    queryKey: ["transfer_orders"],
    queryFn: listTransferOrders,
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [newLocOpen, setNewLocOpen] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);

  const downloadPdf = async (tr: TransferOrder) => {
    try {
      const [settings, fullRes] = await Promise.all([
        getCompanySettings().catch(() => null),
        import("@/lib/orders").then((m) => m.getTransferOrder(tr.id)),
      ]);
      const full = fullRes ?? tr;
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-primary mb-1.5">
            {t("tr.section", "Logistics")}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {t("tr.title", "Transfer Orders")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("tr.subtitle", "Move inventory between locations.")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportMenu
            title={t("tr.title", "Transfer Orders")}
            filename="transfer-orders"
            rows={transfers.data ?? []}
            columns={TRANSFER_EXPORT_COLUMNS}
            orientation="landscape"
          />
          <Button variant="outline" asChild>
            <Link to="/location-stock">
              <Warehouse className="h-4 w-4" /> {t("ls.title", "Location Stock")}
            </Link>
          </Button>
          <Button variant="outline" onClick={() => setNewLocOpen(true)}>
            <MapPin className="h-4 w-4" /> {t("loc.new", "New Location")}
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="shadow-soft">
            <Plus className="h-4 w-4" /> {t("tr.create", "Create Transfer Order")}
          </Button>
        </div>
      </div>

      <Card className="border-border shadow-soft">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-primary" />
            {t("tr.list", "All transfers")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transfers.isLoading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : !transfers.data?.length ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {t("tr.empty", "No transfers yet.")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("tr.number", "Transfer #")}</TableHead>
                    <TableHead>{t("tr.from", "From")}</TableHead>
                    <TableHead>{t("tr.to", "To")}</TableHead>
                    <TableHead>{t("po.status", "Status")}</TableHead>
                    <TableHead>{t("po.order_date", "Date")}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transfers.data.map((tr) => (
                    <TableRow key={tr.id}>
                      <TableCell className="font-mono text-xs">{tr.transfer_number}</TableCell>
                      <TableCell>{tr.from_location ?? "—"}</TableCell>
                      <TableCell>{tr.to_location ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_COLORS[tr.status]}>
                          {t(`tr.statuses.${tr.status}`, tr.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{tr.transfer_date ?? "—"}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDetailsId(tr.id)}>
                              <Eye className="h-3.5 w-3.5" />
                              {t("tr.view_details", "View details")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => downloadPdf(tr)}>
                              <FileDown className="h-3.5 w-3.5" />
                              {t("common.exportPdf", "Export PDF")}
                            </DropdownMenuItem>
                            {tr.status !== "completed" && tr.status !== "cancelled" && (
                              <DropdownMenuItem
                                onClick={async () => {
                                  try {
                                    await completeTransferOrder(tr.id);
                                    toast.success(t("tr.completed", "Transfer completed"));
                                    qc.invalidateQueries({ queryKey: ["transfer_orders"] });
                                    qc.invalidateQueries({ queryKey: ["products"] });
                                    qc.invalidateQueries({ queryKey: ["movements"] });
                                  } catch (e: any) {
                                    toast.error(e.message);
                                  }
                                }}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />{" "}
                                {t("tr.complete", "Complete")}
                              </DropdownMenuItem>
                            )}
                            {tr.status === "draft" && (
                              <DropdownMenuItem
                                onClick={async () => {
                                  await updateTransferStatus(tr.id, "in_transit");
                                  qc.invalidateQueries({ queryKey: ["transfer_orders"] });
                                }}
                              >
                                {t("tr.send", "Send in transit")}
                              </DropdownMenuItem>
                            )}
                            {tr.status !== "cancelled" && tr.status !== "completed" && (
                              <DropdownMenuItem
                                onClick={async () => {
                                  await updateTransferStatus(tr.id, "cancelled");
                                  qc.invalidateQueries({ queryKey: ["transfer_orders"] });
                                }}
                              >
                                {t("common.cancel")}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateTransferDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <LocationFormDialog
        open={newLocOpen}
        onClose={() => setNewLocOpen(false)}
        onCreated={() => qc.invalidateQueries({ queryKey: ["locations"] })}
      />
      <TransferDetailsDrawer
        transferId={detailsId}
        onClose={() => setDetailsId(null)}
      />
    </div>
  );
}

function CreateTransferDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const products = useQuery({ queryKey: ["products"], queryFn: listProducts });

  const [fromLoc, setFromLoc] = useState<Location | null>(null);
  const [toLoc, setToLoc] = useState<Location | null>(null);
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<TransferItem[]>([]);
  const [saving, setSaving] = useState(false);

  const addItem = (p: ProductLite) => {
    setItems((prev) => [
      ...prev,
      {
        product_id: p.id,
        sku: p.sku,
        barcode: p.barcode,
        product_name: p.name,
        quantity: 1,
      },
    ]);
  };

  const submit = async (status: "draft" | "completed") => {
    if (!fromLoc || !toLoc)
      return toast.error(t("tr.need_locs", "Select from and to locations"));
    if (fromLoc.id === toLoc.id)
      return toast.error(t("tr.same_loc", "From and to must differ"));
    if (items.length === 0)
      return toast.error(t("po.need_items", "Add at least one item"));

    // Client-side stock check using cached products
    const productMap = new Map(products.data?.map((p) => [p.id, p]) ?? []);
    for (const it of items) {
      if (!it.product_id) continue;
      const p = productMap.get(it.product_id);
      if (p && (p.stock ?? 0) < it.quantity) {
        return toast.error(
          t("tr.insufficient", "Insufficient stock for {{name}} (have {{have}}, need {{need}})", {
            name: p.name,
            have: p.stock ?? 0,
            need: it.quantity,
          }),
        );
      }
    }

    setSaving(true);
    try {
      await createTransferOrder({
        from_location_id: fromLoc.id,
        to_location_id: toLoc.id,
        from_location: fromLoc.name,
        to_location: toLoc.name,
        transfer_date: transferDate || null,
        notes: notes || null,
        items,
        status,
      });
      toast.success(t("tr.created", "Transfer created"));
      qc.invalidateQueries({ queryKey: ["transfer_orders"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      onClose();
      setItems([]);
      setFromLoc(null);
      setToLoc(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl bg-surface max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("tr.create", "Create Transfer Order")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>{t("tr.from", "From")}</Label>
              <LocationSelect
                value={fromLoc?.id ?? null}
                onChange={(_, loc) => setFromLoc(loc ?? null)}
                excludeId={toLoc?.id ?? null}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("tr.to", "To")}</Label>
              <LocationSelect
                value={toLoc?.id ?? null}
                onChange={(_, loc) => setToLoc(loc ?? null)}
                excludeId={fromLoc?.id ?? null}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("po.order_date", "Date")}</Label>
              <Input
                type="date"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("po.items", "Items")}</Label>
            <ProductPicker value={null} onSelect={addItem} />
            {items.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("po.product", "Product")}</TableHead>
                      <TableHead className="w-24">{t("common.quantity")}</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((it, idx) => {
                      const p = products.data?.find((x) => x.id === it.product_id);
                      const over = p ? it.quantity > (p.stock ?? 0) : false;
                      return (
                        <TableRow key={idx}>
                          <TableCell>
                            <p className="text-sm">{it.product_name}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {it.sku}
                              {p && (
                                <span className="ml-2">
                                  · {t("tr.available", "Available")}: {p.stock ?? 0}
                                </span>
                              )}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={1}
                              max={p?.stock ?? undefined}
                              value={it.quantity}
                              className={over ? "border-destructive" : ""}
                              onChange={(e) => {
                                const v = parseInt(e.target.value) || 0;
                                setItems((prev) =>
                                  prev.map((x, i) =>
                                    i === idx ? { ...x, quantity: v } : x,
                                  ),
                                );
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() =>
                                setItems((prev) => prev.filter((_, i) => i !== idx))
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>{t("common.notes")}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button variant="outline" onClick={() => submit("draft")} disabled={saving}>
            {t("po.save_draft", "Save as draft")}
          </Button>
          <Button onClick={() => submit("completed")} disabled={saving}>
            {t("tr.complete_now", "Complete transfer")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
