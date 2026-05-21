import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

// ---------------- Types ----------------
export type POStatus = "draft" | "ordered" | "partially_received" | "received" | "cancelled";
export type SOStatus = "draft" | "confirmed" | "fulfilled" | "cancelled" | "refunded";
export type PaymentStatus = "unpaid" | "paid" | "partial" | "refunded";
export type TransferStatus = "draft" | "in_transit" | "completed" | "cancelled";

export type Supplier = {
  id: string;
  organization_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
};

export type Customer = {
  id: string;
  organization_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
};

export type POItem = {
  id?: string;
  purchase_order_id?: string;
  product_id: string | null;
  sku: string | null;
  barcode: string | null;
  product_name: string | null;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
  line_total: number;
};

export type SOItem = {
  id?: string;
  sales_order_id?: string;
  product_id: string | null;
  sku: string | null;
  barcode: string | null;
  product_name: string | null;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  line_total: number;
  margin: number;
};

export type TransferItem = {
  id?: string;
  transfer_order_id?: string;
  product_id: string | null;
  sku: string | null;
  barcode: string | null;
  product_name: string | null;
  quantity: number;
};

export type PurchaseOrder = {
  id: string;
  po_number: string;
  supplier_id: string | null;
  organization_id: string | null;
  status: POStatus;
  order_date: string | null;
  expected_date: string | null;
  received_date: string | null;
  notes: string | null;
  subtotal: number;
  tax: number;
  total: number;
  created_at: string;
  suppliers?: { name: string } | null;
  items?: POItem[];
};

export type SalesOrder = {
  id: string;
  so_number: string;
  customer_id: string | null;
  organization_id: string | null;
  status: SOStatus;
  order_date: string | null;
  fulfilled_date: string | null;
  notes: string | null;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  payment_status: PaymentStatus;
  payment_method: string | null;
  inventory_deducted_at: string | null;
  inventory_reversed_at: string | null;
  created_at: string;
  customers?: { name: string; email?: string | null; phone?: string | null; address?: string | null } | null;
  items?: SOItem[];
};

export type SalesOrderPayment = {
  id: string;
  sales_order_id: string;
  organization_id: string | null;
  amount: number;
  payment_method: string;
  payment_date: string;
  notes: string | null;
  previous_status: string | null;
  new_status: string | null;
  performed_by: string | null;
  performed_by_email: string | null;
  created_at: string;
};

export type TransferOrder = {
  id: string;
  transfer_number: string;
  organization_id: string | null;
  from_location: string | null;
  to_location: string | null;
  status: TransferStatus;
  transfer_date: string | null;
  completed_date: string | null;
  notes: string | null;
  created_at: string;
  items?: TransferItem[];
};

// ---------------- Helpers ----------------
function genNumber(prefix: string) {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate(),
  ).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}`;
  return `${prefix}-${stamp}`;
}

// ---------------- Suppliers ----------------
export async function listSuppliers(): Promise<Supplier[]> {
  const { data, error } = await sb.from("suppliers").select("*").order("name");
  if (error) throw error;
  return data ?? [];
}
export async function createSupplier(v: Omit<Supplier, "id" | "created_at" | "organization_id">) {
  const { data, error } = await sb.from("suppliers").insert(v).select().single();
  if (error) throw error;
  return data as Supplier;
}

// ---------------- Customers ----------------
export async function listCustomers(): Promise<Customer[]> {
  const { data, error } = await sb.from("customers").select("*").order("name");
  if (error) throw error;
  return data ?? [];
}
export async function createCustomer(v: Omit<Customer, "id" | "created_at" | "organization_id">) {
  const { data, error } = await sb.from("customers").insert(v).select().single();
  if (error) throw error;
  return data as Customer;
}

// ---------------- Purchase Orders ----------------
export async function listPurchaseOrders(): Promise<PurchaseOrder[]> {
  const { data, error } = await sb
    .from("purchase_orders")
    .select("*, suppliers(name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getPurchaseOrder(id: string): Promise<PurchaseOrder | null> {
  const { data, error } = await sb
    .from("purchase_orders")
    .select("*, suppliers(name)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: items } = await sb
    .from("purchase_order_items")
    .select("*")
    .eq("purchase_order_id", id);
  return { ...data, items: items ?? [] };
}

export async function createPurchaseOrder(input: {
  supplier_id: string | null;
  order_date: string | null;
  expected_date: string | null;
  notes: string | null;
  tax: number;
  items: POItem[];
  status: POStatus;
}) {
  const subtotal = input.items.reduce((s, i) => s + i.quantity_ordered * i.unit_cost, 0);
  const total = subtotal + (input.tax ?? 0);
  const { data: po, error } = await sb
    .from("purchase_orders")
    .insert({
      po_number: genNumber("PO"),
      supplier_id: input.supplier_id,
      order_date: input.order_date,
      expected_date: input.expected_date,
      notes: input.notes,
      subtotal,
      tax: input.tax,
      total,
      status: input.status,
    })
    .select()
    .single();
  if (error) throw error;
  if (input.items.length) {
    const rows = input.items.map((i) => ({
      purchase_order_id: po.id,
      product_id: i.product_id,
      sku: i.sku,
      barcode: i.barcode,
      product_name: i.product_name,
      quantity_ordered: i.quantity_ordered,
      quantity_received: 0,
      unit_cost: i.unit_cost,
      line_total: i.quantity_ordered * i.unit_cost,
    }));
    const { error: iErr } = await sb.from("purchase_order_items").insert(rows);
    if (iErr) throw iErr;
  }
  return po as PurchaseOrder;
}

export async function receivePurchaseOrder(
  poId: string,
  receipts: { item_id: string; product_id: string | null; receive_qty: number }[],
) {
  const po = await getPurchaseOrder(poId);
  if (!po) throw new Error("PO not found");

  for (const r of receipts) {
    if (r.receive_qty <= 0) continue;
    const item = po.items?.find((it) => it.id === r.item_id);
    if (!item) continue;
    // Update item received qty
    const newRec = (item.quantity_received ?? 0) + r.receive_qty;
    await sb
      .from("purchase_order_items")
      .update({ quantity_received: newRec })
      .eq("id", r.item_id);
    // Create stock movement (trigger updates stock + writes history)
    if (r.product_id) {
      await sb.from("inventory_movements").insert({
        product_id: r.product_id,
        type: "add",
        quantity: r.receive_qty,
        note: `[po-receive] ${po.po_number}`,
      });
    }
  }

  // Recompute status
  const updated = await getPurchaseOrder(poId);
  const allReceived = updated?.items?.every((i) => i.quantity_received >= i.quantity_ordered);
  const anyReceived = updated?.items?.some((i) => i.quantity_received > 0);
  const status: POStatus = allReceived ? "received" : anyReceived ? "partially_received" : po.status;
  await sb
    .from("purchase_orders")
    .update({
      status,
      received_date: allReceived ? new Date().toISOString().slice(0, 10) : null,
    })
    .eq("id", poId);
}

export async function updatePOStatus(id: string, status: POStatus) {
  const { error } = await sb.from("purchase_orders").update({ status }).eq("id", id);
  if (error) throw error;
}

// ---------------- Sales Orders ----------------
export async function listSalesOrders(): Promise<SalesOrder[]> {
  const { data, error } = await sb
    .from("sales_orders")
    .select("*, customers(name, email, phone, address)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getSalesOrder(id: string): Promise<SalesOrder | null> {
  const { data, error } = await sb
    .from("sales_orders")
    .select("*, customers(name, email, phone, address)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: items } = await sb
    .from("sales_order_items")
    .select("*")
    .eq("sales_order_id", id);
  return { ...data, items: items ?? [] };
}

export async function listSalesPayments(soId: string): Promise<SalesOrderPayment[]> {
  const { data, error } = await sb
    .from("sales_order_payments")
    .select("*")
    .eq("sales_order_id", soId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

function computePaymentStatus(amountPaid: number, total: number): PaymentStatus {
  if (amountPaid <= 0) return "unpaid";
  if (amountPaid >= total) return "paid";
  return "partial";
}

export async function recordSalesPayment(input: {
  sales_order_id: string;
  amount: number;
  payment_method: string;
  payment_date?: string | null;
  notes?: string | null;
}) {
  if (input.amount <= 0) throw new Error("Amount must be greater than 0");
  const so = await getSalesOrder(input.sales_order_id);
  if (!so) throw new Error("SO not found");
  const prevPaid = Number(so.amount_paid ?? 0);
  const total = Number(so.total ?? 0);
  const newPaid = Math.min(prevPaid + input.amount, total + input.amount); // allow overpay; balance can go negative
  const newBalance = Math.max(total - newPaid, 0);
  const prevStatus = so.payment_status;
  const newStatus = computePaymentStatus(newPaid, total);

  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id ?? null;
  const uemail = userData.user?.email ?? null;

  const { error: payErr } = await sb.from("sales_order_payments").insert({
    sales_order_id: input.sales_order_id,
    amount: input.amount,
    payment_method: input.payment_method,
    payment_date: input.payment_date ?? new Date().toISOString().slice(0, 10),
    notes: input.notes ?? null,
    previous_status: prevStatus,
    new_status: newStatus,
    performed_by: uid,
    performed_by_email: uemail,
  });
  if (payErr) throw payErr;

  const { error: updErr } = await sb
    .from("sales_orders")
    .update({
      amount_paid: newPaid,
      balance_due: newBalance,
      payment_status: newStatus,
      payment_method: input.payment_method,
    })
    .eq("id", input.sales_order_id);
  if (updErr) throw updErr;

  // Audit trail in transaction_history (best-effort)
  try {
    await sb.from("transaction_history").insert({
      type: "stock_adjusted",
      source: "manual",
      product_id: null,
      product_name: `Payment · ${so.so_number}`,
      sku: so.so_number,
      reason: `[so-payment] ${input.payment_method} $${input.amount.toFixed(2)} (${prevStatus} → ${newStatus})${input.notes ? ` · ${input.notes}` : ""}`,
      user_id: uid,
      user_email: uemail,
    });
  } catch {}

  return { newPaid, newBalance, newStatus, prevStatus };
}

export async function markSalesOrderPaid(soId: string, method: string = "other") {
  const so = await getSalesOrder(soId);
  if (!so) throw new Error("SO not found");
  const remaining = Math.max(Number(so.total) - Number(so.amount_paid ?? 0), 0);
  if (remaining <= 0) {
    // Already paid — just normalize status
    await sb
      .from("sales_orders")
      .update({ payment_status: "paid", balance_due: 0 })
      .eq("id", soId);
    return;
  }
  return recordSalesPayment({
    sales_order_id: soId,
    amount: remaining,
    payment_method: method,
    notes: "Marked as paid",
  });
}

export async function createSalesOrder(input: {
  customer_id: string | null;
  order_date: string | null;
  notes: string | null;
  tax: number;
  discount: number;
  payment_status: PaymentStatus;
  payment_method: string | null;
  items: SOItem[];
  status: SOStatus;
}) {
  const subtotal = input.items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const total = subtotal + (input.tax ?? 0) - (input.discount ?? 0);
  const amountPaid = input.payment_status === "paid" ? total : 0;
  const balanceDue = total - amountPaid;
  const { data: so, error } = await sb
    .from("sales_orders")
    .insert({
      so_number: genNumber("SO"),
      customer_id: input.customer_id,
      order_date: input.order_date,
      notes: input.notes,
      subtotal,
      tax: input.tax,
      discount: input.discount,
      total,
      amount_paid: amountPaid,
      balance_due: balanceDue,
      payment_status: input.payment_status,
      payment_method: input.payment_method,
      status: input.status,
    })
    .select()
    .single();
  if (error) throw error;
  if (input.items.length) {
    const rows = input.items.map((i) => ({
      sales_order_id: so.id,
      product_id: i.product_id,
      sku: i.sku,
      barcode: i.barcode,
      product_name: i.product_name,
      quantity: i.quantity,
      unit_price: i.unit_price,
      unit_cost: i.unit_cost,
      line_total: i.quantity * i.unit_price,
      margin: (i.unit_price - i.unit_cost) * i.quantity,
    }));
    const { error: iErr } = await sb.from("sales_order_items").insert(rows);
    if (iErr) throw iErr;
  }
  // If creating as confirmed/fulfilled, decrement stock right away
  if (input.status === "fulfilled" || input.status === "confirmed") {
    await deductSalesOrderStock(so.id, input.status === "fulfilled");
  }
  return so as SalesOrder;
}

/**
 * Validate that all line items have enough stock available.
 * Throws if any product would go negative (unless allowNegative=true).
 */
export async function validateSalesOrderStock(soId: string): Promise<{ product_id: string; name: string; available: number; needed: number }[]> {
  const so = await getSalesOrder(soId);
  if (!so) throw new Error("SO not found");
  const shortages: { product_id: string; name: string; available: number; needed: number }[] = [];
  for (const it of so.items ?? []) {
    if (!it.product_id || it.quantity <= 0) continue;
    const { data: p } = await sb.from("products").select("id,name,stock").eq("id", it.product_id).maybeSingle();
    if (!p) continue;
    if ((p.stock ?? 0) < it.quantity) {
      shortages.push({ product_id: p.id, name: p.name, available: p.stock ?? 0, needed: it.quantity });
    }
  }
  return shortages;
}

/**
 * Deduct stock for a sales order. Idempotent: skips if already deducted.
 * If markFulfilled=true, sets status to "fulfilled". Otherwise keeps current status.
 */
export async function deductSalesOrderStock(id: string, markFulfilled: boolean, opts?: { allowNegative?: boolean }) {
  const so = await getSalesOrder(id);
  if (!so) throw new Error("SO not found");
  if (so.inventory_deducted_at) {
    // Already deducted — just update status flag if needed
    if (markFulfilled && so.status !== "fulfilled") {
      await sb
        .from("sales_orders")
        .update({ status: "fulfilled", fulfilled_date: new Date().toISOString().slice(0, 10) })
        .eq("id", id);
    }
    return;
  }

  if (!opts?.allowNegative) {
    const shortages = await validateSalesOrderStock(id);
    if (shortages.length) {
      throw new Error(
        `Insufficient stock: ${shortages.map((s) => `${s.name} (need ${s.needed}, have ${s.available})`).join(", ")}`,
      );
    }
  }

  for (const it of so.items ?? []) {
    if (!it.product_id || it.quantity <= 0) continue;
    await sb.from("inventory_movements").insert({
      product_id: it.product_id,
      type: "remove",
      quantity: it.quantity,
      note: `[so-fulfill] ${so.so_number}`,
    });
  }

  const update: any = {
    inventory_deducted_at: new Date().toISOString(),
    inventory_reversed_at: null,
  };
  if (markFulfilled) {
    update.status = "fulfilled";
    update.fulfilled_date = new Date().toISOString().slice(0, 10);
  }
  await sb.from("sales_orders").update(update).eq("id", id);
}

/** Reverse inventory deduction for a sales order (used on cancellation). Idempotent. */
export async function reverseSalesOrderStock(id: string) {
  const so = await getSalesOrder(id);
  if (!so) throw new Error("SO not found");
  if (!so.inventory_deducted_at || so.inventory_reversed_at) return;
  for (const it of so.items ?? []) {
    if (!it.product_id || it.quantity <= 0) continue;
    await sb.from("inventory_movements").insert({
      product_id: it.product_id,
      type: "add",
      quantity: it.quantity,
      note: `[so-reverse] ${so.so_number}`,
    });
  }
  await sb
    .from("sales_orders")
    .update({ inventory_reversed_at: new Date().toISOString() })
    .eq("id", id);
}

/** Backward-compatible alias: confirm/fulfill the SO and deduct stock. */
export async function fulfillSalesOrder(id: string) {
  await deductSalesOrderStock(id, true);
}

export async function confirmSalesOrder(id: string) {
  await deductSalesOrderStock(id, false);
  await sb.from("sales_orders").update({ status: "confirmed" }).eq("id", id);
}

export async function cancelSalesOrder(id: string) {
  await reverseSalesOrderStock(id);
  await sb.from("sales_orders").update({ status: "cancelled" }).eq("id", id);
}

export async function updateSOStatus(id: string, status: SOStatus) {
  if (status === "cancelled") {
    await cancelSalesOrder(id);
    return;
  }
  if (status === "fulfilled") {
    await fulfillSalesOrder(id);
    return;
  }
  if (status === "confirmed") {
    await confirmSalesOrder(id);
    return;
  }
  const { error } = await sb.from("sales_orders").update({ status }).eq("id", id);
  if (error) throw error;
}

// ---------------- Transfer Orders ----------------
export async function listTransferOrders(): Promise<TransferOrder[]> {
  const { data, error } = await sb
    .from("transfer_orders")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getTransferOrder(id: string): Promise<TransferOrder | null> {
  const { data, error } = await sb
    .from("transfer_orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: items } = await sb
    .from("transfer_order_items")
    .select("*")
    .eq("transfer_order_id", id);
  return { ...data, items: items ?? [] };
}

export async function createTransferOrder(input: {
  from_location: string;
  to_location: string;
  transfer_date: string | null;
  notes: string | null;
  items: TransferItem[];
  status: TransferStatus;
}) {
  const { data: t, error } = await sb
    .from("transfer_orders")
    .insert({
      transfer_number: genNumber("TR"),
      from_location: input.from_location,
      to_location: input.to_location,
      transfer_date: input.transfer_date,
      notes: input.notes,
      status: input.status,
    })
    .select()
    .single();
  if (error) throw error;
  if (input.items.length) {
    const rows = input.items.map((i) => ({
      transfer_order_id: t.id,
      product_id: i.product_id,
      sku: i.sku,
      barcode: i.barcode,
      product_name: i.product_name,
      quantity: i.quantity,
    }));
    const { error: iErr } = await sb.from("transfer_order_items").insert(rows);
    if (iErr) throw iErr;
  }
  if (input.status === "completed") {
    await completeTransferOrder(t.id);
  }
  return t as TransferOrder;
}

export async function completeTransferOrder(id: string) {
  const t = await getTransferOrder(id);
  if (!t) throw new Error("Transfer not found");
  if (t.status === "completed") return;
  for (const it of t.items ?? []) {
    if (!it.product_id || it.quantity <= 0) continue;
    // Remove from source
    await sb.from("inventory_movements").insert({
      product_id: it.product_id,
      type: "remove",
      quantity: it.quantity,
      note: `[transfer-out] ${t.transfer_number} ${t.from_location} → ${t.to_location}`,
    });
    // Add to destination
    await sb.from("inventory_movements").insert({
      product_id: it.product_id,
      type: "add",
      quantity: it.quantity,
      note: `[transfer-in] ${t.transfer_number} ${t.from_location} → ${t.to_location}`,
    });
  }
  await sb
    .from("transfer_orders")
    .update({
      status: "completed",
      completed_date: new Date().toISOString().slice(0, 10),
    })
    .eq("id", id);
}

export async function updateTransferStatus(id: string, status: TransferStatus) {
  const { error } = await sb.from("transfer_orders").update({ status }).eq("id", id);
  if (error) throw error;
}

// ---------------- Internal Use ----------------
export const INTERNAL_DEPARTMENTS = [
  "Warehouse",
  "Office",
  "Maintenance",
  "Cleaning",
  "Shipping",
  "Operations",
  "Other",
];
export const INTERNAL_REASONS = [
  "Internal Use",
  "Maintenance",
  "Cleaning",
  "Packaging",
  "Testing",
  "Sample",
  "Damage",
  "Employee Use",
  "Other",
];

export async function createInternalUse(input: {
  product_id: string;
  quantity: number;
  department: string;
  reason: string;
  notes: string | null;
}) {
  if (input.quantity <= 0) throw new Error("Quantity must be greater than 0");
  const note = `[internal_use] dept=${input.department} | reason=${input.reason}${
    input.notes ? ` | ${input.notes}` : ""
  }`;
  const { error } = await sb.from("inventory_movements").insert({
    product_id: input.product_id,
    type: "remove",
    quantity: input.quantity,
    note,
  });
  if (error) throw error;
}

export async function listInternalUse() {
  const { data, error } = await sb
    .from("transaction_history")
    .select("*")
    .eq("source", "internal_use")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return data ?? [];
}
