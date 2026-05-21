import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  listPurchaseOrders,
  listSuppliers,
  createSupplier,
  createPurchaseOrder,
  receivePurchaseOrder,
  getPurchaseOrder,
  updatePOStatus,
  type PurchaseOrder,
  type POItem,
  type POStatus,
} from "@/lib/orders";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Plus, Trash2, MoreHorizontal, Truck, ShoppingCart } from "lucide-react";
import { ProductPicker, type ProductLite } from "@/components/ProductPickerInput";

export const Route = createFileRoute("/_authenticated/purchase-orders")({
  component: PurchaseOrdersPage,
});

const STATUS_COLORS: Record<POStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  ordered: "bg-primary/10 text-primary",
  partially_received: "bg-warning/15 text-[oklch(0.5_0.14_70)]",
  received: "bg-success/10 text-[oklch(0.4_0.12_155)]",
  cancelled: "bg-destructive/10 text-destructive",
};

function PurchaseOrdersPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const pos = useQuery({ queryKey: ["purchase_orders"], queryFn: listPurchaseOrders });
  const [createOpen, setCreateOpen] = useState(false);
  const [receiveId, setReceiveId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-primary mb-1.5">
            {t("po.section", "Procurement")}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {t("po.title", "Purchase Orders")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("po.subtitle", "Buy inventory from suppliers and receive stock.")}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="shadow-soft">
          <Plus className="h-4 w-4" /> {t("po.create", "Create Purchase Order")}
        </Button>
      </div>

      <Card className="border-border shadow-soft">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-primary" />
            {t("po.list", "All purchase orders")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pos.isLoading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : !pos.data?.length ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {t("po.empty", "No purchase orders yet.")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("po.number", "PO #")}</TableHead>
                    <TableHead>{t("po.supplier", "Supplier")}</TableHead>
                    <TableHead>{t("po.status", "Status")}</TableHead>
                    <TableHead>{t("po.expected", "Expected")}</TableHead>
                    <TableHead className="text-right">{t("po.total", "Total")}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pos.data.map((po) => (
                    <TableRow key={po.id}>
                      <TableCell className="font-mono text-xs">{po.po_number}</TableCell>
                      <TableCell>{po.suppliers?.name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_COLORS[po.status]}>
                          {t(`po.statuses.${po.status}`, po.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {po.expected_date ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${Number(po.total).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {po.status !== "received" && po.status !== "cancelled" && (
                              <DropdownMenuItem onClick={() => setReceiveId(po.id)}>
                                <Truck className="h-3.5 w-3.5" />{" "}
                                {t("po.receive", "Receive")}
                              </DropdownMenuItem>
                            )}
                            {po.status === "draft" && (
                              <DropdownMenuItem
                                onClick={async () => {
                                  await updatePOStatus(po.id, "ordered");
                                  qc.invalidateQueries({ queryKey: ["purchase_orders"] });
                                  toast.success(t("po.marked_ordered", "Marked as ordered"));
                                }}
                              >
                                {t("po.mark_ordered", "Mark as ordered")}
                              </DropdownMenuItem>
                            )}
                            {po.status !== "cancelled" && po.status !== "received" && (
                              <DropdownMenuItem
                                onClick={async () => {
                                  await updatePOStatus(po.id, "cancelled");
                                  qc.invalidateQueries({ queryKey: ["purchase_orders"] });
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

      <CreatePODialog open={createOpen} onClose={() => setCreateOpen(false)} />
      {receiveId && (
        <ReceivePODialog
          poId={receiveId}
          open={!!receiveId}
          onClose={() => setReceiveId(null)}
        />
      )}
    </div>
  );
}

function CreatePODialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const suppliers = useQuery({ queryKey: ["suppliers"], queryFn: listSuppliers });
  const [supplierId, setSupplierId] = useState<string>("");
  const [newSupplier, setNewSupplier] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [expected, setExpected] = useState("");
  const [tax, setTax] = useState("0");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<POItem[]>([]);
  const [saving, setSaving] = useState(false);

  const addItem = (p: ProductLite) => {
    setItems((prev) => [
      ...prev,
      {
        product_id: p.id,
        sku: p.sku,
        barcode: p.barcode,
        product_name: p.name,
        quantity_ordered: 1,
        quantity_received: 0,
        unit_cost: Number(p.cost) || 0,
        line_total: Number(p.cost) || 0,
      },
    ]);
  };

  const subtotal = items.reduce((s, i) => s + i.quantity_ordered * i.unit_cost, 0);
  const total = subtotal + (parseFloat(tax) || 0);

  const submit = async (status: "draft" | "ordered") => {
    if (items.length === 0) return toast.error(t("po.need_items", "Add at least one item"));
    setSaving(true);
    try {
      let sid: string | null = supplierId || null;
      if (newSupplier.trim()) {
        const s = await createSupplier({
          name: newSupplier.trim(),
          email: null,
          phone: null,
          address: null,
          notes: null,
        });
        sid = s.id;
      }
      await createPurchaseOrder({
        supplier_id: sid,
        order_date: orderDate || null,
        expected_date: expected || null,
        notes: notes || null,
        tax: parseFloat(tax) || 0,
        items,
        status,
      });
      toast.success(t("po.created", "Purchase order created"));
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      onClose();
      setItems([]);
      setNewSupplier("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl bg-surface max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("po.create", "Create Purchase Order")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("po.supplier", "Supplier")}</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("po.select_supplier", "Select supplier")} />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.data?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder={t("po.new_supplier", "Or new supplier name")}
                value={newSupplier}
                onChange={(e) => setNewSupplier(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>{t("po.order_date", "Order date")}</Label>
                <Input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("po.expected", "Expected")}</Label>
                <Input
                  type="date"
                  value={expected}
                  onChange={(e) => setExpected(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("po.items", "Items")}</Label>
            <ProductPicker value={null} onSelect={addItem} showStock={false} />
            {items.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("po.product", "Product")}</TableHead>
                      <TableHead className="w-24">{t("common.quantity")}</TableHead>
                      <TableHead className="w-28">{t("po.unit_cost", "Unit cost")}</TableHead>
                      <TableHead className="w-24 text-right">{t("po.line", "Line")}</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((it, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <p className="text-sm">{it.product_name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{it.sku}</p>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            value={it.quantity_ordered}
                            onChange={(e) => {
                              const v = parseInt(e.target.value) || 0;
                              setItems((prev) =>
                                prev.map((x, i) =>
                                  i === idx
                                    ? { ...x, quantity_ordered: v, line_total: v * x.unit_cost }
                                    : x,
                                ),
                              );
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={it.unit_cost}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value) || 0;
                              setItems((prev) =>
                                prev.map((x, i) =>
                                  i === idx
                                    ? { ...x, unit_cost: v, line_total: x.quantity_ordered * v }
                                    : x,
                                ),
                              );
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          ${(it.quantity_ordered * it.unit_cost).toFixed(2)}
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
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("common.notes")}</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{t("pdf.subtotal")}</span>
                <span className="font-mono">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <Label className="text-sm">{t("po.tax", "Tax")}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={tax}
                  onChange={(e) => setTax(e.target.value)}
                  className="w-28 text-right"
                />
              </div>
              <div className="flex justify-between text-base font-semibold border-t pt-2">
                <span>{t("pdf.total")}</span>
                <span className="font-mono">${total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button variant="outline" onClick={() => submit("draft")} disabled={saving}>
            {t("po.save_draft", "Save as draft")}
          </Button>
          <Button onClick={() => submit("ordered")} disabled={saving}>
            {t("po.mark_ordered", "Mark as ordered")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReceivePODialog({
  poId,
  open,
  onClose,
}: {
  poId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const po = useQuery({
    queryKey: ["purchase_order", poId],
    queryFn: () => getPurchaseOrder(poId),
  });
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const receipts = (po.data?.items ?? [])
      .map((i) => ({
        item_id: i.id!,
        product_id: i.product_id,
        receive_qty: qtys[i.id!] ?? 0,
      }))
      .filter((r) => r.receive_qty > 0);
    if (!receipts.length) return toast.error(t("po.no_receipts", "Enter at least one quantity"));
    setSaving(true);
    try {
      await receivePurchaseOrder(poId, receipts);
      toast.success(t("po.received", "Stock received"));
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["history"] });
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl bg-surface">
        <DialogHeader>
          <DialogTitle>
            {t("po.receive", "Receive")} {po.data?.po_number}
          </DialogTitle>
        </DialogHeader>
        {po.data ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("po.product", "Product")}</TableHead>
                <TableHead className="text-center">{t("po.ordered", "Ordered")}</TableHead>
                <TableHead className="text-center">
                  {t("po.received_short", "Received")}
                </TableHead>
                <TableHead className="text-center">{t("po.receive_now", "Receive now")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {po.data.items?.map((i) => {
                const remaining = i.quantity_ordered - i.quantity_received;
                return (
                  <TableRow key={i.id}>
                    <TableCell>
                      <p className="text-sm">{i.product_name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{i.sku}</p>
                    </TableCell>
                    <TableCell className="text-center">{i.quantity_ordered}</TableCell>
                    <TableCell className="text-center">{i.quantity_received}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        max={remaining}
                        value={qtys[i.id!] ?? ""}
                        onChange={(e) =>
                          setQtys((p) => ({
                            ...p,
                            [i.id!]: Math.min(parseInt(e.target.value) || 0, remaining),
                          }))
                        }
                        className="text-center"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <p>{t("common.loading")}</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} disabled={saving}>
            <Truck className="h-4 w-4" /> {t("po.receive", "Receive")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
