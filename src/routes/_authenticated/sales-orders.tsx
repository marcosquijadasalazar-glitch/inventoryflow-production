import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  listSalesOrders,
  listCustomers,
  createCustomer,
  createSalesOrder,
  fulfillSalesOrder,
  updateSOStatus,
  type SOItem,
  type SOStatus,
  type PaymentStatus,
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
import { Plus, Trash2, MoreHorizontal, CheckCircle2, Receipt, AlertTriangle } from "lucide-react";
import { ProductPicker, type ProductLite } from "@/components/ProductPickerInput";
import { useProfile, canManageOrg } from "@/lib/profile";

export const Route = createFileRoute("/_authenticated/sales-orders")({
  component: SalesOrdersPage,
});

const STATUS_COLORS: Record<SOStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  confirmed: "bg-primary/10 text-primary",
  fulfilled: "bg-success/10 text-[oklch(0.4_0.12_155)]",
  cancelled: "bg-destructive/10 text-destructive",
  refunded: "bg-warning/15 text-[oklch(0.5_0.14_70)]",
};

function SalesOrdersPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const sos = useQuery({ queryKey: ["sales_orders"], queryFn: listSalesOrders });
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-primary mb-1.5">
            {t("so.section", "Sales")}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {t("so.title", "Sales Orders")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("so.subtitle", "Sell and dispatch inventory to customers.")}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="shadow-soft">
          <Plus className="h-4 w-4" /> {t("so.create", "Create Sales Order")}
        </Button>
      </div>

      <Card className="border-border shadow-soft">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            {t("so.list", "All sales orders")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sos.isLoading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : !sos.data?.length ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {t("so.empty", "No sales orders yet.")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("so.number", "SO #")}</TableHead>
                    <TableHead>{t("so.customer", "Customer")}</TableHead>
                    <TableHead>{t("so.status", "Status")}</TableHead>
                    <TableHead>{t("so.payment", "Payment")}</TableHead>
                    <TableHead className="text-right">{t("pdf.total")}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sos.data.map((so) => (
                    <TableRow key={so.id}>
                      <TableCell className="font-mono text-xs">{so.so_number}</TableCell>
                      <TableCell>{so.customers?.name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_COLORS[so.status]}>
                          {t(`so.statuses.${so.status}`, so.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {t(`so.payments.${so.payment_status}`, so.payment_status)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${Number(so.total).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {so.status !== "fulfilled" && so.status !== "cancelled" && (
                              <DropdownMenuItem
                                onClick={async () => {
                                  try {
                                    await fulfillSalesOrder(so.id);
                                    toast.success(t("so.fulfilled_toast", "Order fulfilled"));
                                    qc.invalidateQueries({ queryKey: ["sales_orders"] });
                                    qc.invalidateQueries({ queryKey: ["products"] });
                                    qc.invalidateQueries({ queryKey: ["movements"] });
                                  } catch (e: any) {
                                    toast.error(e.message);
                                  }
                                }}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />{" "}
                                {t("so.fulfill", "Fulfill")}
                              </DropdownMenuItem>
                            )}
                            {so.status !== "cancelled" && so.status !== "fulfilled" && (
                              <DropdownMenuItem
                                onClick={async () => {
                                  await updateSOStatus(so.id, "cancelled");
                                  qc.invalidateQueries({ queryKey: ["sales_orders"] });
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

      <CreateSODialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function CreateSODialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const profile = useProfile();
  const customers = useQuery({ queryKey: ["customers"], queryFn: listCustomers });
  const [customerId, setCustomerId] = useState<string>("");
  const [newCustomer, setNewCustomer] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [tax, setTax] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<SOItem[]>([]);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("unpaid");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [saving, setSaving] = useState(false);

  const canOverride = canManageOrg(profile.data?.role);
  const overstocked = items.find(
    (i) => i.product_id && i.quantity > (i as any).__stock,
  );

  const addItem = (p: ProductLite) => {
    setItems((prev) => [
      ...prev,
      {
        product_id: p.id,
        sku: p.sku,
        barcode: p.barcode,
        product_name: p.name,
        quantity: 1,
        unit_price: Number(p.price) || 0,
        unit_cost: Number(p.cost) || 0,
        line_total: Number(p.price) || 0,
        margin: (Number(p.price) || 0) - (Number(p.cost) || 0),
        __stock: p.stock,
      } as SOItem & { __stock: number },
    ]);
  };

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const total = subtotal + (parseFloat(tax) || 0) - (parseFloat(discount) || 0);

  const submit = async (status: "draft" | "confirmed" | "fulfilled") => {
    if (items.length === 0) return toast.error(t("so.need_items", "Add at least one item"));
    if (overstocked && !canOverride && status !== "draft") {
      return toast.error(t("so.overstock", "Quantity exceeds available stock"));
    }
    setSaving(true);
    try {
      let cid: string | null = customerId || null;
      if (newCustomer.trim()) {
        const c = await createCustomer({
          name: newCustomer.trim(),
          email: null,
          phone: null,
          address: null,
          notes: null,
        });
        cid = c.id;
      }
      await createSalesOrder({
        customer_id: cid,
        order_date: orderDate || null,
        notes: notes || null,
        tax: parseFloat(tax) || 0,
        discount: parseFloat(discount) || 0,
        payment_status: paymentStatus,
        payment_method: paymentMethod,
        items,
        status,
      });
      toast.success(t("so.created", "Sales order created"));
      qc.invalidateQueries({ queryKey: ["sales_orders"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      onClose();
      setItems([]);
      setNewCustomer("");
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
          <DialogTitle>{t("so.create", "Create Sales Order")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("so.customer", "Customer")}</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("so.select_customer", "Select customer")} />
                </SelectTrigger>
                <SelectContent>
                  {customers.data?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder={t("so.new_customer", "Or new customer name")}
                value={newCustomer}
                onChange={(e) => setNewCustomer(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("po.order_date", "Order date")}</Label>
              <Input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
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
                      <TableHead className="w-28">{t("so.unit_price", "Unit price")}</TableHead>
                      <TableHead className="w-24 text-right">{t("po.line", "Line")}</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((it, idx) => {
                      const stock = (it as any).__stock as number | undefined;
                      const over = stock != null && it.quantity > stock;
                      return (
                        <TableRow key={idx} className={over ? "bg-destructive/5" : ""}>
                          <TableCell>
                            <p className="text-sm">{it.product_name}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {it.sku}
                              {stock != null && ` · stock ${stock}`}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={1}
                              value={it.quantity}
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
                            <Input
                              type="number"
                              step="0.01"
                              value={it.unit_price}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value) || 0;
                                setItems((prev) =>
                                  prev.map((x, i) =>
                                    i === idx ? { ...x, unit_price: v } : x,
                                  ),
                                );
                              }}
                            />
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            ${(it.quantity * it.unit_price).toFixed(2)}
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

          {overstocked && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/5 border border-destructive/20 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p>
                {t("so.overstock", "Quantity exceeds available stock")}
                {canOverride && ` — ${t("so.override", "manager override available")}`}
              </p>
            </div>
          )}

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>{t("so.payment_status", "Payment status")}</Label>
              <Select
                value={paymentStatus}
                onValueChange={(v) => setPaymentStatus(v as PaymentStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpaid">{t("so.payments.unpaid", "Unpaid")}</SelectItem>
                  <SelectItem value="paid">{t("so.payments.paid", "Paid")}</SelectItem>
                  <SelectItem value="partial">{t("so.payments.partial", "Partial")}</SelectItem>
                  <SelectItem value="refunded">{t("so.payments.refunded", "Refunded")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("so.payment_method", "Payment method")}</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="zelle">Zelle</SelectItem>
                  <SelectItem value="ach">ACH</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("common.notes")}</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={1}
              />
            </div>
          </div>

          <div className="space-y-2 max-w-xs ml-auto">
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
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm">{t("so.discount", "Discount")}</Label>
              <Input
                type="number"
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-28 text-right"
              />
            </div>
            <div className="flex justify-between text-base font-semibold border-t pt-2">
              <span>{t("pdf.total")}</span>
              <span className="font-mono">${total.toFixed(2)}</span>
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
          <Button onClick={() => submit("fulfilled")} disabled={saving}>
            {t("so.confirm_fulfill", "Confirm & fulfill")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
