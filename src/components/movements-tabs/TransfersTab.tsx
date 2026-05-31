import { Link } from "@tanstack/react-router";
import { invalidateDerived } from "@/lib/invalidate-after-write";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";
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
import { useApprovalGate } from "@/components/approvals/useApprovalGate";


const TRANSFER_EXPORT_COLUMNS: ExportColumn<TransferOrder>[] = [
  { key: "transfer_number", header: "Transfer #" },
  { key: "from_location", header: "From", get: (t) => t.from_location ?? "" },
  { key: "to_location", header: "To", get: (t) => t.to_location ?? "" },
  { key: "status", header: "Status" },
  { key: "transfer_date", header: "Date", get: (t) => t.transfer_date ?? "" },
  { key: "completed_date", header: "Completed", get: (t) => t.completed_date ?? "" },
  { key: "notes", header: "Notes", get: (t) => t.notes ?? "" },
];

const STATUS_COLORS: Record<TransferStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  in_transit: "bg-warning/15 text-[oklch(0.5_0.14_70)]",
  completed: "bg-success/10 text-[oklch(0.4_0.12_155)]",
  cancelled: "bg-destructive/10 text-destructive",
};

export function TransfersTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const transfers = useQuery({
    queryKey: ["transfer_orders"],
    queryFn: listTransferOrders,
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [newLocOpen, setNewLocOpen] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const { guard, modal } = useApprovalGate();

  // Search + filters
  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState<"__all" | TransferStatus>("__all");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [fSource, setFSource] = useState("__all");
  const [fDest, setFDest] = useState("__all");

  const sourceLocs = useMemo(() => {
    const s = new Set<string>();
    transfers.data?.forEach((t) => t.from_location && s.add(t.from_location));
    return Array.from(s).sort();
  }, [transfers.data]);
  const destLocs = useMemo(() => {
    const s = new Set<string>();
    transfers.data?.forEach((t) => t.to_location && s.add(t.to_location));
    return Array.from(s).sort();
  }, [transfers.data]);

  const filteredTransfers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromT = fFrom ? new Date(fFrom).getTime() : -Infinity;
    const toT = fTo ? new Date(fTo).getTime() + 86_400_000 : Infinity;
    return (transfers.data ?? []).filter((tr) => {
      if (fStatus !== "__all" && tr.status !== fStatus) return false;
      if (fSource !== "__all" && tr.from_location !== fSource) return false;
      if (fDest !== "__all" && tr.to_location !== fDest) return false;
      const dateRef = tr.transfer_date ?? tr.created_at;
      const ts = dateRef ? new Date(dateRef).getTime() : 0;
      if (ts < fromT || ts > toT) return false;
      if (q) {
        const items = (tr as any).items ?? [];
        const hay = [
          tr.transfer_number,
          tr.from_location,
          tr.to_location,
          tr.status,
          tr.notes,
          ...items.flatMap((i: any) => [i.product_name, i.sku, i.barcode]),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [transfers.data, search, fStatus, fFrom, fTo, fSource, fDest]);

  const activeFilterCount =
    (fStatus !== "__all" ? 1 : 0) +
    (fSource !== "__all" ? 1 : 0) +
    (fDest !== "__all" ? 1 : 0) +
    (fFrom || fTo ? 1 : 0) +
    (search ? 1 : 0);

  const resetFilters = () => {
    setSearch("");
    setFStatus("__all");
    setFSource("__all");
    setFDest("__all");
    setFFrom("");
    setFTo("");
  };

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
        <CardHeader className="space-y-4">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-primary" />
            {t("tr.list", "All transfers")}
          </CardTitle>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t(
                "tr.searchPlaceholder",
                "Search transfer #, product, SKU, source, destination…",
              )}
              className="pl-8 bg-surface"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <Select value={fStatus} onValueChange={(v) => setFStatus(v as any)}>
              <SelectTrigger className="bg-surface">
                <SelectValue placeholder={t("po.status", "Status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">{t("tr.allStatuses", "All statuses")}</SelectItem>
                <SelectItem value="draft">{t("tr.statuses.draft", "draft")}</SelectItem>
                <SelectItem value="in_transit">{t("tr.statuses.in_transit", "in transit")}</SelectItem>
                <SelectItem value="completed">{t("tr.statuses.completed", "completed")}</SelectItem>
                <SelectItem value="cancelled">{t("tr.statuses.cancelled", "cancelled")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={fSource} onValueChange={setFSource}>
              <SelectTrigger className="bg-surface">
                <SelectValue placeholder={t("tr.from", "From")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">{t("tr.allSources", "All sources")}</SelectItem>
                {sourceLocs.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={fDest} onValueChange={setFDest}>
              <SelectTrigger className="bg-surface">
                <SelectValue placeholder={t("tr.to", "To")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">{t("tr.allDests", "All destinations")}</SelectItem>
                {destLocs.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={fFrom}
              onChange={(e) => setFFrom(e.target.value)}
              className="bg-surface"
              aria-label={t("movements.from", "From date")}
            />
            <Input
              type="date"
              value={fTo}
              onChange={(e) => setFTo(e.target.value)}
              className="bg-surface"
              aria-label={t("movements.to", "To date")}
            />
          </div>

          {activeFilterCount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {filteredTransfers.length} / {transfers.data?.length ?? 0}
              </span>
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <X className="h-3.5 w-3.5" />
                {t("movements.resetFilters", "Reset filters")}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {transfers.isLoading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : !transfers.data?.length ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {t("tr.empty", "No transfers yet.")}
            </p>
          ) : !filteredTransfers.length ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {t("common.noResults", "No results match your filters.")}
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
                    <TableHead>{t("tr.products", "Products")}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransfers.map((tr) => (
                    <TableRow key={tr.id}>
                      <TableCell className="font-mono text-xs align-top">{tr.transfer_number}</TableCell>
                      <TableCell className="align-top">
                        <LocationPath
                          nodeId={(tr as any).from_location_id}
                          fallback={tr.from_location}
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <LocationPath
                          nodeId={(tr as any).to_location_id}
                          fallback={tr.to_location}
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge variant="outline" className={STATUS_COLORS[tr.status]}>
                          {t(`tr.statuses.${tr.status}`, tr.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs align-top">{tr.transfer_date ?? "—"}</TableCell>
                      <TableCell className="align-top text-xs max-w-[280px]">
                        {((tr as any).items ?? []).length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <ul className="space-y-0.5">
                            {((tr as any).items ?? []).slice(0, 4).map((it: any, i: number) => (
                              <li key={i} className="truncate">
                                <span className="font-medium">{it.product_name}</span>
                                <span className="text-muted-foreground font-mono ml-1.5">{it.sku}</span>
                                <span className="ml-1.5">× {it.quantity}</span>
                              </li>
                            ))}
                            {((tr as any).items ?? []).length > 4 && (
                              <li className="text-muted-foreground">
                                +{((tr as any).items ?? []).length - 4} more
                              </li>
                            )}
                          </ul>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
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
                                onClick={() => {
                                  const totalQty = (tr as any).items?.reduce((s: number, i: any) => s + (i.quantity ?? 0), 0) ?? 0;
                                  guard({
                                    action: "transfer_order",
                                    measurements: { quantity: totalQty },
                                    entityLabel: tr.transfer_number,
                                    onApproved: async () => {
                                      try {
                                        await completeTransferOrder(tr.id);
                                        toast.success(t("tr.completed", "Transfer completed"));
                                        qc.invalidateQueries({ queryKey: ["transfer_orders"] });
                                        qc.invalidateQueries({ queryKey: ["products"] });
                                        qc.invalidateQueries({ queryKey: ["movements"] });
                                        invalidateDerived(qc);
                                      } catch (e: any) {
                                        toast.error(e.message);
                                      }
                                    },
                                  });
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
      {modal}
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
  const { guard, modal } = useApprovalGate();

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

    const totalQty = items.reduce((s, i) => s + (i.quantity ?? 0), 0);
    const totalValue = items.reduce((s, i) => {
      const p = productMap.get(i.product_id ?? "");
      return s + (i.quantity ?? 0) * ((p as any)?.cost ?? (p as any)?.price ?? 0);
    }, 0);

    const performCreate = async () => {
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
        invalidateDerived(qc);
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

    guard({
      action: "transfer_order",
      measurements: { quantity: totalQty, value: totalValue },
      entityLabel: `${fromLoc.name} → ${toLoc.name}`,
      onApproved: performCreate,
    });
  };

  return (
    <>
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
    {modal}
    </>
  );
}
