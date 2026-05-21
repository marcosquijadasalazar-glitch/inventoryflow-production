import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { MovementWithProduct } from "./inventory";
import type { CompanySettings } from "./settings";

const dt = (s: string) => new Date(s).toLocaleString();

function toRows(movements: MovementWithProduct[]) {
  return movements.map((m) => ({
    Date: dt(m.created_at),
    Type: m.type,
    Product: m.products?.name ?? "",
    SKU: m.products?.sku ?? "",
    Barcode: m.products?.barcode ?? "",
    Category: m.products?.category ?? "",
    Supplier: m.products?.supplier ?? "",
    Location: m.products?.location ?? "",
    Quantity: m.quantity,
    Reason: m.note ?? "",
  }));
}

function escape(v: any) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportMovementsCsv(movements: MovementWithProduct[]) {
  const rows = toRows(movements);
  const headers = Object.keys(rows[0] ?? {
    Date: "", Type: "", Product: "", SKU: "", Barcode: "", Category: "",
    Supplier: "", Location: "", Quantity: "", Reason: "",
  });
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape((r as any)[h])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `movements-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportMovementsXlsx(movements: MovementWithProduct[]) {
  const rows = toRows(movements);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Movements");
  XLSX.writeFile(wb, `movements-${Date.now()}.xlsx`);
}

export async function exportMovementsPdf(
  movements: MovementWithProduct[],
  settings: CompanySettings | null,
) {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(settings?.company_name ?? "InventoryFlow", 40, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100);
  const sub = [settings?.address, settings?.phone, settings?.email]
    .filter(Boolean)
    .join(" · ");
  if (sub) doc.text(sub, 40, 65);
  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Inventory Movements", 40, 100);
  doc.setDrawColor(220);
  doc.line(40, 108, 800, 108);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleString()}`, 40, 122);
  doc.setTextColor(20);

  autoTable(doc, {
    startY: 140,
    head: [[
      "Date", "Type", "Product", "SKU", "Barcode", "Category",
      "Supplier", "Location", "Qty", "Reason",
    ]],
    body: movements.map((m) => [
      dt(m.created_at),
      m.type,
      m.products?.name ?? "—",
      m.products?.sku ?? "—",
      m.products?.barcode ?? "—",
      m.products?.category ?? "—",
      m.products?.supplier ?? "—",
      m.products?.location ?? "—",
      String(m.quantity),
      m.note ?? "—",
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [40, 40, 60], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 246, 250] },
    margin: { left: 40, right: 40 },
  });

  if (settings?.footer_notes) {
    const pages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(settings.footer_notes, 40, 570);
    }
  }

  doc.save(`movements-${Date.now()}.pdf`);
}
