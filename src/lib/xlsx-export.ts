import * as XLSX from "xlsx";
import type { Product } from "./inventory";
import type { TransactionRow } from "./history";

export function exportProductsXlsx(products: Product[]) {
  const rows = products.map((p) => ({
    Name: p.name,
    SKU: p.sku,
    Barcode: p.barcode ?? "",
    Category: p.category ?? "",
    Supplier: p.supplier ?? "",
    Location: p.location ?? "",
    Stock: p.stock,
    "Min Stock": p.min_stock,
    Cost: Number(p.cost),
    Price: Number(p.price),
    "Inventory Value": Number(p.cost) * p.stock,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventory");
  XLSX.writeFile(wb, `inventory-${Date.now()}.xlsx`);
}

export function exportHistoryXlsx(rows: TransactionRow[]) {
  const data = rows.map((r) => ({
    Date: new Date(r.created_at).toLocaleString(),
    Type: r.type,
    Source: r.source,
    Product: r.product_name ?? "",
    SKU: r.sku ?? "",
    Barcode: r.barcode ?? "",
    Qty: r.quantity_change ?? "",
    Previous: r.previous_stock ?? "",
    New: r.new_stock ?? "",
    Reason: r.reason ?? "",
    User: r.user_email ?? "",
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "History");
  XLSX.writeFile(wb, `history-${Date.now()}.xlsx`);
}
